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
    /**
     * When the bracelet's own timed readings were switched on. Unset means never, and the
     * next sync does it — which is how a band paired before this existed gets it too.
     */
    monitoringSetAt?: string;
    /** Which `MONITORING` set in `reader.ts` was sent. Absent with `monitoringSetAt` means 1. */
    monitoringVersion?: number;
    /** The name last written to the band (`BAND_NAME` in `reader.ts`). Unset: never renamed. */
    nameSetTo?: string;
    /** The newest reading of each kind the last sync brought over. */
    latest?: LatestReadings;
    /**
     * When the phone last set the bracelet's clock — the last moment its stamps are known to
     * be right. `clock.ts` explains why the server needs it.
     */
    clockSetAt?: string;
    /** The clock as the last sync left it, sent with the next one. See `clock.ts`. */
    lastClockCheck?: { at: string; afterRead?: ClockReading | null; afterAck?: ClockReading | null };
    /**
     * A wrong clock found by something other than a sync — live view sets the clock too —
     * kept until a sync has reported it, because setting it destroyed the only evidence.
     */
    unreportedClock?: ClockReading & { lastSetAt: string | null };
    /**
     * Per never-deleted series (`INCREMENTAL` in `reader.ts`): whether this band honours a
     * start date, and the newest record the server has. Saved only after the POST lands.
     */
    incremental?: Record<string, SeriesCursor>;
    /** Which `INCREMENTAL_VERSION` wrote `incremental`. A different one starts again. */
    incrementalVersion?: number;
    /** The last full replay the server received. One is due every day regardless. */
    lastFullReadAt?: string;
    /**
     * When the server first confirmed it stores the continuous heart stream for this band.
     * Unset: the next read is the transition replay, which drops its oldest day.
     */
    heartStreamSince?: string;
    /** The last run of the background task (`lib/health/backgroundSync.ts`), shown on screen. */
    lastBackgroundSync?: { at: string; ran: boolean; days: number; reason: string | null };
}

/** One series' incremental-read state. */
export interface SeriesCursor {
    /** Proved by `judgeProbe` against a full read; `unsupported` stays on full reads. */
    verdict: 'unverified' | 'verified' | 'unsupported';
    /** The newest record's instant (ISO). The next read starts the local day before it. */
    newest?: string;
}

/** The bracelet's clock as read, and the phone's when it answered. */
export interface ClockReading {
    /** The bracelet's time, read as phone-local like every record's stamp. Null: it did not say. */
    bandAt: string | null;
    phoneAt: string;
}

/** One reading and when the bracelet took it. */
export interface Stamped<T = number> {
    value: T;
    at: string;
}

/**
 * The newest of each family, kept on the phone so the bracelet screen can show them
 * without a round trip — the same reason `lastBattery` is here. Absent families stay
 * absent: a V8 has no axillary temperature and a band that measured no SpO2 today has not
 * measured 0%.
 */
export interface LatestReadings {
    heartRate?: Stamped;
    spo2?: Stamped;
    temperature?: Stamped;
    hrv?: Stamped;
    /** The bracelet's own stress score, from the newest HRV record. */
    stress?: Stamped;
    bloodPressure?: Stamped<{ systolic: number; diastolic: number }>;
    steps?: Stamped;
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
