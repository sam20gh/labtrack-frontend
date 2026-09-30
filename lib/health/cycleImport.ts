/**
 * Importing periods from Apple Health or Health Connect — opt-in, per device.
 *
 * Three decisions:
 *
 * 1. **Its own switch and its own permission prompt.** Connecting a health store for workouts
 *    does not read anybody's periods. The import is switched on from cycle settings (or the
 *    last step of setup), which is where the prompt appears, asking for the cycle types and
 *    nothing else.
 * 2. **Device-local, not on the account.** The permission belongs to this phone's store. A
 *    second phone signed into the same account has not been granted anything, and a flag on
 *    the server would have it try — and read nothing — without the person ever being asked.
 * 3. **A window, re-read whole, every sync.** Period data is a few hundred rows a year, so the
 *    last `WINDOW_DAYS` are read in full and sent with the window's bounds, and the server
 *    replaces this store's days inside it. A cursor would carry additions and silently miss the
 *    period somebody deleted in the Health app. The first sync reaches back `FIRST_WINDOW_DAYS`
 *    so the history the store already holds arrives at once.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { platformFor } from './index';
import type { CycleRow, NightTemperatureRow } from './types';

const FLAG_KEY = 'cycle.healthImport';
const BACKFILLED_KEY = 'cycle.healthImportBackfilled';
const WINDOW_DAYS = 180;
const FIRST_WINDOW_DAYS = 730;

interface PlatformCycle {
    hasCyclePermission(): Promise<boolean>;
    requestCyclePermissions(): Promise<boolean>;
    readCycle(from: Date): Promise<CycleRow[]>;
    readNightTemperature?(from: Date): Promise<NightTemperatureRow[]>;
}

/** Lazily, and per platform, for the reason `READERS` in `index.ts` gives. */
const platformModule = (): PlatformCycle | null => {
    try {
        const platform = platformFor();
        if (platform === 'apple_health') return require('./healthkit') as PlatformCycle;
        if (platform === 'health_connect') return require('./healthConnect') as PlatformCycle;
    } catch { /* a build without the module */ }
    return null;
};

/** "Apple Health" / "Health Connect", or null on a device with neither. */
export const importSourceLabel = (): string | null => {
    const platform = platformFor();
    return platform === 'apple_health' ? 'Apple Health' : platform === 'health_connect' ? 'Health Connect' : null;
};

/** The `source` the server files these days under. */
export const importSource = (): 'apple_health' | 'health_connect' | null => {
    const platform = platformFor();
    return platform === 'apple_health' || platform === 'health_connect' ? platform : null;
};

export const isCycleImportOn = async (): Promise<boolean> => {
    try { return (await AsyncStorage.getItem(FLAG_KEY)) === '1'; } catch { return false; }
};

/**
 * Ask for the cycle permissions and, if given, switch the import on. Resolves with whether it
 * is now on. On Android a refusal cannot be re-prompted, which the settings screen says.
 */
export const enableCycleImport = async (): Promise<boolean> => {
    const mod = platformModule();
    if (!mod) return false;
    const granted = await mod.requestCyclePermissions().catch(() => false);
    if (!granted) return false;
    try { await AsyncStorage.setItem(FLAG_KEY, '1'); } catch { /* the next toggle asks again */ }
    return true;
};

/** Stop reading. What was imported stays until the person removes it (`removeImportedDays`). */
export const disableCycleImport = async (): Promise<void> => {
    try { await AsyncStorage.multiRemove([FLAG_KEY, BACKFILLED_KEY]); } catch { /* nothing to undo */ }
};

const localDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/**
 * What a phone-store batch carries for the cycle tracker, or nothing when the import is off
 * or the permission was withdrawn in the store's own settings. Never throws: a sync must not
 * fail because the period read did.
 */
export const readCycleForSync = async (): Promise<{
    cycle?: CycleRow[]; cycleWindow?: { from: string; to: string }; nightTemperature?: NightTemperatureRow[];
}> => {
    try {
        if (!(await isCycleImportOn())) return {};
        const mod = platformModule();
        if (!mod || !(await mod.hasCyclePermission())) return {};

        const first = (await AsyncStorage.getItem(BACKFILLED_KEY)) !== '1';
        const now = new Date();
        const from = new Date(now.getTime() - (first ? FIRST_WINDOW_DAYS : WINDOW_DAYS) * 86_400_000);
        from.setHours(0, 0, 0, 0);

        const [cycle, nightTemperature] = await Promise.all([
            mod.readCycle(from),
            mod.readNightTemperature ? mod.readNightTemperature(new Date(now.getTime() - 60 * 86_400_000)) : Promise.resolve([]),
        ]);
        if (first) await AsyncStorage.setItem(BACKFILLED_KEY, '1').catch(() => {});

        return { cycle, cycleWindow: { from: localDay(from), to: localDay(now) }, nightTemperature };
    } catch {
        return {};
    }
};
