/**
 * How the live session writes its numbers.
 *
 * Everything is stored metric; the person's distance unit (`lib/units.ts`) decides only how
 * it is drawn. Pace follows the distance unit too — "5:31 /km" or "8:53 /mi" — and a ride
 * is shown as speed, because nobody on a bike thinks in minutes per kilometre.
 */
import { getUnits, type UnitPrefs } from '@/lib/units';
import type { TrackableType } from './trackMath';

const M_PER_MILE = 1609.344;

/** `1:05:09` past an hour, `05:09` below it. */
export const formatClock = (totalSec: number): string => {
    const s = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Distance as a bare number and its unit, so the screen can size them differently. */
export const distanceParts = (metres: number, prefs: UnitPrefs = getUnits()): { value: string; unit: string } => {
    const miles = prefs.distance === 'mi';
    const v = miles ? metres / M_PER_MILE : metres / 1000;
    return { value: v.toFixed(2), unit: miles ? 'mi' : 'km' };
};

/**
 * Pace or speed for this type, or null when there is nothing honest to show — standing
 * still, or not yet enough distance to divide by.
 */
export const paceParts = (
    secPerKm: number | null,
    type: TrackableType,
    prefs: UnitPrefs = getUnits(),
): { value: string; unit: string } | null => {
    if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
    const miles = prefs.distance === 'mi';
    if (type === 'biking') {
        const kmh = 3600 / secPerKm;
        return miles
            ? { value: (kmh / 1.609344).toFixed(1), unit: 'mph' }
            : { value: kmh.toFixed(1), unit: 'km/h' };
    }
    const perUnit = miles ? secPerKm * 1.609344 : secPerKm;
    // Slower than an hour per unit is not a pace anybody is keeping.
    if (perUnit >= 3600) return null;
    const m = Math.floor(perUnit / 60);
    const s = Math.round(perUnit % 60);
    const [mm, ss] = s === 60 ? [m + 1, 0] : [m, s];
    return { value: `${mm}:${String(ss).padStart(2, '0')}`, unit: miles ? '/mi' : '/km' };
};

export const TYPE_LABEL: Record<TrackableType, string> = {
    jogging: 'Run',
    walking: 'Walk',
    hiking: 'Hike',
    biking: 'Ride',
};
