/**
 * The radio.
 *
 * `react-native-ble-plx` owns scanning, connecting and the characteristics; this file is
 * the thin layer that knows *which* characteristics a J-Style bracelet uses and turns a
 * notification stream into something a session can await. It holds no health data and does
 * no decoding — `modules/jstyle-ble` decodes, `session.ts` decides what to ask for.
 *
 * ## The GATT profile
 *
 * Both bracelets expose one service, `fff0`, with a write characteristic at `fff6` and a
 * notify characteristic at `fff7`. Read out of the vendor demos — `BleService.java` on
 * Android names all three — rather than guessed, and identical across the 2208A and the V8
 * because they are the same vendor's firmware.
 *
 * **The service is there once connected, not in the advertisement.** The V8 does not put
 * `fff0` in what it broadcasts, so a scan filtered on it never hears the bracelet at all —
 * no error, just an empty list, while the maker's app finds it instantly. Both vendor demos
 * scan with no filter (`startScan(null, …)` on Android, `startScanningWithServices:nil` on
 * iOS) and pick the bracelet out by name, which is what `scan` below does too.
 *
 * ## One device at a time
 *
 * Deliberate, and not a simplification to be undone later. The vendor codec keeps its
 * decode state in static fields (`modules/jstyle-ble/index.ts` explains why), so two
 * bracelets streaming history at once would decode each other's packets. The connection
 * below is therefore a module-level singleton rather than an object a caller can make two
 * of.
 */
import { BleManager, Device, Characteristic, Subscription, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

import type { JstyleVariant } from '@/modules/jstyle-ble';

/** The vendor's GATT profile. Same on both bracelets. */
export const GATT = {
    service: '0000fff0-0000-1000-8000-00805f9b34fb',
    write: '0000fff6-0000-1000-8000-00805f9b34fb',
    notify: '0000fff7-0000-1000-8000-00805f9b34fb',
} as const;

/**
 * How a bracelet advertises itself.
 *
 * The vendor ships these under many retail names, and the advertisement does not carry the
 * service (see the header), so recognition is a name match with the service as a bonus for
 * firmware that does advertise it. `2301` is the V8's internal model number — its SDK is
 * `blesdk_2301` — and JCVital is the brand the V8 ships under today.
 *
 * A name that matches nothing is not discarded; it is reported as unrecognised, because the
 * next retail box will carry a name nobody has seen yet and the person must still be able
 * to reach it. `connect` refuses anything without the vendor's data channel, so picking the
 * wrong one costs a clear error rather than a bad pairing.
 */
const BRACELET_NAME = /2208|2301|\bv8\b|j-?style|jcvital|predyqt/i;

/**
 * Which model a name means. Separate from recognition on purpose, and narrower: a wrong
 * guess pairs the device against the wrong SDK and every reading after that is decoded with
 * the wrong table, so anything short of a model number falls back to asking the person.
 */
const NAME_HINTS: { pattern: RegExp; variant: JstyleVariant }[] = [
    { pattern: /2208|j-?style\s*2208/i, variant: 'j2208a' },
    // `JCV8B…` is how the V8 ships; `Predyqt 2` is what the first sync renames it to.
    { pattern: /2301|\bv8\b|jstyle\s*v8|jcv8|predyqt\s*2/i, variant: 'v8' },
];

export interface DiscoveredBracelet {
    id: string;
    name: string | null;
    rssi: number | null;
    /** Null when the advertisement does not say. The pairing screen then asks. */
    variant: JstyleVariant | null;
    /**
     * Advertises the vendor service or carries a known bracelet name. False for any other
     * named device nearby, which the pairing screen keeps behind a "show others" control.
     */
    recognised: boolean;
}

export const identify = (name: string | null): JstyleVariant | null => {
    if (!name) return null;
    return NAME_HINTS.find((h) => h.pattern.test(name))?.variant ?? null;
};

let manager: BleManager | null = null;

/**
 * The manager, made lazily.
 *
 * Constructing a `BleManager` powers up the Bluetooth stack and, on iOS, can raise the
 * system permission dialog. Doing that at import time would ask every person who opens the
 * app for Bluetooth, including the ones who will never own a bracelet — so it happens on
 * the first scan, which is a screen somebody navigated to on purpose.
 */
const getManager = (): BleManager => {
    if (!manager) manager = new BleManager();
    return manager;
};

/** True when this build has the BLE native module at all. */
export const isBleBuild = (): boolean => {
    try {
        getManager();
        return true;
    } catch {
        return false;
    }
};

/** Resolves true once the radio is on, or false after `timeoutMs` without it. */
const whenPoweredOn = (timeoutMs = 5_000): Promise<boolean> => new Promise((resolve) => {
    let done = false;
    let subscription: { remove: () => void } | null = null;
    const finish = (on: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        subscription?.remove();
        resolve(on);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
        subscription = getManager().onStateChange((state) => {
            if (state === State.PoweredOn) finish(true);
        }, true);
    } catch {
        finish(false);
    }
});

/**
 * Why a scan cannot run, written to be shown to a person.
 *
 * Returns null when it can. Every string here names the thing the person can do about it,
 * because the alternative — "Bluetooth error" — leaves someone toggling settings at random.
 */
export const scanBlockedReason = async (): Promise<string | null> => {
    if (Platform.OS === 'web') return 'Pairing a bracelet needs the mobile app.';

    let state: State;
    try {
        state = await getManager().state();
    } catch {
        return 'Bracelet support is not in this version of the app yet.';
    }

    switch (state) {
        case State.PoweredOn: return null;
        case State.PoweredOff: return 'Bluetooth is off. Turn it on to find your bracelet.';
        case State.Unauthorized:
            return Platform.OS === 'ios'
                ? 'Predyqt needs Bluetooth permission. Enable it in Settings › Predyqt.'
                : 'Predyqt needs the Nearby devices permission to find your bracelet.';
        case State.Unsupported: return 'This device has no Bluetooth LE radio.';
        default: return 'Bluetooth is still starting up. Try again in a moment.';
    }
};

/**
 * Ask for Android's "Nearby devices" permission.
 *
 * The manifest declaring it is not enough: from Android 12 it is a runtime grant, and
 * `react-native-ble-plx` never asks — a scan without it fails as "Unauthorized". Below 12
 * the scan needs location instead. Called from the pairing screen's button, never earlier,
 * for the same reason `getManager` is lazy. iOS asks by itself on the first scan.
 */
export const requestScanPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    const { PERMISSIONS, RESULTS } = PermissionsAndroid;
    const wanted = Number(Platform.Version) >= 31
        ? [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_CONNECT]
        : [PERMISSIONS.ACCESS_FINE_LOCATION];

    try {
        const result = await PermissionsAndroid.requestMultiple(wanted);
        return wanted.every((p) => result[p] === RESULTS.GRANTED);
    } catch {
        return false;
    }
};

const advertisesProfile = (device: Device): boolean =>
    (device.serviceUUIDs ?? []).some((uuid) => {
        const id = uuid.toLowerCase();
        return id === GATT.service || id === 'fff0';
    });

/**
 * Scan for bracelets.
 *
 * Unfiltered at the radio, as the vendor's own apps scan — see the header for why a service
 * filter finds nothing. Devices with no name and no vendor service are dropped here; that is
 * most of what a busy room broadcasts, and none of it can be a bracelet somebody could pick.
 *
 * Calls `onFound` each time a device is seen — including repeatedly for the same one as its
 * RSSI changes, which is what lets a pairing screen sort by proximity — and de-duplicates by
 * id so the list does not grow. The returned function stops the scan and must be called: a
 * scan left running is a measurable battery drain and Android will eventually throttle it.
 */
export const scan = (
    onFound: (device: DiscoveredBracelet) => void,
    onError?: (message: string) => void,
): (() => void) => {
    const seen = new Map<string, number>();

    getManager().startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) {
            onError?.(error.message);
            return;
        }
        if (!device) return;

        // The advertisement first: iOS caches a peripheral's GAP name, so after a rename
        // `device.name` can keep showing the old one while the band is advertising the new.
        const name = device.localName ?? device.name ?? null;
        const recognised = advertisesProfile(device) || (!!name && BRACELET_NAME.test(name));
        if (!recognised && !name) return;

        // Same device, no meaningful change in signal: nothing for a list to redraw.
        const previous = seen.get(device.id);
        if (previous !== undefined && Math.abs((device.rssi ?? 0) - previous) < 5) return;
        seen.set(device.id, device.rssi ?? 0);

        onFound({
            id: device.id,
            name,
            rssi: device.rssi,
            variant: identify(name),
            recognised,
        });
    });

    return () => {
        try { getManager().stopDeviceScan(); } catch { /* already stopped */ }
    };
};

export interface Connection {
    device: Device;
    write: Characteristic;
    notify: Characteristic;
}

let connection: Connection | null = null;
let notifySubscription: Subscription | null = null;

/**
 * Connect, and leave the connection ready to talk.
 *
 * Four steps that all have to happen before the first command, and skipping any of them
 * fails in a way that looks like the bracelet is broken:
 *
 * 1. **Request a larger MTU on Android.** The default 23 bytes splits the vendor's 20-byte
 *    frames across notifications, and the codec cannot reassemble them — it decodes the
 *    fragments as malformed packets. iOS negotiates this itself and ignores the request.
 * 2. **Discover services**, without which the characteristics cannot be looked up.
 * 3. **Check the profile is actually there.** A device advertising `fff0` that turns out to
 *    have no `fff6` is not a bracelet, and saying so beats a null dereference three calls
 *    later.
 * 4. **Subscribe before writing.** The bracelet answers fast enough that a command written
 *    before the subscription is live loses its reply, and the session then waits out a
 *    timeout on a device that already answered.
 */
export const connect = async (
    deviceId: string,
    onPacket: (base64: string) => void,
    onDisconnect?: () => void,
): Promise<Connection> => {
    await disconnect();
    // A manager created seconds ago — always the case when a background task woke the app —
    // reports `Unknown` until the radio answers, and connecting then fails. Wait for it.
    if (!(await whenPoweredOn())) throw new Error((await scanBlockedReason()) ?? 'Bluetooth is not ready.');

    const device = await getManager().connectToDevice(deviceId, { timeout: 15_000 });

    if (Platform.OS === 'android') {
        // 185 rather than the maximum: some of this vendor's firmware refuses 512 outright
        // and the failure is a rejected connection rather than a smaller MTU.
        try { await device.requestMTU(185); } catch { /* the default may still work */ }
    }

    await device.discoverAllServicesAndCharacteristics();

    const characteristics = await device.characteristicsForService(GATT.service);
    const write = characteristics.find((c) => c.uuid.toLowerCase() === GATT.write);
    const notify = characteristics.find((c) => c.uuid.toLowerCase() === GATT.notify);

    if (!write || !notify) {
        await device.cancelConnection().catch(() => undefined);
        throw new Error('That device is not a J-Style bracelet — it has no data channel.');
    }

    notifySubscription = notify.monitor((error, characteristic) => {
        if (error || !characteristic?.value) return;
        onPacket(characteristic.value);
    });

    device.onDisconnected(() => {
        connection = null;
        notifySubscription?.remove();
        notifySubscription = null;
        onDisconnect?.();
    });

    connection = { device, write, notify };
    return connection;
};

/**
 * Write one command.
 *
 * **Without a response**, which is what the vendor profile expects: `fff6` is
 * write-without-response, and the reply comes back on `fff7` as a notification rather than
 * as an acknowledgement. Using the with-response form makes the bracelet's firmware stall.
 */
export const write = async (base64: string): Promise<void> => {
    if (!connection) throw new Error('No bracelet is connected.');
    await connection.device.writeCharacteristicWithoutResponseForService(
        GATT.service, GATT.write, base64,
    );
};

export const isConnected = (): boolean => connection !== null;
export const connectedId = (): string | null => connection?.device.id ?? null;

export const disconnect = async (): Promise<void> => {
    notifySubscription?.remove();
    notifySubscription = null;

    const open = connection;
    connection = null;
    if (!open) return;

    try { await open.device.cancelConnection(); } catch { /* already gone */ }
};

/** Released when the app no longer needs the radio at all. */
export const destroy = (): void => {
    notifySubscription?.remove();
    notifySubscription = null;
    connection = null;
    manager?.destroy();
    manager = null;
};
