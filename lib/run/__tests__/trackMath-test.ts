/**
 * The phone's track arithmetic, held to the server's.
 *
 * `fixtures/tracks/` is copied from `labtrack-backend/__tests__/fixtures/tracks/` and
 * `expected.json` there was produced by `utils/trackMetrics.js`. Every number the live
 * screen and the provisional summary show comes from this module; if any of these fail,
 * somebody will finish a run, see one distance, and find another in their history.
 *
 * Regenerate on the backend (`node scripts/generateTrackFixtures.js`) and copy the folder
 * here — never edit expected.json by hand.
 */
import { computeTrack, createAccumulator, elevationGain, type Track, type TrackableType } from '../trackMath';
import { activeKcal } from '../energy';

/* eslint-disable @typescript-eslint/no-require-imports */
const expected: Record<string, any> = require('./fixtures/tracks/expected.json');
const load = (name: string): { type: TrackableType; weightKg: number | null; truth: { distanceM: number }; track: Track } =>
    require(`./fixtures/tracks/${name}.json`);
/* eslint-enable @typescript-eslint/no-require-imports */

const names = Object.keys(expected);

describe('the same answer as the server, fixture by fixture', () => {
    it.each(names)('%s', (name) => {
        const f = load(name);
        const m = computeTrack(f.track, { type: f.type });
        const e = expected[name];
        expect(m.distanceM).toBe(e.distanceM);
        expect(m.movingSec).toBe(e.movingSec);
        expect(m.elapsedSec).toBe(e.elapsedSec);
        expect(m.avgPacePerKm).toBe(e.avgPacePerKm);
        expect(m.maxSpeed).toBe(e.maxSpeed);
        expect(m.elevationGainM).toBe(e.elevationGainM);
        expect(m.avgBpm).toBe(e.avgBpm);
        expect(m.maxBpm).toBe(e.maxBpm);
        expect(m.splits).toEqual(e.splits);
        expect(m.route).toHaveLength(e.routePoints);
        expect(m.pointsUsed).toBe(e.pointsUsed);
        expect(activeKcal(m.segments, { type: f.type, weightKg: f.weightKg })).toBe(e.activeKcal);
    });
});

describe('live and final cannot disagree', () => {
    it.each(names)('%s: fixes fed one at a time reach the batch distance, time and splits', (name) => {
        const f = load(name);
        const { track } = f;
        const pauses = track.pauses ?? [];
        const acc = createAccumulator(f.type);
        let wasPaused = false;
        for (let i = 0; i < track.t.length; i += 1) {
            const t = track.t[i];
            const paused = pauses.some(([s, e]) => t >= s && t <= e);
            // What the recorder does: resume() when a pause ends.
            if (wasPaused && !paused) acc.resume();
            wasPaused = paused;
            acc.push({
                t, lat: track.lat[i], lng: track.lng[i],
                alt: track.alt?.[i], acc: track.acc?.[i], hr: track.hr?.[i],
            }, { paused });
        }
        const live = acc.snapshot();
        const e = expected[name];
        expect(live.distanceM).toBe(e.distanceM);
        expect(live.movingSec).toBe(e.movingSec);
        expect(live.avgBpm).toBe(e.avgBpm);
        expect(acc.finishSplits()).toEqual(e.splits);
    });

    it('reports a live pace close to the pace actually run, and none while stood still', () => {
        const f = load('redLight');
        const acc = createAccumulator('jogging');
        const { track } = f;
        let atLight: ReturnType<typeof acc.snapshot> | null = null;
        let running: ReturnType<typeof acc.snapshot> | null = null;
        for (let i = 0; i < track.t.length; i += 1) {
            acc.push({ t: track.t[i], lat: track.lat[i], lng: track.lng[i], acc: track.acc?.[i] });
            if (i === 600) running = acc.snapshot();
            if (i === 740) atLight = acc.snapshot(); // 80 s into the 90 s stop
        }
        // The fixture runs at 5:30/km = 330 s/km.
        expect(running!.currentPacePerKm).toBeGreaterThan(310);
        expect(running!.currentPacePerKm).toBeLessThan(350);
        expect(atLight!.stationary).toBe(true);
        expect(atLight!.currentPacePerKm).toBeNull();
    });

    it('lands kilometres live, with the one in progress reported separately', () => {
        const { track } = load('loop5k');
        const acc = createAccumulator('jogging');
        for (let i = 0; i < 700; i += 1) acc.push({ t: track.t[i], lat: track.lat[i], lng: track.lng[i] });
        const s = acc.snapshot();
        expect(s.splits.map((x) => x.label)).toEqual(['Km 1', 'Km 2']);
        expect(s.currentSplit.distanceM).toBeGreaterThan(0);
        expect(s.currentSplit.distanceM).toBeLessThan(1000);
    });
});

describe('what it refuses', () => {
    it('rejects a fix worse than 25 m, a teleport, and time running backwards', () => {
        const acc = createAccumulator('jogging');
        expect(acc.push({ t: 0, lat: 25, lng: 55, acc: 5 })).toBe(true);
        expect(acc.push({ t: 1000, lat: 25.00002, lng: 55, acc: 60 })).toBe(false);
        expect(acc.push({ t: 2000, lat: 25.01, lng: 55, acc: 5 })).toBe(false); // ~1.1 km in 2 s
        expect(acc.push({ t: -500, lat: 25, lng: 55 })).toBe(false); // before the last kept fix
    });

    it('survives an empty or corrupt track', () => {
        expect(computeTrack({ t: [], lat: [], lng: [] }).distanceM).toBe(0);
        expect(computeTrack(undefined).distanceM).toBe(0);
        expect(elevationGain([null, undefined])).toBeNull();
    });

    it('prints no calories without a weight', () => {
        const m = computeTrack(load('noWeight').track, { type: 'jogging' });
        expect(activeKcal(m.segments, { type: 'jogging', weightKg: null })).toBeNull();
    });
});
