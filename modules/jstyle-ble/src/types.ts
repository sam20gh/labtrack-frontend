/**
 * The vocabulary both bracelet SDKs are normalised into.
 *
 * J-Style ships two SDKs — `blesdk2208a` for the 2208A and `blesdkv8` for the V8 — with
 * near-identical APIs and **different numbers for the same ideas**. `HRVData` is 38 in one
 * enum and 41 in the other; `ECG_HistoryData` is 48 and 51. Nothing about that is visible
 * at a call site, so a number that crossed the native boundary would mean one thing on a
 * 2208A and something else on a V8, and the bug would be a sleep record filed as a
 * temperature reading rather than a crash.
 *
 * So numbers never cross. The native side maps each SDK's own enum onto the string names
 * below before anything reaches JavaScript, and the JS side never learns either numbering.
 * A vendor SDK bump that renumbers an enum is then a change to one lookup table in Kotlin
 * and one in Swift, instead of a silent reinterpretation of every stored row.
 */

/** Which bracelet, and therefore which vendor SDK encodes and decodes. */
export type JstyleVariant = 'j2208a' | 'v8';

/**
 * A command the app sends.
 *
 * Deliberately smaller than either SDK. Both expose alarms, dial faces, weather push,
 * find-my-phone, take-photo mode and social-distance reminders; none of that is health data
 * and Predyqt has no screen for any of it. A command here is one the sync or the pairing
 * flow actually issues — adding one that nothing calls is the dummy control this codebase
 * keeps removing.
 */
export type JstyleCommand =
    // ── handshake, run once on connect ──────────────────────────────────────
    | 'getDeviceTime'
    | 'setDeviceTime'
    | 'getPersonalInfo'
    | 'setPersonalInfo'
    | 'getBattery'
    | 'getVersion'
    | 'getMacAddress'
    | 'getDeviceName'
    // ── history reads, the whole point of a sync ────────────────────────────
    | 'getTotalActivity'
    | 'getDetailActivity'
    | 'getDetailSleep'
    | 'getStaticHr'
    | 'getDynamicHr'
    | 'getHrv'
    | 'getAutoSpo2'
    | 'getManualSpo2'
    | 'getTemperature'
    | 'getAxillaryTemperature'
    // ── live measurement, driven by a screen someone is looking at ──────────
    | 'ppg'
    /** Start or stop the bracelet streaming steps, heart rate and temperature. `live`. */
    | 'liveData'
    /** Start or stop a spot measurement on the bracelet. `measure`, `open`, `seconds`. */
    | 'measure'
    // ── settings ────────────────────────────────────────────────────────────
    /**
     * Turn on the bracelet's own timed readings for one family. `monitor`,
     * `intervalMinutes`. Without it a band takes no spot readings between syncs, and a
     * resting heart rate never exists to be shown.
     */
    | 'setAutoMonitoring'
    /**
     * Rename the bracelet — what it advertises over Bluetooth and so what every phone's scan
     * lists. `name`, at most 14 ASCII characters. **V8 only**: the 2208A SDK has no encoder.
     */
    | 'setDeviceName';

/** What a spot measurement measures. Encoded differently by each SDK — see the codecs. */
export type JstyleMeasure = 'hr' | 'spo2' | 'hrv';

/** A family the bracelet can sample on its own timer. */
export type JstyleMonitor = 'hr' | 'spo2' | 'hrv' | 'temperature';

/**
 * Where a history read is in its conversation.
 *
 * This is **pagination, not history depth**, and reading it as depth is the way to make a
 * sync hang. The bracelet answers `start` with at most **50 packets** and then stops — it
 * does not keep going and it does not mark the last one as final. The client has to count
 * them and ask for the next batch with `next`; a reader that only waits for `end` waits
 * forever on a device that is politely waiting to be asked.
 *
 * `delete` acknowledges what was read so the bracelet can free the space. **It destroys
 * data and the bracelet is the only copy** — its storage is a ring buffer of a few weeks,
 * nothing is sent twice, and a `delete` issued before the rows are on the server loses them
 * for good. `session.ts` issues it only after the POST has been acknowledged.
 */
export type JstyleReadMode = 'start' | 'next' | 'delete';

/**
 * A decoded packet.
 *
 * `end` is the flag that makes a multi-packet history read terminable. A day of detailed
 * activity is dozens of notifications and the last one is marked rather than counted, so a
 * reader waits for `end` instead of guessing a length.
 */
export interface JstylePacket {
    /** The normalised name, e.g. `detailSleep`. `unknown` for anything this build predates. */
    type: JstylePacketType;
    /** The vendor SDK's own enum value, kept only so an `unknown` is reportable. */
    rawType: number;
    /** Last packet of this response. */
    end: boolean;
    /** The SDK's own dictionary, keys as `DeviceKey` names them. */
    data: Record<string, unknown>;
}

/**
 * What a decoded packet can be.
 *
 * Wider than `JstyleCommand`, because a bracelet speaks unprompted: a button press, a
 * finished on-device measurement, an SOS. Those arrive on the same notify characteristic as
 * a command's reply and have to be nameable.
 */
export type JstylePacketType =
    | 'deviceTime' | 'personalInfo' | 'deviceInfo' | 'battery' | 'macAddress'
    | 'version' | 'deviceName' | 'deviceNameSet'
    | 'totalActivity' | 'detailActivity' | 'detailSleep'
    | 'staticHr' | 'dynamicHr' | 'hrv'
    | 'autoSpo2' | 'manualSpo2'
    | 'temperature' | 'axillaryTemperature'
    | 'realTimeStep' | 'activityModeData'
    | 'ecgHistory' | 'ecgRaw' | 'ecgResult' | 'ecgStatus' | 'ecgFailed'
    | 'ppgRaw' | 'ppgResult' | 'ppgProgress' | 'ppgStarted' | 'ppgStartFailed' | 'ppgStopped'
    | 'deviceMeasurementHr' | 'deviceMeasurementHrv' | 'deviceMeasurementSpo2'
    | 'deviceMeasurementTemperature' | 'deviceMeasurement' | 'measurementStopped'
    | 'autoMonitoring' | 'autoMonitoringSet'
    | 'sos' | 'findPhone' | 'deviceSendData'
    | 'error'
    /** A packet this build has no name for. Reported, never guessed at. */
    | 'unknown';

/** Arguments for the commands that take any. */
export interface JstyleCommandArgs {
    /** History reads. Defaults to `start`. */
    mode?: JstyleReadMode;
    /**
     * History reads — where the device starts. Platform-specific, because the SDKs are:
     * Android passes it straight to the jar, which splits `yyyy-MM-dd HH:mm:ss`; iOS parses
     * ISO 8601 without fractional seconds. `startDateArg` in `lib/health/jstyle/reader.ts`
     * writes both.
     */
    startDate?: string;
    /** `setPersonalInfo`. */
    personalInfo?: JstylePersonalInfo;
    /** `ppg`: 1 start, 2 send result, 3 stop, 4 progress, 5 quit. */
    ppgMode?: number;
    ppgStatus?: number;
    /** `liveData`: stream on or off. */
    live?: boolean;
    /** `measure`: which reading. */
    measure?: JstyleMeasure;
    /** `measure`: start (true) or stop (false). */
    open?: boolean;
    /** `measure`: how long the bracelet measures for. The iOS SDK's floor is 30. */
    seconds?: number;
    /** `setAutoMonitoring`: which family. */
    monitor?: JstyleMonitor;
    /** `setAutoMonitoring`: minutes between readings. 0 turns the family off. */
    intervalMinutes?: number;
    /** `setDeviceName`: at most 14 ASCII characters; the firmware has room for no more. */
    name?: string;
}

/**
 * What the bracelet needs to know about its wearer.
 *
 * Not vanity: stride length turns step counts into distance and weight turns movement into
 * calories, both on the device. Left unset the bracelet uses a default adult and every
 * distance and calorie figure it reports is quietly wrong — which looks like a bad sensor
 * rather than an unset field.
 */
export interface JstyleCapabilities {
    /** Commands this bracelet's SDK can actually encode. */
    commands: JstyleCommand[];
}

export interface JstylePersonalInfo {
    /** Centimetres. */
    heightCm: number;
    /** Kilograms. */
    weightKg: number;
    ageYears: number;
    gender: 'male' | 'female';
    /** Centimetres. Derived from height when unknown. */
    strideCm?: number;
}
