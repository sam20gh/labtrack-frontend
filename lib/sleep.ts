/**
 * Sleep tracker client — `Design/sleep.svg`.
 *
 * Four things worth knowing before using it.
 *
 * **The nights come from the device, not from here.** Health Connect and HealthKit sleep
 * sessions arrive through `runSync()` in `lib/health/sync.ts` and land as `SleepSession`
 * rows; everything in this file reads what that produced. `logNight` is the fallback for a
 * phone with no health store, not the main path.
 *
 * **A day is the WAKE day.** A night that starts on Tuesday and ends on Wednesday is
 * Wednesday's sleep — it is the row somebody taps on Wednesday morning. Every call that
 * resolves a calendar day carries `tzOffset`, because the server cannot infer it and
 * defaulting to UTC files a late night in the Americas under the following morning.
 *
 * **Measured values are not editable.** A night that came from a watch accepts a note and
 * nothing else; the API answers 409 for anything more. An app that lets somebody rewrite
 * what their device recorded cannot then claim the number came from the device.
 *
 * **A time of day is minutes from local midnight, never a `Date`.** A bedtime is a
 * wall-clock fact: it stays 22:30 when somebody flies to Tokyo. Storing an instant moves it.
 */
import { api } from './api';

/** Minutes west of UTC, as `Date.getTimezoneOffset()` reports it. */
const tzOffset = () => new Date().getTimezoneOffset();

/** Local `YYYY-MM-DD`, matching how the server stores `SleepSession.day`. */
export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export type SleepRange = '1d' | '1w' | '1m' | '1y' | 'all';
export type SleepStageKey = 'deep' | 'rem' | 'light' | 'awake';

export interface SleepBand {
    key: 'good' | 'suboptimal' | 'attention';
    label: string;
    min?: number;
    max?: number;
}

export interface SleepStageTotals {
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
}

/**
 * One night, as every screen reads it.
 *
 * Every measured figure is `number | null`, never `0` for missing. A source that reports
 * only a total and a night with no deep sleep are different facts, and a ring at zero on the
 * first tells somebody something about their body that nobody measured.
 */
export interface SleepNight {
    _id: string;
    day: string;
    startedAt: string;
    endedAt: string;
    /** Minutes from local midnight. Wraps: a 23:30 bedtime is 1410, a 00:25 one is 25. */
    bedtimeMin: number | null;
    wakeMin: number | null;
    asleepMin: number | null;
    inBedMin: number | null;
    stages: SleepStageTotals;
    efficiency: number | null;
    score: number | null;
    band: SleepBand | null;
    /** 0–1. **Null when there is no goal**, never zero — see the note in `sleepInsight.js`. */
    goalProgress: number | null;
    source: 'healthkit' | 'health_connect' | 'manual' | 'aggregator';
    sourceDevice: { name?: string; model?: string; manufacturer?: string } | null;
    /** A row somebody typed can be corrected; one a watch measured cannot. */
    editable: boolean;
    notes: string | null;
    /** Only ever present on `getNight` — the hypnogram is large and nothing else draws it. */
    segments?: SleepSegment[];
}

export interface SleepSegment {
    stage: SleepStageKey | 'in_bed' | 'unknown';
    startedAt: string;
    endedAt: string;
    minutes: number;
}

export interface SleepSeriesPoint {
    day: string;
    asleepMin: number | null;
    inBedMin: number | null;
    score: number | null;
    efficiency: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
    bedtimeMin: number | null;
    wakeMin: number | null;
    goalProgress: number | null;
}

/** One sleep directive from the person's health plan, worded as the interpretation wrote it. */
export interface SleepGuidance {
    key: string;
    label: string | null;
    directive: string;
    rationale?: string;
    focus?: string[];
}

export interface SleepSchedule {
    _id: string;
    name: string;
    bedtimeMin: number;
    wakeMin: number;
    /** Weekday indexes, 0 = Sunday. Empty means every day. */
    days: number[];
    enabled: boolean;
    /** 0 disables the bedtime reminder. There is no alarm — see `models/SleepSchedule.js`. */
    remindMinutesBefore: number;
    durationMin: number;
}

export interface SleepOverview {
    today: string;
    range: SleepRange;
    days: string[];
    series: SleepSeriesPoint[];
    averages: { asleepMin: number | null; score: number | null; nights: number };
    latest: SleepNight | null;
    /** False when `latest` is an older night — the card says which night it is describing. */
    isToday: boolean;
    streak: number;
    goal: {
        minutes: number;
        setByUser: boolean;
        progress: number | null;
        explanation: string;
        suggestedBedtimeMin: number | null;
        wakeMin: number | null;
    };
    schedules: SleepSchedule[];
    onboarded: boolean;
    guidance: SleepGuidance[];
    bands: SleepBand[];
}

export interface SleepPlan {
    _id: string;
    goalMinutes: number;
    bedtimeWindow: { fromMin: number | null; toMin: number | null };
    wakeWindow: { fromMin: number | null; toMin: number | null };
    selfRatedDepth: number | null;
    reportedAverageHours: number | null;
    guidance: SleepGuidance[];
    goalSetByUser: boolean;
    onboarded: boolean;
}

export interface SleepPlanResponse {
    plan: SleepPlan;
    basis: {
        baseMinutes: number;
        basis: string;
        shiftMinutes: number;
        derivedMinutes: number;
        appliedKeys: string[];
        method: 'user' | 'derived';
        clamped: boolean;
    };
    explanation: string;
    bounds: { min: number; max: number };
    rescoredNights?: number;
}

export interface StageBreakdown {
    nights: number;
    totalMin: number | null;
    stages: { stage: SleepStageKey; minutes: number | null; share: number | null }[];
}

export interface SleepInsight {
    range: SleepRange;
    days: string[];
    nights: number;
    series: { day: string; asleepMin: number | null; score: number | null; efficiency: number | null }[];
    score: {
        average: number | null;
        comparison: PeriodComparison;
        band: SleepBand | null;
    };
    duration: { average: number | null; comparison: PeriodComparison; goalMinutes: number | null };
    breakdown: StageBreakdown;
    ranges: { stage: SleepStageKey; nights: number; avgMin: number | null; lowMin: number | null; highMin: number | null }[];
    weekday: {
        days: { index: number; label: string; nights: number; avgMin: number | null }[];
        avgMin: number | null;
        best: string | null;
        worst: string | null;
    };
    consistency: {
        nights: number;
        bedtimeMin?: number | null;
        wakeMin?: number | null;
        bedtimeSpreadMin?: number | null;
        wakeSpreadMin?: number | null;
        spreadMin: number | null;
        band: { key: string; label: string } | null;
    };
    previousNights: number;
    guidance: SleepGuidance[];
}

/**
 * This window against the one before it.
 *
 * `deltaPct` is null when the previous window reported nothing, rather than a large
 * positive: a change measured from no data is unknown, not an improvement.
 */
export interface PeriodComparison {
    current: number | null;
    previous: number | null;
    currentNights?: number;
    previousNights?: number;
    deltaPct: number | null;
    direction: 'up' | 'down' | 'flat' | null;
}

export interface SleepScoreScreen {
    latest: SleepNight | null;
    explanation: string | null;
    average30: number | null;
    nights: number;
    weights: { duration: number; efficiency: number; stages: number };
    bands: SleepBand[];
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export const getOverview = (range: SleepRange = '1w') =>
    api.get<SleepOverview>(`/sleep/overview?range=${range}&tzOffset=${tzOffset()}`);

export const getSleepPlan = () => api.get<SleepPlanResponse>('/sleep/plan');

export const updateSleepPlan = (body: Partial<{
    goalMinutes: number | null;
    bedtimeWindow: { fromMin: number | null; toMin: number | null } | null;
    wakeWindow: { fromMin: number | null; toMin: number | null } | null;
    selfRatedDepth: number | null;
    reportedAverageHours: number | null;
    onboarded: boolean;
}>) => api.put<SleepPlanResponse>('/sleep/plan', body);

export const getInsight = (range: SleepRange = '1m') =>
    api.get<SleepInsight>(`/sleep/insight?range=${range}&tzOffset=${tzOffset()}`);

export const getSleepScore = () =>
    api.get<SleepScoreScreen>(`/sleep/score?tzOffset=${tzOffset()}`);

export interface NightQuery {
    from?: string;
    to?: string;
    sort?: 'recent' | 'oldest' | 'longest' | 'shortest' | 'best';
    minMin?: number;
    maxMin?: number;
    minScore?: number;
    maxScore?: number;
    stage?: SleepStageKey;
    limit?: number;
    skip?: number;
}

export const listNights = (query: NightQuery = {}) => {
    const params = new URLSearchParams({ tzOffset: String(tzOffset()) });
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return api.get<{ nights: SleepNight[]; total: number; limit: number; skip: number }>(
        `/sleep/nights?${params.toString()}`
    );
};

/** `positive` and `attention` are about the record, never a verdict on the person. */
export type SleepAnalysisTone = 'positive' | 'neutral' | 'attention';

/**
 * How one sleep went and what would improve the next — `utils/sleepAnalysis.js`, a
 * deterministic table, so every sentence traces back to a figure on the same screen.
 */
export interface SleepAnalysis {
    kind: 'night' | 'nap';
    headline: string;
    tone: 'positive' | 'mixed' | 'attention';
    findings: { key: string; tone: SleepAnalysisTone; title: string; detail: string }[];
    recommendations: {
        key: string;
        title: string;
        detail: string;
        /** `plan` when it is the health plan's own wording. */
        source?: 'plan';
        /** An app route that acts on it, when there is one. */
        route?: string;
    }[];
    basis: string;
}

/** A day's sleep: its night, its naps, and the two together. */
export interface SleepDayTotals { nightMin: number | null; napMin: number; totalMin: number }

export const getNight = (id: string) =>
    api.get<{
        night: SleepNight & { segments: SleepSegment[] };
        /** Whether this row is the day's night or one of its naps. */
        kind: 'night' | 'nap';
        day: SleepDayTotals | null;
        analysis: SleepAnalysis | null;
        breakdown: StageBreakdown['stages'];
        goalMinutes: number | null;
        explanation: string;
        weights: { duration: number; efficiency: number; stages: number };
    }>(`/sleep/nights/${id}?tzOffset=${tzOffset()}`);

export const logNight = (body: {
    startedAt: string;
    endedAt: string;
    asleepMin?: number;
    stages?: Partial<SleepStageTotals>;
    notes?: string;
}) => api.post<{ night: SleepNight }>('/sleep/nights', { ...body, tzOffset: tzOffset() });

/** Only `notes` on a synced night. See the note at the top of this file. */
export const updateNight = (id: string, body: Partial<{
    notes: string; asleepMin: number; stages: Partial<SleepStageTotals>;
}>) => api.patch<{ night: SleepNight }>(`/sleep/nights/${id}`, body);

export const deleteNight = (id: string) =>
    api.delete<{ message: string; willResync: boolean }>(`/sleep/nights/${id}`);

export const listSchedules = () => api.get<{ schedules: SleepSchedule[] }>('/sleep/schedules');

export const createSchedule = (body: Partial<SleepSchedule>) =>
    api.post<{ schedule: SleepSchedule }>('/sleep/schedules', { ...body, tzOffset: tzOffset() });

export const updateSchedule = (id: string, body: Partial<SleepSchedule>) =>
    api.put<{ schedule: SleepSchedule }>(`/sleep/schedules/${id}`, { ...body, tzOffset: tzOffset() });

export const deleteSchedule = (id: string) =>
    api.delete<{ message: string }>(`/sleep/schedules/${id}`);

// ---------------------------------------------------------------------------
// Sleep record — nights and naps, stacked. See `utils/sleepRecord.js`.
// ---------------------------------------------------------------------------

export type RecordBucket = 'day' | 'week' | 'month';

/**
 * One bar. For a day it is that night; for a week or month it is the typical night in it,
 * with every stage divided by the same count so the segments still sum to `asleepMin`.
 * Everything is null on a bar nothing was recorded for — no bar is drawn, not a zero.
 */
export interface SleepRecordBar {
    from: string;
    to: string;
    dayCount: number;
    nights: number;
    asleepMin: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    /** Time asleep that no stage accounts for — all of it on a source that reports a total. */
    unstagedMin: number | null;
    awakeMin: number | null;
    inBedMin: number | null;
    score: number | null;
    efficiency: number | null;
    bedtimeMin: number | null;
    wakeMin: number | null;
    /** Nap minutes per day with any sleep. Zero is real here: slept, and did not nap. */
    napMin: number | null;
    napCount: number;
    /** Night plus naps, per day with any sleep. What other health apps call "total sleep". */
    totalAsleepMin: number | null;
    /** Day bars only. */
    nightId?: string | null;
    naps?: SleepRecordNap[];
}

export interface SleepRecordNap {
    id: string;
    day?: string;
    startMin: number | null;
    endMin: number | null;
    minutes: number;
}

export interface SleepRecordHighlight { id: string; day: string; value: number }

export interface SleepRecord {
    range: SleepRange;
    bucket: RecordBucket;
    days: string[];
    today: string;
    end: string;
    previousEnd: string | null;
    nextEnd: string | null;
    series: SleepRecordBar[];
    summary: {
        nights: number;
        dayCount: number;
        totalAsleepMin: number | null;
        avgAsleepMin: number | null;
        avgInBedMin: number | null;
        avgEfficiency: number | null;
        avgScore: number | null;
        /** `share` is a percentage of the reported stage minutes, awake included. */
        stages: Record<SleepStageKey, { avgMin: number | null; share: number | null }>;
        stagedNights: number;
        bedtime: { avgMin: number | null; spreadMin: number | null };
        wake: { avgMin: number | null; spreadMin: number | null };
        /** Night plus naps. `avgMin` is per day with any sleep. */
        totalSleep: { avgMin: number | null; totalMin: number | null; days: number };
        /** Judged on the day's total, naps included. */
        goal: { minutes: number; met: number; nights: number; includesNaps?: boolean } | null;
        naps: { count: number; totalMin: number | null; avgMin: number | null; days: number };
        highlights: {
            longest: SleepRecordHighlight | null;
            shortest: SleepRecordHighlight | null;
            bestScore: SleepRecordHighlight | null;
            mostDeep: SleepRecordHighlight | null;
        };
        comparison: { asleepMin: PeriodComparison; score: PeriodComparison } | null;
    };
    naps: SleepRecordNap[];
    /** `1d` only: the night and the naps, with segments, for the timeline. */
    timeline?: {
        id: string;
        kind: 'night' | 'nap';
        startedAt: string;
        endedAt: string;
        asleepMin: number | null;
        segments: SleepSegment[];
    }[];
}

export const getRecord = (range: SleepRange, end?: string | null) =>
    api.get<SleepRecord>(
        `/sleep/record?range=${range}&tzOffset=${tzOffset()}${end ? `&end=${end}` : ''}`
    );

// ---------------------------------------------------------------------------
// Formatting and colour — kept here so every screen renders a night the same way
// ---------------------------------------------------------------------------

/** `8h 15m`, the way the design writes every duration on these screens. */
export const formatMinutes = (minutes?: number | null): string => {
    if (!Number.isFinite(minutes as number)) return '—';
    const total = Math.max(0, Math.round(minutes as number));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
};

/** The same duration split, for the two-size treatment the design gives the hero figure. */
export const splitMinutes = (minutes?: number | null): { hours: number; mins: number } | null => {
    if (!Number.isFinite(minutes as number)) return null;
    const total = Math.max(0, Math.round(minutes as number));
    return { hours: Math.floor(total / 60), mins: total % 60 };
};

/** `10:30 PM` from minutes-from-midnight. The clock the whole feature is written in. */
export const formatClock = (minutes?: number | null): string => {
    if (!Number.isFinite(minutes as number)) return '—';
    const total = ((Math.round(minutes as number) % 1440) + 1440) % 1440;
    const h24 = Math.floor(total / 60);
    const m = total % 60;
    const suffix = h24 >= 12 ? 'PM' : 'AM';
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** `Today` / `Yesterday` / a date — the two words people actually navigate a history by. */
export const dayLabel = (day: string): string => {
    const now = today();
    if (day === now) return 'Today';

    const yesterday = new Date(`${now}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (day === key) return 'Yesterday';

    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
    });
};

/**
 * The stages' colours and labels, in the order every screen lists them.
 *
 * One table so the donut, the hypnogram, the legend and the breakdown rows cannot drift —
 * the argument `METRIC_TINT` in `lib/prediction.ts` makes about extending rather than
 * restating a palette.
 *
 * **The tones are chosen to be told apart, not to match.** They used to be four purples and an
 * amber, and deep and REM — the two stages people look for — were violet and near-black
 * violet: indistinguishable on a 4pt bar and invisible to anyone with a colour deficiency.
 * Now deep stays the brand violet (the band the design puts first), light is its pale
 * step because light and deep are the same kind of sleep at different depths, REM is cyan
 * because it is a different kind altogether, and awake keeps the amber the app uses for
 * facts rather than verdicts. Validated with the dataviz palette checker: every pair clears
 * the colour-vision separation floor. Light and awake fall under 3:1 against white, which is
 * why every chart that uses them prints the legend with its values rather than relying on
 * colour alone.
 */
export const STAGE_META: Record<SleepStageKey, { label: string; tint: string; description: string }> = {
    deep: {
        label: 'Deep',
        tint: '#5B21B6',
        description: 'The restorative part of the night — physical repair and immune function.',
    },
    rem: {
        label: 'REM',
        tint: '#0891B2',
        description: 'When most dreaming happens, and when memory is consolidated.',
    },
    light: {
        label: 'Light',
        tint: '#A78BFA',
        description: 'Most of a normal night. The stage you pass through between the others.',
    },
    awake: {
        label: 'Awake',
        tint: '#F59E0B',
        description: 'Time in bed but not asleep. Brief waking through the night is normal.',
    },
};

/**
 * The two things a record draws that are not stages. A nap is its own hue (pink, validated
 * with the stages above) because it is a separate sleep, not a part of the night. Unstaged
 * is grey: a source that reported only a total measured the night but not its make-up, and
 * a colour would claim a stage nobody recorded.
 */
export const NAP_META = { label: 'Nap', tint: '#DB2777' } as const;
export const UNSTAGED_META = { label: 'No stage data', tint: '#CBD5E1' } as const;

export const STAGE_ORDER: SleepStageKey[] = ['deep', 'rem', 'light', 'awake'];

/** The band's tone. Bands are semantic — a person reads them to understand a number. */
export const bandTint = (key?: string | null): string => {
    if (key === 'good') return '#059669';
    if (key === 'suboptimal') return '#B45309';
    if (key === 'attention') return '#DC2626';
    return '#6B7280';
};

/**
 * Anything at all was recorded for this day.
 *
 * Broader than "a night was scored": a source that reports a duration and no stages still
 * measured the night, and a strip that drew it as empty would be telling somebody their
 * sleep did not count.
 */
export const nightHasData = (p: SleepSeriesPoint): boolean =>
    Number.isFinite(p.asleepMin as number)
    || Number.isFinite(p.inBedMin as number)
    || Number.isFinite(p.score as number);
