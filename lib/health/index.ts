/**
 * The device health store, behind one interface.
 *
 * Two platforms, two completely different APIs, and **neither native module is installed
 * yet**. `react-native-health-connect` v4 wants `compileSdk 36` and Expo SDK 52 ships 35,
 * so adding it today breaks the Android build; the Expo upgrade is separate, prior work
 * (see `docs/ACTIVITY-TRACKER-PLAN.md` §5).
 *
 * So the readers live in a registry that is empty today (see `READERS` below). The
 * consequence is the point: every screen in this feature builds, runs and is usable now
 * against manually logged activities, `probe()` reports `available: false` with a reason a
 * person can read, and registering the two readers later lights sync up without a single
 * screen changing.
 *
 * A missing reader is not an error state. Someone on an Android 12 phone with no Health
 * Connect installed is a normal user, and the connect screen tells them what to do.
 */
import { Platform } from 'react-native';
import type {
    HealthCapability, HealthPlatform, SyncBatch, HealthReader,
} from './types';

export * from './types';

/**
 * The platform readers, registered rather than imported.
 *
 * **This map is empty on purpose, and it is the one thing to change when the native
 * modules land.** Metro resolves `require` statically, so a top-level import of a package
 * that is not installed fails the whole bundle — a try/catch around it does not help. A
 * registry keeps the resolution out of the module graph entirely.
 *
 * To turn sync on, once `@kingstinct/react-native-healthkit` and
 * `react-native-health-connect` are installed and the Expo SDK is on a version that can
 * compile them:
 *
 *   import { reader as healthKitReader } from './healthkit';
 *   import { reader as healthConnectReader } from './healthConnect';
 *
 *   const READERS = {
 *       apple_health: () => healthKitReader,
 *       health_connect: () => healthConnectReader,
 *   };
 *
 * Nothing else in the app changes. Every screen already handles `available: false`,
 * because until that day every device reports it.
 */
const READERS: Partial<Record<HealthPlatform, () => HealthReader>> = {};

const loadReader = (platform: HealthPlatform): HealthReader | null => {
    const factory = READERS[platform];
    if (!factory) return null;
    try {
        return factory();
    } catch {
        return null;
    }
};

/** Which store this device could use at all, before asking about permissions. */
export const platformFor = (): HealthPlatform | null => {
    if (Platform.OS === 'ios') return 'apple_health';
    if (Platform.OS === 'android') return 'health_connect';
    return null;
};

const LABELS: Record<HealthPlatform, string> = {
    apple_health: 'Apple Health',
    health_connect: 'Health Connect',
    aggregator: 'Connected service',
};

export const labelFor = (platform: HealthPlatform) => LABELS[platform];

/**
 * What this device can actually do right now.
 *
 * Every `reason` is written to be shown to a person, because it will be. A greyed control
 * with a reason beats one that looks live and fails on tap — the line the assistant's
 * microphone already takes.
 */
export const probe = async (): Promise<HealthCapability> => {
    const platform = platformFor();

    if (!platform) {
        return {
            platform: null,
            available: false,
            granted: false,
            reason: 'Health data sync is only available on iOS and Android.',
        };
    }

    const reader = loadReader(platform);
    if (!reader) {
        return {
            platform,
            available: false,
            granted: false,
            // Deliberately not "an error occurred". This is a build that predates the
            // native module, and saying so is more use than a shrug.
            reason: `${LABELS[platform]} sync isn't in this version of the app yet. You can still log activities by hand.`,
            needsAppUpdate: true,
        };
    }

    try {
        return await reader.probe();
    } catch (err: any) {
        return {
            platform,
            available: false,
            granted: false,
            reason: err?.message || `Could not reach ${LABELS[platform]}.`,
        };
    }
};

/**
 * Ask for read permission.
 *
 * Partial grants are normal and are not a failure: someone may allow steps and workouts and
 * refuse sleep. The result names what was granted so the screens can hide what they cannot
 * fill rather than drawing an empty chart.
 */
export const requestPermissions = async (): Promise<HealthCapability> => {
    const platform = platformFor();
    if (!platform) return probe();

    const reader = loadReader(platform);
    if (!reader) return probe();

    try {
        return await reader.requestPermissions();
    } catch (err: any) {
        return {
            platform,
            available: true,
            granted: false,
            reason: err?.message || 'Permission was not granted.',
        };
    }
};

/**
 * Read everything new since `cursor`.
 *
 * The cursor is opaque to us and to the server — a HealthKit anchor on iOS, a Health
 * Connect changes token on Android. It is round-tripped through the API so a reinstall
 * resumes where it left off instead of re-reading a year of samples.
 */
export const readSince = async (cursor: string | null): Promise<SyncBatch | null> => {
    const platform = platformFor();
    if (!platform) return null;

    const reader = loadReader(platform);
    if (!reader) return null;

    return reader.readSince(cursor);
};

/** True when this build could sync at all, regardless of permission. */
export const isSyncBuild = (): boolean => {
    const platform = platformFor();
    return Boolean(platform && loadReader(platform));
};
