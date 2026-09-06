/**
 * Predictive health analysis client.
 *
 * **The forecast is computed on the server and this file only fetches it**, for the three
 * reasons `lib/score.ts` gives about the LabTrack score, all of which apply harder here:
 * the fit reads up to a year of rows across four collections, the interval has to be stored
 * so it can be scored against what actually happened, and two phones must not disagree about
 * what somebody was told last week.
 *
 * Two things this file is careful about, because the screens depend on them:
 *
 * 1. **A refusal is a first-class result, not an error.** `predict()` and `getInsight()`
 *    answer 422 with a sentence when there is not enough history, and the design has a
 *    screen for exactly that. Callers get `{ ok: false, refusal }` rather than a thrown
 *    `ApiError`, so "we need three readings" never renders as "something went wrong".
 * 2. **Nothing here computes a health figure.** Every number on every prediction screen came
 *    off `utils/predictionForecast.js`. The helpers below format, colour and label — none of
 *    them derives a value, and adding one that did would put a second forecaster in the app
 *    that could disagree with the first. That is the mistake `lib/healthScore.ts` was.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import { api, ApiError } from './api';
import { METRIC_ROUTE as TRACKER_ROUTE, METRIC_TINT as TRACKER_TINT } from './metrics';
import { Palette } from '@/constants/theme';
import type { Ionicons } from '@expo/vector-icons';

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export type MetricKey =
    | 'turing_score' | 'blood_pressure' | 'weight' | 'sleep'
    | 'calories' | 'resting_heart_rate' | 'steps' | 'hydration';

export type Direction = 'rising' | 'falling' | 'flat';
export type BetterWhen = 'rising' | 'falling' | null;
export type Tone = 'reassuring' | 'neutral' | 'watchful' | 'urgent';

export interface Horizon {
    days: number;
    /** `1d` | `1w` | `1m` | `3m` | `1y` */
    id: string;
    /** "Next 1w" — the design's chip. */
    label: string;
    /** "the next 1 week" — for sentences. */
    long: string;
}

/** What the fit was standing on. Shown on the Details screen, because it is the provenance. */
export interface Basis {
    points: number;
    spanDays: number;
    firstAt: string;
    lastAt: string;
    lastValue: number;
    staleDays: number;
    sd: number;
}

export interface Component {
    key: string;
    label: string;
    point: number;
    low: number;
    high: number;
    margin: number;
    currentValue: number | null;
    changePct: number | null;
    direction: Direction;
    slopePerDay: number;
    confidence: number;
    basis: Basis;
}

/** The clinical band of the predicted value, staged by the same table a reading is staged by. */
export interface Band {
    key: string;
    label: string;
    detail?: string;
    crisis?: boolean;
    driver?: string;
}

export interface Risk {
    label: string;
    detail: string;
    risk: 'high' | 'moderate' | 'low';
    preventable: boolean;
    /** The forecast's own confidence — never the model's opinion of one. */
    chance: number | null;
}

export interface Narrative {
    headline?: string;
    summary?: string;
    tone?: Tone;
    keyFactors: string[];
    suggestions: string[];
    risks: Risk[];
    componentNotes: { component: string; note: string }[];
    /** True when no model was available and the prose is the deterministic fallback. */
    degraded: boolean;
    model: string | null;
}

/** What actually happened. Null until the target date arrives with a reading to check. */
export interface Resolution {
    resolvedAt: string;
    actual: number | null;
    actualPair?: { systolic: number; diastolic: number };
    error: number | null;
    absErrorPct: number | null;
    withinInterval: boolean | null;
    actualDirection: Direction | null;
    directionCorrect: boolean | null;
}

export interface SeriesPoint {
    day: string;
    value: number;
    low?: number;
    high?: number;
    secondary?: number;
    secondaryLow?: number;
    secondaryHigh?: number;
}

export interface Display {
    /** "126/96" or "82.4" — what the big number prints. */
    value: string;
    /** "120-132 / 92-100" — the interval, which is what is actually being claimed. */
    range: string;
    margin: string;
}

export interface Prediction {
    id: string;
    metric: MetricKey;
    metricLabel: string;
    unit: string | null;
    horizonDays: number;
    horizonId: string;
    horizonLabel: string;
    targetDate: string;
    generatedAt: string;
    components: Component[];
    band: Band | null;
    confidence: number;
    narrative: Narrative;
    resolution: Resolution | null;
    series: { history: SeriesPoint[]; projected: SeriesPoint[] };
    display: Display | null;
    disclaimer: string;
}

/** The compact row the "Past Predictions" list draws. */
export interface PredictionSummary {
    id: string;
    metric: MetricKey;
    metricLabel: string;
    unit: string | null;
    generatedAt: string;
    targetDate: string;
    horizonLabel: string;
    display: Display | null;
    direction: Direction;
    changePct: number | null;
    band: Band | null;
    confidence: number;
    resolution: Resolution | null;
    spark: number[];
}

/** Why a metric cannot be predicted yet, in the words the design's modal prints. */
export interface Refusal {
    reason: 'too_few' | 'no_span' | 'horizon_too_far';
    need: number;
    have: number;
    maxHorizonDays?: number;
    message: string;
    metric?: string;
    component?: string;
}

export interface PredictableMetric {
    key: MetricKey;
    label: string;
    shortLabel: string;
    unit: string;
    icon: string;
    betterWhen: BetterWhen;
    ready: boolean;
    observations: number;
    maxHorizonDays: number;
    horizons: Horizon[];
    /** "Up to 3 weeks ahead", or what is still needed. */
    reach: string;
    /** The series' own scatter as a share of the reading — the design's "Deviation" line. */
    deviationPct: number | null;
    latest: number | null;
    refusal: Refusal | null;
}

export interface Accuracy {
    resolved: number;
    withinIntervalPct: number;
    medianErrorPct: number | null;
}

export interface Overview {
    metricsPredicted: number;
    improvement: { pct: number; of: number } | null;
    accuracy: Accuracy | null;
    scorePrediction: Prediction | null;
    metricPredictions: Prediction[];
    past: PredictionSummary[];
    professionals: {
        id: string; name: string; speciality: string;
        image: string; country: string; hourlyRate: number;
    }[];
    disclaimer: string;
}

export interface Insight {
    metric: {
        key: MetricKey; label: string; unit: string;
        icon: string; betterWhen: BetterWhen; decimals: number;
    };
    horizonDays: number;
    horizonId: string;
    horizons: Horizon[];
    components: Component[];
    band: Band | null;
    confidence: number;
    display: Display;
    headline: string;
    series: { history: SeriesPoint[]; projected: SeriesPoint[] };
    calendar: CalendarDay[];
    safetyNote: string | null;
    disclaimer: string;
}

export interface CalendarDay {
    day: string;
    value: number;
    direction: 'up' | 'down' | 'level';
    /** Whether that direction is good *for this metric* — never the direction itself. */
    tone: 'good' | 'bad' | 'neutral';
    delta: number;
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

/**
 * A call that can legitimately answer "not enough data".
 *
 * `ok: false` with a refusal is a *state*, not a failure — the design draws a whole screen
 * for it. Anything else still throws, so a real outage is not disguised as an empty tracker.
 */
export type Attempt<T> = { ok: true; data: T } | { ok: false; refusal: Refusal; metricLabel: string };

const attempt = async <T>(run: () => Promise<T>): Promise<Attempt<T>> => {
    try {
        return { ok: true, data: await run() };
    } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.body?.refusal) {
            return { ok: false, refusal: err.body.refusal, metricLabel: err.body.metricLabel };
        }
        throw err;
    }
};

export const getOverview = () => api.get<Overview>('/predictions/overview');

export const getPredictableMetrics = () =>
    api.get<{ metrics: PredictableMetric[]; minObservations: number; disclaimer: string }>(
        '/predictions/metrics',
    );

export const listPredictions = (metric?: MetricKey, limit = 20) =>
    api.get<{ predictions: Prediction[] }>(
        `/predictions?limit=${limit}${metric ? `&metric=${metric}` : ''}`,
    );

export const getPrediction = (id: string) =>
    api.get<{ prediction: Prediction }>(`/predictions/${id}`);

export const predict = (metric: MetricKey, horizon: string) =>
    attempt(async () => {
        const { prediction } = await api.post<{ prediction: Prediction }>('/predictions', { metric, horizon });
        return prediction;
    });

export const getInsight = (metric: MetricKey, horizon: string) =>
    attempt(() => api.get<Insight>(`/predictions/insight/${metric}?horizon=${horizon}`));

export const getAccuracy = () =>
    api.get<{
        total: number; overall: Accuracy | null;
        byMetric: Record<string, { label: string; total: number } & Partial<Accuracy>>;
        note: string | null;
    }>('/predictions/accuracy');

export const getStatus = () =>
    api.get<{ forecasting: boolean; narrative: boolean; minObservations: number }>('/predictions/status');

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/** Icons per metric. A metric with no icon here falls back to the analytics glyph. */
export const METRIC_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    turing_score: 'medkit',
    blood_pressure: 'heart',
    weight: 'barbell',
    sleep: 'moon',
    calories: 'flame',
    resting_heart_rate: 'pulse',
    steps: 'footsteps',
    hydration: 'water',
};

export const iconFor = (metric: string) => METRIC_ICON[metric] ?? 'analytics';

/**
 * Where a metric's own tracker lives, so a prediction is never a dead end.
 *
 * The rule `PILLAR_ROUTE` states on the score screen: a figure someone is told about and
 * cannot act on is worse than one they are not told about.
 *
 * **Delegated to `lib/metrics.ts` wherever the keys overlap.** Hand-writing these produced
 * three dead links on the first pass — `/metrics/blood_pressure` (the route is hyphenated),
 * and `/metrics/sleep` and `/metrics/steps`, which do not exist at all: `app/metrics/[kind]`
 * only serves the loggable kinds, and the device-fed ones live under `/activity`. Nothing
 * errors on a bad push, so a wrong route here is a button that silently does nothing.
 */
export const METRIC_ROUTE: Record<string, string> = {
    turing_score: '/score',
    calories: '/nutrition',
    resting_heart_rate: TRACKER_ROUTE.heart_rate,
    blood_pressure: TRACKER_ROUTE.blood_pressure,
    weight: TRACKER_ROUTE.weight,
    sleep: TRACKER_ROUTE.sleep,
    steps: TRACKER_ROUTE.steps,
    hydration: TRACKER_ROUTE.hydration,
};

/**
 * The colour a metric is drawn in — its icon, its chart line where nothing else decides one.
 *
 * **Reused from `lib/metrics.ts` wherever the keys overlap**, so hydration is the same blue on
 * the metrics dashboard and on a prediction of it. Two tints for one metric reads as two
 * different metrics.
 *
 * This is identity, not status: `toneColour` below is what says whether a movement is good,
 * and these must never be used for that. The three that are new here are the three the metrics
 * dashboard has no card for.
 */
export const METRIC_TINT: Record<string, string> = {
    ...TRACKER_TINT,
    /**
     * The deep brand violet, **not** `Palette.primary`.
     *
     * `primary` is already blood pressure's tint in `lib/metrics.ts`, and the picker lists the
     * two of them adjacently — two identical violet glyphs on the app's two most important
     * metrics is the exact failure the tints were added to fix. The score is the aggregate of
     * every other row, so the darkest point of the brand ramp is the right one for it.
     */
    turing_score: Palette.primaryDeep,
    /**
     * Orange rather than `Palette.amber`. Weight is `#F59E0B` and sits two rows away; at glyph
     * size the two ambers are one colour. This is warm enough to separate from it and reads
     * with the flame.
     */
    calories: '#F97316',
    /** Resting heart rate shares the heart-rate rose; it is the same measurement, at rest. */
    resting_heart_rate: TRACKER_TINT.heart_rate,
};

export const tintFor = (metric: string) => METRIC_TINT[metric] ?? Palette.primary;

/**
 * The soft wash behind a metric's icon.
 *
 * The tint at 12% rather than a per-metric surface token: eight metrics would mean eight new
 * palette entries whose only job is to be the same hue one step paler, and the first one
 * somebody forgot to add would fall back to grey — which is exactly the state this replaced.
 * React Native accepts `#rrggbbaa`.
 */
export const tintSurface = (metric: string) => `${tintFor(metric)}1F`;

/**
 * The colour a movement is drawn in.
 *
 * **Direction is not the colour.** A falling blood pressure is green and a falling step count
 * is not, and a metric with no better direction — weight, calories — is never coloured at all,
 * because doing so would make the app take a view on somebody's body. `betterWhen` carries
 * that decision from the server so the two halves cannot disagree.
 */
export const toneColour = (direction: Direction, betterWhen: BetterWhen): string => {
    if (!betterWhen || direction === 'flat') return Palette.textSecondary;
    return direction === betterWhen ? Palette.successDeep : Palette.danger;
};

/** The tint behind a chip drawn in `toneColour`. */
export const toneSurface = (direction: Direction, betterWhen: BetterWhen): string => {
    if (!betterWhen || direction === 'flat') return Palette.surface;
    return direction === betterWhen ? Palette.successSurface : Palette.dangerSurface;
};

export const DIRECTION_ICON: Record<Direction, React.ComponentProps<typeof Ionicons>['name']> = {
    rising: 'trending-up',
    falling: 'trending-down',
    flat: 'remove',
};

/**
 * How a confidence figure is described, and where the wording changes.
 *
 * 0.6 is the same threshold `predictionEngine.WEAK_CONFIDENCE` uses to force the summary to
 * say so in plain words. Kept in step by hand rather than fetched: it is a copy decision here
 * and a prompt decision there, and coupling them through the network would be worse than a
 * comment.
 */
export const confidenceLabel = (c: number): { label: string; colour: string; weak: boolean } => {
    if (c >= 0.8) return { label: 'High confidence', colour: Palette.successDeep, weak: false };
    if (c >= 0.6) return { label: 'Moderate confidence', colour: Palette.info, weak: false };
    if (c >= 0.45) return { label: 'Low confidence', colour: Palette.warning, weak: true };
    return { label: 'Very low confidence', colour: Palette.danger, weak: true };
};

export const confidencePct = (c: number) => `${Math.round(c * 100)}%`;

/**
 * The band's colour. Crisis is deliberately not on the ladder.
 *
 * `bloodPressure.isCrisis` is kept off the band ladder on the server for exactly this reason
 * — so a screen cannot render "seek care now" as one more warm shade — and the client has to
 * honour that or the property is lost at the last step.
 */
export const bandColour = (band: Band | null): string => {
    if (!band) return Palette.textSecondary;
    if (band.crisis) return Palette.danger;
    switch (band.key) {
        case 'healthy': case 'normal': return Palette.successDeep;
        case 'suboptimal': case 'elevated': return Palette.warning;
        case 'attention': case 'stage_1': case 'stage_2': case 'low': return Palette.danger;
        default: return Palette.textSecondary;
    }
};

/** "in 6 days", "today", "3 weeks ago". */
export const relativeDay = (iso: string): string => {
    const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    const n = Math.abs(days);
    const unit = n >= 60 ? `${Math.round(n / 30)} months` : n >= 14 ? `${Math.round(n / 7)} weeks` : `${n} days`;
    return days > 0 ? `in ${unit}` : `${unit} ago`;
};

export const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The value with its unit, as the big number prints it.
 *
 * The interval is a separate string on purpose: every screen that shows `value` also has to
 * show `range` beside it, and returning one concatenated string would let a caller drop the
 * half that carries the uncertainty.
 */
export const withUnit = (value: string, unit: string | null) => (unit ? `${value} ${unit}` : value);

/**
 * Whether a resolved prediction landed.
 *
 * Null-safe on purpose: an unresolved prediction is unresolved, never a miss, which is the
 * distinction `Prediction.resolution` exists to keep.
 */
export const outcomeOf = (r: Resolution | null): { label: string; colour: string } | null => {
    if (!r?.resolvedAt || r.withinInterval === null) return null;
    return r.withinInterval
        ? { label: 'Landed in range', colour: Palette.successDeep }
        : { label: 'Missed the range', colour: Palette.warning };
};

/* ------------------------------------------------------------------ *
 * The first-run gate
 * ------------------------------------------------------------------ */

export const PREDICT_INTRO_KEY = 'predictIntroSeen';

/**
 * Open the predictor, showing the value-prop screen only on a first visit.
 *
 * Here rather than in each caller for the reason `openResourcesHub` gives: there are three
 * entry points already — the home rail, the quick-action sheet and the score screen — and a
 * gate implemented three times is one that eventually disagrees with itself.
 *
 * A storage read that fails opens the hub rather than the intro. The worse of the two
 * failures is showing the pitch again to somebody who has already read it.
 */
export const openPredictions = async (router: Router): Promise<void> => {
    let seen = 'true';
    try {
        seen = (await AsyncStorage.getItem(PREDICT_INTRO_KEY)) ?? '';
    } catch {
        seen = 'true';
    }
    router.push((seen ? '/predict' : '/predict/intro') as never);
};
