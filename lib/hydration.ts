/**
 * Hydration derivations — everything the water screens compute from what the API already sends.
 *
 * `/metrics/hydration/today` and `/metrics/water/history` between them carry the whole feature:
 * a day's consumed/target/level, and a per-day series with each day's own target beside it.
 * Nothing here fetches. It exists so the five hydration screens cannot disagree about what
 * "met your target" or "your weekly average" means — the same reason `utils/hydrationTargets.js`
 * holds that arithmetic on the server rather than in the controller.
 *
 * Three rules carried over from the server, because a client that breaks them undoes them:
 *
 * 1. **A day with no logs is absent, never zero.** Averages divide by days logged. The same
 *    call `nutritionInsight.js` makes, and for the same reason: averaging over calendar days
 *    turns a fortnight's honest gap into a fortnight of dehydration.
 * 2. **Null, never zero.** No logged days means `null` — "nothing to measure", not "you drank
 *    nothing". Every consumer has to render that as a state rather than a number.
 * 3. **A future day is not a missed day.** `dayStatus` has its own `future` case so a month
 *    grid cannot draw the rest of the month as three weeks of failure.
 */
import type { SeriesPoint, MetricLog } from './metrics';
import { displayVolume, unitLabel, type UnitPrefs } from './units';

/**
 * What one drop on the Daily Goal card is worth.
 *
 * The design captions its row "1 drop ≈ 250ml" and draws eight of them against a 2,000ml
 * goal. Kept as a constant rather than "draw eight drops" because the target here is derived
 * from body mass and activity, so it is rarely 2,000 — the row has to grow and shrink with it
 * or the caption is a lie.
 */
export const DROP_ML = 250;

/** Above this the row would be a wall of drops rather than a quantity anyone can read. */
const MAX_DROPS = 12;

/**
 * What counts as having met the target, as a fraction of it.
 *
 * The server's top band, `optimal`, starts at 90% — so this is not a second opinion, it is
 * the same threshold read from the same place. Hitting a derived target to the millilitre is
 * not a thing anyone does, and a grid that demanded it would be a month of red crosses under
 * a level the server was calling Optimal.
 */
const MET_FRACTION = 0.9;

/* ------------------------------------------------------------------ *
 * Containers
 * ------------------------------------------------------------------ */

/**
 * The four vessels `Design/water.svg` draws, smallest first.
 *
 * The API's own `containers` list has three (small 200 / medium 350 / large 700) and is what
 * the log screen offers. This is a *display* bucket for a volume that has already been
 * recorded — including a custom one, and including entries the design's own history shows at
 * 1,000ml, which is larger than any preset. So the two lists are deliberately not the same
 * list: one is what you can pick, this is what a number looks like once it is on the record.
 */
export type ContainerSize = 'cup' | 'glass' | 'bottle' | 'flask';

const CONTAINER_STEPS: { size: ContainerSize; under: number; label: string }[] = [
    { size: 'cup', under: 250, label: 'Cup' },
    { size: 'glass', under: 500, label: 'Glass' },
    { size: 'bottle', under: 850, label: 'Bottle' },
    { size: 'flask', under: Infinity, label: 'Large bottle' },
];

export const containerFor = (ml: number | null | undefined): ContainerSize =>
    (CONTAINER_STEPS.find((s) => (ml ?? 0) < s.under) ?? CONTAINER_STEPS[3]).size;

export const containerLabel = (size: ContainerSize): string =>
    CONTAINER_STEPS.find((s) => s.size === size)?.label ?? 'Drink';

/** The words under a history row — "Glass of water", "Bottle of coffee". */
export const describeEntry = (log: MetricLog): string => {
    const vessel = containerLabel(containerFor(log.ml));
    const drink = log.drinkType && log.drinkType !== 'water' ? log.drinkType : 'water';
    return `${vessel} of ${drink}`;
};

/* ------------------------------------------------------------------ *
 * A day
 * ------------------------------------------------------------------ */

export type DayStatus = 'met' | 'short' | 'none' | 'future';

/**
 * How one square of the month grid is drawn.
 *
 * `none` and `short` are different states and the grid must not merge them: a day with no
 * entries is a day somebody did not use the tracker, and marking it with the same red cross
 * as a day they logged 400ml against a 2,400ml target tells them they failed at something
 * they were never measured on. The design draws the first as an empty ring and only the
 * second as a cross, which is the right call and the one this preserves.
 */
export const dayStatus = (point: SeriesPoint, today: string): DayStatus => {
    if (point.day > today) return 'future';
    if (point.value === null || point.value === undefined) return 'none';
    const target = point.target ?? null;
    if (!target) return 'none';
    // 90%, which is where `hydrationTargets.LEVELS` puts the top band. A day the server
    // would call "Optimal" and this grid would call a miss is two answers to one question.
    return point.value >= target * MET_FRACTION ? 'met' : 'short';
};

/**
 * Drops for the Daily Goal card.
 *
 * `total` is the target rounded to whole drops so the caption stays true, capped so a
 * four-litre target does not draw sixteen. `filled` can exceed nothing — it is clamped to
 * `total`, because a row that overflows is a row that no longer reads as progress.
 */
export const drops = (consumedMl: number | null, targetMl: number | null): { filled: number; total: number } => {
    const total = Math.min(MAX_DROPS, Math.max(1, Math.round((targetMl ?? 0) / DROP_ML)));
    const filled = Math.min(total, Math.floor((consumedMl ?? 0) / DROP_ML));
    return { filled, total };
};

/** 0–1, clamped. What the glass fills to and what the goal card reports. */
export const attainment = (consumedMl: number | null, targetMl: number | null): number => {
    if (!targetMl || targetMl <= 0) return 0;
    return Math.max(0, Math.min(1, (consumedMl ?? 0) / targetMl));
};

/**
 * Which rung a past day landed on.
 *
 * The server classifies **today** and only today, so a detail screen looking at last Tuesday
 * has a number and no band. It uses the server's own `levels` table — shipped with `min` on
 * every row for exactly this — rather than a second copy of the thresholds, because a
 * clinical ladder duplicated on the client is one that drifts the first time the server's is
 * revised. The same argument `MetricLog.category` makes about never reclassifying on read.
 *
 * Null when the day has no entries, matching `levelFor` on the server: no logs is not a rung.
 */
export const levelForPercent = (
    levels: HydrationLevelRow[],
    percent: number | null,
    logs: number,
): HydrationLevelRow | null => {
    if (!logs || percent === null || !levels.length) return null;
    return levels.find((l) => Number.isFinite(l.min) && percent >= (l.min as number))
        ?? levels[levels.length - 1];
};

type HydrationLevelRow = { key: string; label: string; blurb: string; min?: number };

/* ------------------------------------------------------------------ *
 * A window
 * ------------------------------------------------------------------ */

export interface HydrationSummary {
    /** Days in the window that actually carry an entry. Everything below divides by this. */
    daysLogged: number;
    /** Total millilitres across those days. Zero days logged gives null, not 0. */
    totalMl: number | null;
    dailyAverageMl: number | null;
    /** The daily average scaled to a week, which is the figure the design's Highlight shows. */
    weeklyAverageMl: number | null;
    best: { day: string; ml: number } | null;
    /** Days that reached their own target — each day is judged against its own, not today's. */
    metCount: number;
    /** Consecutive days meeting target, counting back. Today, still unfinished, cannot break it. */
    streak: number;
}

export const summarise = (series: SeriesPoint[], today: string): HydrationSummary => {
    const logged = series.filter((p) => p.day <= today && p.value !== null && p.value !== undefined);

    if (!logged.length) {
        return {
            daysLogged: 0, totalMl: null, dailyAverageMl: null, weeklyAverageMl: null,
            best: null, metCount: 0, streak: 0,
        };
    }

    const totalMl = logged.reduce((s, p) => s + (p.value as number), 0);
    const dailyAverageMl = Math.round(totalMl / logged.length);

    const best = logged.reduce((b, p) =>
        (p.value as number) > b.ml ? { day: p.day, ml: p.value as number } : b,
        { day: logged[0].day, ml: logged[0].value as number });

    const metCount = logged.filter((p) => p.target && (p.value as number) >= p.target * MET_FRACTION).length;

    /*
     * Walk back from the newest past day. A gap ends the streak rather than being stepped
     * over, because a day nobody logged is a day this app cannot claim anything about.
     *
     * **Today is allowed to be unfinished.** Counting it like any other day would reset the
     * run to zero every midnight and leave it there until the first drink — so a streak
     * would read 0 for most of every morning, which is the one time it might have got
     * somebody to log one. It only ever adds to the run, never breaks it.
     */
    let streak = 0;
    const past = series.filter((p) => p.day <= today);
    for (let i = past.length - 1; i >= 0; i -= 1) {
        const status = dayStatus(past[i], today);
        if (status === 'met') { streak += 1; continue; }
        if (past[i].day === today) continue;
        break;
    }

    return {
        daysLogged: logged.length,
        totalMl,
        dailyAverageMl,
        weeklyAverageMl: dailyAverageMl * 7,
        best,
        metCount,
        streak,
    };
};

/**
 * This window against the one before it, as a percentage.
 *
 * Null unless **both** halves have logged days — a "+340%" against a week nobody tracked is
 * arithmetic, not a trend, and it is the first thing a person would read at the top of the
 * screen.
 */
export const changeVsPrevious = (series: SeriesPoint[], today: string): number | null => {
    const past = series.filter((p) => p.day <= today);
    if (past.length < 4) return null;

    const half = Math.floor(past.length / 2);
    const mean = (rows: SeriesPoint[]) => {
        const has = rows.filter((p) => p.value !== null && p.value !== undefined);
        return has.length ? has.reduce((s, p) => s + (p.value as number), 0) / has.length : null;
    };

    const before = mean(past.slice(0, half));
    const after = mean(past.slice(half));
    if (before === null || after === null || before === 0) return null;

    return Math.round(((after - before) / before) * 1000) / 10;
};

/**
 * Average millilitres per weekday, Monday first.
 *
 * `null` for a weekday nobody logged on. The design's frequency chart draws no bar there,
 * which is the honest rendering — a zero-height bar and a missing bar look identical, but
 * only one of them is a claim.
 */
export const weekdayAverages = (series: SeriesPoint[], today: string): { label: string; ml: number | null }[] => {
    const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets: number[][] = LABELS.map(() => []);

    for (const p of series) {
        if (p.day > today || p.value === null || p.value === undefined) continue;
        // `new Date('YYYY-MM-DD')` parses as UTC; the local suffix keeps a Sunday evening in
        // the Americas out of Monday's bucket. The same trap `MealLog.day` documents.
        const dow = new Date(`${p.day}T00:00:00`).getDay();
        buckets[(dow + 6) % 7].push(p.value as number);
    }

    return LABELS.map((label, i) => ({
        label,
        ml: buckets[i].length
            ? Math.round(buckets[i].reduce((s, v) => s + v, 0) / buckets[i].length)
            : null,
    }));
};

/* ------------------------------------------------------------------ *
 * Entries
 * ------------------------------------------------------------------ */

export interface ConsumptionRow {
    size: ContainerSize;
    label: string;
    count: number;
    totalMl: number;
    /** Times per week, so "2x weekly average" in the design has something behind it. */
    perWeek: number;
}

/**
 * "Most Consumed" — how often each vessel size appears, biggest count first.
 *
 * `perWeek` divides by the window rather than by days logged, because frequency is a claim
 * about calendar time: drinking fourteen glasses across two logged days out of a fortnight is
 * not seven glasses a week.
 */
export const consumptionBySize = (logs: MetricLog[], windowDays: number): ConsumptionRow[] => {
    const by = new Map<ContainerSize, { count: number; totalMl: number }>();

    for (const log of logs) {
        const size = containerFor(log.ml);
        const row = by.get(size) ?? { count: 0, totalMl: 0 };
        row.count += 1;
        row.totalMl += log.ml ?? 0;
        by.set(size, row);
    }

    const weeks = Math.max(1, windowDays / 7);
    return [...by.entries()]
        .map(([size, row]) => ({
            size,
            label: containerLabel(size),
            count: row.count,
            totalMl: row.totalMl,
            perWeek: Math.round((row.count / weeks) * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count);
};

/** The commonest single serving on record, which is what "you drank medium size mostly" means. */
export const typicalServingMl = (logs: MetricLog[]): number | null => {
    if (!logs.length) return null;
    const sorted = logs.map((l) => l.ml ?? 0).filter(Boolean).sort((a, b) => a - b);
    if (!sorted.length) return null;
    return sorted[Math.floor(sorted.length / 2)];
};

/** The hour most drinks land in, as `HH:00`. Null under three entries — two is not a pattern. */
export const busiestHour = (logs: MetricLog[]): number | null => {
    if (logs.length < 3) return null;
    const hours = new Array(24).fill(0);
    for (const l of logs) hours[new Date(l.measuredAt).getHours()] += 1;
    const best = hours.indexOf(Math.max(...hours));
    return hours[best] > 1 ? best : null;
};

/** Group entries under their local day, newest day first, newest entry first within a day. */
export const groupByDay = (logs: MetricLog[]): { day: string; logs: MetricLog[]; totalMl: number }[] => {
    const by = new Map<string, MetricLog[]>();
    for (const log of logs) {
        const rows = by.get(log.day) ?? [];
        rows.push(log);
        by.set(log.day, rows);
    }
    return [...by.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([day, rows]) => ({
            day,
            logs: rows.sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1)),
            totalMl: rows.reduce((s, r) => s + (r.ml ?? 0), 0),
        }));
};

/* ------------------------------------------------------------------ *
 * Words
 * ------------------------------------------------------------------ */

/**
 * The line under the hero number.
 *
 * Never congratulatory when nothing was logged, and never a rebuke: this is a tally of what
 * somebody typed in, not a measurement of their body. `utils/hydrationTargets.js` makes the
 * same distinction in `levelFor`, and the copy has to hold it or the label undoes it.
 */
export const heroLine = (
    consumedMl: number | null,
    targetMl: number | null,
    logs: number,
    prefs: UnitPrefs,
): string => {
    if (!logs) return 'Nothing logged today yet.';
    if (!targetMl) return 'Logged today.';
    const remaining = Math.max(0, targetMl - (consumedMl ?? 0));
    if (remaining <= 0) return "You have reached today's target.";
    // Through `splitVolume` rather than raw millilitres: this sentence sits directly under a
    // figure drawn in the person's chosen unit, and the two must not disagree.
    const left = splitVolume(remaining, prefs);
    return `${left.value} ${left.unit} left to reach today's target.`;
};

/**
 * A volume split into the number and its unit, for the places one is set at 44pt beside a
 * 17pt unit.
 *
 * It has to mirror `formatVolume` exactly — including the promotion to litres past a
 * thousand — or the hero would read "2.4 L" while the goal card under it said "2,400 ml".
 * The unit label is returned rather than derived at the call site for the same reason
 * `presentMetric` returns one: a converted number under the original label is worse than no
 * conversion at all.
 */
export const splitVolume = (
    ml: number | null | undefined,
    prefs: UnitPrefs,
): { value: string; unit: string } => {
    if (ml == null || !Number.isFinite(ml)) return { value: '--', unit: unitLabel('volume', prefs) };
    if (prefs.volume !== 'ml') {
        return { value: displayVolume(ml, prefs).toLocaleString(), unit: unitLabel('volume', prefs) };
    }
    return ml >= 1000
        ? { value: (ml / 1000).toFixed(1), unit: 'L' }
        : { value: Math.round(ml).toLocaleString(), unit: 'ml' };
};

/** A day label the history and detail screens share, so "Today" means the same on both. */
export const dayLabel = (day: string, today: string): string => {
    if (day === today) return 'Today';
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (day === y) return 'Yesterday';
    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short',
    });
};
