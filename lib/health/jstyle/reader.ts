/**
 * The bracelet as a `HealthReader`.
 *
 * Same three methods as the HealthKit and Health Connect readers, so `lib/health/sync.ts`
 * drives all three identically. What it does underneath is completely different — it opens
 * a radio connection and holds a conversation — but none of that reaches the interface,
 * which is the point of the interface.
 *
 * ## The cursor is a date, and it is only an optimisation
 *
 * HealthKit hands back an anchor and Health Connect a changes token; a bracelet has
 * neither. What it has is a ring buffer of a few weeks that it replays from the start every
 * time. So the cursor here is simply the instant of the last successful read, used to drop
 * records older than that before they are posted. Losing it costs bandwidth and nothing
 * else: every row carries a deterministic `externalId`, so the server upserts and a full
 * replay is idempotent.
 */
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
    getPaired, updatePaired, type ClockReading, type LatestReadings, type PairedBracelet, type Stamped,
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

/** What to call each model on screen. The vendor's own names. */
export const VARIANT_LABEL: Record<JstyleVariant, string> = {
    j2208a: 'J-Style 2208A',
    v8: 'J-Style V8',
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
    await release();

    const batch: SyncBatch = {
        platform: 'jstyle_bracelet',
        tzOffset: new Date().getTimezoneOffset(),
        // The next cursor is *now*, written only because this read is about to succeed.
        cursor: `${CURSOR_VERSION}:${readAt}`,
        providerLabel: VARIANT_LABEL[variant],
        permissions: capabilities(variant).commands,
        devices: [{ ...deviceFor(paired), lastSeenAt: new Date().toISOString() }],
        activities: [], sleep: [], heart: [], days: [],
        spo2: [], temperature: [], bloodPressure: [], ecg: [],
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

        const sent = new Map<SeriesCommand, Set<string>>();
        const read = async (command: SeriesCommand) => {
            const result = await session.readSeries(variant, command);
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
    // The POST that carried any clock reading live view kept has landed.
    await updatePaired({ unreportedClock: undefined });
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
