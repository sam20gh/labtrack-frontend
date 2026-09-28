/**
 * The pure parts of the Afterglow screens: the sun, the trail, the goal, and the coach's
 * wording. Each is something a person sees or hears during a run, and none of them can be
 * checked by looking at a simulator.
 */
/* eslint-disable import/first -- jest.mock must precede the imports it replaces */
jest.mock('@react-native-async-storage/async-storage', () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot import
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-speech', () => ({ speak: jest.fn() }));
jest.mock('../recorder', () => ({ subscribe: jest.fn(), getState: jest.fn() }));

import { lightPresetFor, solarElevation } from '../sun';
import { buildTrail, EMBER_DARK, rampColor, recentPace } from '../afterglow';
import { goalProgress } from '../goal';
import { cueInterval, cueText } from '../coach';
import { createAccumulator } from '../trackMath';

// Dubai Marina. Sunrise on 2026-09-20 is about 06:10 local (02:10 UTC), sunset about 18:20
// local (14:20 UTC); local noon is about 12:15 (08:15 UTC).
const DUBAI = { lat: 25.08, lng: 55.14 };
const utc = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 20, h, m));

describe('sun', () => {
    it('puts the sun high at local noon and well below the horizon at midnight', () => {
        expect(solarElevation(utc(8, 15), DUBAI.lat, DUBAI.lng)).toBeGreaterThan(60);
        expect(solarElevation(utc(20, 0), DUBAI.lat, DUBAI.lng)).toBeLessThan(-50);
    });

    it('picks the preset a runner would recognise', () => {
        expect(lightPresetFor(utc(8, 0), DUBAI.lat, DUBAI.lng)).toBe('day');
        expect(lightPresetFor(utc(21, 0), DUBAI.lat, DUBAI.lng)).toBe('night');
        expect(lightPresetFor(utc(2, 5), DUBAI.lat, DUBAI.lng)).toBe('dawn'); // 06:05 local
        expect(lightPresetFor(utc(14, 30), DUBAI.lat, DUBAI.lng)).toBe('dusk'); // 18:30 local
    });

    it('follows the place, not the phone’s clock: the same instant is night in London', () => {
        expect(lightPresetFor(utc(2, 5), 51.5, -0.12)).toBe('night');
    });
});

/** A straight run east: `legs` of [seconds, m/s]. */
const run = (legs: [number, number][]) => {
    const acc = createAccumulator('jogging');
    let t = 0;
    let x = 0;
    acc.push({ t, lat: 25, lng: 55 });
    for (const [secs, speed] of legs) {
        for (let s = 0; s < secs; s += 1) {
            t += 1000;
            x += speed;
            acc.push({ t, lat: 25, lng: 55 + x / (111_320 * Math.cos((25 * Math.PI) / 180)) });
        }
    }
    return acc;
};

describe('the trail', () => {
    it('is dim where the run was slow and bright where it was fast, and never violet', () => {
        const acc = run([[200, 2], [200, 4]]);
        const trail = buildTrail(acc.points(), acc.segments(), EMBER_DARK);
        const stops = (trail.gradient as unknown[]).slice(3);
        const colours = stops.filter((_, i) => i % 2 === 1) as string[];
        expect(colours[0]).toBe(rampColor(0, EMBER_DARK));
        expect(colours[colours.length - 1]).toBe(rampColor(1, EMBER_DARK));
        for (const c of colours) expect(c.toLowerCase()).not.toBe('#853aab');
    });

    it('keeps the gradient’s stops strictly increasing from 0 to 1, within the cap', () => {
        const acc = run([[1800, 3]]);
        const trail = buildTrail(acc.points(), acc.segments(), EMBER_DARK, { maxStops: 48 });
        const progress = (trail.gradient as unknown[]).slice(3).filter((_, i) => i % 2 === 0) as number[];
        expect(progress[0]).toBe(0);
        expect(progress[progress.length - 1]).toBe(1);
        for (let i = 1; i < progress.length; i += 1) expect(progress[i]).toBeGreaterThan(progress[i - 1]);
        expect(progress.length).toBeLessThanOrEqual(48);
    });

    it('paints an even-paced run in one colour and draws no legend range', () => {
        const acc = run([[600, 3]]);
        const trail = buildTrail(acc.points(), acc.segments(), EMBER_DARK);
        const colours = new Set((trail.gradient as unknown[]).slice(3).filter((_, i) => i % 2 === 1));
        expect(colours.size).toBe(1);
        expect(trail.paceRange).toBeNull();
    });

    it('draws a comet tail over the last 400 m only', () => {
        const acc = run([[600, 3]]);
        const trail = buildTrail(acc.points(), acc.segments(), EMBER_DARK);
        expect(trail.tail!.coordinates.length).toBeGreaterThan(100);
        expect(trail.tail!.coordinates.length).toBeLessThan(160); // ≈ 134 fixes at 3 m/s
    });

    it('draws nothing to colour before there is a route', () => {
        const acc = run([[3, 3]]);
        expect(buildTrail(acc.points(), acc.segments(), EMBER_DARK).gradient).toBeNull();
    });

    it('gives the ribbon the last five minutes of pace only', () => {
        const acc = run([[600, 2], [300, 4]]);
        const pace = recentPace(acc.segments(), 300);
        expect(pace.length).toBeGreaterThan(50);
        for (const p of pace.slice(2)) expect(p).toBeCloseTo(250, -1);
    });
});

describe('goals', () => {
    it('reports distance and time goals as a fraction, capped at done', () => {
        expect(goalProgress({ kind: 'distance', metres: 5000 }, { distanceM: 2500, movingSec: 0, activeSec: 0 }).fraction).toBe(0.5);
        const over = goalProgress({ kind: 'time', seconds: 1800 }, { distanceM: 0, movingSec: 0, activeSec: 2000 });
        expect(over).toMatchObject({ fraction: 1, done: true });
    });

    it('puts the ghost on moving time, so a red light does not cost the lead', () => {
        // Target 6:00/km. 1,000 m in 330 s of moving: 30 s ahead, whatever the clock says.
        const g = goalProgress({ kind: 'pace', secPerKm: 360 }, { distanceM: 1000, movingSec: 330, activeSec: 420 });
        expect(g.ghostGapSec).toBe(30);
        const behind = goalProgress({ kind: 'pace', secPerKm: 300 }, { distanceM: 1000, movingSec: 330, activeSec: 330 });
        expect(behind.ghostGapSec).toBe(-30);
    });

    it('says nothing about the ghost in the first 50 m, which is GPS noise', () => {
        expect(goalProgress({ kind: 'pace', secPerKm: 300 }, { distanceM: 30, movingSec: 5, activeSec: 5 }).ghostGapSec).toBeNull();
    });
});

describe('the coach', () => {
    it('reads a kilometre split the way a runner says it', () => {
        expect(cueText(3, { intervalM: 1000, unit: 'km', lapSec: 331, type: 'jogging' }))
            .toBe('three kilometres. Pace, five thirty-one per kilometre.');
        expect(cueText(1, { intervalM: 1000, unit: 'km', lapSec: 305, type: 'jogging' }))
            .toBe('one kilometre. Pace, five oh five per kilometre.');
    });

    it('reads half splits as the per-unit pace, not the half’s time', () => {
        expect(cueText(3, { intervalM: 500, unit: 'km', lapSec: 150, type: 'jogging' }))
            .toBe('1.5 kilometres. Pace, five minutes per kilometre.');
    });

    it('gives a rider speed, and a mile runner miles', () => {
        expect(cueText(2, { intervalM: 1000, unit: 'km', lapSec: 150, type: 'biking' }))
            .toBe('two kilometres. 24 kilometres an hour.');
        expect(cueText(1, { intervalM: 1609.344, unit: 'mi', lapSec: 540, type: 'jogging' }))
            .toBe('one mile. Pace, nine minutes per mile.');
    });

    it('never praises or scolds', () => {
        const text = cueText(5, { intervalM: 1000, unit: 'km', lapSec: 900, type: 'walking' })!;
        expect(text).not.toMatch(/great|good|well done|slow|keep|push|come on/i);
    });

    it('is silent when cues are off', () => {
        expect(cueInterval('off', 'km')).toBeNull();
        expect(cueInterval('half', 'mi')).toBeCloseTo(804.672);
    });
});
