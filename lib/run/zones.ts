/**
 * Heart-rate zones — a deterministic table, and a description of effort, never a verdict.
 *
 * Five bands as a share of the estimated maximum (`maxHr` from the server, Tanaka's
 * 208 − 0.7 × age, null without a birth date). The labels describe how hard the effort is,
 * not whether it is good for anybody: zone 5 is "Maximum", not "Danger", and nothing here
 * alerts — vital alerts judge heart rate only at rest, and 175 on a hill is the hill. The
 * estimate is labelled as one wherever a zone is shown.
 *
 * Colour is the same Ember ramp as the trail — five validated ordinal steps, one per zone.
 */
import type { Track } from './trackMath';

export const ZONES = [
    { n: 1, from: 0.5, label: 'Easy' },
    { n: 2, from: 0.6, label: 'Steady' },
    { n: 3, from: 0.7, label: 'Moderate' },
    { n: 4, from: 0.8, label: 'Hard' },
    { n: 5, from: 0.9, label: 'Maximum' },
] as const;

/** 1–5, or 0 below zone 1, or null when there is no estimate to compare against. */
export const zoneFor = (bpm: number | null | undefined, maxHr: number | null | undefined): number | null => {
    if (bpm == null || !maxHr || !Number.isFinite(bpm)) return null;
    const share = bpm / maxHr;
    let zone = 0;
    for (const z of ZONES) if (share >= z.from) zone = z.n;
    return zone;
};

/** Longest gap between fixes that still counts as time at that heart rate. */
const MAX_STEP_SEC = 10;

/**
 * Seconds in each zone, index 0 = below zone 1. Counted between consecutive fixes that both
 * carry heart rate, gaps capped, pauses excluded — a paused run is not time at any effort.
 * Null when the track has no heart rate or there is no estimate.
 */
export const timeInZones = (track: Partial<Track> | null | undefined, maxHr: number | null | undefined): number[] | null => {
    if (!track?.t || !track.hr || !maxHr) return null;
    const pauses = track.pauses ?? [];
    const out = [0, 0, 0, 0, 0, 0];
    let any = false;
    for (let i = 1; i < track.t.length; i += 1) {
        const hr = track.hr[i];
        const prevHr = track.hr[i - 1];
        if (hr == null || prevHr == null) continue;
        const t0 = track.t[i - 1];
        const t1 = track.t[i];
        if (pauses.some(([s, e]) => t1 >= s && t0 <= e)) continue;
        const dt = Math.min(MAX_STEP_SEC, (t1 - t0) / 1000);
        if (!(dt > 0)) continue;
        const zone = zoneFor((hr + prevHr) / 2, maxHr);
        if (zone == null) continue;
        out[zone] += dt;
        any = true;
    }
    return any ? out.map((v) => Math.round(v)) : null;
};
