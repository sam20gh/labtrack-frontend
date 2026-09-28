/**
 * The pocket lock's release rule. A real ride found the first version trapping its rider: a
 * slide to two-thirds sprang back, because it needed 85% of the travel.
 */
/* eslint-disable import/first -- jest.mock must precede the imports it replaces */
jest.mock('expo-haptics', () => ({}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { shouldUnlock } from '../SlideToUnlock';

describe('unlocking', () => {
    const end = 270; // a 338-pt track minus the thumb and padding

    it('unlocks at two-thirds, the slide that used to spring back', () => {
        expect(shouldUnlock(end * (2 / 3), 0, end)).toBe(true);
    });

    it('unlocks from halfway, or from a flick past a quarter', () => {
        expect(shouldUnlock(end * 0.5, 0, end)).toBe(true);
        expect(shouldUnlock(end * 0.3, 0.9, end)).toBe(true);
    });

    it('does not unlock from a short, slow brush — which is what a pocket does', () => {
        expect(shouldUnlock(end * 0.3, 0.1, end)).toBe(false);
        expect(shouldUnlock(end * 0.1, 2, end)).toBe(false);
    });

    it('does nothing before the track has been measured', () => {
        expect(shouldUnlock(100, 1, 0)).toBe(false);
    });
});
