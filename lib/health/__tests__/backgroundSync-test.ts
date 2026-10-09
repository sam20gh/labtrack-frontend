/**
 * The bracelet's background sync — `lib/health/backgroundSync.ts`.
 *
 * What has to hold:
 *   - The task is defined when the module loads, not later: a woken app evaluates the bundle
 *     and mounts nothing.
 *   - It does nothing with the app open, signed out, or with no bracelet paired.
 *   - It syncs the bracelet and nothing else, and records every run where the screen shows it.
 *   - It is registered only when there is something to do, and only where the system allows it.
 */
// `var`, not `const`: and no initializer: the module under test defines its task at import, which runs before this line would.
// eslint-disable-next-line no-var
var mockTasks: Record<string, () => Promise<number>>;
let mockRegistered = false;
let mockStatus = 2;
jest.mock('expo-task-manager', () => ({
    defineTask: (name: string, fn: () => Promise<number>) => { mockTasks = mockTasks ?? {}; mockTasks[name] = fn; },
    isTaskRegisteredAsync: jest.fn(async () => mockRegistered),
}));
jest.mock('expo-background-task', () => ({
    BackgroundTaskResult: { Success: 1, Failed: 2 },
    BackgroundTaskStatus: { Restricted: 1, Available: 2 },
    getStatusAsync: jest.fn(async () => mockStatus),
    registerTaskAsync: jest.fn(async () => { mockRegistered = true; }),
    unregisterTaskAsync: jest.fn(async () => { mockRegistered = false; }),
}));

let mockAppState = 'background';
jest.mock('react-native', () => ({ AppState: { get currentState() { return mockAppState; } } }));

let mockSignedIn = true;
jest.mock('@/lib/auth', () => ({ isSignedIn: async () => mockSignedIn }));
jest.mock('../index', () => ({ hydrateHealthSources: async () => undefined }));

const mockRunSync = jest.fn();
jest.mock('../sync', () => ({ runSync: (...args: unknown[]) => mockRunSync(...args) }));

let mockPaired: Record<string, unknown> | null = { id: 'band-1' };
jest.mock('../jstyle/store', () => ({
    getPairedSync: () => mockPaired,
    updatePaired: jest.fn(async (patch: Record<string, unknown>) => { mockPaired = { ...mockPaired, ...patch }; }),
}));

import * as BackgroundTask from 'expo-background-task';
import { BRACELET_SYNC_TASK, BACKGROUND_INTERVAL_MINUTES, ensureBackgroundSync } from '../backgroundSync';

const runTask = () => mockTasks[BRACELET_SYNC_TASK]();

beforeEach(() => {
    jest.clearAllMocks();
    mockAppState = 'background';
    mockSignedIn = true;
    mockPaired = { id: 'band-1' };
    mockRegistered = false;
    mockStatus = 2;
    mockRunSync.mockResolvedValue({ ran: true, daysUpdated: ['2026-10-08'] });
});

describe('the task', () => {
    it('is defined as soon as the module loads', () => {
        expect(typeof mockTasks[BRACELET_SYNC_TASK]).toBe('function');
    });

    it('syncs the bracelet only, and records the run', async () => {
        expect(await runTask()).toBe(1);
        expect(mockRunSync).toHaveBeenCalledWith(true, { only: ['jstyle_bracelet'] });
        expect(mockPaired?.lastBackgroundSync).toMatchObject({ ran: true, days: 1, reason: null });
    });

    it('does nothing while the app is open, signed out, or unpaired', async () => {
        mockAppState = 'active';
        await runTask();
        mockAppState = 'background';
        mockSignedIn = false;
        await runTask();
        mockSignedIn = true;
        mockPaired = null;
        await runTask();
        expect(mockRunSync).not.toHaveBeenCalled();
    });

    it('records a failure with its reason', async () => {
        mockRunSync.mockRejectedValue(new Error('Bluetooth is off. Turn it on to find your bracelet.'));
        expect(await runTask()).toBe(2);
        expect(mockPaired?.lastBackgroundSync).toMatchObject({ ran: false, reason: expect.stringMatching(/Bluetooth is off/) });
    });
});

describe('registration', () => {
    it('registers hourly when signed in with a bracelet', async () => {
        await ensureBackgroundSync();
        expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(BRACELET_SYNC_TASK, { minimumInterval: BACKGROUND_INTERVAL_MINUTES });
        expect(BACKGROUND_INTERVAL_MINUTES).toBeGreaterThanOrEqual(15);
    });

    it('does not register where the system forbids it', async () => {
        mockStatus = 1;
        await ensureBackgroundSync();
        expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it('unregisters once there is nothing to do', async () => {
        mockRegistered = true;
        mockPaired = null;
        await ensureBackgroundSync();
        expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(BRACELET_SYNC_TASK);
    });

    it('does nothing when it is already right', async () => {
        mockRegistered = true;
        await ensureBackgroundSync();
        expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
        expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    });
});
