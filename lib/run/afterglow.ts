/**
 * The Afterglow trail — the route coloured by pace, and the comet tail behind the runner.
 *
 * **One hue, light to dark.** A sequential magnitude is a single-hue ramp (the dataviz rule),
 * so the trail is ember from dim to bright, not a blue-to-red rainbow, and **never violet**:
 * purple means "you can act here" in this app, and a route is not a control. Both ramps were
 * run through the dataviz skill's `validate_palette.js --ordinal` against the map surfaces
 * they sit on (2026-09-28): monotone lightness, one hue (22° / 10° spread), visible steps,
 * slow end 2.82:1 on the night map and 2.78:1 on the day map. Re-run it after any change.
 *
 * **Relative to this run, never to a norm.** The slowest stretch of *this* run is dim and
 * the fastest bright, whatever the numbers. Colouring against an absolute pace would make a
 * walker's whole route "slow", which is a judgement about somebody's body the app does not
 * make (the rule `betterWhen: null` holds for weight).
 *
 * Everything here is pure: it takes the recorder's kept points and segments and returns
 * coordinates plus Mapbox expressions. Rebuilt about once a second; linear in the track.
 */
import { haversine, replayTrack, type Segment, type Track, type TrackableType } from './trackMath';

/** Slow → fast. Brighter is faster on the night map. */
export const EMBER_DARK = ['#A4481A', '#CC5C20', '#F07A2A', '#FFA35C', '#FFD2A6'] as const;
/** Slow → fast. Darker is faster on the day map (high contrast) — the anchor flips. */
export const EMBER_LIGHT = ['#D9772E', '#BC5A1C', '#98451A', '#733112', '#4A1F0A'] as const;

export type Ramp = readonly string[];

const hexToRgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Colour at `t` in [0, 1] along the ramp. */
export const rampColor = (t: number, ramp: Ramp): string => {
    const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(x));
    const f = x - i;
    const a = hexToRgb(ramp[i]);
    const b = hexToRgb(ramp[i + 1]);
    return toHex(a.map((v, k) => v + (b[k] - v) * f));
};

export const withAlpha = (hex: string, alpha: number) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
};

interface TrailPoint { t: number; lat: number; lng: number }
type Timed = Pick<Segment, 'startT' | 'endT' | 'speed' | 'distanceM'>;

export interface Trail {
    coordinates: number[][];
    /** `['interpolate', ['linear'], ['line-progress'], …]`, or null with too little route. */
    gradient: unknown[] | null;
    tail: { coordinates: number[][]; gradient: unknown[] } | null;
    /** The two ends of the legend, as seconds per km: [slowest, fastest]. */
    paceRange: [number, number] | null;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

export const buildTrail = (
    points: readonly TrailPoint[],
    segments: readonly Timed[],
    ramp: Ramp,
    { tailM = 400, maxStops = 48 }: { tailM?: number; maxStops?: number } = {},
): Trail => {
    const coordinates = points.map((p) => [p.lng, p.lat]);
    const empty: Trail = { coordinates, gradient: null, tail: null, paceRange: null };
    if (points.length < 2 || !segments.length) return empty;

    const cum = new Array<number>(points.length).fill(0);
    for (let i = 1; i < points.length; i += 1) {
        cum[i] = cum[i - 1] + haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }
    const total = cum[cum.length - 1];
    if (total < 20) return empty;

    // The run's own range, trimmed to the 10th–90th percentile so one sprint for a bus does
    // not make the rest of the route look uniformly slow.
    const speeds = segments.map((s) => s.speed).sort((a, b) => a - b);
    const lo = quantile(speeds, 0.1);
    const hi = quantile(speeds, 0.9);
    const span = hi - lo;
    const norm = (v: number) => (span < 0.1 ? 0.5 : (v - lo) / span);

    // Each point takes the speed of the segment that ends at or after it.
    const pointT: number[] = new Array(points.length);
    let k = 0;
    for (let i = 0; i < points.length; i += 1) {
        while (k < segments.length - 1 && segments[k].endT < points[i].t) k += 1;
        const seg = segments[k];
        pointT[i] = points[i].t >= seg.startT - 60_000 ? norm(seg.speed) : 0;
    }

    // Down-sample into equal-length bins so a two-hour run is still ≤ maxStops stops.
    const bins = Math.max(2, Math.min(maxStops, points.length));
    const sums = new Array<number>(bins).fill(0);
    const weights = new Array<number>(bins).fill(0);
    for (let i = 1; i < points.length; i += 1) {
        const w = cum[i] - cum[i - 1];
        const b = Math.min(bins - 1, Math.floor((cum[i] / total) * bins));
        sums[b] += pointT[i] * w;
        weights[b] += w;
    }
    const stops: unknown[] = [];
    let last = 0.5;
    for (let b = 0; b < bins; b += 1) {
        const v = weights[b] > 0 ? sums[b] / weights[b] : last;
        last = v;
        const progress = b === 0 ? 0 : b === bins - 1 ? 1 : (b + 0.5) / bins;
        stops.push(progress, rampColor(v, ramp));
    }

    let tail: Trail['tail'] = null;
    const from = cum.findIndex((c) => c >= total - tailM);
    if (from >= 0 && points.length - from >= 2) {
        const fast = ramp[ramp.length - 1];
        tail = {
            coordinates: coordinates.slice(from),
            gradient: ['interpolate', ['linear'], ['line-progress'], 0, withAlpha(fast, 0), 1, withAlpha(fast, 0.95)],
        };
    }

    return {
        coordinates,
        gradient: ['interpolate', ['linear'], ['line-progress'], ...stops],
        tail,
        paceRange: span < 0.1 ? null : [Math.round(1000 / lo), Math.round(1000 / hi)],
    };
};

/**
 * Pace over the last `windowSec` of moving, one value per segment, oldest first — the
 * ribbon under the live numbers. Seconds per km; empty while there is nothing recent.
 */
export const recentPace = (segments: readonly Timed[], windowSec = 300): number[] => {
    if (!segments.length) return [];
    const end = segments[segments.length - 1].endT;
    const out: number[] = [];
    for (let i = segments.length - 1; i >= 0; i -= 1) {
        if (end - segments[i].endT > windowSec * 1000) break;
        if (segments[i].speed > 0) out.push(1000 / segments[i].speed);
    }
    return out.reverse();
};

/** The trail for a stored track — the detail screen and the replay. */
export const trailFromTrack = (track: Partial<Track> | undefined, type: TrackableType, ramp: Ramp, opts?: { tailM?: number }) => {
    const { points, segments } = replayTrack(track, type);
    return buildTrail(points, segments, ramp, { tailM: opts?.tailM ?? 0 });
};
