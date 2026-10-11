/**
 * The arithmetic behind reading a chart with a finger — pure, so it can be tested without a
 * renderer. `hooks/useChartScrub.ts` owns the gesture; `components/charts/ChartCallout.tsx`
 * draws the readout; this file decides which slot a touch means, where the readout goes, and
 * how a value is printed in it.
 *
 * Three rules every chart that scrubs keeps:
 *
 * 1. **A touch snaps to the nearest slot, never between two.** A readout reporting an
 *    interpolated 96.4% for a point between Monday's 96 and Tuesday's 97 would be a reading
 *    nobody took.
 * 2. **On a short range every day is selectable, gaps included; on a long one only days with
 *    data are.** On a week, landing on Wednesday and reading "No reading" is the answer to
 *    "why is there a gap?". On a year of 365 sub-pixel slots, the same rule turns a sweep
 *    across a sparse weight log into a strobe of "No reading", so there the finger snaps to
 *    the nearest day that has something to say.
 * 3. **The readout never covers the point it describes.** It rides above the plot, centred
 *    on the crosshair; when the point is high enough that a centred callout would sit on it,
 *    the callout steps to whichever side has room.
 */

/** Above this many slots, only slots with data are selectable (rule 2). */
export const SPARSE_SNAP_ABOVE = 31;

/**
 * Index of the slot nearest `target`, among those `allowed` admits. Nearest rather than a
 * bucket division: once gaps are skipped the remaining slots are not evenly spaced.
 */
export function nearestIndex(
    xs: readonly number[],
    target: number,
    allowed?: (i: number) => boolean,
): number | null {
    let best: number | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < xs.length; i += 1) {
        if (allowed && !allowed(i)) continue;
        const distance = Math.abs(xs[i] - target);
        if (distance < bestDistance) {
            best = i;
            bestDistance = distance;
        }
    }
    return best;
}

/**
 * The next selectable slot from `from` in `direction`, for the screen reader's swipe up /
 * swipe down. From nothing selected, either direction lands on the newest slot — the one
 * somebody opening a history chart is most likely asking about.
 */
export function stepIndex(
    count: number,
    from: number | null,
    direction: 1 | -1,
    allowed?: (i: number) => boolean,
): number | null {
    const ok = (i: number) => i >= 0 && i < count && (!allowed || allowed(i));
    if (from === null) {
        for (let i = count - 1; i >= 0; i -= 1) if (ok(i)) return i;
        return null;
    }
    for (let i = from + direction; i >= 0 && i < count; i += direction) if (ok(i)) return i;
    return from;
}

/**
 * Centres of `count` equal columns separated by `gap`, across `width` — the x of each slot in
 * a flex row of bars.
 */
export const columnCentres = (count: number, width: number, gap = 0): number[] => {
    if (count <= 0 || width <= 0) return [];
    const column = (width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => i * (column + gap) + column / 2);
};

/** The gap between the callout and the crosshair or point it sits beside. */
const CALLOUT_GAP = 12;

/**
 * Where the callout goes, in the chart's own coordinates.
 *
 * Centred over the crosshair and clamped inside the chart by default. If the selected point
 * is within the callout's height of the top, centring would hide it, so the callout moves to
 * the right of the crosshair — or the left, near the right edge — and if neither side has
 * room (a narrow chart, a long label) it drops below the point instead.
 */
export function placeCallout({
    x, pointY, chartWidth, calloutWidth, calloutHeight, top = 0,
}: {
    x: number;
    /** The selected point's y, or null for a slot with no value. */
    pointY: number | null;
    chartWidth: number;
    calloutWidth: number;
    calloutHeight: number;
    top?: number;
}): { left: number; top: number } {
    const clamp = (left: number) => Math.max(0, Math.min(left, chartWidth - calloutWidth));
    const covers = pointY !== null && pointY < top + calloutHeight + CALLOUT_GAP / 2;
    if (!covers) return { left: clamp(x - calloutWidth / 2), top };

    if (x + CALLOUT_GAP + calloutWidth <= chartWidth) return { left: x + CALLOUT_GAP, top };
    if (x - CALLOUT_GAP - calloutWidth >= 0) return { left: x - CALLOUT_GAP - calloutWidth, top };
    return { left: clamp(x - calloutWidth / 2), top: (pointY as number) + CALLOUT_GAP };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "Today", "Yesterday", "Mon 6 Oct", or "Mon 6 Oct 2025" outside the current year.
 *
 * Built from local date fields rather than `toLocaleDateString`, so the readout is the same
 * on every Hermes build — and `YYYY-MM-DD` is read as a local day, the way the server files it.
 */
export function scrubDayLabel(day: string, now: Date = new Date()): string {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00`) : new Date(day);
    if (Number.isNaN(d.getTime())) return day;
    if (sameDay(d, now)) return 'Today';
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (sameDay(d, yesterday)) return 'Yesterday';
    const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** A clock time for an intraday reading, 24-hour, the way the stress chart's axis is written. */
export function scrubTimeLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A number as the readout prints it: thousands grouped, hundreds whole, anything smaller to
 * one decimal — and never "97.0".
 */
export function formatChartNumber(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1000) return Math.round(value).toLocaleString();
    if (abs >= 100) return String(Math.round(value));
    return String(Math.round(value * 10) / 10);
}

/** Units written against the number rather than after a space. */
const TIGHT_UNITS = new Set(['%', '°C', '°F']);

/**
 * A value with its unit. Hours are the one unit rewritten: "7.4 h" makes somebody do
 * arithmetic to read their own night, so it prints "7h 24m".
 */
export function formatChartValue(value: number, unit?: string): string {
    if (unit === 'h') {
        const minutes = Math.round(value * 60);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
    const n = formatChartNumber(value);
    if (!unit) return n;
    return TIGHT_UNITS.has(unit) ? `${n}${unit}` : `${n} ${unit}`;
}
