/**
 * The cycle import's promises, each of which is a privacy claim:
 *
 *   - nothing about periods is read unless the person switched the import on, on this device;
 *   - a refused permission leaves it off;
 *   - every batch carries the window it re-read, which is how deletions reach the server;
 *   - the first sync reaches back two years, later ones six months;
 *   - switching it off forgets the backfill, so switching it on again re-reads the history.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot import
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockReadCycle = jest.fn(async (_from?: Date) => [{ day: '2026-09-12', flow: 'heavy', externalId: 'f1' }]);
const mockRequestCyclePermissions = jest.fn(async () => true);
const mockHasCyclePermission = jest.fn(async () => true);

jest.mock('../index', () => ({ platformFor: () => 'health_connect' }));
jest.mock('../healthConnect', () => ({
    readCycle: (from: Date) => mockReadCycle(from),
    requestCyclePermissions: () => mockRequestCyclePermissions(),
    hasCyclePermission: () => mockHasCyclePermission(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    readCycleForSync, enableCycleImport, disableCycleImport, isCycleImportOn, importSourceLabel,
} from '../cycleImport';

const daysBack = (window: { from: string; to: string }) =>
    Math.round((Date.parse(window.to) - Date.parse(window.from)) / 86_400_000);

beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

it('reads nothing until switched on', async () => {
    expect(await readCycleForSync()).toEqual({});
    expect(mockReadCycle).not.toHaveBeenCalled();
    expect(mockHasCyclePermission).not.toHaveBeenCalled();
});

it('stays off when the store refuses', async () => {
    mockRequestCyclePermissions.mockResolvedValueOnce(false);
    expect(await enableCycleImport()).toBe(false);
    expect(await isCycleImportOn()).toBe(false);
});

it('sends the window with the rows — two years first, six months after', async () => {
    expect(await enableCycleImport()).toBe(true);
    const first = await readCycleForSync();
    expect(first.cycle).toHaveLength(1);
    expect(daysBack(first.cycleWindow!)).toBeGreaterThanOrEqual(729);

    const second = await readCycleForSync();
    expect(daysBack(second.cycleWindow!)).toBeLessThanOrEqual(181);
});

it('reads nothing once the permission is withdrawn in the store', async () => {
    await enableCycleImport();
    mockHasCyclePermission.mockResolvedValueOnce(false);
    expect(await readCycleForSync()).toEqual({});
});

it('switching off forgets the backfill', async () => {
    await enableCycleImport();
    await readCycleForSync();
    await disableCycleImport();
    await enableCycleImport();
    const again = await readCycleForSync();
    expect(daysBack(again.cycleWindow!)).toBeGreaterThanOrEqual(729);
});

it('names the store in words', () => {
    expect(importSourceLabel()).toBe('Health Connect');
});
