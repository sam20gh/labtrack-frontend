/**
 * The line after a bracelet sync — `describeSync` in `reader.ts`.
 *
 * "Synced — nothing new to bring over" used to be the answer to three different outcomes,
 * and on 2026-10-07 it hid a whole day of iPhone syncs that read data and mapped none of
 * it. What has to hold:
 *
 *   - Days the server updated always win.
 *   - Unreadable data is named, and "still on the bracelet" is said only when nothing was
 *     posted — the only case in which nothing can have been deleted.
 *   - A bracelet that answered nothing at all is not reported as having nothing new.
 */
jest.mock('@/modules/jstyle-ble', () => ({
    capabilities: () => ({ commands: [] }),
    isAvailable: () => true,
    supports: () => false,
}));
jest.mock('../transport', () => ({}));
jest.mock('../session', () => ({}));
jest.mock('../live', () => ({ isLive: () => false }));
jest.mock('../clock', () => ({}));
jest.mock('../store', () => ({}));

import { describeSync, type ReadReport } from '../reader';

const report = (patch: Partial<ReadReport>): ReadReport =>
    ({ asked: 11, silent: 0, unreadable: 0, rows: 0, ...patch });

describe('describeSync', () => {
    it('reports days updated whatever else happened', () => {
        expect(describeSync(2, report({ unreadable: 3, rows: 9 }))).toBe('Synced — 2 days updated.');
        expect(describeSync(1, null)).toBe('Synced — 1 day updated.');
    });

    it('names unreadable data when nothing was posted', () => {
        expect(describeSync(0, report({ unreadable: 4 }))).toMatch(/can't read yet/);
    });

    it('does not claim unreadable data is still on the bracelet once rows were posted', () => {
        expect(describeSync(0, report({ unreadable: 4, rows: 2 }))).toBe(
            'Synced — the bracelet had nothing new since the last sync.',
        );
    });

    it('says the bracelet did not answer when every series was silent', () => {
        expect(describeSync(0, report({ silent: 11 }))).toMatch(/didn't send its history/);
    });

    it('says nothing new only when the bracelet answered', () => {
        expect(describeSync(0, report({ silent: 3 }))).toBe(
            'Synced — the bracelet had nothing new since the last sync.',
        );
        expect(describeSync(0, null)).toBe('Synced — the bracelet had nothing new since the last sync.');
    });
});
