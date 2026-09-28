/**
 * The pure geometry behind the replay, the poster and the route glyphs.
 *
 * **The privacy trim.** A route that starts and ends at the same door is a home address, so
 * anything that leaves the phone as a picture drops the first and last `PRIVACY_TRIM_M`. A
 * route too short to survive that is not drawn at all on a shared image — the poster says why
 * — rather than drawn in full, because "it was only a short walk" is not a reason to publish
 * where somebody lives. The trim applies to what is *shared*; the person's own map shows all
 * of it.
 */
import { haversine } from './trackMath';

export const PRIVACY_TRIM_M = 250;

const cumulative = (coords: number[][]) => {
    const cum = new Array<number>(coords.length).fill(0);
    for (let i = 1; i < coords.length; i += 1) {
        cum[i] = cum[i - 1] + haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    }
    return cum;
};

/** `[lng, lat]` with the ends removed, or null when nothing would be left worth drawing. */
export const trimForPrivacy = (coords: number[][], metres = PRIVACY_TRIM_M): number[][] | null => {
    if (coords.length < 2) return null;
    const cum = cumulative(coords);
    const total = cum[cum.length - 1];
    if (total < metres * 2 + 200) return null;
    const out = coords.filter((_, i) => cum[i] >= metres && cum[i] <= total - metres);
    return out.length >= 2 ? out : null;
};

/**
 * Fit `[lng, lat]` into a box as an SVG path, north up, with longitude scaled by the
 * latitude's cosine so a loop in Oslo is not drawn twice as wide as it is.
 */
export const routePath = (coords: number[][], width: number, height: number, padding = 8): string => {
    if (coords.length < 2) return '';
    const cosLat = Math.cos((coords[0][1] * Math.PI) / 180);
    const xs = coords.map((c) => c[0] * cosLat);
    const ys = coords.map((c) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;
    return coords.map((_, i) => {
        const x = offX + (xs[i] - minX) * scale;
        const y = offY + (maxY - ys[i]) * scale;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
};

/** `[[minLng, minLat], [maxLng, maxLat]]`, for fitting a camera. */
export const boundsOf = (coords: number[][]): [number[], number[]] | null => {
    if (!coords.length) return null;
    let minLng = Infinity; let minLat = Infinity; let maxLng = -Infinity; let maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }
    return [[minLng, minLat], [maxLng, maxLat]];
};

/** Initial compass bearing from a to b, degrees clockwise from north. */
export const bearing = (a: number[], b: number[]): number => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const [lng1, lat1] = [toRad(a[0]), toRad(a[1])];
    const [lng2, lat2] = [toRad(b[0]), toRad(b[1])];
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * The point `d` metres along the route, **interpolated between fixes**. Snapping to the
 * nearest fix is what made the first replay judder: at replay speed consecutive frames
 * landed on the same fix, then jumped to the next one.
 */
export const pointAt = (coords: number[][], cum: number[], d: number): number[] => {
    const n = coords.length;
    if (n === 0) return [0, 0];
    if (d <= 0 || n === 1) return coords[0];
    const total = cum[n - 1];
    if (d >= total) return coords[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const span = cum[hi] - cum[lo];
    const f = span > 0 ? (d - cum[lo]) / span : 0;
    return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * f, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * f];
};

/**
 * How long the replay runs: longer for a longer route, within bounds. The first version was
 * eight seconds whatever the distance, so an 80-minute ride went past at kilometres a second.
 */
export const REPLAY_MIN_MS = 15_000;
export const REPLAY_MAX_MS = 45_000;
export const replayDurationMs = (distanceM: number): number =>
    Math.round(Math.max(REPLAY_MIN_MS, Math.min(REPLAY_MAX_MS, REPLAY_MIN_MS + (distanceM / 1000) * 1200)));

/**
 * Turn from `current` towards `target` by at most `maxDelta` degrees, **the short way round**.
 * Without the wrap a camera going from 350° to 10° spins through 340 degrees the long way,
 * which is the lurch the first replay made on every northward turn.
 */
export const turnToward = (current: number, target: number, maxDelta: number): number => {
    const diff = ((target - current + 540) % 360) - 180; // −180…180
    const step = Math.max(-maxDelta, Math.min(maxDelta, diff));
    return (current + step + 360) % 360;
};

/**
 * Which way the camera should look at `d` metres: along the chord from a little behind to
 * `ahead` metres in front. A chord across a window ignores the GPS wiggles a fix-to-fix
 * bearing follows, and looks into a bend before the dot reaches it.
 */
export const lookHeading = (coords: number[][], cum: number[], d: number, ahead = 250, behind = 40): number => {
    const from = pointAt(coords, cum, d - behind);
    const to = pointAt(coords, cum, d + ahead);
    return from[0] === to[0] && from[1] === to[1] ? 0 : bearing(from, to);
};

/** Where the replay camera is at `progress` (0–1 of the distance), and which way it looks. */
export const replayFrame = (coords: number[][], cum: number[], progress: number, ahead = 250) => {
    const total = cum[cum.length - 1] || 0;
    const d = Math.max(0, Math.min(1, progress)) * total;
    return { center: pointAt(coords, cum, d), heading: lookHeading(coords, cum, d, ahead), distanceM: d };
};

export { cumulative };
