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
 * Where the replay camera is at `progress` (0–1 of the distance), and which way it looks.
 * Heading is taken towards a point ~150 m ahead and not the next fix, so the camera turns
 * with the road rather than twitching with every GPS wobble.
 */
export const replayFrame = (coords: number[][], cum: number[], progress: number) => {
    const total = cum[cum.length - 1] || 0;
    const target = Math.max(0, Math.min(1, progress)) * total;
    let i = 0;
    while (i < cum.length - 1 && cum[i + 1] < target) i += 1;
    const aheadTarget = Math.min(total, target + 150);
    let j = i;
    while (j < cum.length - 1 && cum[j] < aheadTarget) j += 1;
    const here = coords[i];
    const ahead = coords[Math.max(j, Math.min(i + 1, coords.length - 1))];
    return { center: here, heading: here === ahead ? 0 : bearing(here, ahead), distanceM: target };
};

export { cumulative };
