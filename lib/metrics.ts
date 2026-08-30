/**
 * Health metrics client — weight, hydration, blood pressure.
 *
 * These are the three metrics in the design's list that no connected device reports into
 * LabTrack yet, so **they are entered by hand and that entry is the source of truth**. A
 * logged weight is what the score's body pillar reads; `User.weight` from onboarding is only
 * the fallback, and is labelled as self-reported wherever it is shown.
 *
 * Heart rate, sleep and steps appear on the same list but are read-only here — they come from
 * a health store through `lib/health`. `loggable` on each card says which is which, so the
 * screen never offers a "+" that would open a form for a number the phone measures.
 *
 * Days are local: every call carries `tzOffset`, the rule every tracker in this app follows.
 */
import { api } from './api';

const tzOffset = () => new Date().getTimezoneOffset();

export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export type MetricKey =
    | 'weight' | 'blood_pressure' | 'heart_rate' | 'sleep' | 'hydration' | 'steps';

/** The three that accept a manual entry. The rest are device-fed. */
export type LoggableKind = 'weight' | 'water' | 'blood-pressure';

export interface SeriesPoint {
    day: string;
    value: number | null;
    secondary?: number | null;
    target?: number | null;
    category?: string | null;
}

export interface MetricCard {
    key: MetricKey;
    label: string;
    unit: string;
    value: number | string | null;
    target?: number | null;
    at: string | null;
    status: string;
    statusColour?: string | null;
    /** A crisis-range blood-pressure reading somewhere in the window. */
    urgent?: boolean;
    /** Shown, and labelled, when nothing has been measured — never passed off as a reading. */
    fallback?: { value: number; source: 'reported' } | null;
    series: SeriesPoint[];
    secondarySeries?: SeriesPoint[];
    loggable: boolean;
}

export interface MetricsOverview {
    days: number;
    metrics: MetricCard[];
}

export const getOverview = (days = 7) =>
    api.get<MetricsOverview>(`/metrics/overview?days=${days}&tzOffset=${tzOffset()}`);

/* ------------------------------------------------------------------ *
 * Blood pressure
 * ------------------------------------------------------------------ */

export type BpCategoryKey = 'crisis' | 'stage_2' | 'stage_1' | 'elevated' | 'normal' | 'low';

export interface BpCategory {
    key: BpCategoryKey;
    label: string;
    summary?: string;
    colour: string;
    /** Kept separate from the band so a screen cannot render a crisis as one more chip. */
    isCrisis?: boolean;
    /** Which of the two numbers put the reading in this band. */
    driver?: 'systolic' | 'diastolic' | 'both' | null;
}

export interface MetricLog {
    _id: string;
    kind: 'weight' | 'water' | 'blood_pressure';
    day: string;
    measuredAt: string;
    weightKg?: number | null;
    ml?: number | null;
    drinkType?: string | null;
    systolic?: number | null;
    diastolic?: number | null;
    pulse?: number | null;
    category?: BpCategory | null;
    source: string;
    note?: string | null;
}

export interface MetricHistory {
    kind: string;
    days: number;
    series: SeriesPoint[];
    logs: MetricLog[];
    summary: {
        readings: number;
        mean: { systolic: number; diastolic: number; category: BpCategory };
        worst: { systolic: number; diastolic: number; category: BpCategory; at: string } | null;
        hadCrisis: boolean;
        meanPulse: number | null;
        note: string;
    } | null;
    note: string | null;
}

export const getHistory = (kind: LoggableKind, days = 30) =>
    api.get<MetricHistory>(`/metrics/${kind}/history?days=${days}&tzOffset=${tzOffset()}`);

export const logBloodPressure = (body: {
    systolic: number; diastolic: number; pulse?: number | null; measuredAt?: string; note?: string;
}) =>
    api.post<{ log: MetricLog; category: BpCategory; urgentNote: string | null; note: string }>(
        '/metrics/blood-pressure', { ...body, tzOffset: tzOffset() },
    );

/* ------------------------------------------------------------------ *
 * Weight
 * ------------------------------------------------------------------ */

export const logWeight = (body: { weightKg: number; bodyFatPct?: number; measuredAt?: string; note?: string }) =>
    api.post<{ log: MetricLog; changeKg: number | null; since: string | null; bmi: number | null }>(
        '/metrics/weight', { ...body, tzOffset: tzOffset() },
    );

/* ------------------------------------------------------------------ *
 * Hydration
 * ------------------------------------------------------------------ */

export interface HydrationLevel {
    key: string;
    label: string;
    blurb: string;
    percent?: number;
}

export interface HydrationDay {
    consumedMl: number | null;
    targetMl: number | null;
    /** Number of entries. Zero with 0 ml means "not tracked", not "drank nothing". */
    logs: number;
    /** Null on a day with no logs — that is "not tracked", not "dehydrated". */
    level: HydrationLevel | null;
    remainingMl: number | null;
}

export interface HydrationToday extends HydrationDay {
    day: string;
    /** How the target was arrived at, shown so the number is not a mystery. */
    basis: string[];
    note: string;
    logs: number;
    entries: MetricLog[];
    containers: { key: string; label: string; ml: number }[];
    drinkTypes: { key: string; label: string; factor: number }[];
    levels: HydrationLevel[];
}

export const getHydrationToday = async (): Promise<HydrationToday> => {
    // The server names the entry list `logs` and the entry *count* `logs` on the day rollup;
    // they are split here so a screen cannot render an array where it wanted a number.
    const raw = await api.get<Omit<HydrationToday, 'entries'> & { logs: MetricLog[] }>(
        `/metrics/hydration/today?tzOffset=${tzOffset()}`,
    );
    return { ...raw, entries: raw.logs, logs: raw.logs.length };
};

export const logWater = (body: { ml?: number; container?: string; drinkType?: string; measuredAt?: string }) =>
    api.post<{ log: MetricLog; day: HydrationDay }>(
        '/metrics/water', { ...body, tzOffset: tzOffset() },
    );

export const deleteLog = (id: string) => api.delete<{ message: string; day: string }>(`/metrics/logs/${id}`);

/* ------------------------------------------------------------------ *
 * Reference tables
 * ------------------------------------------------------------------ */

export interface MetricsReference {
    bloodPressure: {
        categories: { key: BpCategoryKey; label: string; systolic: number; diastolic: number; match: string; colour: string }[];
        limits: { systolic: [number, number]; diastolic: [number, number] };
        note: string;
        crisisNote: string;
    };
    hydration: {
        containers: { key: string; label: string; ml: number }[];
        drinkTypes: { key: string; label: string; factor: number }[];
        levels: HydrationLevel[];
        limits: { ml: [number, number] };
        note: string;
    };
}

export const getReference = () => api.get<MetricsReference>('/metrics/reference');

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

export const METRIC_ICON: Record<MetricKey, string> = {
    weight: 'barbell-outline',
    blood_pressure: 'pulse-outline',
    heart_rate: 'heart-outline',
    sleep: 'moon-outline',
    hydration: 'water-outline',
    steps: 'walk-outline',
};

export const METRIC_TINT: Record<MetricKey, string> = {
    weight: '#F59E0B',
    blood_pressure: '#7C3AED',
    heart_rate: '#FB7185',
    sleep: '#6366F1',
    hydration: '#38BDF8',
    steps: '#10B981',
};

/** Which detail route a card opens. Device-fed metrics point at their own trackers. */
export const METRIC_ROUTE: Record<MetricKey, string> = {
    weight: '/metrics/weight',
    blood_pressure: '/metrics/blood-pressure',
    hydration: '/metrics/water',
    heart_rate: '/activity',
    sleep: '/activity',
    steps: '/activity',
};

/** The log route for a loggable card. */
export const LOG_ROUTE: Partial<Record<MetricKey, string>> = {
    weight: '/metrics/log/weight',
    blood_pressure: '/metrics/log/blood-pressure',
    hydration: '/metrics/log/water',
};

export const formatMl = (ml: number | null) =>
    ml === null ? '--' : ml >= 1000 ? `${(ml / 1000).toFixed(2).replace(/0$/, '')} L` : `${ml} ml`;
