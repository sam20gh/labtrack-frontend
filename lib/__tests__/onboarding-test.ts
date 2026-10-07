/**
 * The two decisions the client makes about the journey: where a sign-in lands, and how a
 * step is opened so it can find its way back. Everything else is the server's.
 */
jest.mock('../auth', () => ({ getAccessToken: jest.fn(async () => null) }));
jest.mock('../api', () => ({ api: { get: jest.fn() }, apiFetch: jest.fn() }));

import { api } from '../api';
import { learnedLine, openStep, landAfterSignIn } from '../onboarding';

const journeyGet = api.get as jest.Mock;

const router = () => ({ push: jest.fn(), replace: jest.fn() }) as any;

describe('landAfterSignIn', () => {
    afterEach(() => journeyGet.mockReset());

    it('sends somebody the server says is new to the welcome hub', async () => {
        journeyGet.mockResolvedValueOnce({ showWelcome: true });
        const r = router();
        await landAfterSignIn(r);
        expect(r.replace).toHaveBeenCalledWith('/welcome');
    });

    it('sends everybody else home', async () => {
        journeyGet.mockResolvedValueOnce({ showWelcome: false });
        const r = router();
        await landAfterSignIn(r);
        expect(r.replace).toHaveBeenCalledWith('/(tabs)');
    });

    it('fails open to home: a journey that cannot load never stands between somebody and their account', async () => {
        journeyGet.mockRejectedValueOnce(new Error('offline'));
        const r = router();
        await landAfterSignIn(r);
        expect(r.replace).toHaveBeenCalledWith('/(tabs)');
    });
});

describe('openStep', () => {
    it('appends returnTo with the right separator, encoded', () => {
        const r = router();
        openStep(r, '/health-assessment?mode=essentials', '/welcome');
        expect(r.push).toHaveBeenCalledWith('/health-assessment?mode=essentials&returnTo=%2Fwelcome');
        openStep(r, '/packages', '/welcome');
        expect(r.push).toHaveBeenLastCalledWith('/packages?returnTo=%2Fwelcome');
        openStep(r, '/bracelet');
        expect(r.push).toHaveBeenLastCalledWith('/bracelet');
    });
});

describe('learnedLine', () => {
    it('names what has been learned and leaves out the zeroes', () => {
        expect(learnedLine({ nights: 6, activities: 1, results: 0, days: 0 })).toBe('6 nights of sleep · 1 activity');
        expect(learnedLine({ nights: 0, activities: 0, results: 0, days: 0 })).toBeNull();
    });
});
