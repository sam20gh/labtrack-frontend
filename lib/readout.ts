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

const tzOffset = () => new Date().getTimezoneOffset();

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
    };
    sentence: string;
}

/**
 * The Vitals grid under the readout, in the order it draws: the clinical readings first, the
 * habits after. Nothing the rings already show — heart rate, HRV, temperature, sleep, steps —
 * or the same number would be on the home screen twice.
 */
export const VITAL_KEYS = ['blood_pressure', 'spo2', 'weight', 'stress', 'hydration'] as const;

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
    if (r.held) return 'See your alert';
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
