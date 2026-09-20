# jstyle-ble

The protocol codec for the J-Style 2208A and V8 health bracelets.

## What this is, and what it is not

Both vendor SDKs are **codecs, not Bluetooth stacks**. Every `Get…` call returns a byte
array to write to a characteristic, and `DataParsingWithData` turns a notification's bytes
into a dictionary. Scanning, connecting, writing and subscribing are the app's job.

So this module is two functions and no lifecycle. The radio lives in
[`lib/health/jstyle/transport.ts`](../../lib/health/jstyle/transport.ts) on top of
`react-native-ble-plx`, and the conversation lives in
[`session.ts`](../../lib/health/jstyle/session.ts).

That split is deliberate. A native module that owned the radio would need a connection
state machine, a write queue and a reconnect policy written twice — once in Kotlin, once in
Swift — and testable in neither. Keeping the radio in JavaScript leaves one state machine,
shared across both platforms and both bracelets.

## ⚠️ iOS builds are device-only

Both vendor archives are `arm64` with **no simulator slice**:

```
$ lipo -info vendor/j2208a/libBleSDK_J2208A.a
Non-fat file: … is architecture: arm64
```

A target linking this pod therefore **cannot build for the iOS simulator** — not as a
setting to flip, but because the code for that architecture does not exist. Excluding
`arm64` for the simulator does not help; it falls back to `x86_64`, which is equally absent.

Anything touching a bracelet must be exercised on a physical device. The JS side is written
so this is the *only* thing lost: `isAvailable()` returns false wherever the native module
is missing, so a simulator behaves exactly like a phone with no bracelet paired.

## Three numbering schemes, and why numbers never cross the bridge

The same ideas carry different numbers in all three SDKs:

| | iOS 2208A | iOS V8 | Android (both) |
|---|---|---|---|
| HRV | 38 | 41 | `"42"` |
| ECG history | 48 | 51 | `"53"` |
| Temperature | 45 | 48 | `"59"` |

No compiler anywhere checks that a caller picked the right table, and getting it wrong does
not crash — it stores a temperature as a sleep stage. So the native side maps every packet
onto a **string name** before anything reaches JavaScript, and the JS side never learns any
of the numberings. A vendor SDK bump that renumbers an enum is then one table in
[`PacketTypes.kt`](android/src/main/java/com/labtrack/jstyleble/PacketTypes.kt) and one in
[`PacketTypes.swift`](ios/PacketTypes.swift).

## The two bracelets are not the same device

| Command | 2208A | V8 (Android) | V8 (iOS) |
|---|---|---|---|
| `getAxillaryTemperature` | ✅ | ❌ | ❌ |
| `getManualSpo2` | ✅ | ❌ | ✅ |

The V8 row is not a mistake. `BleSDK_V8.h` declares `GetManualSpo2DataWithMode`; the V8 jar
exposes only `Oxygen_data`, which is the automatic history. Same bracelet, two SDKs written
a year apart.

Capability is therefore asked of the platform rather than assumed from the model, and the
answer is allowed to differ. `buildCommand` throws on a command the variant cannot encode —
better than a plausible-looking byte array the bracelet answers with something else, decoded
under whichever flag was last set. Guard every read with `supports()`.

## The codec is stateful

`BleSDK` is static methods over static flags: `GetTotalActivityDataWithMode` sets a flag
that the *next* parse reads to know what it is decoding. Two reads in flight would decode
each other's packets — not fail, decode, into plausible rows of the wrong kind.

`session.ts` holds the mutex. **Nothing else may call `buildCommand` directly.**

`resetCodec()` clears those flags reflectively on Android. iOS has no such facility — the
state is inside a singleton and the headers expose no reset (`Reset` and
`ClearAllHistoryData` are commands sent to the *bracelet*, and calling either would factory-
reset somebody's watch). What stands in for it is that a session always opens a read with
`start` rather than `next`.

## Reading history is paged, and the paging is explicit

The bracelet answers a `start` with **at most 50 packets** and then goes quiet. It does not
mark the fiftieth as final and it does not keep going. The client counts and asks for the
next batch with `next`.

A reader that waits for the end flag alone waits out its timeout against a device that is
politely waiting to be asked.

`delete` (`0x99`) frees the bracelet's ring buffer and **destroys data**. It holds a few
weeks, nothing is sent twice, and it is the only copy until a sync lands — so it is issued
only after `/api/wearables/sync` has been acknowledged.

> Note the near-miss: `BleSDK` also carries a `DATA_DELETE = 99` constant — decimal 99,
> `0x63` — which is *not* the delete value. Every vendor demo passes `(byte) 0x99`. Sending
> `0x63` is not a delete and not an error either: the bracelet ignores it, the space is
> never freed, and the ring buffer quietly starts overwriting unread history.

## GATT profile

Identical on both bracelets, read out of the vendor demos rather than guessed:

| | UUID |
|---|---|
| Service | `0000fff0-0000-1000-8000-00805f9b34fb` |
| Write (no response) | `0000fff6-…` |
| Notify | `0000fff7-…` |

Android needs an MTU bump: the default 23 bytes splits the vendor's frames across
notifications and the codec decodes the fragments as malformed packets.

## Building

Adding this module changes the native project, so it needs a new build — `eas update` alone
will not ship it.

```bash
nvm use                       # Node 20; RN 0.81 does not run on 18
npx expo prebuild --clean
npx expo run:ios              # a physical device — see the warning above
npx expo run:android
```

## Updating the vendor SDKs

1. Replace the jars in `android/libs/` and the archives + headers in `ios/vendor/`.
2. Re-diff the packet tables — `javap -constants …BleConst` and the `DATATYPE_` enums in
   the iOS headers — against `PacketTypes.kt` and `PacketTypes.swift`.
3. Re-check the capability tables in `Codec.kt` and `JstyleCodec.swift`.
4. `nm -gU` both archives and confirm no new duplicate symbols. At the time of writing the
   only shared symbol is a compiler-generated weak block descriptor, which the linker
   coalesces.
