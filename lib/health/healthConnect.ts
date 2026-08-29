/**
 * Android Health Connect reader.
 *
 * Health Connect is the aggregation layer the Android health ecosystem writes into —
 * Samsung Health, Fitbit, Garmin Connect and Google Fit all deposit here, so reading it
 * once covers every one of them. That is why this is the Android path rather than
 * integrating each vendor.
 *
 * The cursor is a **changes token**, obtained from a previous `getChanges` call. Tokens
 * expire (Health Connect keeps roughly 30 days of change history); when that happens the
 * result says so and this falls back to a windowed read rather than losing the sync.
 *
 * Two limits worth knowing, neither of them fixable here:
 *
 * 1. **There is no background read.** Health Connect offers no equivalent of HealthKit's
 *    observer queries, so Android syncs when the app is opened. The UI must not imply
 *    otherwise.
 * 2. **On Android 13 and below Health Connect is a separate Play app.** `getSdkStatus`
 *    reports that as `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED`, and the connect screen
 *    offers an install path instead of a dead button.
 */
import {
    initialize,
    getSdkStatus,
    requestPermission,
    getGrantedPermissions,
    getChanges,
    readRecords,
    openHealthConnectSettings,
    SdkAvailabilityStatus,
    SleepStageType,
} from 'react-native-health-connect';
import type {
    HealthReader, HealthCapability, SyncBatch, HealthScope,
    ActivityRow, SleepRow, DayRow, SleepStage, SourceDevice,
} from './types';

/** Read permissions, grouped by the scope a person grants. */
const SCOPES: Record<HealthScope, readonly string[]> = {
    activity: ['ExerciseSession', 'Steps', 'ActiveCaloriesBurned', 'TotalCaloriesBurned', 'Distance', 'FloorsClimbed'],
    sleep: ['SleepSession'],
    heart: ['HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'Vo2Max'],
};

const ALL_RECORD_TYPES = Object.values(SCOPES).flat();

const PERMISSIONS = ALL_RECORD_TYPES.map(
    (recordType) => ({ accessType: 'read' as const, recordType: recordType as any })
);

/** Record types worth watching for changes. Daily totals are read by window instead. */
const WATCHED: any[] = ['ExerciseSession', 'SleepSession'];

const BACKFILL_DAYS = 90;

const iso = (v: string | Date) => new Date(v).toISOString();

const backfillFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - BACKFILL_DAYS);
    return d;
};

const deviceOf = (record: any): SourceDevice | undefined => {
    const device = record?.metadata?.device;
    const origin = record?.metadata?.dataOrigin;
    if (!device && !origin) return undefined;
    return {
        name: device?.model || origin,
        model: device?.model,
        manufacturer: device?.manufacturer,
    };
};

const STAGE_OF: Record<number, SleepStage> = {
    [SleepStageType.AWAKE]: 'awake',
    [SleepStageType.SLEEPING]: 'light',
    [SleepStageType.OUT_OF_BED]: 'awake',
    [SleepStageType.LIGHT]: 'light',
    [SleepStageType.DEEP]: 'deep',
    [SleepStageType.REM]: 'rem',
    [SleepStageType.UNKNOWN]: 'unknown',
};

/**
 * Health Connect reports `exerciseType` as an integer.
 *
 * Sent to the server as a readable name rather than the number, because a stored `56` is a
 * row nobody can debug a year later. Anything unmapped goes across as `exercise-<n>`, which
 * the server passes through rather than dropping — the same rule `normaliseType` follows.
 */
const EXERCISE_TYPES: Record<number, string> = {
    8: 'biking',
    9: 'biking',
    56: 'running',
    57: 'running',
    79: 'walking',
    73: 'swimming',
    74: 'swimming',
    82: 'yoga',
    80: 'weightlifting',
    37: 'hiking',
    64: 'rowing',
    65: 'rowing',
    70: 'soccer',
    45: 'meditation',
};

const exerciseName = (type: number) => EXERCISE_TYPES[type] || `exercise-${type}`;

const toActivityRow = (r: any): ActivityRow | null => {
    if (!r?.startTime || !r?.endTime) return null;
    const start = new Date(r.startTime);
    const end = new Date(r.endTime);
    return {
        externalId: r.metadata?.id || `hc-${r.startTime}`,
        type: exerciseName(r.exerciseType),
        startedAt: iso(start),
        endedAt: iso(end),
        durationSec: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)),
        sourceDevice: deviceOf(r),
    };
};

const toSleepRow = (r: any): SleepRow | null => {
    if (!r?.startTime || !r?.endTime) return null;

    const segments = (r.stages || [])
        .filter((s: any) => s?.startTime && s?.endTime)
        .map((s: any) => ({
            stage: STAGE_OF[s.stage] ?? 'unknown',
            startedAt: iso(s.startTime),
            endedAt: iso(s.endTime),
        }));

    return {
        externalId: r.metadata?.id || `hc-sleep-${r.startTime}`,
        startedAt: iso(r.startTime),
        endedAt: iso(r.endTime),
        segments: segments.length ? segments : undefined,
        sourceDevice: deviceOf(r),
    };
};

const localDayKey = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/**
 * Daily totals, summed from records by local day.
 *
 * `aggregateGroupByPeriod` would be the neater call, but it aggregates in UTC days, which
 * files an evening walk in the Americas under the following day — the exact bug the whole
 * feature's `tzOffset` handling exists to avoid. Summing by local day here is a few more
 * lines and the right answer.
 */
const DAILY: { recordType: string; field: keyof DayRow; value: (r: any) => number | undefined }[] = [
    { recordType: 'Steps', field: 'steps', value: (r) => r.count },
    { recordType: 'ActiveCaloriesBurned', field: 'activeKcal', value: (r) => r.energy?.inKilocalories },
    { recordType: 'Distance', field: 'distanceM', value: (r) => r.distance?.inMeters },
    { recordType: 'FloorsClimbed', field: 'floors', value: (r) => r.floors },
];

const readDays = async (from: Date) => {
    const timeRangeFilter = {
        operator: 'between' as const,
        startTime: from.toISOString(),
        endTime: new Date().toISOString(),
    };

    const byDay = new Map<string, DayRow>();
    const add = (day: string, field: keyof DayRow, amount: number) => {
        const row = byDay.get(day) || { day };
        (row as any)[field] = ((row as any)[field] || 0) + amount;
        byDay.set(day, row);
    };

    for (const spec of DAILY) {
        try {
            const result = await readRecords(spec.recordType as any, { timeRangeFilter });
            for (const r of (result as any).records || []) {
                const when = r.startTime || r.time;
                const amount = spec.value(r);
                if (!when || !Number.isFinite(amount)) continue;
                add(localDayKey(new Date(when)), spec.field, amount as number);
            }
        } catch {
            // A type the person did not grant. The rest of the day still reads.
        }
    }

    // Resting heart rate and HRV are averaged rather than summed
    for (const [recordType, field, pick] of [
        ['RestingHeartRate', 'restingBpm', (r: any) => r.beatsPerMinute],
        ['HeartRateVariabilityRmssd', 'hrvMs', (r: any) => r.heartRateVariabilityMillis],
    ] as const) {
        try {
            const result = await readRecords(recordType as any, { timeRangeFilter });
            const buckets = new Map<string, number[]>();
            for (const r of (result as any).records || []) {
                const when = r.time || r.startTime;
                const v = pick(r);
                if (!when || !Number.isFinite(v)) continue;
                const day = localDayKey(new Date(when));
                buckets.set(day, [...(buckets.get(day) || []), v]);
            }
            for (const [day, values] of buckets) {
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const row = byDay.get(day) || { day };
                (row as any)[field] = Math.round(mean);
                byDay.set(day, row);
            }
        } catch {
            // Not granted, or not recorded by this device
        }
    }

    for (const row of byDay.values()) {
        for (const k of Object.keys(row) as (keyof DayRow)[]) {
            if (typeof row[k] === 'number') (row as any)[k] = Math.round((row[k] as number) * 100) / 100;
        }
    }

    return [...byDay.values()];
};

const scopesFromPermissions = (granted: any[]): HealthScope[] => {
    const types = new Set(granted.map((p) => p.recordType));
    return (Object.keys(SCOPES) as HealthScope[]).filter(
        (scope) => SCOPES[scope].some((t) => types.has(t))
    );
};

const statusCapability = async (): Promise<HealthCapability> => {
    const status = await getSdkStatus();

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        return {
            platform: 'health_connect',
            available: false,
            granted: false,
            reason: 'Health Connect isn’t available on this device.',
        };
    }

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return {
            platform: 'health_connect',
            available: false,
            granted: false,
            needsInstall: true,
            reason: 'Health Connect needs to be installed or updated from the Play Store before LabTrack can read your activity.',
        };
    }

    await initialize();
    const granted = await getGrantedPermissions();
    const scopes = scopesFromPermissions(granted);

    return {
        platform: 'health_connect',
        available: true,
        granted: scopes.length > 0,
        scopes,
        reason: scopes.length === 0 ? 'Health Connect hasn’t been given permission yet.' : undefined,
    };
};

export const reader: HealthReader = {
    probe: statusCapability,

    async requestPermissions() {
        const status = await getSdkStatus();
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return statusCapability();

        await initialize();
        const granted = await requestPermission(PERMISSIONS as any);
        const scopes = scopesFromPermissions(granted);

        return {
            platform: 'health_connect',
            available: true,
            granted: scopes.length > 0,
            scopes,
            reason: scopes.length === 0
                // Health Connect does not re-prompt once someone has declined, so pointing
                // at settings is the only route back rather than a retry that does nothing.
                ? 'No data types were shared. You can change this in Health Connect settings.'
                : undefined,
        };
    },

    async readSince(cursor) {
        await initialize();

        let activities: ActivityRow[] = [];
        let sleep: SleepRow[] = [];
        let nextToken: string | null = null;
        let windowFrom = backfillFrom();

        if (cursor) {
            const changes = await getChanges({ changesToken: cursor });

            if (changes.changesTokenExpired) {
                // More than ~30 days since the last sync. Re-read a window rather than
                // silently returning nothing, which would look like "no new activity".
                nextToken = null;
            } else {
                for (const change of changes.upsertionChanges) {
                    const record: any = change.record;
                    if (record?.recordType === 'ExerciseSession') {
                        const row = toActivityRow(record);
                        if (row) activities.push(row);
                    } else if (record?.recordType === 'SleepSession') {
                        const row = toSleepRow(record);
                        if (row) sleep.push(row);
                    }
                }
                nextToken = changes.nextChangesToken;
                // Daily totals have no change feed, so they are re-read over a short window
                windowFrom = new Date(Date.now() - 7 * 86_400_000);
            }
        }

        if (!cursor || nextToken === null) {
            // First sync, or a token that expired: read the backfill window directly.
            const timeRangeFilter = {
                operator: 'between' as const,
                startTime: windowFrom.toISOString(),
                endTime: new Date().toISOString(),
            };

            try {
                const result = await readRecords('ExerciseSession' as any, { timeRangeFilter });
                activities = ((result as any).records || [])
                    .map(toActivityRow)
                    .filter(Boolean) as ActivityRow[];
            } catch { /* not granted */ }

            try {
                const result = await readRecords('SleepSession' as any, { timeRangeFilter });
                sleep = ((result as any).records || [])
                    .map(toSleepRow)
                    .filter(Boolean) as SleepRow[];
            } catch { /* not granted */ }

            // Take a token now so the *next* sync is incremental
            try {
                const seed = await getChanges({ recordTypes: WATCHED });
                nextToken = seed.nextChangesToken;
            } catch {
                nextToken = null;
            }
        }

        const days = await readDays(windowFrom);
        const granted = await getGrantedPermissions();

        return {
            platform: 'health_connect',
            tzOffset: new Date().getTimezoneOffset(),
            cursor: nextToken,
            providerLabel: 'Health Connect',
            permissions: scopesFromPermissions(granted),
            devices: activities
                .map((a) => a.sourceDevice)
                .filter((d): d is SourceDevice => Boolean(d?.name))
                .slice(0, 5)
                .map((d) => ({ ...d, lastSeenAt: new Date().toISOString() })),
            activities,
            sleep,
            // Raw heart-rate samples are not uploaded; the day's figures travel in `days`.
            heart: [],
            days,
        } satisfies SyncBatch;
    },
};

/** Deep-link into Health Connect, for the "permissions were declined" path. */
export const openSettings = openHealthConnectSettings;
