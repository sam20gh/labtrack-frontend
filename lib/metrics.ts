/**
 * Health metrics client — weight, hydration, blood pressure.
 *
 * These are the three metrics in the design's list that no connected device reports into
 * Predyqt yet, so **they are entered by hand and that entry is the source of truth**. A
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
import { schemed } from '@/constants/theme';

const tzOffset = () => new Date().getTimezoneOffset();

export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export type MetricKey =
    | 'weight' | 'blood_pressure' | 'heart_rate' | 'hrv' | 'spo2' | 'temperature'
    | 'sleep' | 'hydration' | 'steps';

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
    /** HRV only: the median of the person's previous 28 days, once five exist. */
    baseline?: number | null;
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
    /** Present on a *classified* level: the day's attainment against its own target. */
    percent?: number;
    /**
     * The floor of the band, as a percentage of target.
     *
     * Sent on every row of the `levels` table (it is `hydration.LEVELS` verbatim) and absent
     * from a classified `level`. It is what lets a screen band a **past** day — the server
     * only ever classifies today, and re-deriving the thresholds on the client would be a
     * second copy of a clinical table. See `levelForPercent` in `lib/hydration.ts`.
     */
    min?: number;
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
    // The same glyph `DayStats` gives HRV on the activity screen.
    hrv: 'git-compare-outline',
    // Filled, where hydration's drop is an outline: a blood drop, not a glass of water. The
    // colour and the label carry the rest.
    spo2: 'water',
    temperature: 'thermometer-outline',
    sleep: 'moon-outline',
    hydration: 'water-outline',
    steps: 'walk-outline',
};

/**
 * Identity colours — which metric a glyph or line belongs to, never whether it is good.
 *
 * **None of them may be a brand violet.** Blood pressure was `#7C3AED`, the brand itself, so
 * its card read as chrome, and it sat 8.7 ΔE from sleep's indigo (3.5 under deuteranopia):
 * the two failed the dataviz validator's normal-vision floor on the one screen that lists all
 * six. `#0C6EA0` clears every other tint here and every brand step at ≥15, and sits 32 from
 * `danger`: the BP card is the one most likely to carry a red Stage 2 chip beside its icon,
 * so its identity must not be a red either. It is 12.7 from `info`, the closest it comes.
 *
 * Sleep's `#6366F1` is still 8.7 from the brand. That is not fixable here — the brand's three
 * violets span the whole indigo-to-lavender band a night colour would live in — and waits on
 * the brand, not on this table. Validate any change: `validate_palette.js --pairs all`.
 *
 * **Dark has its own set, searched and checked as a set** — lightening each light tint in
 * isolation put blood pressure and hydration at ΔE 3.0 and sleep and hydration at 0.3 for a
 * deuteranope. The dark set keeps each hue within ±24° and was searched against the dark
 * card, the status colours and the brand violets together. Against light mode it is better
 * on every measure: weakest pair 9.8 vs 9.6 (normal vision), weakest neighbours 8.9 vs 3.9
 * (colour-blind), ≥8 from every status and brand colour, ≥6.3:1 on the card vs 2.1:1.
 *
 * It deliberately sits above the validator's dark lightness band (L 0.70–0.80 against a 0.67
 * ceiling). That band stops an area fill dominating a chart; these are glyphs, sparkline
 * strokes and labelled marks, which have to be bright enough to read on near-black.
 *
 * **SpO2 is the one tint whose hue moves between schemes**, and it was searched, not picked.
 * Light `#911342` (wine) clears all six plus `danger`, `warning`, `success`, `info`, `alert`,
 * the brand and prediction's calories orange: ≥14.2 CVD, ≥16.8 normal. No dark tint within
 * ±24° of it clears 15 normal-vision — heart rate's pink and `danger` hold that corner — so
 * dark takes `#C340DB` (magenta), 15.5 normal / 11.4 CVD against everything on the metrics
 * screen, 4.35:1 on the card. Keeping the hue would have meant a pair below the one floor
 * secondary encoding does not excuse. Both were run through `validate_palette.js`; the
 * failures `--pairs all` still reports are pairs that predate it.
 *
 * **Temperature has no hue, because there is none left.** Searched the same way against the
 * seven here plus the brand, with the floors split — ≥15 normal-vision against everything,
 * ≥8 CVD against its list neighbours and ≥6 against the rest. In light mode the only passes
 * were the brand's own lavender and a band of oranges, and every one of those oranges sits
 * within 8 of `warning` (#B45309): an orange thermometer on a health screen reads as an
 * alert, and status colours are reserved. So it takes `textSecondary`, the ink this app
 * gives any glyph that is not an action — the skill's "fold it, don't invent a hue". An
 * eighth *hue* would have to come from re-stepping the whole set, not from squeezing one in.
 */
const METRIC_TINTS: Record<'light' | 'dark', Record<Exclude<MetricKey, 'temperature' | 'hrv'>, string>> = {
    light: {
        weight: '#F59E0B', blood_pressure: '#0C6EA0', heart_rate: '#FB7185', spo2: '#911342',
        sleep: '#6366F1', hydration: '#38BDF8', steps: '#10B981',
    },
    dark: {
        weight: '#F59E0B', blood_pressure: '#54D0EC', heart_rate: '#DF76AC', spo2: '#C340DB',
        sleep: '#A3BBFF', hydration: '#20B2C4', steps: '#59B934',
    },
};

/**
 * **HRV folds to `textSecondary` too, for temperature's reason.** It is the ninth metric on a
 * screen whose searched set already had no room for an eighth hue. `info`, which the
 * activity chart draws HRV in, is a status colour and sits 12.7 ΔE from blood pressure, the
 * closest pair on this list already. The glyph and label carry it.
 */
export const METRIC_TINT = schemed((Palette, scheme): Record<MetricKey, string> => ({
    ...METRIC_TINTS[scheme],
    temperature: Palette.textSecondary,
    hrv: Palette.textSecondary,
}));

/** Which detail route a card opens. Device-fed metrics point at their own trackers. */
export const METRIC_ROUTE: Record<MetricKey, string> = {
    weight: '/metrics/weight',
    blood_pressure: '/metrics/blood-pressure',
    hydration: '/metrics/water',
    heart_rate: '/activity',
    // Charted over time on the activity screen, beside heart rate.
    hrv: '/activity',
    // The bracelet screen, where the latest reading is and a new one can be taken.
    spo2: '/bracelet',
    temperature: '/bracelet',
    sleep: '/sleep/record',
    steps: '/activity',
};

/**
 * The server decides which cards exist, and it deploys independently of this app.
 *
 * So a card can arrive whose key this build has never heard of. The HRV card did exactly
 * that: the API shipped it while installed builds were still on a bundle without `hrv` in
 * these tables, and `router.push(METRIC_ROUTE.hrv)` was `router.push(undefined)`. That
 * throws in the press handler, and a release build answers an uncaught error with a white
 * screen. Every lookup a screen makes by a server-sent key goes through these three, which
 * answer something drawable, or null for "no destination", rather than `undefined`.
 */
export const metricRoute = (key: string): string | null =>
    (METRIC_ROUTE as Record<string, string | undefined>)[key] ?? null;

export const metricIcon = (key: string): string =>
    (METRIC_ICON as Record<string, string | undefined>)[key] ?? 'stats-chart-outline';

export const metricTint = (key: string, palette: { textSecondary: string }): string =>
    (METRIC_TINT as Record<string, string | undefined>)[key] ?? palette.textSecondary;

/** The log route for a loggable card. */
export const LOG_ROUTE: Partial<Record<MetricKey, string>> = {
    weight: '/metrics/log/weight',
    blood_pressure: '/metrics/log/blood-pressure',
    hydration: '/metrics/log/water',
};

export const formatMl = (ml: number | null) =>
    ml === null ? '--' : ml >= 1000 ? `${(ml / 1000).toFixed(2).replace(/0$/, '')} L` : `${ml} ml`;
