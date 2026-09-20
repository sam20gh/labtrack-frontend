/**
 * Running a sync, from the app's point of view.
 *
 * One function, because every caller wants the same thing: read whatever the device has
 * that the server has not seen, post it, and hand back the cursor. The cursor lives on the
 * server (`ConnectedSource.lastSyncCursor`) rather than in AsyncStorage, so a reinstall
 * resumes incrementally instead of re-reading three months of samples.
 *
 * **Failure here is never fatal to a screen.** A sync that cannot run is a dashboard that
 * shows what it already has, not an error state — the person's own logged activities are
 * still theirs. So `runSync` resolves with a result object rather than throwing, and the
 * only thing a caller has to decide is whether to mention it.
 */
import { getWearableStatus, syncBatch } from '@/lib/activity';
import { probe, readSince, sources } from './index';
import type { HealthPlatform } from './types';

export interface SyncResult {
    ran: boolean;
    /** Days the server says changed, so a screen knows whether to refetch. */
    daysUpdated: string[];
    counts?: { activities: number; sleep: number; heart: number; days: number };
    /** Present when the sync did not run or did not finish. Written to be shown. */
    reason?: string;
    platform?: HealthPlatform | null;
    /**
     * One entry per source that was tried.
     *
     * A phone can now have two at once — the OS health store and a paired bracelet — and
     * they fail independently: a bracelet out of range says nothing about whether Health
     * Connect synced. The flattened fields above are the aggregate, kept so the four
     * screens that already read `ran` and `daysUpdated` did not have to change.
     */
    perSource?: { platform: HealthPlatform; ran: boolean; reason?: string; days: number }[];
}

/**
 * A sync is skipped if one ran within this window.
 *
 * The dashboard, history and session screens all refetch on focus, and moving between them
 * should not re-read the health store each time. Two minutes is short enough that a workout
 * finished mid-session still appears, and long enough that navigation is free.
 */
const MIN_INTERVAL_MS = 2 * 60 * 1000;

let lastRunAt = 0;
let inFlight: Promise<SyncResult> | null = null;

/**
 * Sync one source.
 *
 * Never throws. A source that cannot run reports why and the others carry on — which is
 * the whole reason this is a per-source function rather than a loop body: a bracelet that
 * is out of range must not cost somebody their Health Connect sync.
 */
const runOne = async (platform: HealthPlatform): Promise<SyncResult> => {
    const capability = await probe(platform);
    if (!capability.available || !capability.granted) {
        return { ran: false, daysUpdated: [], reason: capability.reason, platform };
    }

    try {
        // The cursor is whatever the server last stored for this platform.
        const status = await getWearableStatus();
        const source = status.sources.find((s) => s.platform === platform);

        const batch = await readSince(source?.cursor ?? null, platform);
        if (!batch) return { ran: false, daysUpdated: [], platform };

        const total = batch.activities.length + batch.sleep.length
            + batch.heart.length + batch.days.length
            + (batch.spo2?.length ?? 0) + (batch.temperature?.length ?? 0)
            + (batch.bloodPressure?.length ?? 0) + (batch.ecg?.length ?? 0);

        // Nothing changed. Still a run, so the interval guard holds.
        if (total === 0) {
            return {
                ran: true,
                daysUpdated: [],
                counts: { activities: 0, sleep: 0, heart: 0, days: 0 },
                platform,
            };
        }

        const result = await syncBatch(batch);

        // Only now may the bracelet forget what it just handed over. Its storage is the
        // only copy until this POST is acknowledged, so acknowledging any earlier would
        // turn a dropped connection into permanent data loss. No other source has this
        // step, which is why it is here rather than on `HealthReader`.
        if (platform === 'jstyle_bracelet') {
            try {
                await require('./jstyle/reader').acknowledgeSynced();
            } catch { /* it keeps the rows and re-sends them; the server upserts */ }
        }

        return {
            ran: true,
            daysUpdated: result.daysUpdated,
            counts: result.received,
            platform,
        };
    } catch (err) {
        return {
            ran: false,
            daysUpdated: [],
            reason: err instanceof Error ? err.message : 'Could not sync health data.',
            platform,
        };
    }
};

/**
 * Sync every source this device has.
 *
 * Sequential rather than parallel, and that is load-bearing for the bracelet: it holds a
 * BLE connection and the vendor codec keeps decode state in static fields, so overlapping
 * it with anything else that talks to it is not safe. The phone store is fast enough that
 * running it first costs nothing.
 */
const run = async (force: boolean): Promise<SyncResult> => {
    const list = sources();
    if (!list.length) {
        return { ran: false, daysUpdated: [], reason: 'Not a mobile device.', platform: null };
    }

    if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) {
        return { ran: false, daysUpdated: [], platform: list[0] };
    }

    const results: SyncResult[] = [];
    for (const platform of list) {
        results.push(await runOne(platform));
    }

    const ran = results.some((r) => r.ran);
    if (ran) lastRunAt = Date.now();

    // Days are unioned rather than concatenated: both sources can touch the same day, and
    // a caller uses this list to decide what to refetch.
    const daysUpdated = [...new Set(results.flatMap((r) => r.daysUpdated))];

    const counts = results.reduce(
        (acc, r) => ({
            activities: acc.activities + (r.counts?.activities ?? 0),
            sleep: acc.sleep + (r.counts?.sleep ?? 0),
            heart: acc.heart + (r.counts?.heart ?? 0),
            days: acc.days + (r.counts?.days ?? 0),
        }),
        { activities: 0, sleep: 0, heart: 0, days: 0 },
    );

    return {
        ran,
        daysUpdated,
        counts: ran ? counts : undefined,
        // Only worth showing when *nothing* ran. If one source worked, a message about the
        // other one failing is noise on a screen that just updated.
        reason: ran ? undefined : results.find((r) => r.reason)?.reason,
        platform: results.find((r) => r.ran)?.platform ?? list[0],
        perSource: results.map((r) => ({
            platform: r.platform as HealthPlatform,
            ran: r.ran,
            reason: r.reason,
            days: r.daysUpdated.length,
        })),
    };
};

/**
 * Sync, coalescing concurrent callers.
 *
 * Several screens call this on focus and a tab switch can fire two at once. Without the
 * in-flight guard both would read the same anchor, and the second would post rows the first
 * had already sent — harmless, because the server upserts by `externalId`, but it doubles
 * the work on the slowest path in the app.
 */
export const runSync = (force = false): Promise<SyncResult> => {
    if (inFlight) return inFlight;
    inFlight = run(force).finally(() => { inFlight = null; });
    return inFlight;
};

/** Forget the interval guard — used after connecting, where an immediate sync is the point. */
export const resetSyncThrottle = () => { lastRunAt = 0; };
