/**
 * The map's lighting follows the sun at the runner's position — a 6 am run looks like dawn.
 *
 * Mapbox Standard takes a `lightPreset` of dawn / day / dusk / night. Picking it from the
 * phone's clock would be wrong twice a year and wrong everywhere far from the time zone's
 * meridian, so it is computed from solar elevation instead: the low-precision formulae from
 * the Astronomical Almanac, good to a fraction of a degree, which is far more than a
 * four-way choice needs. On-device and offline; no API.
 */
const RAD = Math.PI / 180;

/** Degrees above the horizon. Negative is below. */
export const solarElevation = (date: Date, lat: number, lng: number): number => {
    // Days since J2000.0 (2000-01-01 12:00 UTC).
    const d = date.getTime() / 86_400_000 - 10_957.5;
    const g = (357.529 + 0.98560028 * d) * RAD; // mean anomaly
    const q = 280.459 + 0.98564736 * d; // mean longitude, degrees
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; // ecliptic longitude
    const e = (23.439 - 0.00000036 * d) * RAD; // obliquity
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const decl = Math.asin(Math.sin(e) * Math.sin(L));
    const gmstDeg = ((18.697374558 + 24.06570982441908 * d) % 24) * 15;
    const hourAngle = (gmstDeg + lng) * RAD - ra;
    const phi = lat * RAD;
    return Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)) / RAD;
};

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

/** Civil twilight (sun between −6° and +6°) is dawn or dusk depending on which way it moves. */
export const lightPresetFor = (date: Date, lat: number, lng: number): LightPreset => {
    const now = solarElevation(date, lat, lng);
    if (now > 6) return 'day';
    if (now < -6) return 'night';
    const soon = solarElevation(new Date(date.getTime() + 10 * 60_000), lat, lng);
    return soon > now ? 'dawn' : 'dusk';
};
