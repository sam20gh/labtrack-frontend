/**
 * Syncing the bracelet while Predyqt is closed.
 *
 * Foreground sync (`autoSync.ts`) covers every time the app is opened. This covers the night:
 * a night's sleep reached the server only once somebody opened the app in the morning, and the
 * home screen showed yesterday until then. Here a system background task — WorkManager on
 * Android, `BGTaskScheduler` on iOS, through `expo-background-task` — wakes the app about once
 * an hour and runs the same bracelet sync, with no screen.
 *
 * Five things to know:
 *
 * 1. **The task is defined at module scope, and this module is imported at the top of
 *    `app/_layout.tsx`.** A woken app evaluates the bundle without mounting anything, and a
 *    task defined inside a component or an effect does not exist when the wake arrives. The
 *    same rule `lib/run/recorder.ts` follows.
 * 2. **Bracelet only.** Reading Health Connect while the app is closed needs Android 14's
 *    `READ_HEALTH_DATA_IN_BACKGROUND`, a separate grant with its own prompt; until that is
 *    asked for, a background read would only throw. HealthKit is unreadable on a locked phone.
 * 3. **Every hour, not every fifteen minutes.** Each run is a Bluetooth connection, and 96 a day
 *    is real battery for a sleep record that is just as complete hourly. The interval is a
 *    minimum: the system decides, and iOS often waits for overnight charging.
 * 4. **Nothing runs while the app is open**, because `autoSync.ts` already has it, and nothing
 *    runs for a signed-out phone or with no bracelet paired.
 * 5. **Every run is recorded on the pairing** (`lastBackgroundSync`) and shown on the bracelet
 *    screen. A background job nobody can see working is indistinguishable from one that never
 *    runs, and Xiaomi, Huawei and Samsung all kill them by default.
 *
 * Adding `expo-background-task` moved the fingerprint: it needed a build.
 */
import { AppState } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { isSignedIn } from '@/lib/auth';
import { hydrateHealthSources } from './index';
import { runSync } from './sync';

export const BRACELET_SYNC_TASK = 'predyqt-bracelet-sync';
export const BACKGROUND_INTERVAL_MINUTES = 60;

const store = () => require('./jstyle/store') as typeof import('./jstyle/store');

TaskManager.defineTask(BRACELET_SYNC_TASK, async () => {
    const at = new Date().toISOString();
    try {
        if (AppState.currentState === 'active') return BackgroundTask.BackgroundTaskResult.Success;
        await hydrateHealthSources();
        if (!store().getPairedSync() || !(await isSignedIn())) return BackgroundTask.BackgroundTaskResult.Success;

        const result = await runSync(true, { only: ['jstyle_bracelet'] });
        await store().updatePaired({
            lastBackgroundSync: { at, ran: result.ran, days: result.daysUpdated.length, reason: result.reason ?? null },
        });
        console.log(`🌙 Background bracelet sync: ${result.ran ? `${result.daysUpdated.length} day(s)` : `skipped — ${result.reason ?? 'nothing ran'}`}`);
        return result.ran ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await store().updatePaired({ lastBackgroundSync: { at, ran: false, days: 0, reason } }).catch(() => undefined);
        console.warn(`🌙 Background bracelet sync failed — ${reason}`);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

/**
 * Register the task when there is something for it to do, and unregister it when there is not.
 *
 * Called at launch, after pairing, after forgetting a bracelet and after signing out. Safe to
 * call repeatedly. Never throws: a phone that cannot run background tasks still syncs on open.
 */
export const ensureBackgroundSync = async (): Promise<void> => {
    try {
        await hydrateHealthSources();
        const wanted = !!store().getPairedSync() && (await isSignedIn());
        const registered = await TaskManager.isTaskRegisteredAsync(BRACELET_SYNC_TASK);

        if (wanted && !registered) {
            if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
            await BackgroundTask.registerTaskAsync(BRACELET_SYNC_TASK, { minimumInterval: BACKGROUND_INTERVAL_MINUTES });
            console.log(`🌙 Background bracelet sync registered, every ~${BACKGROUND_INTERVAL_MINUTES} min`);
        } else if (!wanted && registered) {
            await BackgroundTask.unregisterTaskAsync(BRACELET_SYNC_TASK);
            console.log('🌙 Background bracelet sync unregistered');
        }
    } catch (err) {
        console.warn(`🌙 Could not set up background sync — ${err instanceof Error ? err.message : String(err)}`);
    }
};

/** Whether this phone lets background tasks run at all. iOS can switch it off per app. */
export const backgroundSyncAvailable = async (): Promise<boolean> => {
    try {
        return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
    } catch {
        return false;
    }
};
