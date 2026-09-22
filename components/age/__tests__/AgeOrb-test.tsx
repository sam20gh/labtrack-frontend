/**
 * The age dial's geometry, and the label it sits under.
 *
 * Both failures this guards against are silent and look deliberate.
 *
 * The arc is drawn with a mirrored SVG transform and an animated dash offset. Getting either
 * backwards produces a confident, well-drawn arc pointing the **wrong way** — telling somebody
 * their body is four years older when it is four years younger — and nothing errors, nothing
 * logs, and the screen looks finished.
 *
 * The label failed the other way in the first build: it said "0.5 year younger" over an orb
 * tinted for `on_track`, because the wording used a threshold of its own and the colour used
 * the server's bands. The words and the colour were reading different rules on the one line
 * of the card people actually look at.
 */
/**
 * `lib/age.ts` imports AsyncStorage for the first-run gate, and this project has no Jest
 * setup file to mock it globally.
 *
 * **It must not grow one.** A `setupFiles` entry lives in `package.json`'s `jest` block, and
 * `app.json` sets `runtimeVersion.policy` to `fingerprint` — which hashes `package.json`
 * whole. Editing it invalidates over-the-air updates for every build already in somebody's
 * hands, silently, with no error at the publish or on the device. That is the fourth trap in
 * `CLAUDE.md`, verified on 2026-09-04 when a one-line `types:check` script hid two shipped
 * features from the test device. A local mock costs one line and moves nothing.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

/**
 * And `lib/api` pulls `lib/auth`, which builds a Supabase client that wants a WebSocket.
 * Stubbing the token getter breaks that chain — the pattern `lib/__tests__/appState-test.ts`
 * already uses, for the same reason: the helpers under test here are pure, and nothing about
 * them needs a network stack to exist.
 */
jest.mock('@/lib/auth', () => ({ getAccessToken: jest.fn(async () => null) }));

import { arcReach, arcEndDegrees } from '../AgeOrb';
import { deltaLabel, tintForBand, BAND_TINT } from '@/lib/age';

describe('which way the arc sweeps', () => {
    it('sweeps left for somebody younger than their age', () => {
        // Negative is anticlockwise. If this ever comes back positive, the mirror transform
        // in AgeOrb has been dropped and every younger person is shown as older.
        expect(arcReach(38, 45)).toBeLessThan(0);
        expect(arcEndDegrees(arcReach(38, 45))).toBeCloseTo(-94.5, 1);
    });

    it('sweeps right for somebody older', () => {
        expect(arcReach(52, 45)).toBeGreaterThan(0);
        expect(arcEndDegrees(arcReach(52, 45))).toBeCloseTo(94.5, 1);
    });

    it('draws nothing at all when the two ages match', () => {
        expect(arcReach(45, 45)).toBe(0);
        expect(arcEndDegrees(0)).toBe(0);
    });

    it('is symmetric, so the same gap either way is the same length of arc', () => {
        expect(Math.abs(arcReach(40, 45))).toBeCloseTo(Math.abs(arcReach(50, 45)), 6);
    });
});

describe('the ends of the scale', () => {
    it('fills the sweep at ten years and goes no further', () => {
        expect(arcReach(55, 45)).toBe(1);
        expect(arcReach(85, 45)).toBe(1);
        expect(arcReach(35, 45)).toBe(-1);
        expect(arcReach(5, 45)).toBe(-1);
    });

    it('never laps, because a second turn reads as a smaller number than a first', () => {
        for (const v of [80, 120, -40, 0]) {
            expect(Math.abs(arcReach(v, 45))).toBeLessThanOrEqual(1);
        }
    });

    it('lands the half-scale gap exactly halfway round the sweep', () => {
        expect(arcEndDegrees(arcReach(50, 45))).toBeCloseTo(67.5, 4);
    });
});

describe('the dial with nothing to show', () => {
    it('reaches nowhere without a value', () => {
        // The orb draws no arc and no numeral in this state. Not a needle parked at the tick:
        // "we worked out your age" and "we cannot yet" have to survive being glanced at.
        expect(arcReach(null, 45)).toBe(0);
        expect(arcReach(undefined, 45)).toBe(0);
    });

    it('reaches nowhere without a chronological age to measure from', () => {
        // The tick at twelve o'clock *is* the person's calendar age. With no tick there is
        // nothing for the arc to be far from, so it must not draw a length anyway.
        expect(arcReach(41, null)).toBe(0);
        expect(arcReach(41, undefined)).toBe(0);
        expect(arcReach(41, NaN)).toBe(0);
    });
});

describe('the words never disagree with the colour', () => {
    it('says "about your age" for everything the server calls on track', () => {
        // The exact failure in the first build: −0.5 bands as `on_track` and tints grey, and
        // the label said "0.5 year younger" on top of it.
        for (const delta of [-1.9, -0.5, 0, 0.5, 1.9]) {
            expect(deltaLabel(delta, 'on_track')).toBe('About your age');
        }
    });

    it('names the gap once the band does', () => {
        expect(deltaLabel(-4.1, 'younger')).toBe('4.1 years younger');
        expect(deltaLabel(6.2, 'older')).toBe('6.2 years older');
        expect(deltaLabel(-1.0, 'younger')).toBe('1.0 year younger');
    });

    it('falls back to the band boundary rather than a threshold of its own', () => {
        // A historic row with no band, or a half rendered alone. Two years is where the
        // server's own ladder puts the edge; anything else here would drift from it.
        expect(deltaLabel(-1.5)).toBe('About your age');
        expect(deltaLabel(-4.1)).toBe('4.1 years younger');
    });

    it('says nothing at all when there is no gap to describe', () => {
        expect(deltaLabel(null)).toBe('');
        expect(deltaLabel(undefined)).toBe('');
        expect(deltaLabel(NaN)).toBe('');
    });
});

describe('the palette this feature refuses', () => {
    it('never tints a gap with the colour reserved for a clinical result', () => {
        // `Palette.danger` is a verdict on a *result* — a potassium that needs attention now.
        // Putting the same red on "your bloods suggest you are four years older" teaches
        // people the colour means nothing, which is the argument `Palette.alert` already
        // makes for error states and `meterWeak` for password strength.
        const danger = '#DC2626';
        for (const tint of Object.values(BAND_TINT)) {
            expect(tint.toUpperCase()).not.toBe(danger);
        }
        expect(tintForBand(null)).toBe(BAND_TINT.on_track);
    });

    it('draws being exactly your own age in a muted tone, not a positive one', () => {
        // Colouring it green would make the absence of a finding look like an achievement.
        expect(BAND_TINT.on_track).toBe('#6B7280');
    });
});
