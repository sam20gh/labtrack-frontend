/**
 * The shape both platform readers normalise to, and the shape `/api/wearables/sync`
 * accepts.
 *
 * One vocabulary on purpose. HealthKit talks in `HKWorkoutActivityType` identifiers and
 * quantity samples; Health Connect talks in exercise-type integers and records. If either
 * of those reached the server, the server would need to know both, and every screen would
 * need to know which phone it was running on.
 */

export type HealthPlatform = 'apple_health' | 'health_connect' | 'aggregator' | 'jstyle_bracelet';

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
    /**
     * Cardiorespiratory fitness, ml/kg/min.
     *
     * Both readers have asked for this permission since they were written and neither read
     * it, so every person who granted it was handing over a figure nothing collected. It is
     * a *fitness* measure rather than a day's activity — a watch estimates it every few
     * runs, not every day — so it arrives on the days it was estimated and the rest stay
     * null, like every other figure here.
     */
    vo2Max?: number;
    zoneMinutes?: number[];
}

/**
 * A blood-oxygen reading.
 *
 * `manual` is a measurement somebody started themselves; `automatic` is the bracelet's own
 * periodic sweep. Kept apart because they are not equally trustworthy — an automatic sweep
 * fires whether or not the band is seated properly, and a run of low automatic readings
 * from a loose strap should not read like a run of low deliberate ones.
 */
export interface Spo2Row {
    externalId: string;
    measuredAt: string;
    /** Percent. */
    spo2: number;
    context: 'manual' | 'automatic';
    sourceDevice?: SourceDevice;
}

/**
 * A body-temperature reading.
 *
 * `site` matters more than the number. A wrist reading runs degrees below core and is a
 * trend line rather than a temperature; an axillary reading is a real clinical site. Storing
 * both under one figure would let a normal wrist reading of 33 °C look like hypothermia.
 */
export interface TemperatureRow {
    externalId: string;
    measuredAt: string;
    /** Celsius, always. Display units are `lib/units.ts`'s job. */
    celsius: number;
    site: 'wrist' | 'axillary';
    sourceDevice?: SourceDevice;
}

/**
 * A blood-pressure estimate from the bracelet's optical sensor.
 *
 * **This is not a cuff reading**, and `method` is what says so on every row. It is derived
 * from pulse-wave features, it is not validated against a sphygmomanometer, and the vendor
 * exposes a calibration command precisely because it drifts per person.
 *
 * It is nonetheless classified like any other reading, by product decision, so
 * `utils/bloodPressure.js` stages it and a crisis reading raises a crisis. `method` travels
 * with it so a screen, a clinician or a later change of mind can tell the two apart in the
 * record — which would be impossible if the provenance were dropped at ingest.
 */
export interface BloodPressureRow {
    externalId: string;
    measuredAt: string;
    systolic: number;
    diastolic: number;
    pulse?: number;
    method: 'optical_estimate';
    sourceDevice?: SourceDevice;
}

/**
 * One ECG or PPG measurement the person ran on the bracelet.
 *
 * `samples` is the waveform and it is the reason this is its own row rather than a field:
 * a single trace is thousands of integers, which is a document of its own and never
 * something to embed in a day's rollup.
 *
 * Every derived figure here is **the bracelet's own output**, carried rather than computed.
 * Nothing in Miovix interprets an ECG — there is no engine behind it and writing one is a
 * clinical decision, not a feature. The same line the symptom checker holds.
 */
export interface EcgRow {
    externalId: string;
    measuredAt: string;
    kind: 'ecg' | 'ppg';
    /** Waveform samples, raw vendor units. Empty when only a result was reported. */
    samples: number[];
    /** Samples per second, where the device reported it. */
    sampleRateHz?: number;
    durationSec?: number;
    /** The device's own readings, never re-derived here. */
    result?: {
        hrBpm?: number;
        hrvMs?: number;
        stress?: number;
        breathRate?: number;
        systolic?: number;
        diastolic?: number;
        /** The vendor's own quality score. A low one is why a trace may be unreadable. */
        quality?: number;
    };
    sourceDevice?: SourceDevice;
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

    /**
     * Families only a bracelet reports.
     *
     * Optional because neither phone health store fills them: HealthKit and Health Connect
     * readers send batches without these keys and the server has to keep accepting those
     * unchanged. A missing key means "this source does not measure it", which is not the
     * same as an empty array meaning "it measured nothing this time" — the distinction
     * `alignment: 'unassessed'` makes everywhere else in this codebase.
     */
    spo2?: Spo2Row[];
    temperature?: TemperatureRow[];
    bloodPressure?: BloodPressureRow[];
    ecg?: EcgRow[];
}

export interface HealthReader {
    probe(): Promise<HealthCapability>;
    requestPermissions(): Promise<HealthCapability>;
    readSince(cursor: string | null): Promise<SyncBatch>;
}
