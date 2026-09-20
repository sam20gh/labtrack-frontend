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
    capabilities, isAvailable, type JstyleVariant,
} from '@/modules/jstyle-ble';
import type {
    HealthCapability, HealthReader, SyncBatch, SourceDevice,
} from '../types';
import * as transport from './transport';
import * as session from './session';
import * as map from './mapping';
import { getPaired, updatePaired, type PairedBracelet } from './store';

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
const readSince = async (cursor: string | null): Promise<SyncBatch> => {
    const paired = await getPaired();
    if (!paired) throw new Error('No bracelet is paired.');

    const { variant } = paired;
    const ctx: map.MapContext = { deviceId: paired.id, variant, device: deviceFor(paired) };
    const since = cursor ? new Date(cursor) : null;

    const batch: SyncBatch = {
        platform: 'jstyle_bracelet',
        tzOffset: new Date().getTimezoneOffset(),
        // The next cursor is *now*, written only because this read is about to succeed.
        cursor: new Date().toISOString(),
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
        await session.ask(variant, 'setDeviceTime');

        const battery = map.readBattery((await session.ask(variant, 'getBattery')).packets);
        if (battery !== null) await updatePaired({ lastBattery: battery });

        const read = (command: Parameters<typeof session.readSeries>[1]) =>
            session.readSeries(variant, command);

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
    } finally {
        // Always, including on the failure path. A connection left open keeps the radio hot
        // and stops the next sync connecting at all, because these bracelets accept exactly
        // one central at a time.
        await transport.disconnect();
        session.reset(variant);
    }

    await updatePaired({ lastSyncAt: batch.cursor ?? undefined });
    return since ? dropOlderThan(batch, since) : batch;
};

/**
 * Drop what the server has already seen.
 *
 * Purely bandwidth. Every row carries a deterministic `externalId` and the server upserts,
 * so re-posting an old row is harmless — which is why this filters rather than tracking
 * what was sent, and why losing the cursor costs nothing but a larger POST.
 *
 * Day rows are deliberately **not** filtered: a day's totals keep changing until the day is
 * over, so the last thing a sync should do is stop re-sending today because it sent it an
 * hour ago.
 */
const dropOlderThan = (batch: SyncBatch, since: Date): SyncBatch => {
    const after = (iso: string) => new Date(iso).getTime() >= since.getTime();
    return {
        ...batch,
        activities: batch.activities.filter((r) => after(r.startedAt)),
        sleep: batch.sleep.filter((r) => after(r.endedAt)),
        heart: batch.heart.filter((r) => after(r.measuredAt)),
        spo2: batch.spo2?.filter((r) => after(r.measuredAt)),
        temperature: batch.temperature?.filter((r) => after(r.measuredAt)),
        bloodPressure: batch.bloodPressure?.filter((r) => after(r.measuredAt)),
        ecg: batch.ecg?.filter((r) => after(r.measuredAt)),
    };
};

/**
 * Tell the bracelet it may free what was just read.
 *
 * **Called only after `/api/wearables/sync` has answered.** The bracelet is the only copy
 * until then, so acknowledging early turns every failed upload — a train, a tunnel, a
 * flaky connection — into permanent data loss.
 *
 * Kept off `HealthReader` on purpose. No other reader has a step that destroys data on the
 * source, and putting one on the shared interface would invite a future reader to implement
 * it because the slot was there.
 */
export const acknowledgeSynced = async (): Promise<void> => {
    const paired = await getPaired();
    if (!paired || !transport.isConnected()) return;

    for (const command of ['getTotalActivity', 'getDetailSleep', 'getStaticHr'] as const) {
        await session.acknowledge(paired.variant, command);
    }
};

export const reader: HealthReader = { probe, requestPermissions, readSince };
