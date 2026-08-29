/**
 * The shape both platform readers normalise to, and the shape `/api/wearables/sync`
 * accepts.
 *
 * One vocabulary on purpose. HealthKit talks in `HKWorkoutActivityType` identifiers and
 * quantity samples; Health Connect talks in exercise-type integers and records. If either
 * of those reached the server, the server would need to know both, and every screen would
 * need to know which phone it was running on.
 */

export type HealthPlatform = 'apple_health' | 'health_connect' | 'aggregator';

/** The data families a person grants separately, and the app asks for separately. */
export type HealthScope = 'activity' | 'sleep' | 'heart';

export interface HealthCapability {
    platform: HealthPlatform | null;
    /** The store exists on this device and this build can talk to it. */
    available: boolean;
    /** At least one scope was granted. */
    granted: boolean;
    /** Which families we may actually read. A partial grant is normal, not a failure. */
    scopes?: HealthScope[];
    /** Written to be shown to a person. Present whenever something is unavailable. */
    reason?: string;
    /** The store is fine; this build predates the native module. */
    needsAppUpdate?: boolean;
    /** Android below 14 with no Health Connect app installed. */
    needsInstall?: boolean;
    devices?: { name?: string; model?: string; manufacturer?: string; lastSeenAt?: string }[];
}

export interface SourceDevice {
    name?: string;
    model?: string;
    manufacturer?: string;
}

export interface ActivityRow {
    externalId: string;
    /** The platform's own name for it. The server de-prefixes and maps it. */
    type: string;
    startedAt: string;
    endedAt?: string;
    durationSec?: number;
    distanceM?: number;
    activeKcal?: number;
    elevationM?: number;
    avgBpm?: number;
    maxBpm?: number;
    cadence?: number;
    sourceDevice?: SourceDevice;
}

export type SleepStage = 'awake' | 'light' | 'deep' | 'rem' | 'in_bed' | 'unknown';

export interface SleepRow {
    externalId: string;
    startedAt: string;
    endedAt: string;
    /** Drawn as the hypnogram. Totals are derived from these server-side when present. */
    segments?: { stage: SleepStage; startedAt: string; endedAt: string }[];
    /** Only for sources that report totals without a stage breakdown. */
    stages?: { deepMin?: number; remMin?: number; lightMin?: number; awakeMin?: number };
    asleepMin?: number;
    inBedMin?: number;
    sourceDevice?: SourceDevice;
}

/**
 * Heart-rate readings worth keeping as rows.
 *
 * `context` is mandatory and the server drops anything else. A worn watch emits a reading
 * every few seconds and nothing in the app plots that stream — the dashboards need the
 * day's spread, which travels in `DayRow` instead. 130 bpm mid-run and 130 bpm sitting
 * still are the same integer and different facts, which is what `context` records.
 */
export interface HeartRow {
    externalId: string;
    measuredAt: string;
    bpm: number;
    context: 'resting' | 'active' | 'recovery' | 'sleeping' | 'manual';
    sourceDevice?: SourceDevice;
}

/** Whole-day figures the store reports directly. Steps are not the sum of workouts. */
export interface DayRow {
    day: string;
    steps?: number;
    activeKcal?: number;
    restingKcal?: number;
    exerciseMin?: number;
    distanceM?: number;
    floors?: number;
    restingBpm?: number;
    minBpm?: number;
    maxBpm?: number;
    avgBpm?: number;
    hrvMs?: number;
    zoneMinutes?: number[];
}

export interface SyncBatch {
    platform: HealthPlatform;
    /** `Date.getTimezoneOffset()`. The server cannot infer the calendar the user lives in. */
    tzOffset: number;
    /** Opaque resume token. Persisted server-side and handed back on the next read. */
    cursor: string | null;
    providerLabel?: string;
    permissions?: string[];
    devices?: { name?: string; model?: string; manufacturer?: string; lastSeenAt?: string }[];
    activities: ActivityRow[];
    sleep: SleepRow[];
    heart: HeartRow[];
    days: DayRow[];
}

export interface HealthReader {
    probe(): Promise<HealthCapability>;
    requestPermissions(): Promise<HealthCapability>;
    readSince(cursor: string | null): Promise<SyncBatch>;
}
