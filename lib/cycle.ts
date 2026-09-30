/**
 * Cycle tracker client — `/api/cycle`.
 *
 * Four things worth knowing before using it.
 *
 * **Every number comes from the server.** When the next period is likely, whether somebody is
 * late, which days are fertile: all of it is `utils/cycleForecast.js`, a deterministic table
 * with tests. This file only fetches, formats and words it. A second copy of the rules here
 * would be a second opinion about somebody's body, and the two would eventually disagree.
 *
 * **A day is the person's local `YYYY-MM-DD`,** sent as a string and never through a `Date`
 * that could move it across midnight. `tzOffset` rides every read so the server knows what
 * "today" is here.
 *
 * **A prediction is a window, and every screen says so.** `formatRange(window)` — "16–20 Sep" —
 * is what a screen prints, never the expected day alone.
 *
 * **The wording is a table, not a template per screen.** `headline()` is the one place that
 * turns a state into a sentence, so the dashboard, the home card and the calendar cannot
 * describe the same Tuesday differently. The late copy names the ordinary causes, pregnancy
 * among them, and never names a condition.
 */
import type { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { api } from './api';

const tzOffset = () => new Date().getTimezoneOffset();
const DAY_MS = 86_400_000;

/** Local `YYYY-MM-DD`, matching how the server stores `CycleDay.day`. */
export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const toTime = (day: string) => Date.parse(`${day}T00:00:00.000Z`);
export const addDays = (day: string, n: number): string =>
    new Date(toTime(day) + n * DAY_MS).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string): number => Math.round((toTime(b) - toTime(a)) / DAY_MS);
export const daysBetween = (from: string, to: string): string[] => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
};

/* ------------------------------------------------------------------ types */

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy' | 'unspecified';
export type Symptom =
    | 'cramps' | 'headache' | 'bloating' | 'breast_tenderness' | 'acne' | 'fatigue'
    | 'back_pain' | 'nausea' | 'cravings' | 'mood_swings' | 'insomnia' | 'diarrhoea';
export type CycleStatus = 'none' | 'hormonal_contraception' | 'pregnant' | 'breastfeeding' | 'perimenopause';
export type CycleAccess = 'enabled' | 'off' | 'dismissed' | 'suggested' | 'offer' | 'hidden';
export type CycleState = 'period' | 'upcoming' | 'due' | 'late' | 'very_late' | 'long_gap' | 'paused' | 'unknown';

export interface CyclePlan {
    enabled: boolean;
    onboarded: boolean;
    seed: { lastPeriodStart: string | null; periodLength: number | null; cycleLength: number | null };
    status: CycleStatus;
    showFertileWindow: boolean;
    /** False under hormonal contraception or a paused status, whatever the switch says. */
    fertileAllowed: boolean;
    reminders: { periodSoon: boolean; late: boolean };
    discreetPush: boolean;
}

export interface DayWindow { from: string; to: string }

export interface CyclePrediction {
    expected: string;
    window: DayWindow;
    cycleLength: number;
    spread: number;
    /** `observed`: from logged cycles. `reported`: from the setup answers. */
    source: 'observed' | 'reported';
    cyclesUsed: number;
}

export interface ProjectedPeriod {
    start: string;
    end: string;
    window: DayWindow;
    ovulation: string | null;
    fertile: DayWindow | null;
}

export interface CycleReading {
    state: CycleState;
    reason: 'needs_period' | 'needs_length' | CycleStatus | null;
    cycleDay: number | null;
    lastStart: string | null;
    lastStartSource: 'logged' | 'reported' | null;
    currentPeriod: { start: string; day: number; loggedThrough: string; expectedEnd: string } | null;
    prediction: CyclePrediction | null;
    daysUntil: { from: number; to: number } | null;
    daysLate: number | null;
    daysSinceStart: number | null;
    periodLength: { length: number; source: 'observed' | 'reported' | 'default' };
    luteal: { days: number; source: 'temperature' | 'default' };
    next: ProjectedPeriod | null;
    /** The next fertile window that has not ended — null unless it is switched on and allowed. */
    fertile: { window: DayWindow; ovulation: string | null; now: boolean } | null;
}

/** What to draw on one day. The calendar and the week strip both read this. */
export interface DayMark {
    day: string;
    today: boolean;
    future: boolean;
    flow: Flow | null;
    /** A logged period day. */
    period: boolean;
    /** Bleeding logged between periods. */
    between: boolean;
    /** `period`: a predicted period day. `window`: inside the start window only. */
    predicted: 'period' | 'window' | null;
    fertile: boolean;
    ovulation: boolean;
    ovulationConfirmed: boolean;
    symptoms: number;
    mood: number | null;
    note: boolean;
}

export interface DayEntry {
    day: string;
    flow: Flow | null;
    symptoms: Symptom[];
    mood: number | null;
    note: string | null;
    source?: string;
}

export interface CycleStats {
    cyclesLogged: number;
    averageCycle: number | null;
    averagePeriod: number | null;
    variation: number | null;
}

export interface CycleNote { key: string; title: string; body: string }

export interface CycleOverview {
    access: CycleAccess;
    plan: CyclePlan;
    today: string;
    reading: CycleReading;
    week: DayMark[];
    todayLog: DayEntry | null;
    stats: CycleStats;
    notes: CycleNote[];
    prompt: { kind: 'confirm_end'; start: string; suggestedEnd: string } | null;
    temperatureSignal: boolean;
}

export interface CycleCalendar {
    month: string;
    today: string;
    days: DayMark[];
    fertileShown: boolean;
    prediction: CyclePrediction | null;
}

export interface PeriodRecord {
    start: string; end: string; length: number; loggedDays: number;
    heaviest: 'spotting' | 'light' | 'medium' | 'heavy' | null;
}

export interface CycleRecord {
    start: string; nextStart: string; length: number; periodLength: number;
    usable: boolean; outsideUsual: boolean;
}

export interface Accuracy {
    checked: number; hits: number; rate: number;
    checks: { start: string; expected: string; missDays: number; hit: boolean }[];
}

export interface CycleHistory {
    periods: PeriodRecord[];
    cycles: CycleRecord[];
    openCycle: { start: string; day: number } | null;
    stats: CycleStats;
    accuracy: Accuracy | null;
    normal: { cycleMin: number; cycleMax: number; variationMax: number; periodMax: number };
}

export interface CycleInsight {
    cycles: { start: string; length: number; periodLength: number; usable: boolean }[];
    normal: CycleHistory['normal'];
    stats: CycleStats;
    symptoms: { symptom: Symptom; count: number; peakDays: number[] }[];
    accuracy: Accuracy | null;
    temperature: {
        signal: boolean;
        from: string;
        nights: { day: string; celsius: number }[];
        periodStarts: string[];
        confirmedOvulations: string[];
    };
}

/* -------------------------------------------------------------------- API */

export const getCyclePlan = () =>
    api.get<{ access: CycleAccess; plan: CyclePlan; imported?: Partial<Record<'health_connect' | 'apple_health', number>> }>('/cycle/plan');

export type CyclePlanUpdate = Partial<Omit<CyclePlan, 'seed' | 'reminders' | 'fertileAllowed'>> & {
    seed?: Partial<CyclePlan['seed']>;
    reminders?: Partial<CyclePlan['reminders']>;
};

export const updateCyclePlan = (update: CyclePlanUpdate) =>
    api.put<{ access: CycleAccess; plan: CyclePlan }>('/cycle/plan', { ...update, tzOffset: tzOffset() });

export const dismissCycleOffer = () => api.post<{ access: CycleAccess }>('/cycle/offer/dismiss');

export const getCycleOverview = () =>
    api.get<CycleOverview>(`/cycle/overview?tzOffset=${tzOffset()}`);

export const getCycleCalendar = (month: string) =>
    api.get<CycleCalendar>(`/cycle/calendar?month=${month}&tzOffset=${tzOffset()}`);

export const getCycleDay = (day: string) => api.get<{ entry: DayEntry | null }>(`/cycle/days/${day}`);

/**
 * Replace a day. Omit `flow` to leave it to the health store — the log screen does, when
 * somebody saves a symptom on a day whose flow was imported and did not touch the flow.
 */
export const saveCycleDay = (day: string, entry: Omit<DayEntry, 'day' | 'source' | 'flow'> & { flow?: Flow | null }) =>
    api.put<{ entry: DayEntry | null }>(`/cycle/days/${day}?tzOffset=${tzOffset()}`, entry);

export const editPeriodDays = (change: { add?: string[]; remove?: string[] }) =>
    api.put<{ added: number; removed: number }>('/cycle/period-days', { ...change, tzOffset: tzOffset() });

export const getCycleHistory = () => api.get<CycleHistory>(`/cycle/history?tzOffset=${tzOffset()}`);
export const getCycleInsight = () => api.get<CycleInsight>(`/cycle/insight?tzOffset=${tzOffset()}`);
export const deleteAllCycleData = () => api.delete<{ deletedDays: number }>('/cycle/data');
/** The days a health store contributed. Nothing the person logged is touched. */
export const deleteImportedDays = (source: 'health_connect' | 'apple_health') =>
    api.delete<{ deletedDays: number }>(`/cycle/imported?source=${source}`);

/** Where a day's flow came from, in words, or null when the person logged it. */
export const flowSourceLabel = (source?: string): string | null =>
    source === 'health_connect' ? 'From Health Connect' : source === 'apple_health' ? 'From Apple Health' : null;

/* ------------------------------------------------------------- formatting */

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** "12 Oct". */
export const formatDay = (day: string): string =>
    asDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Mon 12 Oct". */
export const formatDayLong = (day: string): string =>
    asDate(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "16–20 Sep", or "30 Sep – 3 Oct" across a month. Every prediction is printed with this. */
export const formatRange = (w: DayWindow): string => {
    if (w.from === w.to) return formatDay(w.from);
    const a = asDate(w.from);
    const b = asDate(w.to);
    if (a.getUTCMonth() === b.getUTCMonth()) {
        const month = b.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
        return `${a.getUTCDate()}–${b.getUTCDate()} ${month}`;
    }
    return `${formatDay(w.from)} – ${formatDay(w.to)}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "5–8 days", "tomorrow", "2 days". */
const inDays = (from: number, to: number) => {
    if (from === to) return from === 1 ? 'tomorrow' : `in ${plural(from, 'day')}`;
    return `in ${from}–${to} days`;
};

export const sourceLine = (p: CyclePrediction): string =>
    p.source === 'observed'
        ? `Based on your last ${plural(p.cyclesUsed, 'cycle')}`
        : 'Based on what you told us at setup';

/** The ordinary causes, said once, reused by every late state. Names no condition. */
export const LATE_CAUSES =
    'Stress, illness, travel, changes in weight or exercise, and pregnancy can all delay a period. '
    + 'If you could be pregnant, a test is the quickest way to know.';

/**
 * The dashboard's headline, and the home card's. The single place a state becomes words.
 */
export const headline = (r: CycleReading, status: CycleStatus): { title: string; detail: string } => {
    const p = r.prediction;
    switch (r.state) {
        case 'paused':
            return status === 'pregnant'
                ? { title: 'Predictions paused', detail: 'While you are pregnant we will not predict periods or send reminders. You can still log anything you like.' }
                : { title: 'Predictions paused', detail: 'While you are breastfeeding periods are often irregular, so we have paused predictions and reminders.' };
        case 'period':
            return {
                title: `Day ${r.currentPeriod?.day ?? 1} of your period`,
                detail: p ? `Next one likely ${formatRange(p.window)}.` : 'Log each day it continues.',
            };
        case 'upcoming':
            return {
                title: `Period likely ${inDays(r.daysUntil?.from ?? 0, r.daysUntil?.to ?? 0)}`,
                detail: p ? `${formatRange(p.window)} · ${sourceLine(p)}.` : '',
            };
        case 'due':
            return {
                title: 'Your period could start any day',
                detail: p ? `Expected ${formatRange(p.window)}. Tap "Period started" when it does.` : '',
            };
        case 'late':
            return { title: `${plural(r.daysLate ?? 0, 'day')} late`, detail: LATE_CAUSES };
        case 'very_late':
            return {
                title: `${plural(r.daysLate ?? 0, 'day')} late`,
                detail: `${LATE_CAUSES} If late periods keep happening, mention it to a doctor.`,
            };
        case 'long_gap':
            return {
                title: r.lastStart ? `No period logged since ${formatDay(r.lastStart)}` : 'No recent period logged',
                detail: 'Log any periods you have had since and predictions will pick up again.',
            };
        default:
            return r.reason === 'needs_length'
                ? { title: 'One more period to go', detail: 'Log your next period and we can predict the one after it.' }
                : { title: 'Log your last period', detail: 'Tell us the day it started and we will start predicting.' };
    }
};

/* ----------------------------------------------------------------- tables */

type IonName = React.ComponentProps<typeof Ionicons>['name'];
type FaceName = React.ComponentProps<typeof MaterialIcons>['name'];

/** `drops` is how many drops the picker draws; spotting is a single small dot. */
export const FLOWS: { key: Exclude<Flow, 'unspecified'>; label: string; drops: number }[] = [
    { key: 'spotting', label: 'Spotting', drops: 0 },
    { key: 'light', label: 'Light', drops: 1 },
    { key: 'medium', label: 'Medium', drops: 2 },
    { key: 'heavy', label: 'Heavy', drops: 3 },
];

export const flowLabel = (flow: Flow | null): string =>
    flow === 'unspecified' ? 'Period' : FLOWS.find((f) => f.key === flow)?.label ?? 'None';

export const SYMPTOMS: { key: Symptom; label: string; icon: IonName }[] = [
    { key: 'cramps', label: 'Cramps', icon: 'flash-outline' },
    { key: 'headache', label: 'Headache', icon: 'thunderstorm-outline' },
    { key: 'bloating', label: 'Bloating', icon: 'ellipse-outline' },
    { key: 'breast_tenderness', label: 'Tender breasts', icon: 'heart-outline' },
    { key: 'back_pain', label: 'Back pain', icon: 'body-outline' },
    { key: 'fatigue', label: 'Tired', icon: 'battery-dead-outline' },
    { key: 'acne', label: 'Spots', icon: 'sparkles-outline' },
    { key: 'nausea', label: 'Nausea', icon: 'medical-outline' },
    { key: 'cravings', label: 'Cravings', icon: 'ice-cream-outline' },
    { key: 'mood_swings', label: 'Mood swings', icon: 'swap-vertical-outline' },
    { key: 'insomnia', label: 'Poor sleep', icon: 'moon-outline' },
    { key: 'diarrhoea', label: 'Upset stomach', icon: 'water-outline' },
];

export const symptomLabel = (s: Symptom) => SYMPTOMS.find((x) => x.key === s)?.label ?? s;

/** The same five faces the symptom checker draws, read the other way: 5 is the good end. */
export const MOODS: { value: number; icon: FaceName; label: string }[] = [
    { value: 1, icon: 'sentiment-very-dissatisfied', label: 'Low' },
    { value: 2, icon: 'sentiment-dissatisfied', label: 'Down' },
    { value: 3, icon: 'sentiment-neutral', label: 'Okay' },
    { value: 4, icon: 'sentiment-satisfied', label: 'Good' },
    { value: 5, icon: 'sentiment-very-satisfied', label: 'Great' },
];

export const STATUSES: { key: CycleStatus; label: string; body: string }[] = [
    { key: 'none', label: 'None of these', body: 'Predictions and reminders as usual.' },
    {
        key: 'hormonal_contraception', label: 'Hormonal contraception',
        body: 'The pill, patch, ring, implant or hormonal coil. Bleeds are tracked; no fertile window is shown.',
    },
    { key: 'pregnant', label: 'Pregnant', body: 'Predictions and reminders pause.' },
    { key: 'breastfeeding', label: 'Breastfeeding', body: 'Predictions and reminders pause.' },
    { key: 'perimenopause', label: 'Perimenopause', body: 'Predictions widen, and we will not flag irregular cycles.' },
];

export const statusLabel = (s: CycleStatus) => STATUSES.find((x) => x.key === s)?.label ?? 'None';

/** Said wherever the fertile window is drawn or switched on. */
export const FERTILE_DISCLAIMER =
    'An estimate from your calendar, not a measurement. It is not a way to avoid pregnancy.';

/** Whether the home screen should draw the tracker card, and why. The liveness predicate. */
export const homeCardLive = (o: CycleOverview): boolean => {
    if (o.access !== 'enabled') return false;
    const s = o.reading.state;
    if (s === 'period' || s === 'due' || s === 'late' || s === 'very_late') return true;
    if (s === 'upcoming' && (o.reading.daysUntil?.from ?? 99) <= 3) return true;
    return Boolean(o.prompt);
};

/** Should the home screen offer the tracker to somebody who has never set it up? */
export const homeOfferLive = (access: CycleAccess | null | undefined): boolean =>
    access === 'suggested' || access === 'offer';
