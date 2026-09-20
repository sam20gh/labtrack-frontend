/**
 * The J-Style bracelet protocol codec, as a native module.
 *
 * **This module speaks no Bluetooth.** Both vendor SDKs are pure codecs — every `Get…` call
 * returns a byte array to write to a characteristic, and `DataParsingWithData` turns a
 * notification's bytes into a dictionary. The scanning, connecting, writing and subscribing
 * are all the caller's, and in this app they are `lib/health/jstyle/transport.ts` on top of
 * `react-native-ble-plx`.
 *
 * That split is the reason this module is thin. A native module that owned the radio would
 * need a connection state machine, a write queue and a reconnect policy written twice, once
 * in Kotlin and once in Swift, and testable on neither. Keeping the radio in JavaScript
 * leaves one state machine, shared by both platforms and both bracelets, in the language
 * the rest of the app is written in — and leaves the native side as two functions with no
 * lifecycle of their own.
 *
 * ## The codec is stateful, so calls must be serialised
 *
 * `BleSDK` is a class of static methods over static flags — `GetTotalActivityDataWithMode`
 * sets a flag that the *next* `DataParsingWithData` reads to know what it is decoding. A
 * multi-packet history read is therefore a conversation with memory, and two overlapping
 * reads would decode each other's packets. `session.ts` holds the mutex that prevents it;
 * nothing else may call `buildCommand` directly.
 *
 * ## iOS builds are device-only
 *
 * Both vendor archives are `arm64` with no simulator slice, so anything importing this
 * module fails to link for the iOS simulator. `isAvailable()` is what every caller checks,
 * and it is false on a simulator and on Expo Go rather than throwing.
 */
import { requireNativeModule } from 'expo-modules-core';

import type {
    JstyleCapabilities, JstyleCommand, JstyleCommandArgs, JstylePacket, JstyleVariant,
} from './src/types';

export * from './src/types';

interface JstyleBleNativeModule {
    buildCommand(variant: JstyleVariant, command: JstyleCommand, args: JstyleCommandArgs): string;
    parsePacket(variant: JstyleVariant, base64: string): JstylePacket;
    resetCodec(variant: JstyleVariant): void;
    capabilities(variant: JstyleVariant): JstyleCapabilities;
}

/**
 * The native module, or null where it does not exist.
 *
 * Null on the iOS simulator (no arm64-simulator slice in the vendor archives), in Expo Go,
 * and in a build made before this module was added. All three are ordinary states a person
 * can be in, and none of them is an error — the pairing screen offers manual logging
 * instead, the way `lib/health/index.ts` already handles a missing health store.
 */
let native: JstyleBleNativeModule | null = null;
try {
    native = requireNativeModule<JstyleBleNativeModule>('JstyleBleModule');
} catch {
    native = null;
}

/** True when this build can encode and decode bracelet packets at all. */
export const isAvailable = (): boolean => native !== null;

const requireNative = (): JstyleBleNativeModule => {
    if (!native) {
        throw new Error(
            'Bracelet support is not in this build. On iOS this is also the simulator, '
            + 'which the vendor SDK has no slice for — pair on a physical device.',
        );
    }
    return native;
};

/**
 * Encode a command.
 *
 * Returns base64 rather than a byte array: `react-native-ble-plx` writes base64, so
 * handing back anything else would mean converting on both sides of the bridge for no one's
 * benefit.
 */
export const buildCommand = (
    variant: JstyleVariant,
    command: JstyleCommand,
    args: JstyleCommandArgs = {},
): string => requireNative().buildCommand(variant, command, args);

/**
 * Decode one notification.
 *
 * Never throws on a packet it does not recognise. A bracelet on newer firmware can send a
 * type this build has no name for, and losing a whole sync over one unreadable packet would
 * be the wrong trade — it comes back as `type: 'unknown'` with its `rawType`, and the
 * reader skips it.
 */
export const parsePacket = (variant: JstyleVariant, base64: string): JstylePacket =>
    requireNative().parsePacket(variant, base64);

/**
 * Clear the vendor SDK's static decode flags.
 *
 * Called when a connection drops mid-read. Without it the flags still say "a sleep history
 * is in progress", and the first packet of the *next* connection — a battery reply, most
 * likely — is decoded as sleep. The symptom is a nonsense record rather than an error,
 * which is why this is called on every disconnect rather than only on a clean one.
 */
export const resetCodec = (variant: JstyleVariant): void => {
    if (native) native.resetCodec(variant);
};

/**
 * What this bracelet's SDK can encode.
 *
 * The two are not the same device wearing different names. The 2208A reads an axillary
 * temperature and the V8 has no such command in either its Android or its iOS SDK; SpO2 is
 * `GetBloodOxygen` on one and `Oxygen_data` on the other, with the 2208A splitting the
 * automatic and manual histories the V8 returns together.
 *
 * So the reader asks rather than assumes. `buildCommand` throws on a command the variant
 * cannot encode — better than the alternative, which is a plausible-looking byte array that
 * the bracelet answers with something else, decoded under the wrong flag and stored as a
 * reading nobody took.
 */
export const capabilities = (variant: JstyleVariant): JstyleCapabilities =>
    requireNative().capabilities(variant);

/** Whether this bracelet can be asked for this at all. */
export const supports = (variant: JstyleVariant, command: JstyleCommand): boolean => {
    if (!native) return false;
    return native.capabilities(variant).commands.includes(command);
};
