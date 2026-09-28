/**
 * R4: zones, the Android step fill, and the bracelet link's lifecycle. The link test is the
 * one guarding the bracelet itself: a stream left running drains it in a day and blocks
 * every later sync, so it must let go the moment the run ends.
 */
/* eslint-disable import/first -- jest.mock must precede the imports it replaces */
jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    AppState: { addEventListener: jest.fn() },
}));
jest.mock('../../activity', () => ({
    listSessions: jest.fn(),
    enrichLiveSession: jest.fn(async () => ({ filled: ['steps', 'cadence'] })),
}));
jest.mock('../../health/healthConnect', () => ({ stepsBetween: jest.fn() }));

// A controllable recorder for the link test.
jest.mock('../recorder', () => {
    let listener: (() => void) | null = null;
    const state: any = { phase: 'idle', clientId: null, heartLink: 'none' };
    return {
        __state: state,
        __emit: () => listener?.(),
        subscribe: (fn: () => void) => { listener = fn; return () => { listener = null; }; },
        getState: () => state,
        setHeartLink: jest.fn((l: string) => { state.heartLink = l; }),
        recordHeart: jest.fn(),
        recordBraceletSteps: jest.fn(),
    };
});
jest.mock('@/lib/health/jstyle/live', () => {
    let live = false;
    let handlers: any = null;
    return {
        isLive: () => live,
        start: jest.fn(async (h: any) => { live = true; handlers = h; }),
        stop: jest.fn(async () => { live = false; }),
        __handlers: () => handlers,
    };
});
jest.mock('@/lib/health/jstyle/store', () => ({
    getPaired: jest.fn(async () => ({ id: 'band', variant: 'v8', label: 'Predyqt 2' })),
}));
jest.mock('@/modules/jstyle-ble', () => ({ isAvailable: () => true, supports: () => true }));

import { timeInZones, zoneFor } from '../zones';
import { fillLiveSteps } from '../enrich';
import { attachRunHeart } from '../heart';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('zones', () => {
    it('bands by share of the estimated maximum', () => {
        expect(zoneFor(80, 180)).toBe(0);
        expect(zoneFor(95, 180)).toBe(1);
        expect(zoneFor(130, 180)).toBe(3);
        expect(zoneFor(170, 180)).toBe(5);
    });

    it('has no zone without an estimate — never a guessed age', () => {
        expect(zoneFor(150, null)).toBeNull();
        expect(timeInZones({ t: [0, 1000], lat: [0, 0], lng: [0, 0], hr: [150, 150] }, null)).toBeNull();
    });

    it('counts time between fixes, caps gaps, and leaves pauses out', () => {
        const t = [0, 5000, 10000, 70000, 75000, 80000];
        const hr = [130, 130, 130, 130, 160, 160];
        const zones = timeInZones({ t, lat: t.map(() => 0), lng: t.map(() => 0), hr, pauses: [[76000, 90000]] }, 180)!;
        // 5 + 5 s in zone 3, the 60 s gap capped at 10, 5 s averaging 145 (zone 4), the paused step left out.
        expect(zones[3]).toBe(20);
        expect(zones[4]).toBe(5);
        expect(zones.reduce((a, b) => a + b, 0)).toBe(25);
    });
});

describe('Android steps from Health Connect', () => {
    const activity = jest.requireMock('../../activity');
    const hc = jest.requireMock('../../health/healthConnect');

    it('fills a live run that has no cadence, once, and leaves everything else alone', async () => {
        activity.listSessions.mockResolvedValue({
            sessions: [
                { _id: 'live-1', source: 'live', startedAt: 'a', endedAt: 'b' },
                { _id: 'live-2', source: 'live', startedAt: 'a', endedAt: 'b', cadence: 160 },
                { _id: 'watch', source: 'health_connect', startedAt: 'a', endedAt: 'b' },
            ],
        });
        hc.stepsBetween.mockResolvedValue(4100);
        expect(await fillLiveSteps()).toBe(1);
        expect(activity.enrichLiveSession).toHaveBeenCalledWith('live-1', { steps: 4100 });

        await fillLiveSteps();
        expect(hc.stepsBetween).toHaveBeenCalledTimes(1); // asked once per app run
    });
});

describe('the bracelet link', () => {
    const rec = jest.requireMock('../recorder');
    const live = jest.requireMock('@/lib/health/jstyle/live');

    it('connects when a run starts, feeds readings in, and lets go when it ends', async () => {
        attachRunHeart();
        rec.__state.phase = 'recording';
        rec.__state.clientId = 'run-1';
        rec.__emit();
        await flush();
        expect(live.start).toHaveBeenCalledTimes(1);

        live.__handlers().onReading({ heartRate: 151, steps: 5000, at: 1 });
        live.__handlers().onReading({ heartRate: 153, steps: 5040, at: 2 });
        expect(rec.recordHeart).toHaveBeenLastCalledWith(153, 2);
        expect(rec.recordBraceletSteps).toHaveBeenLastCalledWith(expect.any(Number), 40, 2);

        rec.__emit(); // a second notify during the same run does not reconnect
        await flush();
        expect(live.start).toHaveBeenCalledTimes(1);

        rec.__state.phase = 'finished';
        rec.__emit();
        await flush();
        expect(live.stop).toHaveBeenCalled();
        expect(rec.setHeartLink).toHaveBeenLastCalledWith('none');
    });
});
