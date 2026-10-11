/**
 * The daily readout — Sleep, Recovery, Effort — at the top of the home screen.
 *
 * The server does all of the arithmetic (`labtrack-backend/utils/dailyReadout.js`, a
 * deterministic table, and `utils/effort.js`); this file fetches it and holds the few things
 * only the client draws: the glyph per recovery state and the wording around the numbers.
 *
 * Three rules carried over from the server, because a screen can break each of them:
 *
 * 1. **Recovery is one colour.** The state is said by a word and a glyph, never by green,
 *    amber and red. `danger` is a verdict on a result, and a readiness score is not one.
 * 2. **Null, never zero.** A ring with nothing behind it draws a dash and says why; it never
 *    draws an empty ring that reads as "you scored nothing".
 * 3. **Effort is minutes.** "18 of 30 min" — the guideline's own unit, never an index.
 */
import { api } from './api';
import { metricTint } from './metrics';

const tzOffset = () => new Date().getTimezoneOffset();

/** The three rings, in the order they happen. */
export type ReadoutKind = 'sleep' | 'recovery' | 'effort';

/**
 * Each ring's one colour — the home card and the page dials both read it, so a ring and the
 * page it opens cannot drift apart. Sleep keeps the metrics tint it has everywhere else.
 */
export const readoutTint = (
    kind: ReadoutKind,
    palette: { teal: string; orange: string; textSecondary: string },
): string => (kind === 'sleep' ? metricTint('sleep', palette) : kind === 'recovery' ? palette.teal : palette.orange);

export type RecoveryState = 'recharged' | 'steady' | 'low' | 'learning' | 'insufficient';

export interface RecoverySignal {
    key: 'hrv' | 'resting' | 'sleep' | 'temperature';
    value: number;
    usual: number | null;
    unit: string;
    direction: 'above' | 'below' | 'near' | null;
    points: number | null;
}

export interface Readout {
    day: string;
    /** False when no ring has anything to say — the card is then not drawn. */
    live: boolean;
    sleep: {
        score: number | null;
        asleepMin: number | null;
        efficiency: number | null;
        goalMinutes: number | null;
    } | null;
    recovery: {
        score: number | null;
        state: RecoveryState;
        label: string;
        learning: { have: number; need: number } | null;
        signals: RecoverySignal[];
        /** Temperature points taken off, 0 when the night was not warm. */
        penalty: number;
        /** An urgent vital alert is open; the sentence points at it. */
        held: boolean;
    } | null;
    effort: {
        minutes: number | null;
        moderateMin: number | null;
        vigorousMin: number | null;
        target: number;
        targetReason: 'recharged' | 'steady' | 'low' | 'week_done' | 'default';
        weekMinutes: number;
        weekTarget: number;
        steps: number | null;
        source: 'stream' | 'sessions' | 'both' | null;
        note: 'needs_age' | null;
        /** What counted today. Null on a day nothing measured, or one stored before it existed. */
        breakdown: EffortBreakdown | null;
    };
    /** Today's meals against the plan. Null when nutrition was never set up and nothing logged. */
    fuel: Fuel | null;
    /** A fresh urgent reading holding the readout, named. Null almost always. */
    alert: ReadoutAlert | null;
    sentence: string;
}

/**
 * The urgent reading behind a held readout — what it was and when, and the vital alert's own
 * advice (which always says when to seek care). Only for 24 hours after the reading.
 */
export interface ReadoutAlert {
    metric: string;
    label: string;
    value: string;
    /** "at 02:01 today" / "at 22:10 yesterday", in the person's clock. */
    when: string;
    measuredAt: string;
    title: string | null;
    body: string | null;
}

export interface Fuel {
    meals: number;
    mealsPerDay: number | null;
    calories: number;
    target: number | null;
    protein: number;
    proteinTarget: number | null;
    /** Whether the plan carries diet advice — "on plan" is only ever said when it does. */
    hasGuidance: boolean;
    onPlan: { assessed: number; aligned: number; partial: number; offPlan: number } | null;
    /** Extra kcal for a day more active than usual; null when it is not. Never negative. */
    allowance: number | null;
}

/**
 * The Fuel row's two lines. A status, not a score: what was logged against the target, and —
 * only when there is something to say — how the meals sat with the plan and any allowance for
 * a harder day than usual.
 */
export const fuelLines = (f: Fuel): { main: string; detail: string | null } => {
    const main = f.meals === 0
        ? (f.target != null ? `Nothing logged yet · ${f.target.toLocaleString()} kcal today` : 'Nothing logged yet')
        : `${f.calories.toLocaleString()}${f.target != null ? ` of ${f.target.toLocaleString()}` : ''} kcal · ${f.meals} ${f.meals === 1 ? 'meal' : 'meals'}`;

    const parts: string[] = [];
    if (f.onPlan) {
        const partly = f.onPlan.partial ? `, ${f.onPlan.partial} partly` : '';
        parts.push(`${f.onPlan.aligned} of ${f.onPlan.assessed} on plan${partly}`);
    }
    if (f.allowance) parts.push(`+${f.allowance} kcal for a harder day than usual`);
    return { main, detail: parts.length ? parts.join(' · ') : null };
};

/**
 * The Vitals grid under the readout, in the order it draws: the clinical readings first, the
 * habits after. Nothing the rings already show — heart rate, HRV, temperature, sleep, steps —
 * or the same number would be on the home screen twice.
 */
export const VITAL_KEYS = ['blood_pressure', 'spo2', 'weight', 'stress', 'hydration'] as const;

export type EffortBasis = 'heart_rate' | 'rating' | 'band' | 'type';

export interface EffortSession {
    id: string | null;
    type: string;
    durationMin: number;
    intensity: 'light' | 'moderate' | 'vigorous';
    /** What decided the intensity — see `judgeSession` in `utils/effort.js`. */
    basis: EffortBasis;
    effortMin: number;
}

export interface EffortBreakdown {
    /** Effort the band saw outside every workout; null when no band was worn. */
    bandMin: number | null;
    sessions: EffortSession[];
}

/**
 * Why a workout counted what it did, in one line. Names the evidence that decided it, because
 * a swim that counts nothing has to say it was the rating, not the band, that called it light.
 */
export const effortReason = (s: EffortSession): string => {
    const tail = s.intensity === 'light' ? ", so it isn't counted"
        : s.intensity === 'vigorous' ? ', so it counts double' : '';
    const level = s.intensity === 'vigorous' && s.basis === 'rating' ? 'high effort' : s.intensity;
    switch (s.basis) {
        case 'rating': return `You rated it ${level}${tail}`;
        case 'heart_rate': return `Its heart rate was ${level}${tail}`;
        case 'band': return `Your band read it as ${level}${tail}`;
        default: return `Counted as ${level} for its type${tail}`;
    }
};

export const getReadout = () => api.get<Readout>(`/readout?tzOffset=${tzOffset()}`);

/** One glyph per state, so the word is never carried by colour alone. */
export const RECOVERY_GLYPH: Record<RecoveryState, string> = {
    recharged: '●',
    steady: '◐',
    low: '○',
    learning: '◌',
    insufficient: '◌',
};

/** "7h 40m". */
export const formatSleep = (minutes: number | null) => {
    if (minutes == null) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
};

/** What a signal is called on screen. */
export const SIGNAL_LABEL: Record<RecoverySignal['key'], string> = {
    hrv: 'Heart rate variability',
    resting: 'Resting heart rate',
    sleep: "Last night's sleep",
    temperature: 'Night temperature',
};

/** "41 ms · usual 46", "+0.2 °C", "82". */
export const signalValue = (s: RecoverySignal) => {
    if (s.key === 'temperature') return `${s.value > 0 ? '+' : ''}${s.value} °C vs usual`;
    if (s.key === 'sleep') return `${s.value} score`;
    return `${s.value} ${s.unit}${s.usual != null ? ` · usual ${s.usual}` : ''}`;
};

/** The short line under a pill: "↓ usual 46". Only for signals off their usual. */
export const signalPill = (s: RecoverySignal) => {
    if (s.direction !== 'above' && s.direction !== 'below') return null;
    const arrow = s.direction === 'above' ? '↑' : '↓';
    if (s.key === 'hrv') return `HRV ${s.value} ms ${arrow} usual ${s.usual}`;
    if (s.key === 'resting') return `Resting ${s.value} ${arrow} usual ${s.usual}`;
    if (s.key === 'temperature') return `Night temp ${arrow} ${Math.abs(s.value)} °C`;
    return null;
};

/** The word under the Recovery ring, or the reason there is no score. */
export const recoveryCaption = (r: Readout['recovery']) => {
    if (!r) return 'Wear your band overnight';
    if (r.held) return 'See the reading';
    if (r.state === 'learning' && r.learning) return `Learning · ${r.learning.have} of ${r.learning.need}`;
    return `${RECOVERY_GLYPH[r.state]} ${r.label}`;
};

/**
 * Where a signal's marker sits on the Recovery screen's 0–1 scale, with the usual band in the
 * middle third. Positions are a picture of distance from usual, not a second score.
 */
export const signalPosition = (s: RecoverySignal) => {
    if (s.key === 'sleep') return Math.min(1, Math.max(0, s.value / 100));
    if (s.key === 'temperature') return Math.min(1, Math.max(0, 0.5 + s.value / 1.8));
    if (s.usual == null || s.usual === 0) return 0.5;
    const near = s.key === 'hrv' ? 0.15 : 0.075;
    // One band-width either side of usual fills the middle third.
    return Math.min(1, Math.max(0, 0.5 + ((s.value / s.usual - 1) / near) / 6));
};

export interface RecoveryDetail {
    day: string;
    recovery: Readout['recovery'];
    alert: ReadoutAlert | null;
    /** Plain sentences: which signals moved, never why. */
    reasons: string[];
    /** The last seven days, oldest first; null where nothing was measured. */
    trend: { day: string; score: number | null; state: RecoveryState | null }[];
    effortTarget: number;
    targetReason: Readout['effort']['targetReason'];
}

export const getRecovery = () => api.get<RecoveryDetail>(`/readout/recovery?tzOffset=${tzOffset()}`);

/** What today's effort target is doing, in one line, for the Recovery screen. */
export const TARGET_LINE: Record<Readout['effort']['targetReason'], (min: number) => string> = {
    recharged: (m) => `You're well recovered, so today asks a little more: ${m} effort minutes.`,
    steady: (m) => `A usual day's share of your week: ${m} effort minutes.`,
    low: (m) => `Today asks for less while your body catches up: ${m} effort minutes.`,
    week_done: (m) => `This week's target is met. ${m} effort minutes keeps you moving.`,
    default: (m) => `Today's share of your week: ${m} effort minutes.`,
};
