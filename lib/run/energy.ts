/**
 * Active energy for a GPS-tracked session — a port of `labtrack-backend/utils/runEnergy.js`,
 * held to it by the shared fixtures. The equations and the two rules (no body mass, no
 * number; an untracked type gets null) are explained there.
 *
 * Live, the screen prices segments as they arrive with a grade of zero, because smoothing
 * altitude needs fifteen seconds of the future. The summary re-prices with grade, and the
 * stored figure is the server's.
 */
import type { Segment, TrackableType } from './trackMath';

const FOOT_TYPES = new Set<string>(['walking', 'jogging', 'hiking']);
const BIKE_TYPES = new Set<string>(['biking']);

export const RUN_THRESHOLD_MS = 2.2;
export const MAX_GRADE = 0.15;
const KCAL_PER_LITRE_O2 = 5;

const BIKE_METS: [number, number][] = [
    [16, 4],
    [19, 6.8],
    [22.5, 8],
    [25.5, 10],
    [30.5, 12],
    [Infinity, 15.8],
];

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type Priced = Pick<Segment, 'speed' | 'durationSec' | 'distanceM' | 'climbM'>;

const gradeOf = (seg: Priced) => {
    if (!finite(seg.climbM) || !(seg.distanceM > 0)) return 0;
    return Math.max(0, Math.min(MAX_GRADE, seg.climbM / seg.distanceM));
};

const footKcal = (seg: Priced, kg: number) => {
    const S = seg.speed * 60;
    const G = gradeOf(seg);
    const net = seg.speed >= RUN_THRESHOLD_MS ? 0.2 * S + 0.9 * S * G : 0.1 * S + 1.8 * S * G;
    return (net * kg / 1000) * KCAL_PER_LITRE_O2 * (seg.durationSec / 60);
};

const bikeKcal = (seg: Priced, kg: number) => {
    const kmh = seg.speed * 3.6;
    const met = BIKE_METS.find(([upper]) => kmh < upper)![1];
    return (met - 1) * kg * (seg.durationSec / 3600);
};

/** Unrounded kcal for one segment, or null when there is no equation or no mass. */
export const segmentKcal = (seg: Priced, type: TrackableType | string, weightKg: number | null | undefined): number | null => {
    if (!finite(weightKg) || weightKg <= 0) return null;
    if (FOOT_TYPES.has(type)) return footKcal(seg, weightKg);
    if (BIKE_TYPES.has(type)) return bikeKcal(seg, weightKg);
    return null;
};

export const activeKcal = (
    segments: readonly Priced[] | undefined,
    { type, weightKg }: { type: TrackableType | string; weightKg: number | null | undefined },
): number | null => {
    if (!finite(weightKg) || weightKg <= 0) return null;
    if (!FOOT_TYPES.has(type) && !BIKE_TYPES.has(type)) return null;
    const total = (segments ?? []).reduce((sum, seg) => sum + (segmentKcal(seg, type, weightKg) ?? 0), 0);
    return Math.round(total);
};
