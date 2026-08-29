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
import { probe, readSince, platformFor } from './index';
import type { HealthPlatform } from './types';

export interface SyncResult {
    ran: boolean;
    /** Days the server says changed, so a screen knows whether to refetch. */
    daysUpdated: string[];
    counts?: { activities: number; sleep: number; heart: number; days: number };
    /** Present when the sync did not run or did not finish. Written to be shown. */
    reason?: string;
    platform?: HealthPlatform | null;
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

const run = async (force: boolean): Promise<SyncResult> => {
    const platform = platformFor();
    if (!platform) return { ran: false, daysUpdated: [], reason: 'Not a mobile device.', platform };

    const capability = await probe();
    if (!capability.available || !capability.granted) {
        return {
            ran: false,
            daysUpdated: [],
            reason: capability.reason,
            platform,
        };
    }

    if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) {
        return { ran: false, daysUpdated: [], platform };
    }

    try {
        // The cursor is whatever the server last stored for this platform.
        const status = await getWearableStatus();
        const source = status.sources.find((s) => s.platform === platform);

        const batch = await readSince(source?.cursor ?? null);
        if (!batch) return { ran: false, daysUpdated: [], platform };

        const total = batch.activities.length + batch.sleep.length
            + batch.heart.length + batch.days.length;

        // Nothing changed. Still record the run so the interval guard holds.
        if (total === 0) {
            lastRunAt = Date.now();
            return { ran: true, daysUpdated: [], counts: { activities: 0, sleep: 0, heart: 0, days: 0 }, platform };
        }

        const result = await syncBatch(batch);
        lastRunAt = Date.now();

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
