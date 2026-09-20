/**
 * The device health store, behind one interface.
 *
 * Two platforms, two completely different APIs, one shape for the rest of the app.
 * `@kingstinct/react-native-healthkit` on iOS, `react-native-health-connect` on Android,
 * both normalising into the vocabulary in `./types` before anything else sees them.
 *
 * A missing or unavailable reader is not an error state, and every caller has to treat it
 * as ordinary. Someone on an Android 12 phone with no Health Connect installed, someone who
 * declined the prompt, and someone on a build older than these modules are all normal users
 * — `probe()` returns `available: false` with a `reason` written to be shown to them, and
 * the screens offer manual logging instead of a control that fails on tap.
 */
import { Platform } from 'react-native';
import type {
    HealthCapability, HealthPlatform, SyncBatch, HealthReader,
} from './types';

export * from './types';

/**
 * The platform readers, loaded lazily and per-platform.
 *
 * `require` inside the factory rather than a top-level import, and that placement is
 * load-bearing: `@kingstinct/react-native-healthkit` is iOS-only and
 * `react-native-health-connect` is Android-only, so importing both at module scope would
 * pull an unusable native module into the other platform's bundle. The factory only runs
 * once `platformFor()` has already decided which one this device is.
 *
 * The try/catch is the second half of that. A build that predates one of the modules, or a
 * device where the native side failed to link, returns null and every screen falls through
 * to the `available: false` path it already handles — the same path every device was on
 * before these were installed.
 */
const READERS: Partial<Record<HealthPlatform, () => HealthReader>> = {
    apple_health: () => require('./healthkit').reader as HealthReader,
    health_connect: () => require('./healthConnect').reader as HealthReader,
    jstyle_bracelet: () => require('./jstyle/reader').reader as HealthReader,
};

const loadReader = (platform: HealthPlatform): HealthReader | null => {
    const factory = READERS[platform];
    if (!factory) return null;
    try {
        return factory();
    } catch {
        return null;
    }
};

/**
 * Which *phone* health store this device could use, before asking about permissions.
 *
 * Still one per OS, and still the right question for every screen that asks it — Apple
 * Health and Health Connect are mutually exclusive by construction. A bracelet is **not**
 * one of these and is deliberately absent from the answer: it is a second source that sits
 * alongside the phone's store rather than instead of it, and someone can perfectly well
 * have both. `sources()` is the question that includes it.
 */
export const platformFor = (): HealthPlatform | null => {
    if (Platform.OS === 'ios') return 'apple_health';
    if (Platform.OS === 'android') return 'health_connect';
    return null;
};

/**
 * Every source this device could read from, phone store and bracelet alike.
 *
 * The bracelet is listed only once one is paired. An unpaired bracelet is not a source
 * that is switched off, it is a source that does not exist — and listing it would put a
 * permanently empty row on every screen that enumerates sources, for every person who
 * does not own one.
 *
 * Order matters: the phone store comes first because it is the one most people have, and
 * these lists are rendered in the order they are returned.
 */
export const sources = (): HealthPlatform[] => {
    const list: HealthPlatform[] = [];
    const phone = platformFor();
    if (phone) list.push(phone);

    try {
        // Synchronous, and null until `hydrateHealthSources()` has run. A screen that
        // renders before then simply does not draw the bracelet row yet, which is the same
        // thing it does while any other source is still loading.
        if (require('./jstyle/store').getPairedSync()) list.push('jstyle_bracelet');
    } catch { /* a build without the module has no bracelet to list */ }

    return list;
};

/**
 * Warm the bracelet pairing so `sources()` can answer synchronously.
 *
 * Called from `app/_layout.tsx` beside `hydrateUnits()`, and for the same reason: the
 * answer is read from render paths, and an await there is a frame of the wrong UI.
 */
export const hydrateHealthSources = async (): Promise<void> => {
    try { await require('./jstyle/store').hydrate(); } catch { /* nothing paired, or no module */ }
};

const LABELS: Record<HealthPlatform, string> = {
    apple_health: 'Apple Health',
    health_connect: 'Health Connect',
    aggregator: 'Connected service',
    jstyle_bracelet: 'Health bracelet',
};

export const labelFor = (platform: HealthPlatform) => LABELS[platform];

/**
 * What this device can actually do right now.
 *
 * Every `reason` is written to be shown to a person, because it will be. A greyed control
 * with a reason beats one that looks live and fails on tap — the line the assistant's
 * microphone already takes.
 */
export const probe = async (platform: HealthPlatform | null = platformFor()): Promise<HealthCapability> => {
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
export const requestPermissions = async (
    platform: HealthPlatform | null = platformFor(),
): Promise<HealthCapability> => {
    if (!platform) return probe(platform);

    const reader = loadReader(platform);
    if (!reader) return probe(platform);

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
export const readSince = async (
    cursor: string | null,
    platform: HealthPlatform | null = platformFor(),
): Promise<SyncBatch | null> => {
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
