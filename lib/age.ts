/**
 * Predyqt Age client.
 *
 * Fetch only, like `lib/score.ts`, and for the same three reasons — the number spans six
 * months across five collections, the pace needs a stored history to have a slope at all, and
 * two phones must not disagree about somebody's own age.
 *
 * There is a fourth reason here that the score does not have: **the guards are the feature.**
 * An acute-phase CRP, an under-age person, a mis-parsed panel, a lymphocyte count mistaken for
 * a percentage — each is a refusal in `utils/biologicalAge.js`, and a client that computed its
 * own age could simply not implement them. Everything below is a type.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import { api } from './api';

/** Minutes west of UTC, as `Date.getTimezoneOffset()` reports it. */
const tzOffset = () => new Date().getTimezoneOffset();

/**
 * Which evidence the number rests on. **Rendered, always.**
 *
 * `lab` is Levine PhenoAge — published, peer-reviewed, validated against mortality follow-up.
 * `lifestyle` is an aggregation of individual hazard ratios whose composite has never been
 * validated against anything. They are not equally well founded, and a screen that showed
 * them identically would be making a claim the backend was careful not to.
 */
export type AgeSource = 'lab' | 'lifestyle' | 'blended';

/** Neutral by construction. There is no red on this feature. */
export type AgeBand = 'younger' | 'on_track' | 'older';

/** Whether somebody could act on a contributor, and what kind of acting it would be. */
export type Modifiable = 'behaviour' | 'clinical' | 'fixed';

export interface AgeContribution {
    key: string;
    label: string;
    value: number;
    /** What a row prints. Blood pressure is a pair, so the raw value is unusable. */
    display?: string | number;
    unit: string;
    /** Lab half only: the typical value the marker was attributed against. */
    reference?: number | null;
    /** Lifestyle half: what a typical person of this age and sex measures. */
    median?: number | string | null;
    /** Lifestyle half: the guideline. Moves nothing; it is what a lever points at. */
    target?: number | string | null;
    /** How many days of the window this figure was measured over. */
    days?: number;
    /** Share of the term kept after the overlap correction. Shown, not folded in silently. */
    weight?: number;
    modifiable?: Modifiable;
    route?: string;
    /** Years this adds (positive) or removes (negative) versus a typical value. */
    years: number;
    capped?: boolean;
}

/** A half that could not answer. `reason` is what the screen turns into a sentence. */
export interface AgeHalfRefusal {
    ok: false;
    source?: AgeSource;
    reason: string;
    message: string;
    /** `incomplete_panel` only — which analytes are missing, so the screen can name them. */
    missing?: { key: string; label: string }[];
    have?: number;
    need?: number;
}

export interface AgeHalf {
    ok: true;
    source: AgeSource;
    method?: string;
    value: number;
    delta: number;
    clamped?: boolean;
    measuredAt?: string | null;
    freshness?: { weight: number; ageDays: number | null; stale: boolean };
    coverage?: { scored: number; total: number; domains: string[] };
    contributions?: AgeContribution[];
    skipped?: { key: string; label: string; reason: string; route?: string }[];
}

/**
 * How fast the gap is opening or closing, in years of biological age per calendar year.
 *
 * **`state` is not decoration.** `measured` is a regression over the stored history and says
 * the number really is moving at this rate. `provisional` is a projection from the last
 * month's behaviour and says nothing about what has actually happened. `unknown` is the only
 * honest answer for somebody with no history, and it must never be drawn as 1.0x — "aging
 * normally" told to somebody about whom nothing is known reads as a reassurance, which makes
 * it worse than a blank rather than a milder version of one.
 */
export interface AgePace {
    ok: boolean;
    state: 'measured' | 'provisional' | 'unknown';
    value?: number;
    clamped?: boolean;
    bounds?: [number, number];
    confidence?: number | null;
    reason?: string;
    message?: string;
    basis?: {
        snapshots?: number;
        spanDays?: number;
        /** Which series was fitted. A blended fit can carry a blood panel's step change. */
        half?: 'lifestyle' | 'blended';
        recentDelta?: number;
        windowDelta?: number;
        recentDays?: number;
        windowDays?: number;
    };
}

export interface PredyqtAge {
    ok: boolean;
    value?: number;
    chronologicalAge?: number;
    /** Biological minus chronological. The number every screen actually leads with. */
    delta?: number;
    band?: AgeBand | null;
    bandLabel?: string | null;
    source?: AgeSource;
    lab?: AgeHalf | AgeHalfRefusal | null;
    lifestyle?: AgeHalf | AgeHalfRefusal | null;
    weights?: Partial<Record<AgeSource, number>>;
    pace?: AgePace;
    change?: { delta: number; deltaGap: number; since: string } | null;
    computedAt?: string;
    cached?: boolean;
    /** Wording matched to `source`. Never a constant — see `DISCLAIMERS` on the server. */
    disclaimer: string;
    /** Set on a refusal. */
    reason?: string;
    message?: string;
}

export interface AgeLever {
    key: string;
    label: string;
    half: 'lab' | 'lifestyle';
    value: number;
    display?: string | number;
    unit: string;
    target: number | string;
    modifiable: Modifiable;
    route: string;
    /** Years off the **blended** age, already scaled by that half's share of it. */
    years: number;
}

export interface AgeLevers {
    ok: boolean;
    value?: number;
    delta?: number;
    source?: AgeSource;
    levers: AgeLever[];
    disclaimer?: string;
    reason?: string;
    message?: string;
}

export interface AgeTrendPoint {
    value: number;
    chronologicalAge: number;
    delta: number;
    band: AgeBand | null;
    source: AgeSource;
    computedAt: string;
}

export const getAge = (opts: { refresh?: boolean } = {}) =>
    api.get<PredyqtAge>(
        `/age?tzOffset=${tzOffset()}${opts.refresh ? '&refresh=true' : ''}`,
    );

export const getAgeTrend = (days = 365) =>
    api.get<{ days: number; points: AgeTrendPoint[]; disclaimer: string }>(
        `/age/trend?days=${days}`,
    );

export const getAgeLevers = () =>
    api.get<AgeLevers>(`/age/levers?tzOffset=${tzOffset()}`);

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/**
 * The gap, worded — **from the band, so the words and the colour cannot disagree**.
 *
 * The first version took its own view: anything inside half a year read as level, everything
 * else was "0.5 years younger". The server's bands are ±2 years, so a gap of −0.5 produced
 * the words "0.5 year younger" over an orb tinted for `on_track` — grey. The label was
 * claiming something the colour was denying, on the one line of the card people actually read.
 *
 * Passing the band in is what makes that impossible. Both now come from the same decision,
 * which is made once, on the server, in `DELTA_BANDS`. A threshold restated here would drift
 * from it the first time either moved — the argument `predictionMetrics.blood_pressure.band`
 * makes by delegating to `bloodPressure.classify` rather than keeping its own cut-offs.
 *
 * The exact figure is not lost: every surface that calls this also prints the two ages.
 */
export const deltaLabel = (
    delta: number | null | undefined,
    band?: AgeBand | null,
): string => {
    if (delta === null || delta === undefined || !Number.isFinite(delta)) return '';
    if (band === 'on_track') return 'About your age';
    const years = Math.abs(delta);
    // No band given — a historic row, or a half rendered on its own. Fall back to the band
    // boundary rather than to a threshold of this file's own invention.
    if (!band && years <= 2) return 'About your age';
    const rounded = years.toFixed(1);
    return `${rounded} ${years < 1.05 ? 'year' : 'years'} ${delta < 0 ? 'younger' : 'older'}`;
};

/**
 * The colour a gap is drawn in.
 *
 * **Not `danger`, ever.** `Palette.danger` is a verdict on a *result* — a potassium that needs
 * attention now — and putting the same red on "your bloods suggest you are four years older"
 * teaches people the colour means nothing. This is the argument `Palette.alert` already makes
 * for error states and `meterWeak` for password strength.
 *
 * `on_track` is deliberately the muted text colour rather than a positive one. Being exactly
 * your own age is the unremarkable case, and colouring it green would make the absence of a
 * finding look like an achievement.
 */
export const BAND_TINT: Record<AgeBand, string> = {
    younger: '#0F766E',
    on_track: '#6B7280',
    older: '#B45309',
};

export const tintForBand = (band: AgeBand | null | undefined) =>
    (band ? BAND_TINT[band] : BAND_TINT.on_track);

/**
 * The pace, worded, with its honesty attached.
 *
 * A measured pace and a provisional one are different claims and are never phrased alike.
 */
export const paceLabel = (pace: AgePace | undefined): string => {
    if (!pace?.ok || pace.value === undefined) return 'Not enough history yet';
    if (Math.abs(pace.value - 1) < 0.05) return 'Aging at about one year per year';
    return pace.value < 1
        ? `Aging slower than the calendar — ${pace.value.toFixed(2)}×`
        : `Aging faster than the calendar — ${pace.value.toFixed(2)}×`;
};

/** Where on the −1×…3× scale a pace sits, 0–1, for the design's track. */
export const paceFraction = (pace: AgePace | undefined): number | null => {
    if (!pace?.ok || pace.value === undefined) return null;
    const [lo, hi] = pace.bounds ?? [-1, 3];
    return Math.min(1, Math.max(0, (pace.value - lo) / (hi - lo)));
};

/**
 * What a half's refusal means, in a sentence somebody can act on.
 *
 * The server's `message` is already written for a person and is used as-is; this only adds
 * the *heading* above it, because a screen needs both a title and a body and the server
 * should not be writing layout.
 */
export const REFUSAL_TITLE: Record<string, string> = {
    no_results: 'No blood results yet',
    incomplete_panel: 'Your results are missing a few markers',
    acute_phase: 'Not while you were unwell',
    implausible: 'Some results could not be read',
    too_young: 'Not shown below 20',
    out_of_range: 'Outside the tested age range',
    no_age: 'We need your date of birth',
    insufficient_coverage: 'Not enough tracked yet',
    no_inputs: 'Nothing to work from yet',
    not_computable: 'Could not work this out',
};

export const refusalTitle = (reason: string | undefined) =>
    (reason && REFUSAL_TITLE[reason]) || 'Not enough to say yet';

/** Gated on a first run, like Predict, Resources and Badges. */
export const AGE_INTRO_KEY = 'ageIntroSeen';

/**
 * Open the feature, showing the value-prop screen only on a first visit.
 *
 * Here rather than in each caller, for the reason `openPredictions` gives: the home card and
 * the score screen both reach it, and a gate implemented twice is one that eventually
 * disagrees with itself. A storage read that fails opens the hub — showing the pitch twice is
 * the better of the two failures.
 */
export const openAge = async (router: Router): Promise<void> => {
    let seen = 'true';
    try {
        seen = (await AsyncStorage.getItem(AGE_INTRO_KEY)) ?? '';
    } catch {
        seen = 'true';
    }
    router.push((seen ? '/age' : '/age/intro') as never);
};
