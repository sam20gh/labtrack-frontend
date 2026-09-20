/**
 * Which bracelet this phone is paired with.
 *
 * Device-local (AsyncStorage) rather than an API resource, and deliberately so: a BLE peer
 * id is **not portable**. iOS hands out a per-app UUID for a peripheral and Android gives a
 * MAC address, so the identifier this phone uses to reconnect is meaningless on any other
 * phone and on iOS is meaningless to any other app. Storing it server-side would sync a
 * value the other device cannot act on — the same reasoning `lib/units.ts` gives for
 * keeping unit preferences off the server.
 *
 * What *is* server-side is the `ConnectedSource` row: the sync cursor, the label, and when
 * it last wrote. That is the part another device can use.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { JstyleVariant } from '@/modules/jstyle-ble';

const KEY = 'jstyleBracelet';

export interface PairedBracelet {
    /** The BLE peer id. Per-phone — see the note above. */
    id: string;
    variant: JstyleVariant;
    /** What to call it on screen. */
    label: string;
    pairedAt: string;
    /** Last successful read, so a screen can say "synced 2h ago" without a round trip. */
    lastSyncAt?: string;
    lastBattery?: number;
    /** The bracelet's MAC, which *is* stable and identifies the hardware across phones. */
    mac?: string;
}

let cached: PairedBracelet | null | undefined;

export const getPaired = async (): Promise<PairedBracelet | null> => {
    if (cached !== undefined) return cached;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        cached = raw ? (JSON.parse(raw) as PairedBracelet) : null;
    } catch {
        cached = null;
    }
    return cached;
};

/**
 * Read without awaiting.
 *
 * Formatters and render paths need this the way `lib/units.ts` needs synchronous reads.
 * Returns undefined until `hydrate()` has run, which a caller distinguishes from a genuine
 * null — "not loaded yet" and "no bracelet" draw differently.
 */
export const getPairedSync = (): PairedBracelet | null | undefined => cached;

/** Warmed once at launch, beside `hydrateUnits()`. */
export const hydrate = async (): Promise<void> => { await getPaired(); };

export const setPaired = async (device: PairedBracelet): Promise<void> => {
    cached = device;
    await AsyncStorage.setItem(KEY, JSON.stringify(device));
};

export const updatePaired = async (patch: Partial<PairedBracelet>): Promise<void> => {
    const current = await getPaired();
    if (!current) return;
    await setPaired({ ...current, ...patch });
};

/**
 * Forget the bracelet.
 *
 * Only the pairing is forgotten. Everything it has already measured stays — those rows are
 * the person's health record, not the device's, and unpairing a watch must not delete a
 * month of sleep. The same call `ConnectedSource` makes by keeping a revoked row rather
 * than deleting it.
 */
export const clearPaired = async (): Promise<void> => {
    cached = null;
    await AsyncStorage.removeItem(KEY);
};
