/**
 * The bracelet as a `HealthReader`.
 *
 * Same three methods as the HealthKit and Health Connect readers, so `lib/health/sync.ts`
 * drives all three identically. What it does underneath is completely different — it opens
 * a radio connection and holds a conversation — but none of that reaches the interface,
 * which is the point of the interface.
 *
 * ## Where a read starts
 *
 * HealthKit hands back an anchor and Health Connect a changes token; a bracelet has
 * neither. What it has is a ring buffer of a few weeks. The series a sync deletes are small
 * by the next sync; the four it never deletes (`INCREMENTAL`) are read from a start date
 * once the band has proved it honours one, and replayed in full otherwise. Losing any of
 * that costs time and nothing else: every row carries a deterministic `externalId`, so the
 * server upserts and a full replay is idempotent.
 */
import { Platform } from 'react-native';

import {
    capabilities, isAvailable, supports, type JstylePacket, type JstyleVariant,
} from '@/modules/jstyle-ble';
import type {
    HealthCapability, HealthReader, SyncBatch, SourceDevice,
} from '../types';
import * as transport from './transport';
import * as session from './session';
import * as map from './mapping';
import {
    getPaired, updatePaired, type ClockReading, type LatestReadings, type PairedBracelet,
    type SeriesCursor, type Stamped,
} from './store';
import { isLive } from './live';
import { checkAndSetClock, isWrong, readClock } from './clock';

/**
 * The bracelet's own timed readings, switched on once per pairing.
 *
 * Without this a band takes no spot readings between syncs — only the continuous heart
 * stream, which is a day's spread and has no resting figure — so the Health Metrics card
 * had nothing newer than a phone reading to show. Heart rate every ten minutes is what the
 * vendor app ships with; SpO2 hourly because a reading is a thirty-second optical sweep and
 * doing it more often is most of the battery.
 *
 * Wrist temperature every thirty minutes is for the cycle tracker: the server takes the
 * median of the readings inside each night's sleep (`utils/nightTemperature.js`), which needs
 * roughly a dozen a night to be steadier than the sensor's noise. Both codecs already encoded
 * `'temperature'`; it was simply never switched on. **Its battery cost is not documented by
 * the vendor** — measure it on a band before release, and lengthen the interval rather than
 * drop it if it is too high.
 */
const MONITORING: { monitor: 'hr' | 'spo2' | 'temperature'; intervalMinutes: number }[] = [
    { monitor: 'hr', intervalMinutes: 10 },
    { monitor: 'spo2', intervalMinutes: 60 },
    { monitor: 'temperature', intervalMinutes: 30 },
];

/**
 * Bump when `MONITORING` changes. A band paired before the version existed carries only
 * `monitoringSetAt` and counts as version 1, so it is set up again on its next sync — without
 * this, adding temperature would have reached only bands paired from now on.
 */
const MONITORING_VERSION = 2;

export const LABEL = 'Health bracelet';

/**
 * What the V8 is called, on screen and over the air. It ships as JCVital's `JCV8B…`; the
 * first sync renames the band itself to this, so every later scan — on any phone — lists it
 * under our name. At most 14 ASCII characters: the firmware keeps no more.
 */
export const BAND_NAME = 'Predyqt 2';

/** What to call each model on screen. The 2208A keeps the vendor's name; the V8 is ours. */
export const VARIANT_LABEL: Record<JstyleVariant, string> = {
    j2208a: 'J-Style 2208A',
    v8: BAND_NAME,
};

/**
 * What this device can do right now.
 *
 * Three separate "no" answers, and they are not interchangeable — each one names something
 * different the person can do about it. A single "unavailable" would leave somebody with a
 * charged bracelet in their hand toggling settings at random.
 */
const probe = async (): Promise<HealthCapability> => {
    if (!isAvailable() || !transport.isBleBuild()) {
        return {
            platform: 'jstyle_bracelet',
            available: false,
            granted: false,
            reason: 'Bracelet support is not in this version of the app yet.',
            needsAppUpdate: true,
        };
    }

    const blocked = await transport.scanBlockedReason();
    if (blocked) {
        return { platform: 'jstyle_bracelet', available: false, granted: false, reason: blocked };
    }

    const paired = await getPaired();
    if (!paired) {
        return {
            platform: 'jstyle_bracelet',
            available: true,
            granted: false,
            reason: 'No bracelet paired yet.',
        };
    }

    return {
        platform: 'jstyle_bracelet',
        available: true,
        granted: true,
        // Named per bracelet rather than per family: the V8 reads no axillary temperature,
        // and a screen that knows that can leave the card out instead of drawing an empty
        // chart. `lib/health/types.ts` calls a partial grant normal, and this is the
        // bracelet's version of one.
        scopes: ['activity', 'sleep', 'heart'],
        devices: [{
            name: paired.label,
            model: VARIANT_LABEL[paired.variant],
            manufacturer: 'J-Style',
            lastSeenAt: paired.lastSyncAt,
        }],
    };
};

/**
 * There is no permission to request, so this is pairing or nothing.
 *
 * Bluetooth permission itself is handled by the OS on the first scan, which happens on the
 * pairing screen. Returning `probe()` here keeps `lib/health/sync.ts` working unchanged:
 * its contract is "ask, then tell me what I may read", and the honest answer for an
 * unpaired bracelet is that there is nothing to read yet.
 */
const requestPermissions = probe;

const deviceFor = (paired: PairedBracelet): SourceDevice => ({
    name: paired.label,
    model: VARIANT_LABEL[paired.variant],
    manufacturer: 'J-Style',
});

/**
 * Read everything the bracelet is holding.
 *
 * Series are read **one at a time and in order**, never concurrently, because the vendor
 * codec keeps its decode state in static fields — `session.ts` holds the mutex that makes
 * that safe, and this loop is what feeds it.
 *
 * A series that fails does not fail the sync. A bracelet that disconnects halfway through
 * sleep has still given up its activity, and posting what arrived beats discarding it to
 * report a clean failure — the caller sees a shorter batch, and the rows it does not
 * contain are still on the device for next time.
 */
/**
 * The version written into the cursor.
 *
 * The cursor no longer filters anything — see `acknowledgeSynced`: once a sync can delete
 * from the bracelet, every row it read has to be posted, because a row read, filtered out
 * and then deleted is gone. The bracelet is freed after each sync, so the replay is only
 * what is new anyway. `v2` is kept in the string so a cursor records which reader wrote it;
 * the v1 filter is how build 23's discarded SpO2 history sat unsent behind it.
 */
const CURSOR_VERSION = 'v2';

// ── acknowledgement ─────────────────────────────────────────────────────────

type SeriesCommand = Parameters<typeof session.readSeries>[1];

/**
 * The only series a sync ever deletes from the bracelet: each record is one reading at one
 * instant, stored as its own row under its own `externalId`, so once the server has a row
 * nothing is lost by the bracelet forgetting it.
 *
 * Everything else stays on the bracelet, deliberately:
 *
 * - **Day totals, continuous heart rate, HRV** are reduced to one figure *per day* before
 *   they are sent, and the server `$set`s it. The bracelet's delete wipes the whole series,
 *   today's partial record included, so the next sync would send an afternoon and overwrite
 *   the full day with it.
 * - **Sleep** — a delete mid-night splits the night in two, and the ingest keeps only the
 *   longer half (`healthSync.sameNight`).
 *
 * Those buffers roll over on their own, overwriting records synced dozens of times, so
 * leaving them costs a larger replay and nothing else.
 */
const MAPPERS: Partial<Record<SeriesCommand, (packets: JstylePacket[], ctx: map.MapContext) => { externalId: string }[]>> = {
    getDetailActivity: (p, ctx) => map.toActivities(p, ctx),
    getStaticHr: (p, ctx) => map.toHeart(p, ctx),
    getAutoSpo2: (p, ctx) => map.toSpo2(p, ctx, 'automatic'),
    getManualSpo2: (p, ctx) => map.toSpo2(p, ctx, 'manual'),
    getTemperature: (p, ctx) => map.toTemperature(p, ctx, 'wrist'),
    getAxillaryTemperature: (p, ctx) => map.toTemperature(p, ctx, 'axillary'),
};

// ── incremental reads ───────────────────────────────────────────────────────

/**
 * The series a sync never deletes, and so the ones that replay weeks on every read.
 *
 * Both SDKs take a start date on every history command, and every demo passes an empty one.
 * Reading these four from a date is what turns a sync of minutes into seconds. The deletable
 * series (`MAPPERS`) are deliberately not here: they are emptied by every acknowledged sync,
 * and `acknowledgeSynced` re-reads them whole before deleting, which a partial read would
 * make refuse every time.
 */
const INCREMENTAL: SeriesCommand[] = ['getTotalActivity', 'getDetailSleep', 'getDynamicHr', 'getHrv'];

/**
 * Bump to make every band prove its start dates again — after a change to how the date is
 * written, or to what counts as proof.
 */
const INCREMENTAL_VERSION = 1;

/**
 * A full replay at least this often, whatever the band has proved.
 *
 * The safety net under everything below: a record stamped while the band's clock was wrong
 * can sit before any start date, and a cursor that is wrong for a reason nobody has thought
 * of yet costs a day at most.
 */
const FULL_READ_EVERY_MS = 24 * 60 * 60 * 1000;

/** A stamp later than this past now is a wrong clock, and never becomes the cursor. */
const FUTURE_SLACK_MS = 10 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where an incremental read starts: **the local midnight before the newest record held.**
 *
 * Whole days, because three of the four series are reduced to one figure per day before
 * they are posted (`toDays`, `toHeartDays`, `toHrvDays`) and the server `$set`s it. A read
 * starting at 10:00 would post this morning's average as the whole day's. The day before
 * as well, so a night that started before midnight comes back whole, and a band clock a few
 * hours out still lands inside the window.
 */
export const incrementalStart = (newestIso: string): Date => {
    const newestAt = new Date(newestIso);
    const midnight = new Date(newestAt.getFullYear(), newestAt.getMonth(), newestAt.getDate());
    return new Date(midnight.getTime() - DAY_MS);
};

/**
 * The start date in the form each SDK reads.
 *
 * The Android jars split `yyyy-MM-dd HH:mm:ss` and write the numbers as they are — the
 * band's clock is phone-local, so the string is too. The iOS codec parses ISO 8601 with
 * `ISO8601DateFormatter`, whose default refuses fractional seconds, so `toISOString()` as it
 * comes would parse to nil and read everything.
 */
export const startDateArg = (at: Date, os: string = Platform.OS): string => {
    if (os === 'ios') return at.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} `
        + `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
};

/** The newest stamp worth keeping as a cursor, or null. */
const newestStamp = (stamps: Date[], now: number): string | null => {
    const ms = stamps.map((d) => d.getTime()).filter((t) => t <= now + FUTURE_SLACK_MS);
    return ms.length ? new Date(Math.max(...ms)).toISOString() : null;
};

/**
 * Did the band honour the start date? Judged against a full read taken seconds earlier.
 *
 * - `verified`: the probe returned records, none before the start date, and every record
 *   the full read had from the start date on. A record newer than the full read's newest is
 *   allowed — the band can take a reading between the two.
 * - `unsupported`: the band ignored the date (older records came back) or sent nothing it
 *   should have. That band stays on full reads.
 * - `inconclusive`: the full read had nothing older than the start date, so a band that
 *   ignored it would look identical. The reader does not send a probe then at all, and asks
 *   again once the band holds more than two days.
 */
export const judgeProbe = (
    full: Date[], probe: Date[], from: Date,
): 'verified' | 'unsupported' | 'inconclusive' => {
    const start = from.getTime();
    const fullMs = full.map((d) => d.getTime());
    if (!fullMs.some((t) => t < start) || !fullMs.some((t) => t >= start)) return 'inconclusive';

    const probeMs = probe.map((d) => d.getTime());
    if (!probeMs.length || probeMs.some((t) => t < start)) return 'unsupported';

    const got = new Set(probeMs);
    const missing = fullMs.filter((t) => t >= start && !got.has(t));
    return missing.length ? 'unsupported' : 'verified';
};

/** Cursors this sync read, saved only once the server has the rows — see `acknowledgeSynced`. */
let pendingCursors: {
    incremental: Record<string, SeriesCursor>;
    fullRead: boolean;
    at: string;
} | null = null;

/** What one sync read and may delete once the server has it. */
interface PendingAck {
    variant: JstyleVariant;
    ctx: map.MapContext;
    /** Per deletable series: the ids of every row this read produced and the batch carries. */
    sent: Map<SeriesCommand, Set<string>>;
    /** The clock once the reads were done, kept for the next sync to report. */
    afterRead: ClockReading;
}

let pending: PendingAck | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;

/**
 * Whether a sync holds the bracelet, from the read until `release()`.
 *
 * Syncs now start on their own when the app comes to the front, so somebody can open live
 * view in the middle of one — and `transport.connect` drops whatever is open first, which
 * would cut the read off. `live.start` waits on `whenIdle` instead.
 */
let busy = false;
let idleWaiters: (() => void)[] = [];

const setIdle = () => {
    busy = false;
    const waiting = idleWaiters;
    idleWaiters = [];
    waiting.forEach((resolve) => resolve());
};

/** Resolves once no sync holds the bracelet, or after `maxMs` whatever happens. */
export const whenIdle = (maxMs = 60_000): Promise<void> => {
    if (!busy) return Promise.resolve();
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, maxMs);
        idleWaiters.push(() => { clearTimeout(timer); resolve(); });
    });
};

/**
 * What the last read heard back.
 *
 * An empty batch is three different facts, and the screen used to say "nothing new" for all
 * of them: the bracelet answered and had nothing, it never answered, or it answered in a
 * shape this build cannot read. The last is how the first iPhone sync spent a day reporting
 * "nothing new" over a bracelet full of data. Kept off `SyncBatch` because the server has no
 * use for it — it is about this phone's conversation with this bracelet.
 */
export interface ReadReport {
    /** Series this bracelet supports and was asked for. */
    asked: number;
    /** Of those, how many sent nothing at all before the timeout. */
    silent: number;
    /** Records that arrived with content and could not be read — see `map.unreadable`. */
    unreadable: number;
    /** Rows the read produced, across every family. Zero means nothing was posted. */
    rows: number;
    /** Every series read, how, and how long it took — the record of where a sync's time goes. */
    series: SeriesTiming[];
    /** Milliseconds from connecting to the end of the last read. */
    totalMs: number;
}

export interface SeriesTiming {
    command: string;
    /** `full`: the whole buffer. `since`: from a start date. `probe`: testing one. */
    how: 'full' | 'since' | 'probe';
    packets: number;
    ms: number;
    complete: boolean;
}

let lastReport: ReadReport | null = null;

/** The last read's report, or null when the last read failed or none has run. */
export const lastReadReport = (): ReadReport | null => lastReport;

/**
 * The line the bracelet screen shows after a sync that ran.
 *
 * `daysUpdated` is the server's answer and wins when it is non-zero. Otherwise the report
 * decides which of the three empty outcomes this was. "Still on the bracelet" is only said
 * when nothing was posted (`rows === 0`): the bracelet frees a series only after the server
 * has its rows, so with no POST nothing can have been deleted.
 */
export const describeSync = (daysUpdated: number, report: ReadReport | null): string => {
    if (daysUpdated) return `Synced — ${daysUpdated} day${daysUpdated === 1 ? '' : 's'} updated.`;
    if (report && report.rows === 0 && report.unreadable > 0) {
        return 'The bracelet sent data this version of Predyqt can\'t read yet. It is still on the '
            + 'bracelet, and an app update will bring it over.';
    }
    if (report && report.asked > 0 && report.silent === report.asked) {
        return 'The bracelet connected but didn\'t send its history. Keep it next to your phone '
            + 'and sync again.';
    }
    return 'Synced — the bracelet had nothing new since the last sync.';
};

/**
 * A read is only safe to act on when the bracelet said it was finished and every packet was
 * one this build understands. The SpO2 history decoded as `unknown` for a whole build; with
 * deletion switched on, that would have been every reading lost rather than merely unsent.
 */
const trustworthy = (result: session.ReadResult): boolean =>
    result.complete && !result.reason && result.packets.every((p) => p.type !== 'unknown');

/**
 * Let go of the bracelet. Called by `sync.ts` on every path once a bracelet sync is over,
 * and by the watchdog if that never happens — a held connection keeps the radio awake and
 * stops the next sync, or live view, connecting at all.
 */
export const release = async (): Promise<void> => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    const held = pending;
    pending = null;
    // Not sent, so not saved: the next read starts where this one did.
    pendingCursors = null;
    setIdle();
    // Live view may have taken the connection over meanwhile; it is not this sync's to close.
    if (isLive()) return;
    await transport.disconnect();
    if (held) session.reset(held.variant);
};

// The cursor is part of the `HealthReader` contract and filters nothing here — see
// `CURSOR_VERSION`.
const readSince = async (_cursor: string | null): Promise<SyncBatch> => {
    const paired = await getPaired();
    if (!paired) throw new Error('No bracelet is paired.');
    // The live view holds the one connection these bracelets allow, and a sync would
    // disconnect it mid-reading. The screen syncs itself when live view closes.
    if (isLive()) throw new Error('Live view is open — it will sync when you close it.');

    const { variant } = paired;
    const ctx: map.MapContext = { deviceId: paired.id, variant, device: deviceFor(paired) };
    const readAt = new Date().toISOString();
    lastReport = null;
    await release();
    busy = true;
    const report: ReadReport = { asked: 0, silent: 0, unreadable: 0, rows: 0, series: [], totalMs: 0 };
    const startedAt = Date.now();

    const batch: SyncBatch = {
        platform: 'jstyle_bracelet',
        tzOffset: new Date().getTimezoneOffset(),
        // The next cursor is *now*, written only because this read is about to succeed.
        cursor: `${CURSOR_VERSION}:${readAt}`,
        providerLabel: VARIANT_LABEL[variant],
        permissions: capabilities(variant).commands,
        devices: [{ ...deviceFor(paired), lastSeenAt: new Date().toISOString() }],
        activities: [], sleep: [], heart: [], days: [],
        spo2: [], temperature: [], bloodPressure: [], ecg: [], stress: [],
    };

    await transport.connect(
        paired.id,
        session.makePacketHandler(variant),
        () => session.reset(variant),
    );

    try {
        // Setting the clock first is not housekeeping. Every record the bracelet returns is
        // timestamped from its own clock, which drifts and resets to 1970 on a flat
        // battery, and a sync that corrected it afterwards would have already filed a
        // night's sleep in 1970. Cheap, and it fixes the next read rather than this one.
        // It is *read* before it is set: once set, nothing can show it was wrong, and what it
        // stamped meanwhile is still in this read. See `clock.ts`.
        const clockBefore = await checkAndSetClock(variant, { report: true });

        const battery = map.readBattery((await session.ask(variant, 'getBattery')).packets);
        if (battery !== null) await updatePaired({ lastBattery: battery });

        const monitoringVersion = paired.monitoringVersion ?? (paired.monitoringSetAt ? 1 : 0);
        if (monitoringVersion < MONITORING_VERSION && supports(variant, 'setAutoMonitoring')) {
            for (const setting of MONITORING) {
                await session.ask(variant, 'setAutoMonitoring', setting);
            }
            await updatePaired({ monitoringSetAt: new Date().toISOString(), monitoringVersion: MONITORING_VERSION });
        }

        // Written to the band's own memory, so it is sent once per name rather than on every
        // sync. Recorded whether or not the band acknowledges it: a band that never answers
        // this would otherwise cost every sync an eight-second wait. The next scan shows
        // whether it took — the band advertises the new name after it next restarts its radio.
        if (paired.nameSetTo !== BAND_NAME && supports(variant, 'setDeviceName')) {
            await session.ask(variant, 'setDeviceName', { name: BAND_NAME },
                (packet) => packet.type === 'deviceNameSet');
            await updatePaired({ nameSetTo: BAND_NAME, label: BAND_NAME });
        }

        const sent = new Map<SeriesCommand, Set<string>>();
        const timed = async (command: SeriesCommand, how: SeriesTiming['how'], startDate?: Date) => {
            const t0 = Date.now();
            const result = await session.readSeries(variant, command,
                startDate ? { startDate: startDateArg(startDate) } : {});
            if (supports(variant, command)) {
                report.series.push({
                    command, how, packets: result.packets.length, ms: Date.now() - t0, complete: result.complete,
                });
            }
            return result;
        };

        /**
         * Whether this sync replays the never-deleted series in full. Always after a wrong
         * clock: what it stamped meanwhile can sit before any start date.
         */
        const now = Date.now();
        const sameVersion = paired.incrementalVersion === INCREMENTAL_VERSION;
        const fullRead = !sameVersion || isWrong(clockBefore) || !paired.lastFullReadAt
            || now - Date.parse(paired.lastFullReadAt) > FULL_READ_EVERY_MS;
        const cursors: Record<string, SeriesCursor> = sameVersion ? { ...(paired.incremental ?? {}) } : {};

        const read = async (command: SeriesCommand) => {
            const cursor = cursors[command];
            const incremental = INCREMENTAL.includes(command) && supports(variant, command);
            const since = incremental && !fullRead && cursor?.verdict === 'verified' && cursor.newest
                ? incrementalStart(cursor.newest)
                : undefined;

            const result = await timed(command, since ? 'since' : 'full', since);
            if (supports(variant, command)) {
                report.asked += 1;
                if (!result.packets.length) report.silent += 1;
                report.unreadable += map.unreadable(result.packets);
            }

            if (incremental && result.complete) {
                const stamps = map.recordStamps(result.packets);
                const newestNow = newestStamp(stamps, now);
                const next: SeriesCursor = { verdict: cursor?.verdict ?? 'unverified' };
                // A full read is the truth about where the series ends; a partial one can only
                // move the cursor forward.
                next.newest = since
                    ? [cursor?.newest, newestNow].filter((v): v is string => !!v).sort().pop()
                    : newestNow ?? undefined;

                const from = next.newest ? incrementalStart(next.newest) : null;
                // With nothing older than the start date, a band that ignored it would answer
                // exactly as one that honoured it, so a probe could prove nothing.
                if (!since && next.verdict === 'unverified' && from
                    && stamps.some((d) => d.getTime() < from.getTime())) {
                    const probe = await timed(command, 'probe', from);
                    const verdict = judgeProbe(stamps, map.recordStamps(probe.packets), from);
                    console.log(`🧪 ${command}: start date ${startDateArg(from)} → ${verdict}`);
                    if (verdict !== 'inconclusive') next.verdict = verdict;
                }
                cursors[command] = next;
            }
            const mapper = MAPPERS[command];
            if (mapper && result.packets.length && trustworthy(result)) {
                sent.set(command, new Set(mapper(result.packets, ctx).map((r) => r.externalId)));
            }
            return result;
        };

        batch.days.push(...map.toDays((await read('getTotalActivity')).packets));
        batch.activities.push(...map.toActivities((await read('getDetailActivity')).packets, ctx));
        batch.sleep.push(...map.toSleep((await read('getDetailSleep')).packets, ctx));
        batch.heart.push(...map.toHeart((await read('getStaticHr')).packets, ctx));
        batch.days.push(...map.toHeartDays((await read('getDynamicHr')).packets));

        const hrv = await read('getHrv');
        batch.days.push(...map.toHrvDays(hrv.packets));
        batch.bloodPressure!.push(...map.toBloodPressure(hrv.packets, ctx));
        // Stress rides in the HRV records. Each is its own row under its own id, but `getHrv`
        // stays out of `MAPPERS`: deleting the series would also take the day's HRV average.
        batch.stress!.push(...map.toStress(hrv.packets, ctx));

        batch.spo2!.push(...map.toSpo2((await read('getAutoSpo2')).packets, ctx, 'automatic'));
        batch.spo2!.push(...map.toSpo2((await read('getManualSpo2')).packets, ctx, 'manual'));

        batch.temperature!.push(
            ...map.toTemperature((await read('getTemperature')).packets, ctx, 'wrist'),
        );
        batch.temperature!.push(
            ...map.toTemperature((await read('getAxillaryTemperature')).packets, ctx, 'axillary'),
        );

        // The connection stays open through the POST, so the delete can follow the server's
        // answer without a reconnect — and so the only readings that can appear between the
        // read and the delete are ones the bracelet takes in those seconds, which the
        // re-read in `acknowledgeSynced` catches. Two minutes is the ceiling on holding it.
        report.totalMs = Date.now() - startedAt;
        console.log(`⌚ Bracelet read in ${(report.totalMs / 1000).toFixed(1)}s — `
            + report.series.map((t) => `${t.command}${t.how === 'full' ? '' : `[${t.how}]`} `
                + `${t.packets}p ${(t.ms / 1000).toFixed(1)}s`).join(', '));
        pendingCursors = { incremental: cursors, fullRead, at: new Date(now).toISOString() };

        const afterRead = await readClock(variant);
        // Live view sets the clock too. If it found the clock wrong since the last sync, that
        // reading is the evidence, and this sync's own merely says the set worked.
        const found = !isWrong(clockBefore) && paired.unreportedClock
            ? paired.unreportedClock
            : clockBefore;
        batch.clock = {
            deviceId: paired.id,
            bandAt: found.bandAt,
            phoneAt: found.phoneAt,
            lastSetAt: found.lastSetAt,
            afterRead,
            previous: paired.lastClockCheck ?? null,
        };

        pending = { variant, ctx, sent, afterRead };
        watchdog = setTimeout(() => { void release(); }, 120_000);
    } catch (err) {
        // A failed read acknowledges nothing and holds nothing.
        await release();
        session.reset(variant);
        throw err;
    }

    await updatePaired({ lastSyncAt: readAt, latest: latestOf(batch, paired.latest) });
    report.rows = batch.activities.length + batch.sleep.length + batch.heart.length
        + batch.days.length + (batch.spo2?.length ?? 0) + (batch.temperature?.length ?? 0)
        + (batch.bloodPressure?.length ?? 0) + (batch.ecg?.length ?? 0)
        + (batch.stress?.length ?? 0);
    lastReport = report;
    return batch;
};

/** The newest of `rows` by `at`, or the one already held when that is newer. */
const newest = <R, T>(
    rows: R[] | undefined, at: (r: R) => string, value: (r: R) => T, held?: Stamped<T>,
): Stamped<T> | undefined => {
    let best = held;
    for (const row of rows ?? []) {
        const when = at(row);
        if (!best || when > best.at) best = { value: value(row), at: when };
    }
    return best;
};

/**
 * The newest reading of each family.
 *
 * Merged with what was held rather than replacing it, because the bracelet frees what an
 * acknowledged sync read, and the next replay can be empty of a family it measured
 * yesterday. Losing yesterday's SpO2 from the screen because nothing new arrived would be
 * the screen forgetting, not the bracelet.
 */
const latestOf = (batch: SyncBatch, held: LatestReadings = {}): LatestReadings => ({
    heartRate: newest(batch.heart, (r) => r.measuredAt, (r) => r.bpm, held.heartRate),
    spo2: newest(batch.spo2, (r) => r.measuredAt, (r) => r.spo2, held.spo2),
    temperature: newest(
        batch.temperature?.filter((r) => r.site === 'wrist'),
        (r) => r.measuredAt, (r) => r.celsius, held.temperature,
    ),
    hrv: newest(
        batch.days.filter((d) => d.hrvMs != null), (d) => d.day, (d) => d.hrvMs!, held.hrv,
    ),
    bloodPressure: newest(
        batch.bloodPressure, (r) => r.measuredAt,
        (r) => ({ systolic: r.systolic, diastolic: r.diastolic }), held.bloodPressure,
    ),
    steps: newest(
        batch.days.filter((d) => d.steps != null), (d) => d.day, (d) => d.steps!, held.steps,
    ),
});

/**
 * Tell the bracelet it may free what the server now holds.
 *
 * **Called only after `/api/wearables/sync` has answered** — the server has written the rows
 * by then; before it, the bracelet is the only copy, and acknowledging early turns every
 * failed upload into permanent loss.
 *
 * The vendor's delete takes no range: it wipes the **whole** series. So each series is read
 * once more first, and deleted only when everything it now holds is a row this sync sent. A
 * reading taken while the POST was in flight fails that check, the series is left alone,
 * and the next sync sends it — the one outcome this must never have is a reading deleted
 * without having been sent. Series outside `MAPPERS` are never deleted; see there for why.
 *
 * Always releases the bracelet, whether or not anything was deleted.
 *
 * Kept off `HealthReader` on purpose. No other reader has a step that destroys data on the
 * source, and putting one on the shared interface would invite a future reader to implement
 * it because the slot was there.
 */
export const acknowledgeSynced = async (): Promise<void> => {
    const plan = pending;
    // The POST that carried any clock reading live view kept has landed — and with it every
    // row behind this read's cursors, which is the only moment they may be saved. Saved
    // earlier, a failed POST would leave the next read starting past rows nobody received.
    const cursors = pendingCursors;
    pendingCursors = null;
    await updatePaired({
        unreportedClock: undefined,
        ...(cursors ? {
            incremental: cursors.incremental,
            incrementalVersion: INCREMENTAL_VERSION,
            ...(cursors.fullRead ? { lastFullReadAt: cursors.at } : {}),
        } : {}),
    });
    try {
        // Nothing is deleted over a connection this sync did not open and hold throughout —
        // live view taking the bracelet over mid-POST is the case this catches.
        if (!plan || isLive() || transport.connectedId() !== plan.ctx.deviceId) return;

        for (const [command, sentIds] of plan.sent) {
            if (!sentIds.size) continue;
            const again = await session.readSeries(plan.variant, command);
            if (!trustworthy(again)) continue;

            const nowHeld = MAPPERS[command]!(again.packets, plan.ctx).map((r) => r.externalId);
            const unsent = nowHeld.filter((id) => !sentIds.has(id));
            if (unsent.length) {
                console.log(`🔁 ${command}: ${unsent.length} new since the read — kept for next sync`);
                continue;
            }
            await session.acknowledge(plan.variant, command);
        }

        // Once more after the deletes, so the next sync can say whether this one left the
        // clock wrong. See `clock.ts`.
        const afterAck = await readClock(plan.variant);
        await updatePaired({
            lastClockCheck: { at: new Date().toISOString(), afterRead: plan.afterRead, afterAck },
        });
    } finally {
        await release();
    }
};

export const reader: HealthReader = { probe, requestPermissions, readSince };
