/**
 * What a GPS track measured — the phone's half.
 *
 * A line-for-line port of `labtrack-backend/utils/trackMetrics.js`. **The server's figures
 * are the record**; these are what the live screen shows while running and what the summary
 * shows until the upload returns. The two are held together by the shared fixture tracks in
 * `__tests__/fixtures/tracks/`, copied from the backend: both suites assert the same
 * `expected.json`. Change a constant here without changing it there and the fixtures fail
 * on this side; the reverse fails on that side. The rules and the reasons for them are in
 * the backend file's header and are not repeated here.
 *
 * One structural difference, and it is the reason this is not a copy of the batch function:
 * the live screen cannot recompute a two-hour track every second. So the moving parts —
 * teleports, gaps, pauses, anchors, splits — are an **online accumulator** fed one fix at a
 * time, and `computeTrack` is that same accumulator run over a whole track. There is one
 * implementation, so live and final cannot drift apart. Altitude smoothing looks fifteen
 * seconds ahead and the route simplification needs the whole line, so those two stay batch.
 */

export type TrackableType = 'walking' | 'jogging' | 'hiking' | 'biking';

export const MAX_ACCURACY_M = 25;
export const MAX_GAP_SEC = 60;
export const ALT_SMOOTH_SEC = 15;
export const CLIMB_HYSTERESIS_M = 3;
const MIN_PARTIAL_SPLIT_M = 100;
const SPLIT_M = 1000;
export const ROUTE_TOLERANCE_M = 2;
const HR_MIN = 30;
const HR_MAX = 230;
/** The live pace is averaged over this, because instantaneous GPS pace swings ±40 s/km. */
export const LIVE_PACE_WINDOW_SEC = 30;

export const TYPE_LIMITS: Record<TrackableType, { maxSpeed: number; stopSpeed: number; minStep: number }> = {
    walking: { maxSpeed: 4, stopSpeed: 0.4, minStep: 5 },
    jogging: { maxSpeed: 12, stopSpeed: 0.5, minStep: 5 },
    hiking: { maxSpeed: 4, stopSpeed: 0.25, minStep: 5 },
    biking: { maxSpeed: 25, stopSpeed: 1, minStep: 8 },
};
export const TRACKABLE_TYPES = Object.keys(TYPE_LIMITS) as TrackableType[];

const EARTH_RADIUS_M = 6_371_008.8;

/** The columnar shape `ActivityTrack` stores and `POST /activity/sessions/live` takes. */
export interface Track {
    t: number[];
    lat: number[];
    lng: number[];
    alt?: (number | null)[];
    acc?: (number | null)[];
    hr?: (number | null)[];
    pauses?: [number, number][];
}

export interface Fix {
    t: number;
    lat: number;
    lng: number;
    alt?: number | null;
    acc?: number | null;
    hr?: number | null;
}

interface Point {
    t: number;
    lat: number;
    lng: number;
    alt: number | null;
    hr: number | null;
}

export interface Segment {
    startT: number;
    endT: number;
    distanceM: number;
    durationSec: number;
    speed: number;
    /** Filled in by the batch pass; the live accumulator cannot see ahead to smooth. */
    climbM: number | null;
    hr: number | null;
    cumulativeM: number;
}

export interface Split {
    label: string;
    order: number;
    distanceM: number;
    durationSec: number;
    avgBpm: number | null;
    pacePerKm: number | null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const round1 = (v: number) => Math.round(v * 10) / 10;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Rule 1, plus the validity checks: `null` for a fix that must not be used. */
const toPoint = (f: Partial<Fix>): Point | null => {
    if (!finite(f.t) || !finite(f.lat) || !finite(f.lng)) return null;
    if (Math.abs(f.lat) > 90 || Math.abs(f.lng) > 180) return null;
    if (finite(f.acc) && f.acc > MAX_ACCURACY_M) return null;
    return {
        t: f.t,
        lat: f.lat,
        lng: f.lng,
        alt: finite(f.alt) ? f.alt : null,
        hr: finite(f.hr) && f.hr >= HR_MIN && f.hr <= HR_MAX ? f.hr : null,
    };
};

// ---------------------------------------------------------------------------------------
// Splits, online

const createSplitter = () => {
    const splits: Split[] = [];
    let splitDist = 0;
    let splitSec = 0;
    let splitHr: number[] = [];

    const close = (distanceM: number, durationSec: number) => {
        const order = splits.length + 1;
        const avg = mean(splitHr);
        splits.push({
            label: distanceM >= SPLIT_M ? `Km ${order}` : `${round1(distanceM / 1000)} km`,
            order,
            distanceM: round1(distanceM),
            durationSec: Math.round(durationSec),
            avgBpm: avg == null ? null : Math.round(avg),
            pacePerKm: distanceM > 0 ? Math.round(durationSec / (distanceM / 1000)) : null,
        });
        splitHr = [];
    };

    return {
        add(seg: Segment) {
            let remainingD = seg.distanceM;
            let remainingT = seg.durationSec;
            while (splitDist + remainingD >= SPLIT_M) {
                const need = SPLIT_M - splitDist;
                const frac = remainingD > 0 ? need / remainingD : 0;
                const tPart = remainingT * frac;
                if (finite(seg.hr)) splitHr.push(seg.hr);
                close(SPLIT_M, splitSec + tPart);
                splitDist = 0;
                splitSec = 0;
                remainingD -= need;
                remainingT -= tPart;
            }
            if (remainingD > 0 && finite(seg.hr)) splitHr.push(seg.hr);
            splitDist += remainingD;
            splitSec += remainingT;
        },
        /** Closed splits only — what the live Splits face has already landed. */
        closed: () => splits.slice(),
        /** The kilometre in progress, for the bar that fills live. */
        current: () => ({ distanceM: splitDist, durationSec: splitSec }),
        finish() {
            if (splitDist >= MIN_PARTIAL_SPLIT_M) close(splitDist, splitSec);
            splitDist = 0;
            splitSec = 0;
            return splits.slice();
        },
    };
};

// ---------------------------------------------------------------------------------------
// The accumulator

export interface LiveSnapshot {
    distanceM: number;
    movingSec: number;
    maxSpeed: number | null;
    /** Seconds per km over the last `LIVE_PACE_WINDOW_SEC` of moving; null when standing. */
    currentPacePerKm: number | null;
    avgPacePerKm: number | null;
    /** True when the last accepted fix was standing still — what "Auto-paused" shows. */
    stationary: boolean;
    splits: Split[];
    currentSplit: { distanceM: number; durationSec: number };
    avgBpm: number | null;
    maxBpm: number | null;
}

export const createAccumulator = (type: TrackableType) => {
    const limits = TYPE_LIMITS[type] ?? TYPE_LIMITS.jogging;
    const kept: Point[] = [];
    const segments: Segment[] = [];
    const splitter = createSplitter();
    let anchor = 0;
    let distanceM = 0;
    let movingSec = 0;
    let maxSpeed = 0;
    let stationary = false;
    let pendingBreak = false;
    let hrSum = 0;
    let hrCount = 0;
    let hrMax = -Infinity;

    return {
        /**
         * Offer one fix. `paused` is a manual pause. `breakBefore` says a pause window lies
         * between the last kept fix and this one — `resume()` sets it for the live recorder,
         * the batch pass computes it from the stored windows. Returns whether the fix was
         * kept (not rejected by rule 1 or 2).
         */
        push(fix: Partial<Fix>, { paused = false, breakBefore = false } = {}): boolean {
            const b = toPoint(fix);
            if (!b) return false;

            if (kept.length) {
                const prev = kept[kept.length - 1];
                const dt = (b.t - prev.t) / 1000;
                if (dt <= 0) return false;
                const d = haversine(prev.lat, prev.lng, b.lat, b.lng);
                if (dt <= MAX_GAP_SEC && d / dt > limits.maxSpeed) return false; // rule 2
            }

            kept.push(b);
            const i = kept.length - 1;
            if (!paused && finite(b.hr)) {
                hrSum += b.hr;
                hrCount += 1;
                if (b.hr > hrMax) hrMax = b.hr;
            }
            if (i === 0) {
                pendingBreak = false;
                return true;
            }

            const prev = kept[i - 1];
            if ((b.t - prev.t) / 1000 > MAX_GAP_SEC || breakBefore || pendingBreak || paused) {
                anchor = i; // rule 4 and pauses
                pendingBreak = false;
                return true;
            }

            const from = anchor;
            const a = kept[from];
            const d = haversine(a.lat, a.lng, b.lat, b.lng);
            if (d < limits.minStep) return true; // rule 3: not yet an anchor away

            const dt = (b.t - a.t) / 1000;
            const speed = d / dt;
            anchor = i;
            if (speed < limits.stopSpeed) {
                stationary = true;
                return true;
            }
            stationary = false;

            distanceM += d;
            movingSec += dt;
            if (speed > maxSpeed) maxSpeed = speed;
            const seg: Segment = {
                startT: a.t, endT: b.t, distanceM: d, durationSec: dt, speed,
                climbM: null, hr: b.hr, cumulativeM: distanceM,
            };
            segments.push(seg);
            splitter.add(seg);
            return true;
        },

        /** After a manual pause ends: nothing may be counted across it. */
        resume() {
            pendingBreak = true;
        },

        snapshot(): LiveSnapshot {
            let d = 0;
            let s = 0;
            const now = kept.length ? kept[kept.length - 1].t : 0;
            for (let k = segments.length - 1; k >= 0; k -= 1) {
                const seg = segments[k];
                if (now - seg.endT > LIVE_PACE_WINDOW_SEC * 1000) break;
                d += seg.distanceM;
                s += seg.durationSec;
            }
            return {
                distanceM: round1(distanceM),
                movingSec: Math.round(movingSec),
                maxSpeed: maxSpeed > 0 ? round1(maxSpeed) : null,
                currentPacePerKm: !stationary && d >= 10 ? Math.round(s / (d / 1000)) : null,
                avgPacePerKm: distanceM >= 10 ? Math.round(movingSec / (distanceM / 1000)) : null,
                stationary,
                splits: splitter.closed(),
                currentSplit: splitter.current(),
                avgBpm: hrCount ? Math.round(hrSum / hrCount) : null,
                maxBpm: hrCount ? hrMax : null,
            };
        },

        /** Kept fixes, for drawing. Do not mutate. */
        points: (): readonly Point[] => kept,
        segments: (): readonly Segment[] => segments,

        /** Close the trailing partial split. Call once, at the end. */
        finishSplits: () => splitter.finish(),

        get distanceM() { return distanceM; },
        get movingSec() { return movingSec; },
        get maxSpeed() { return maxSpeed; },
        get hr() { return { avg: hrCount ? Math.round(hrSum / hrCount) : null, max: hrCount ? hrMax : null }; },
    };
};

export type Accumulator = ReturnType<typeof createAccumulator>;

// ---------------------------------------------------------------------------------------
// Batch-only parts

const smoothAltitudes = (points: readonly Point[]): (number | null)[] => {
    const out: (number | null)[] = new Array(points.length).fill(null);
    let lo = 0;
    let hi = 0;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < points.length; i += 1) {
        const t = points[i].t;
        while (hi < points.length && points[hi].t <= t + ALT_SMOOTH_SEC * 1000) {
            const alt = points[hi].alt;
            if (finite(alt)) { sum += alt; count += 1; }
            hi += 1;
        }
        while (points[lo].t < t - ALT_SMOOTH_SEC * 1000) {
            const alt = points[lo].alt;
            if (finite(alt)) { sum -= alt; count -= 1; }
            lo += 1;
        }
        if (finite(points[i].alt) && count > 0) out[i] = sum / count;
    }
    return out;
};

export const elevationGain = (alts: (number | null | undefined)[]): number | null => {
    const values = alts.filter(finite);
    if (!values.length) return null;
    let ref = values[0];
    let gain = 0;
    for (const alt of values) {
        if (alt >= ref + CLIMB_HYSTERESIS_M) {
            gain += alt - ref;
            ref = alt;
        } else if (alt <= ref - CLIMB_HYSTERESIS_M) {
            ref = alt;
        }
    }
    return round1(gain);
};

const segmentDistance = (p: number[], a: number[], b: number[], cosLat: number) => {
    const x = (q: number[]) => toRad(q[0]) * EARTH_RADIUS_M * cosLat;
    const y = (q: number[]) => toRad(q[1]) * EARTH_RADIUS_M;
    const px = x(p); const py = y(p);
    const ax = x(a); const ay = y(a);
    const bx = x(b); const by = y(b);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
};

/** Douglas–Peucker over `[lng, lat]`, iterative, endpoints kept. */
export const simplify = (coords: number[][], tolerance = ROUTE_TOLERANCE_M): number[][] => {
    if (coords.length <= 2) return coords.slice();
    const cosLat = Math.cos(toRad(coords[0][1]));
    const keep = new Uint8Array(coords.length);
    keep[0] = 1;
    keep[coords.length - 1] = 1;
    const stack: [number, number][] = [[0, coords.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop()!;
        let maxDist = 0;
        let index = -1;
        for (let i = first + 1; i < last; i += 1) {
            const d = segmentDistance(coords[i], coords[first], coords[last], cosLat);
            if (d > maxDist) { maxDist = d; index = i; }
        }
        if (index !== -1 && maxDist > tolerance) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }
    return coords.filter((_, i) => keep[i]);
};

const inPause = (ms: number, pauses: [number, number][]) => pauses.some(([s, e]) => ms >= s && ms <= e);
const crossesPause = (a: number, b: number, pauses: [number, number][]) =>
    pauses.some(([s, e]) => a <= e && b >= s);

export interface TrackResult {
    distanceM: number;
    movingSec: number;
    elapsedSec: number;
    avgPacePerKm: number | null;
    avgSpeed: number | null;
    maxSpeed: number | null;
    elevationGainM: number | null;
    avgBpm: number | null;
    maxBpm: number | null;
    splits: Split[];
    route: number[][];
    segments: Segment[];
    pointsUsed: number;
    pointsDropped: number;
}

/** The whole computation over a finished track — the provisional summary. */
export const computeTrack = (track: Partial<Track> | undefined, { type = 'jogging' as TrackableType } = {}): TrackResult => {
    const n = Array.isArray(track?.t) ? track!.t.length : 0;
    const pauses = (Array.isArray(track?.pauses) ? track!.pauses : [])
        .filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]) && p[1] >= p[0])
        .map(([s, e]) => [s, e] as [number, number]);

    const raw: Fix[] = [];
    for (let i = 0; i < n; i += 1) {
        const fix = {
            t: track!.t![i], lat: track!.lat?.[i], lng: track!.lng?.[i],
            alt: track!.alt?.[i], acc: track!.acc?.[i], hr: track!.hr?.[i],
        };
        if (toPoint(fix)) raw.push(fix as Fix);
    }
    raw.sort((a, b) => a.t - b.t);

    const empty: TrackResult = {
        distanceM: 0, movingSec: 0, elapsedSec: 0, avgPacePerKm: null, avgSpeed: null, maxSpeed: null,
        elevationGainM: null, avgBpm: null, maxBpm: null, splits: [], route: [], segments: [],
        pointsUsed: raw.length, pointsDropped: n,
    };
    if (raw.length < 2) return empty;

    const acc = createAccumulator(type);
    for (const fix of raw) {
        const points = acc.points();
        const lastT = points.length ? points[points.length - 1].t : null;
        acc.push(fix, {
            paused: inPause(fix.t, pauses),
            breakBefore: lastT != null && crossesPause(lastT, fix.t, pauses),
        });
    }

    const kept = acc.points();
    const alts = smoothAltitudes(kept);
    // Grade needs the smoothed altitude at each segment's two ends.
    const indexByT = new Map(kept.map((p, i) => [p.t, i]));
    const segments = acc.segments().map((seg) => {
        const i = indexByT.get(seg.endT)!;
        const from = indexByT.get(seg.startT)!;
        const a0 = alts[from];
        const a1 = alts[i];
        return { ...seg, climbM: finite(a0) && finite(a1) ? a1 - a0 : null };
    });

    const distanceM = acc.distanceM;
    const movingSec = acc.movingSec;
    const hrs = kept.filter((p) => !inPause(p.t, pauses)).map((p) => p.hr).filter(finite);
    const avgHr = mean(hrs);

    return {
        distanceM: round1(distanceM),
        movingSec: Math.round(movingSec),
        elapsedSec: Math.round((raw[raw.length - 1].t - raw[0].t) / 1000),
        avgPacePerKm: distanceM >= 10 ? Math.round(movingSec / (distanceM / 1000)) : null,
        avgSpeed: movingSec > 0 ? round1(distanceM / movingSec) : null,
        maxSpeed: acc.maxSpeed > 0 ? round1(acc.maxSpeed) : null,
        elevationGainM: elevationGain(alts),
        avgBpm: avgHr == null ? null : Math.round(avgHr),
        maxBpm: hrs.length ? hrs.reduce((m, v) => (v > m ? v : m), -Infinity) : null,
        splits: acc.finishSplits(),
        route: simplify(kept.map((p) => [p.lng, p.lat])),
        segments,
        pointsUsed: kept.length,
        pointsDropped: n - kept.length,
    };
};
