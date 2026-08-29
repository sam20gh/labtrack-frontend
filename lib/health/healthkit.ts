/**
 * Apple Health reader.
 *
 * Everything here uses the **anchored** query variants. An anchor is HealthKit's cursor:
 * hand it back and you get only what changed since, which is the difference between a sync
 * that costs a few rows on app foreground and one that re-reads a year of samples every
 * time someone opens the app. The anchor is round-tripped through
 * `ConnectedSource.lastSyncCursor` so it survives a reinstall.
 *
 * Three things this deliberately does not do:
 *
 * 1. **It does not upload the raw heart-rate stream.** A worn watch emits a reading every
 *    few seconds. What the app needs is the day's resting figure and spread, which comes
 *    from `queryStatisticsCollectionForQuantity` as one row per day. The server refuses
 *    unlabelled samples anyway (`ACCEPTED_HR_CONTEXTS` in `utils/healthSync.js`).
 * 2. **It does not read `irregularHeartRhythmEvent`.** Surfacing an AF detection is a
 *    regulated claim even when Apple generated it — see `docs/ACTIVITY-TRACKER-PLAN.md` §8.
 * 3. **It does not write.** Read scopes only, so the consent prompt asks for exactly what
 *    the app uses.
 */
import {
    isHealthDataAvailable,
    requestAuthorization,
    authorizationStatusFor,
    queryWorkoutSamplesWithAnchor,
    queryCategorySamplesWithAnchor,
    queryStatisticsCollectionForQuantity,
    AuthorizationStatus,
    CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import type {
    HealthReader, HealthCapability, SyncBatch, HealthScope,
    ActivityRow, SleepRow, DayRow, SleepStage, SourceDevice,
} from './types';

/**
 * What we ask to read, grouped by the scope a person grants.
 *
 * HealthKit asks once for the whole set rather than per type, but the grouping still
 * matters: `authorizationStatusFor` is checked per type afterwards so a screen can say
 * "sleep wasn't shared" instead of drawing an empty chart.
 */
const SCOPES: Record<HealthScope, readonly string[]> = {
    activity: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierBasalEnergyBurned',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'HKQuantityTypeIdentifierAppleExerciseTime',
        'HKQuantityTypeIdentifierFlightsClimbed',
    ],
    sleep: ['HKCategoryTypeIdentifierSleepAnalysis'],
    heart: [
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierRestingHeartRate',
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'HKQuantityTypeIdentifierVO2Max',
    ],
};

const ALL_TYPES = Object.values(SCOPES).flat();

/** How far back a first-ever sync reaches when there is no anchor to resume from. */
const BACKFILL_DAYS = 90;

/** Per-query ceiling. The server caps a batch at 2,000 rows across all types. */
const PAGE_LIMIT = 500;

const iso = (d: Date | string) => new Date(d).toISOString();

const deviceOf = (sample: any): SourceDevice | undefined => {
    const device = sample?.device;
    const source = sample?.sourceRevision?.source;
    if (!device && !source) return undefined;
    return {
        // The watch's own name when HealthKit knows it, else the app that wrote the sample
        name: device?.name || source?.name,
        model: device?.model,
        manufacturer: device?.manufacturer,
    };
};

/** Which scopes the person actually granted. A partial grant is normal, not a failure. */
const grantedScopes = (): HealthScope[] => {
    const granted: HealthScope[] = [];
    for (const [scope, types] of Object.entries(SCOPES) as [HealthScope, string[]][]) {
        const any = types.some((t) => {
            try {
                return authorizationStatusFor(t as any) === AuthorizationStatus.sharingAuthorized;
            } catch {
                return false;
            }
        });
        if (any) granted.push(scope);
    }
    return granted;
};

/**
 * HealthKit will not tell you whether *read* access was granted.
 *
 * `authorizationStatusFor` reports share (write) status only; for read types it returns
 * `notDetermined` even after the person has allowed it, because revealing a refusal would
 * itself leak health information. So a granted read scope is inferred from the request
 * having completed, and the real test is whether a query returns anything.
 *
 * This is why the connect screen says "if data doesn't appear, check Health > Sharing"
 * rather than claiming a permission state it cannot observe.
 */
const capability = (available: boolean, reason?: string): HealthCapability => ({
    platform: 'apple_health',
    available,
    granted: available && grantedScopes().length > 0,
    scopes: available ? (Object.keys(SCOPES) as HealthScope[]) : [],
    reason,
});

/** The composite cursor. HealthKit hands out one anchor per query, so they travel together. */
interface Anchors {
    workouts?: string;
    sleep?: string;
    /** ISO date of the last daily-statistics sync, since statistics queries take no anchor. */
    statsThrough?: string;
}

const parseAnchors = (cursor: string | null): Anchors => {
    if (!cursor) return {};
    try {
        return JSON.parse(cursor) as Anchors;
    } catch {
        // An unreadable cursor is not worth failing a sync over — fall back to a backfill.
        return {};
    }
};

const backfillFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - BACKFILL_DAYS);
    return d;
};

/** Workouts since the anchor. */
const readWorkouts = async (anchor?: string) => {
    const result = await queryWorkoutSamplesWithAnchor({
        limit: PAGE_LIMIT,
        anchor,
        filter: anchor ? undefined : { date: { startDate: backfillFrom() } },
    });

    const rows: ActivityRow[] = result.workouts.map((w) => ({
        externalId: w.uuid,
        // Sent raw. `normaliseType` on the server strips the HKWorkoutActivityType prefix
        // and maps it; doing it here would mean two places to fix when Apple adds a type.
        type: String(w.workoutActivityType),
        startedAt: iso(w.startDate),
        endedAt: iso(w.endDate),
        durationSec: Math.round(w.duration?.quantity ?? 0),
        distanceM: w.totalDistance?.quantity,
        activeKcal: w.totalEnergyBurned?.quantity,
        sourceDevice: deviceOf(w),
    }));

    return { rows, anchor: result.newAnchor };
};

/**
 * Sleep, rebuilt into nights.
 *
 * HealthKit does not have a "night" — it has a stream of `SleepAnalysis` category samples,
 * one per stage transition, and an Apple Watch emits dozens per night. They are grouped
 * into sessions by gap: samples less than an hour apart belong to the same night. An hour
 * is deliberately generous, because getting up in the small hours is not a new night and
 * splitting on it would report two short sleeps instead of one adequate one.
 */
const SLEEP_GAP_MS = 60 * 60 * 1000;

const STAGE_OF: Record<number, SleepStage> = {
    [CategoryValueSleepAnalysis.inBed]: 'in_bed',
    [CategoryValueSleepAnalysis.asleepUnspecified]: 'light',
    [CategoryValueSleepAnalysis.awake]: 'awake',
    [CategoryValueSleepAnalysis.asleepCore]: 'light',
    [CategoryValueSleepAnalysis.asleepDeep]: 'deep',
    [CategoryValueSleepAnalysis.asleepREM]: 'rem',
};

const readSleep = async (anchor?: string) => {
    const result = await queryCategorySamplesWithAnchor('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: PAGE_LIMIT,
        anchor,
        filter: anchor ? undefined : { date: { startDate: backfillFrom() } },
    });

    const samples = [...result.samples].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const nights: SleepRow[] = [];
    let current: {
        start: Date; end: Date;
        segments: { stage: SleepStage; startedAt: string; endedAt: string }[];
        device?: SourceDevice; uuid: string;
    } | null = null;

    const flush = () => {
        if (!current) return;
        // `in_bed` samples overlap the stage samples rather than sitting beside them, so
        // they are kept for the in-bed total and excluded from the hypnogram.
        const staged = current.segments.filter((s) => s.stage !== 'in_bed');
        nights.push({
            // Stable across re-syncs: the same night must upsert, not duplicate. The first
            // sample's UUID is what makes that identity, and it does not change.
            externalId: `hk-night-${current.uuid}`,
            startedAt: iso(current.start),
            endedAt: iso(current.end),
            segments: staged.length ? staged : undefined,
            sourceDevice: current.device,
        });
        current = null;
    };

    for (const s of samples) {
        const stage = STAGE_OF[s.value as number] ?? 'unknown';
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);

        if (current && start.getTime() - current.end.getTime() > SLEEP_GAP_MS) flush();

        if (!current) {
            current = { start, end, segments: [], device: deviceOf(s), uuid: s.uuid };
        }
        current.end = new Date(Math.max(current.end.getTime(), end.getTime()));
        current.segments.push({ stage, startedAt: iso(start), endedAt: iso(end) });
    }
    flush();

    // A night still in progress this morning would be re-read tomorrow with more samples
    // and a different end time. Upserting on the first sample's UUID means the later,
    // complete version replaces it rather than adding a second row.
    return { rows: nights, anchor: result.newAnchor };
};

/**
 * Whole-day figures, from statistics collections rather than samples.
 *
 * Steps are not the sum of workouts, and asking HealthKit to total them is both faster and
 * more correct than summing raw samples on the phone — it deduplicates across the watch and
 * the iPhone, which otherwise double-counts every step taken with both on.
 */
const DAILY: { identifier: string; unit: string; field: keyof DayRow; stat: string }[] = [
    { identifier: 'HKQuantityTypeIdentifierStepCount', unit: 'count', field: 'steps', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned', unit: 'kcal', field: 'activeKcal', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierBasalEnergyBurned', unit: 'kcal', field: 'restingKcal', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning', unit: 'm', field: 'distanceM', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierAppleExerciseTime', unit: 'min', field: 'exerciseMin', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierFlightsClimbed', unit: 'count', field: 'floors', stat: 'cumulativeSum' },
    { identifier: 'HKQuantityTypeIdentifierRestingHeartRate', unit: 'count/min', field: 'restingBpm', stat: 'discreteAverage' },
    { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', unit: 'ms', field: 'hrvMs', stat: 'discreteAverage' },
];

const localDayKey = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const readDays = async (since?: string) => {
    const from = since ? new Date(since) : backfillFrom();
    // Anchored to local midnight so each bucket is a calendar day the person recognises
    const anchorDate = new Date(from);
    anchorDate.setHours(0, 0, 0, 0);

    const byDay = new Map<string, DayRow>();

    for (const spec of DAILY) {
        let collection;
        try {
            collection = await queryStatisticsCollectionForQuantity(
                spec.identifier as any,
                [spec.stat] as any,
                anchorDate,
                { day: 1 },
                { unit: spec.unit as any, filter: { date: { startDate: anchorDate } } }
            );
        } catch {
            // A type the person did not share, or one this device never records. Skipping
            // it is right: the other seven still produce a usable day.
            continue;
        }

        for (const entry of collection) {
            const start = (entry as any).startDate;
            if (!start) continue;
            const day = localDayKey(new Date(start));

            const value = (entry as any).sumQuantity?.quantity
                ?? (entry as any).averageQuantity?.quantity;
            if (!Number.isFinite(value)) continue;

            const row = byDay.get(day) || { day };
            (row as any)[spec.field] = Math.round(value * 100) / 100;
            byDay.set(day, row);
        }
    }

    return { rows: [...byDay.values()], through: new Date().toISOString() };
};

export const reader: HealthReader = {
    async probe() {
        if (!isHealthDataAvailable()) {
            return capability(false, 'This device does not have Apple Health.');
        }
        return capability(true);
    },

    async requestPermissions() {
        if (!isHealthDataAvailable()) {
            return capability(false, 'This device does not have Apple Health.');
        }

        // Read-only. `toShare` is left empty so the prompt asks for exactly what is used.
        const ok = await requestAuthorization({ toRead: ALL_TYPES as any });

        if (!ok) {
            return capability(true, 'Apple Health access was not granted.');
        }
        return capability(true);
    },

    async readSince(cursor) {
        const anchors = parseAnchors(cursor);

        // Sequential rather than parallel: HealthKit serialises these internally anyway, and
        // running them one at a time keeps a slow first-ever backfill from holding several
        // large result sets in memory at once.
        const workouts = await readWorkouts(anchors.workouts);
        const sleep = await readSleep(anchors.sleep);
        const days = await readDays(anchors.statsThrough);

        const batch: SyncBatch = {
            platform: 'apple_health',
            tzOffset: new Date().getTimezoneOffset(),
            cursor: JSON.stringify({
                workouts: workouts.anchor,
                sleep: sleep.anchor,
                statsThrough: days.through,
            } satisfies Anchors),
            providerLabel: 'Apple Health',
            permissions: grantedScopes(),
            devices: workouts.rows
                .map((r) => r.sourceDevice)
                .filter((d): d is SourceDevice => Boolean(d?.name))
                .slice(0, 5)
                .map((d) => ({ ...d, lastSeenAt: new Date().toISOString() })),
            activities: workouts.rows,
            sleep: sleep.rows,
            // Raw heart-rate samples are never uploaded. See the note at the top.
            heart: [],
            days: days.rows,
        };

        return batch;
    },
};
