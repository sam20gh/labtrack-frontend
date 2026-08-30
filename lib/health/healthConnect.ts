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
    aggregateRecord,
    aggregateGroupByDuration,
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
    activity: [
        'ExerciseSession', 'Steps', 'ActiveCaloriesBurned', 'TotalCaloriesBurned',
        'Distance', 'FloorsClimbed', 'ElevationGained',
    ],
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

/**
 * Bumped whenever this reader starts collecting something it did not collect before.
 *
 * The cursor is what makes a sync incremental, and it is also what makes an *upgrade*
 * invisible: someone who already synced has a valid changes token, so the reader that now
 * knows how to read heart rate, floors and per-session distance would only ever apply that
 * knowledge to the next seven days and the person would see the same near-empty dashboard
 * they were complaining about. Stamping the version into the cursor turns the first sync
 * after an upgrade back into a full backfill, once, without a migration or a support step.
 */
const READER_VERSION = 'v2';

const encodeCursor = (token: string | null) => (token ? `${READER_VERSION}:${token}` : null);

/** The token inside a cursor this reader wrote, or null — which means backfill. */
const decodeCursor = (cursor: string | null): string | null => {
    if (!cursor) return null;
    const separator = cursor.indexOf(':');
    if (separator < 0) return null;
    // A token from an older reader. Not an error: it is a cursor that cannot speak for the
    // data this version knows how to fetch.
    if (cursor.slice(0, separator) !== READER_VERSION) return null;
    return cursor.slice(separator + 1) || null;
};

const iso = (v: string | Date) => new Date(v).toISOString();

const backfillFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - BACKFILL_DAYS);
    return d;
};

/**
 * Read every page of a record type, not just the first.
 *
 * `readRecords` returns one page — 1000 rows by default — and a `pageToken` for the rest.
 * Reads are **ascending** by default, so a query that overflows a page silently drops the
 * *most recent* days: a 90-day backfill of a phone that writes a step record every few
 * minutes stops somewhere in month one, and the dashboard shows two days with data and
 * calls that the whole history. That is not a rare edge — it is the normal shape of step
 * and distance data — so every read here pages.
 */
const PAGE_SIZE = 1000;
const MAX_PAGES = 25;

const readAll = async (recordType: string, timeRangeFilter: any): Promise<any[]> => {
    const rows: any[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const result: any = await readRecords(recordType as any, {
            timeRangeFilter,
            pageSize: PAGE_SIZE,
            ...(pageToken ? { pageToken } : {}),
        });

        const records = result?.records || [];
        rows.push(...records);

        pageToken = result?.pageToken;
        if (!pageToken || records.length === 0) break;
    }

    return rows;
};

/**
 * One aggregate, or null.
 *
 * A record type the person did not grant, or one their phone has never written, throws.
 * Neither is a failure of the sync — the rest of the session still reads — so this returns
 * null and every caller treats a missing figure as missing rather than as zero.
 */
const aggregateOrNull = async (recordType: string, timeRangeFilter: any): Promise<any | null> => {
    try {
        return await aggregateRecord({ recordType, timeRangeFilter } as any);
    } catch {
        return null;
    }
};

/** A number that is actually a number and actually says something. Zero distance is not a distance. */
const positive = (v: any): number | undefined =>
    (Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : undefined);

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

/**
 * Fill in everything an `ExerciseSession` record does not carry.
 *
 * A Health Connect exercise session is only a type and a pair of timestamps. The distance
 * covered, the calories burned, the heart rate and the climb are separate record types
 * written alongside it, and nothing joins them — so a session synced from the record alone
 * arrives as a duration and nothing else, which is what the history list and the session
 * detail screen were showing.
 *
 * Aggregating over the session's own window is the join. Five aggregate calls per session,
 * each independently allowed to fail, and every figure omitted rather than zeroed when the
 * phone never recorded it: a pool swim has no GPS distance and a yoga session has no climb,
 * and "0 km" for either is a wrong number where a blank is an honest one.
 *
 * Capped at the most recent `ENRICH_LIMIT` sessions. A first sync of a heavy user is 90
 * days of workouts, and enriching all of them would put hundreds of native round-trips in
 * front of the first screen the person sees. Older sessions still sync — with the duration
 * they always had.
 */
const ENRICH_LIMIT = 60;

const enrich = async (row: ActivityRow): Promise<ActivityRow> => {
    if (!row.endedAt) return row;

    const timeRangeFilter = {
        operator: 'between' as const,
        startTime: row.startedAt,
        endTime: row.endedAt,
    };

    const [distance, active, heart, elevation, steps] = await Promise.all([
        aggregateOrNull('Distance', timeRangeFilter),
        aggregateOrNull('ActiveCaloriesBurned', timeRangeFilter),
        aggregateOrNull('HeartRate', timeRangeFilter),
        aggregateOrNull('ElevationGained', timeRangeFilter),
        aggregateOrNull('Steps', timeRangeFilter),
    ]);

    const distanceM = positive(distance?.DISTANCE?.inMeters);
    const durationMin = (row.durationSec || 0) / 60;

    return {
        ...row,
        distanceM,
        activeKcal: positive(active?.ACTIVE_CALORIES_TOTAL?.inKilocalories),
        elevationM: positive(elevation?.ELEVATION_GAINED_TOTAL?.inMeters),
        // A count of zero means the watch was off the wrist for this one, not a heart rate
        // of zero — hence the guard rather than trusting BPM_AVG on its own.
        avgBpm: heart?.MEASUREMENTS_COUNT > 0 ? positive(heart?.BPM_AVG) : undefined,
        maxBpm: heart?.MEASUREMENTS_COUNT > 0 ? positive(heart?.BPM_MAX) : undefined,
        // Steps per minute. Only meaningful when the session was actually walked or run,
        // which is exactly when Health Connect wrote step records inside its window.
        cadence: durationMin > 0 && positive(steps?.COUNT_TOTAL)
            ? Math.round((steps.COUNT_TOTAL / durationMin) * 10) / 10
            : undefined,
    };
};

/** Enrich the newest sessions, in small batches so the native bridge is not flooded. */
const enrichAll = async (rows: ActivityRow[]): Promise<ActivityRow[]> => {
    const ordered = [...rows].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const head = ordered.slice(0, ENRICH_LIMIT);
    const tail = ordered.slice(ENRICH_LIMIT);

    const enriched: ActivityRow[] = [];
    for (let i = 0; i < head.length; i += 5) {
        enriched.push(...await Promise.all(head.slice(i, i + 5).map(enrich)));
    }

    return [...enriched, ...tail];
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
 *
 * Each entry is read independently and a failure is swallowed, because a partial grant is
 * the normal case: somebody who shared steps and refused heart rate should get their steps,
 * not an empty day.
 */
const DAILY: { recordType: string; field: keyof DayRow; value: (r: any) => number | undefined }[] = [
    { recordType: 'Steps', field: 'steps', value: (r) => r.count },
    { recordType: 'ActiveCaloriesBurned', field: 'activeKcal', value: (r) => r.energy?.inKilocalories },
    { recordType: 'Distance', field: 'distanceM', value: (r) => r.distance?.inMeters },
    { recordType: 'FloorsClimbed', field: 'floors', value: (r) => r.floors },
];

/**
 * The day's heart rate, aggregated rather than read.
 *
 * A worn watch writes a heart-rate sample every few seconds — a 90-day backfill is
 * hundreds of thousands of rows, and nothing in the app plots that stream. What the
 * dashboards need is the day's low, average and peak, which `aggregateGroupByDuration`
 * returns in one call per window instead of one row per beat.
 *
 * Bucketed from **local midnight** so each 24-hour slice is a calendar day the person would
 * recognise. A DST change misaligns one boundary by an hour twice a year, which moves a
 * minimum or a maximum between two adjacent days and is worth it here — unlike step totals,
 * where an hour of steps landing on the wrong day is a number somebody would notice, so
 * those stay summed from records above.
 */
const readDailyHeart = async (from: Date): Promise<Map<string, Partial<DayRow>>> => {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);

    const byDay = new Map<string, Partial<DayRow>>();

    try {
        const groups: any[] = await aggregateGroupByDuration({
            recordType: 'HeartRate',
            timeRangeFilter: {
                operator: 'between',
                startTime: start.toISOString(),
                endTime: new Date().toISOString(),
            },
            timeRangeSlicer: { duration: 'DAYS', length: 1 },
        } as any);

        for (const group of groups || []) {
            const result = group?.result;
            if (!group?.startTime || !(result?.MEASUREMENTS_COUNT > 0)) continue;
            byDay.set(localDayKey(new Date(group.startTime)), {
                minBpm: positive(result.BPM_MIN),
                avgBpm: positive(result.BPM_AVG),
                maxBpm: positive(result.BPM_MAX),
            });
        }
    } catch {
        // Heart rate was not granted, or this phone has never recorded any.
    }

    return byDay;
};

const readDays = async (from: Date): Promise<DayRow[]> => {
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
    const put = (day: string, patch: Partial<DayRow>) => {
        const row = byDay.get(day) || { day };
        byDay.set(day, { ...row, ...patch, day });
    };

    for (const spec of DAILY) {
        try {
            for (const r of await readAll(spec.recordType, timeRangeFilter)) {
                const when = r.startTime || r.time;
                const amount = spec.value(r);
                if (!when || !Number.isFinite(amount)) continue;
                add(localDayKey(new Date(when)), spec.field, amount as number);
            }
        } catch {
            // A type the person did not grant. The rest of the day still reads.
        }
    }

    /**
     * Resting energy, derived rather than read.
     *
     * Health Connect has no resting-calories record: it has `TotalCaloriesBurned`, which
     * already includes the active burn. Sending the total as `restingKcal` would double-count
     * the workout in every screen that adds the two, so the basal figure is the difference.
     * Floored at zero — the two records can come from different apps and disagree, and a
     * negative resting burn is not a thing a person can be shown.
     */
    try {
        const totals = new Map<string, number>();
        for (const r of await readAll('TotalCaloriesBurned', timeRangeFilter)) {
            const when = r.startTime || r.time;
            const kcal = r.energy?.inKilocalories;
            if (!when || !Number.isFinite(kcal)) continue;
            const day = localDayKey(new Date(when));
            totals.set(day, (totals.get(day) || 0) + kcal);
        }
        for (const [day, total] of totals) {
            const active = (byDay.get(day) as any)?.activeKcal || 0;
            put(day, { restingKcal: Math.max(0, total - active) });
        }
    } catch {
        // Not granted. Active calories still stand on their own.
    }

    // Resting heart rate and HRV are averaged rather than summed
    for (const [recordType, field, pick] of [
        ['RestingHeartRate', 'restingBpm', (r: any) => r.beatsPerMinute],
        ['HeartRateVariabilityRmssd', 'hrvMs', (r: any) => r.heartRateVariabilityMillis],
    ] as const) {
        try {
            const buckets = new Map<string, number[]>();
            for (const r of await readAll(recordType, timeRangeFilter)) {
                const when = r.time || r.startTime;
                const v = pick(r);
                if (!when || !Number.isFinite(v)) continue;
                const day = localDayKey(new Date(when));
                buckets.set(day, [...(buckets.get(day) || []), v]);
            }
            for (const [day, values] of buckets) {
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                put(day, { [field]: Math.round(mean) } as Partial<DayRow>);
            }
        } catch {
            // Not granted, or not recorded by this device
        }
    }

    for (const [day, heart] of await readDailyHeart(from)) put(day, heart);

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

        const token = decodeCursor(cursor);

        let activities: ActivityRow[] = [];
        let sleep: SleepRow[] = [];
        let nextToken: string | null = null;
        let windowFrom = backfillFrom();

        if (token) {
            const changes = await getChanges({ changesToken: token });

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

        if (!token || nextToken === null) {
            // First sync, or a token that expired: read the backfill window directly.
            const timeRangeFilter = {
                operator: 'between' as const,
                startTime: windowFrom.toISOString(),
                endTime: new Date().toISOString(),
            };

            try {
                activities = (await readAll('ExerciseSession', timeRangeFilter))
                    .map(toActivityRow)
                    .filter(Boolean) as ActivityRow[];
            } catch { /* not granted */ }

            try {
                sleep = (await readAll('SleepSession', timeRangeFilter))
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

        // A session record is a type and two timestamps; everything else it is worth
        // showing lives in neighbouring record types. See `enrich`.
        activities = await enrichAll(activities);

        const days = await readDays(windowFrom);
        const granted = await getGrantedPermissions();

        return {
            platform: 'health_connect',
            tzOffset: new Date().getTimezoneOffset(),
            cursor: encodeCursor(nextToken),
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
