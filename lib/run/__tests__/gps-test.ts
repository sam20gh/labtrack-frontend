/**
 * Location permission for a live session — `lib/run/gps.ts`.
 *
 * On 2026-10-09 two walks on Android recorded 0.00 km and the map never moved. An approximate
 * (coarse) grant passes as "granted", every fix arrives kilometres wide, and `trackMath`
 * drops each one. What has to hold: a coarse grant is never treated as ready to record.
 */
const mockState = {
    services: true,
    current: { granted: true, canAskAgain: true, android: { accuracy: 'fine' } } as Record<string, unknown>,
    asked: { granted: true, canAskAgain: true, android: { accuracy: 'fine' } } as Record<string, unknown>,
};
jest.mock('expo-location', () => ({
    hasServicesEnabledAsync: async () => mockState.services,
    getForegroundPermissionsAsync: async () => mockState.current,
    requestForegroundPermissionsAsync: jest.fn(async () => mockState.asked),
    Accuracy: {}, ActivityType: {},
}));
jest.mock('@/constants/theme', () => ({ Palette: { primary: '#853AAB' } }));

import * as Location from 'expo-location';
import { ensureLocationPermission } from '../gps';

const coarse = { granted: true, canAskAgain: true, android: { accuracy: 'coarse' } };

beforeEach(() => {
    jest.clearAllMocks();
    mockState.services = true;
    mockState.current = { granted: true, canAskAgain: true, android: { accuracy: 'fine' } };
    mockState.asked = { granted: true, canAskAgain: true, android: { accuracy: 'fine' } };
});

describe('ensureLocationPermission', () => {
    it('is ready with a precise grant, without asking', async () => {
        expect(await ensureLocationPermission()).toBe('granted');
        expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('asks to upgrade an approximate grant, and is ready once it is precise', async () => {
        mockState.current = coarse;
        expect(await ensureLocationPermission()).toBe('granted');
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('refuses to record on approximate location', async () => {
        mockState.current = coarse;
        mockState.asked = coarse;
        expect(await ensureLocationPermission()).toBe('approximate');
    });

    it('keeps the other states', async () => {
        mockState.services = false;
        expect(await ensureLocationPermission()).toBe('services_off');
        mockState.services = true;
        mockState.current = { granted: false, canAskAgain: false };
        expect(await ensureLocationPermission()).toBe('blocked');
        mockState.current = { granted: false, canAskAgain: true };
        mockState.asked = { granted: false, canAskAgain: true };
        expect(await ensureLocationPermission()).toBe('denied');
    });

    it('treats iOS (no android field) as precise', async () => {
        mockState.current = { granted: true, canAskAgain: true };
        expect(await ensureLocationPermission()).toBe('granted');
    });
});
