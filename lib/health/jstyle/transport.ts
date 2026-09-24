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
 * Android names all three, and the iOS demos scan for `0xfff0` — rather than guessed, and
 * identical across the 2208A and the V8 because they are the same vendor's firmware.
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
import { Platform } from 'react-native';

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
 * The vendor ships these under many retail names, so the match is on the GATT service
 * rather than on the name — a filter on "J-Style" would miss most of the boxes the same
 * hardware is sold in. The names below only pick the *variant* once a device is found, and
 * an unrecognised name is not an error: `identify` falls back to asking the person, because
 * a wrong guess pairs the device against the wrong SDK and every reading after that is
 * decoded with the wrong table.
 */
const NAME_HINTS: { pattern: RegExp; variant: JstyleVariant }[] = [
    { pattern: /2208|j-?style\s*2208/i, variant: 'j2208a' },
    { pattern: /\bv8\b|jstyle\s*v8/i, variant: 'v8' },
];

export interface DiscoveredBracelet {
    id: string;
    name: string | null;
    rssi: number | null;
    /** Null when the advertisement does not say. The pairing screen then asks. */
    variant: JstyleVariant | null;
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
 * Scan for bracelets.
 *
 * Filters on the vendor service UUID rather than the name. Calls `onFound` each time a
 * device is seen — including repeatedly for the same one as its RSSI changes, which is what
 * lets a pairing screen sort by proximity — and de-duplicates by id so the list does not
 * grow. The returned function stops the scan and must be called: a scan left running is a
 * measurable battery drain and Android will eventually throttle it away.
 */
export const scan = (
    onFound: (device: DiscoveredBracelet) => void,
    onError?: (message: string) => void,
): (() => void) => {
    const seen = new Map<string, number>();

    getManager().startDeviceScan([GATT.service], { allowDuplicates: true }, (error, device) => {
        if (error) {
            onError?.(error.message);
            return;
        }
        if (!device) return;

        // Same device, no meaningful change in signal: nothing for a list to redraw.
        const previous = seen.get(device.id);
        if (previous !== undefined && Math.abs((device.rssi ?? 0) - previous) < 5) return;
        seen.set(device.id, device.rssi ?? 0);

        onFound({
            id: device.id,
            name: device.name ?? device.localName ?? null,
            rssi: device.rssi,
            variant: identify(device.name ?? device.localName ?? null),
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
