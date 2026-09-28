/**
 * The geometry behind the replay, the poster and the route glyphs. The one that protects
 * somebody is the privacy trim: a shared picture must not start at their front door.
 */
import {
    boundsOf, cumulative, pointAt, replayDurationMs, replayFrame, routePath, trimForPrivacy, turnToward,
    REPLAY_MAX_MS, REPLAY_MIN_MS,
} from '../replay';
import { elevationSeries } from '../trackMath';
import { trailFromTrack, EMBER_DARK } from '../afterglow';

const hill = require('./fixtures/tracks/hill.json');
const loop = require('./fixtures/tracks/loop5k.json');

/** A straight line east from (25, 55), one point every `step` metres. */
const line = (metres: number, step = 10) => {
    const perDeg = 111_320 * Math.cos((25 * Math.PI) / 180);
    return Array.from({ length: Math.floor(metres / step) + 1 }, (_, i) => [55 + (i * step) / perDeg, 25]);
};

describe('privacy trim', () => {
    it('drops the first and last 250 m of a shared route', () => {
        const coords = line(2000);
        const trimmed = trimForPrivacy(coords)!;
        const cum = cumulative(coords);
        const firstKept = coords.findIndex((c) => c === trimmed[0]);
        const lastKept = coords.findIndex((c) => c === trimmed[trimmed.length - 1]);
        expect(cum[firstKept]).toBeGreaterThanOrEqual(250);
        expect(cum[cum.length - 1] - cum[lastKept]).toBeGreaterThanOrEqual(250);
    });

    it('draws nothing for a route too short to trim, rather than drawing all of it', () => {
        expect(trimForPrivacy(line(600))).toBeNull();
        expect(trimForPrivacy([])).toBeNull();
    });

    it('trims a loop that starts and ends at the same door at both ends', () => {
        const { track } = loop;
        const coords = track.lng.map((lng: number, i: number) => [lng, track.lat[i]]);
        const trimmed = trimForPrivacy(coords)!;
        expect(trimmed[0]).not.toEqual(coords[0]);
        expect(trimmed[trimmed.length - 1]).not.toEqual(coords[coords.length - 1]);
    });
});

describe('drawing a route in a box', () => {
    it('keeps every point inside the box', () => {
        const d = routePath(line(3000), 60, 40, 4);
        const nums = d.replace(/[ML]/g, ' ').trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i < nums.length; i += 2) {
            expect(nums[i]).toBeGreaterThanOrEqual(3.9);
            expect(nums[i]).toBeLessThanOrEqual(56.1);
            expect(nums[i + 1]).toBeGreaterThanOrEqual(3.9);
            expect(nums[i + 1]).toBeLessThanOrEqual(36.1);
        }
    });

    it('returns nothing to draw for a single point', () => {
        expect(routePath([[55, 25]], 60, 40)).toBe('');
    });

    it('bounds a route by its extremes', () => {
        expect(boundsOf([[1, 2], [3, -1], [0, 5]])).toEqual([[0, -1], [3, 5]]);
    });
});

describe('the replay camera', () => {
    it('moves along the route and looks down it', () => {
        const coords = line(1000);
        const cum = cumulative(coords);
        const half = replayFrame(coords, cum, 0.5);
        expect(half.distanceM).toBeCloseTo(cum[cum.length - 1] / 2, 3);
        expect(half.heading).toBeCloseTo(90, 0); // due east
        expect(replayFrame(coords, cum, 2).distanceM).toBeCloseTo(cum[cum.length - 1], 0);
    });
});

describe('a smooth replay', () => {
    it('glides between fixes instead of snapping to them', () => {
        const coords = line(100, 50); // fixes at 0, 50, 100 m
        const cum = cumulative(coords);
        const mid = pointAt(coords, cum, 25);
        expect(mid[0]).toBeGreaterThan(coords[0][0]);
        expect(mid[0]).toBeLessThan(coords[1][0]);
        expect(mid[0]).toBeCloseTo((coords[0][0] + coords[1][0]) / 2, 6);
    });

    it('turns the short way round north, and never faster than allowed', () => {
        expect(turnToward(350, 10, 45)).toBeCloseTo(10);
        expect(turnToward(10, 350, 45)).toBeCloseTo(350);
        expect(turnToward(0, 170, 30)).toBeCloseTo(30);
        expect(turnToward(0, 190, 30)).toBeCloseTo(330);
        expect(turnToward(90, 91, 30)).toBeCloseTo(91);
    });

    it('takes longer for a longer route, within bounds', () => {
        expect(replayDurationMs(0)).toBe(REPLAY_MIN_MS);
        expect(replayDurationMs(5000)).toBe(21_000);
        expect(replayDurationMs(25000)).toBe(REPLAY_MAX_MS); // the 80-minute ride
        expect(replayDurationMs(200_000)).toBe(REPLAY_MAX_MS);
    });
});

describe('the climb', () => {
    it('profiles the fixture hill with its real 60 m, and says nothing without altitude', () => {
        const profile = elevationSeries(hill.track, 'hiking')!;
        const alts = profile.map((p) => p.alt);
        expect(Math.max(...alts) - Math.min(...alts)).toBeGreaterThan(50);
        expect(Math.max(...alts) - Math.min(...alts)).toBeLessThan(70);
        const noAlt = { ...hill.track, alt: hill.track.alt.map(() => null) };
        expect(elevationSeries(noAlt, 'hiking')).toBeNull();
    });

    it('colours a stored track the same way the live screen did', () => {
        const trail = trailFromTrack(loop.track, 'jogging', EMBER_DARK);
        expect(trail.gradient).not.toBeNull();
        expect(trail.tail).toBeNull(); // no comet on a finished run
    });
});
