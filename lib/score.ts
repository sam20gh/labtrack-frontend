/**
 * LabTrack score client.
 *
 * The score used to be computed here, in `lib/healthScore.ts`, from the biomarkers and the
 * health assessment the home screen happened to have loaded. It is now computed on the
 * server and this file only fetches it. Three reasons, and they are worth knowing before
 * anyone is tempted to move it back:
 *
 *   1. **It reads data this app does not hold.** The score spans thirty days of activity,
 *      sleep, heart, meal and dose rows across five collections. Pulling all of that down to
 *      average it would be a slow way to arrive at a number the server can return in one
 *      call.
 *   2. **The trend needs history.** The breakdown screen draws a score chart. A number
 *      recomputed in a `useMemo` and thrown away has no history to draw.
 *   3. **Two phones must agree.** A score computed on the client means someone's own number
 *      differs between their devices.
 *
 * The important behavioural change: **the score is now based on what the trackers measured,
 * not on what the person said during onboarding.** Every pillar carries a `source`, and the
 * UI is expected to show it — a number still running on questionnaire answers has to say so,
 * or someone will trust it more than it deserves.
 */
import { api } from './api';

/** Minutes west of UTC, as `Date.getTimezoneOffset()` reports it. */
const tzOffset = () => new Date().getTimezoneOffset();

export type PillarKey =
    | 'biomarkers' | 'activity' | 'sleep' | 'nutrition'
    | 'medication' | 'vitals' | 'body' | 'plan' | 'mind';

export type ScoreBand = 'healthy' | 'suboptimal' | 'attention';

/**
 * Where a pillar's number came from.
 *
 * `observed` — measured: a synced session, a logged meal, a recorded dose, a lab report.
 * `reported` — the onboarding questionnaire, which is worth less and decays.
 * `none`     — nothing to score. The pillar still renders, so the screen can say what is
 *              missing and how to fill it.
 */
export type PillarSource = 'observed' | 'reported' | 'none';

export interface Pillar {
    key: PillarKey;
    /** Short axis label — the radar has no room for more than one word. */
    label: string;
    /** 0–100, or null when we hold no data for it. Never 0 as a stand-in for "unknown". */
    value: number | null;
    band: ScoreBand | null;
    detail: string;
    source: PillarSource;
    /** Pillar-specific working — session counts, adherence, BMI. Shape varies. */
    [extra: string]: unknown;
}

export interface ScoreCoverage {
    scored: number;
    observed: number;
    reported: number;
    total: number;
    /** Share of the weighted total that came from measurement, 0–100. */
    observedWeight: number;
}

export interface ScoreChange {
    delta: number;
    since: string;
    improved: { key: PillarKey; label: string; delta: number }[];
    declined: { key: PillarKey; label: string; delta: number }[];
}

export interface HealthScore {
    /** 0–100, or null when too few pillars hold data to be meaningful. */
    value: number | null;
    band: ScoreBand | null;
    bandLabel: string | null;
    headline: string;
    pillars: Pillar[];
    coverage: ScoreCoverage;
    windowDays: number;
    computedAt: string;
    change: ScoreChange | null;
    disclaimer: string;
    bands: { key: ScoreBand; label: string; min: number; max: number }[];
}

export interface TrendPoint {
    at: string;
    value: number;
    band: ScoreBand;
    trigger: string;
    pillars: Partial<Record<PillarKey, number | null>>;
}

export interface ScoreTrend {
    range: string;
    points: TrendPoint[];
    /** Percent change across the window — the design's "+2.5%" chip. */
    change: number | null;
    best: number | null;
    mean: number | null;
}

export const getScore = (opts: { refresh?: boolean } = {}) =>
    api.get<HealthScore>(
        `/score?tzOffset=${tzOffset()}${opts.refresh ? '&refresh=1' : ''}`,
    );

export type TrendRange = '1w' | '1m' | '1y' | 'all';

export const getTrend = (range: TrendRange = '1m') =>
    api.get<ScoreTrend>(`/score/trend?range=${range}`);

/**
 * Force a recalculation.
 *
 * Call this after a device sync completes. Logging a meal, a dose or a session already
 * triggers one server-side, so the screens for those do not need to.
 */
export const recompute = (trigger: 'sync' | 'manual' = 'manual') =>
    api.post<HealthScore>('/score/recompute', { trigger, tzOffset: tzOffset() });

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/**
 * Band colours and labels.
 *
 * The kit calls the bottom band "Critical". It is not called that here, for the reason the
 * sleep score already documents: this is an engagement summary over someone's own records,
 * and a person who simply has not logged anything for a fortnight must not be told they are
 * in a critical state by a number that knows nothing about them.
 */
export const BAND_META: Record<ScoreBand | 'unknown', { label: string; color: string }> = {
    healthy: { label: 'Healthy', color: '#34D399' },
    suboptimal: { label: 'Suboptimal', color: '#FBBF24' },
    attention: { label: 'Needs attention', color: '#FB7185' },
    unknown: { label: 'Not enough data', color: '#CBD5E1' },
};

export const bandMeta = (band: ScoreBand | null) => BAND_META[band ?? 'unknown'];

/** How a pillar's provenance reads on the breakdown screen. */
export const SOURCE_META: Record<PillarSource, { label: string; color: string }> = {
    observed: { label: 'Measured', color: '#7C3AED' },
    reported: { label: 'You told us', color: '#F59E0B' },
    none: { label: 'No data', color: '#94A3B8' },
};

/** The icon each pillar carries, matching the metric list in the kit. */
export const PILLAR_ICON: Record<PillarKey, string> = {
    biomarkers: 'water-outline',
    activity: 'walk-outline',
    sleep: 'moon-outline',
    nutrition: 'nutrition-outline',
    medication: 'medkit-outline',
    vitals: 'heart-outline',
    body: 'body-outline',
    plan: 'calendar-outline',
    mind: 'happy-outline',
};

/**
 * Whether the score is still mostly a self-assessment.
 *
 * The threshold matches `MOSTLY_OBSERVED` in the backend engine. Screens use this to decide
 * whether to show the "connect a device" prompt — a number that is 80% questionnaire should
 * not be presented with the same confidence as one built from a month of measurements.
 */
export const isMostlyReported = (score: HealthScore) =>
    score.value !== null && score.coverage.observedWeight < 50;

/** Screens that fill a given pillar, for the breakdown's "fix this" action. */
export const PILLAR_ROUTE: Partial<Record<PillarKey, string>> = {
    activity: '/activity',
    sleep: '/activity/sources',
    nutrition: '/nutrition',
    medication: '/medications',
    vitals: '/activity/sources',
    biomarkers: '/add-result',
    plan: '/myplans',
    body: '/profile',
};
