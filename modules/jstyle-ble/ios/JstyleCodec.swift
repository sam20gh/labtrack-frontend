import Foundation
import JStyleVendor

/**
 * The two vendor codecs behind one vocabulary.
 *
 * The Objective-C counterpart of `android/.../Codec.kt`, and deliberately the same shape:
 * one `build`, one `parse`, one capability table. Where the two files differ, it is because
 * the vendor SDKs differ, and each difference is commented where it appears.
 */
enum JstyleCodec {

    // ── read modes ──────────────────────────────────────────────────────────
    //
    // Pagination, not history depth. `start` opens a read and the bracelet answers with at
    // most 50 packets before going quiet; `next` asks for the batch after that. See
    // `src/types.ts` for why a reader that only waits for an end flag hangs.
    private static let modeStart: Int32 = 0x00
    private static let modeNext: Int32 = 0x02
    /// Frees the bracelet's ring buffer. Destructive — issued only after the server has the rows.
    private static let modeDelete: Int32 = 0x99

    private static func mode(_ raw: Any?) -> Int32 {
        switch raw as? String {
        case "next": return modeNext
        case "delete": return modeDelete
        default: return modeStart
        }
    }

    /**
     * Commands each variant can encode **on iOS**.
     *
     * Deliberately not identical to the Kotlin table, because the vendor SDKs are not. Two
     * differences, and the second one is the surprising one:
     *
     * 1. **Axillary temperature is 2208A-only**, on both platforms. `BleSDK_V8.h` has no
     *    such method and neither does the V8 jar.
     * 2. **The V8 reads a manual SpO2 history on iOS and not on Android.**
     *    `GetManualSpo2DataWithMode` is right there in `BleSDK_V8.h`; the V8 jar exposes
     *    only `Oxygen_data`, which is the automatic history. Same bracelet, same vendor,
     *    one SDK a year behind the other.
     *
     * So capability is asked of the platform rather than assumed from the model, and the
     * answer is allowed to differ. Taking the intersection instead would mean throwing away
     * readings an iPhone can genuinely collect in order to make a table look tidy; the cost
     * of not doing so is that somebody who changes phone sees that series stop, which is
     * true rather than tidy. Every read is guarded by `supports()`, so an absent command is
     * a series that is not collected, never a failed sync.
     */
    static func capabilities(variant: String) -> [String] {
        let shared = [
            "getDeviceTime", "setDeviceTime", "getPersonalInfo", "setPersonalInfo",
            "getBattery", "getVersion", "getMacAddress", "getDeviceName",
            "getTotalActivity", "getDetailActivity", "getDetailSleep",
            "getStaticHr", "getDynamicHr", "getHrv",
            "getAutoSpo2", "getManualSpo2",
            "getTemperature", "ppg",
        ]
        return variant == "j2208a" ? shared + ["getAxillaryTemperature"] : shared
    }

    struct UnsupportedCommand: Error, LocalizedError {
        let variant: String, command: String
        var errorDescription: String? {
            "The \(variant) bracelet has no '\(command)' command. Check `supports()` first."
        }
    }

    // ── encoding ────────────────────────────────────────────────────────────

    static func build(variant: String, command: String, args: [String: Any]) throws -> Data {
        guard capabilities(variant: variant).contains(command) else {
            throw UnsupportedCommand(variant: variant, command: command)
        }

        let m = mode(args["mode"])
        // The vendor takes an NSDate to resume from and warns it is ignored unless it
        // matches a stored record exactly. `distantPast` means "wherever you are", which is
        // what every vendor demo passes and what a resume actually wants — the bracelet's
        // own bookmark rather than ours.
        let from = (args["startDate"] as? String).flatMap(ISO8601DateFormatter().date(from:))
            ?? Date.distantPast

        return variant == "j2208a"
            ? build2208A(command, m, from, args)
            : buildV8(command, m, from, args)
    }

    private static func build2208A(_ cmd: String, _ m: Int32, _ from: Date, _ args: [String: Any]) -> Data {
        let sdk = BleSDK_J2208A.sharedManager()
        switch cmd {
        case "getDeviceTime":    return sdk.getDeviceTime() as Data
        case "setDeviceTime":    return sdk.setDeviceTime(deviceTime2208A()) as Data
        case "getPersonalInfo":  return sdk.getPersonalInfo() as Data
        case "setPersonalInfo":  return sdk.setPersonalInfo(personalInfo2208A(args)) as Data
        case "getBattery":       return sdk.getDeviceBatteryLevel() as Data
        case "getVersion":       return sdk.getDeviceVersion() as Data
        case "getMacAddress":    return sdk.getDeviceMacAddress() as Data
        case "getDeviceName":    return sdk.getDeviceName() as Data
        case "getTotalActivity": return sdk.getTotalActivityData(withMode: m, withStartDate: from) as Data
        case "getDetailActivity":return sdk.getDetailActivityData(withMode: m, withStartDate: from) as Data
        case "getDetailSleep":   return sdk.getDetailSleepData(withMode: m, withStartDate: from) as Data
        case "getStaticHr":      return sdk.getSingleHRData(withMode: m, withStartDate: from) as Data
        case "getDynamicHr":     return sdk.getContinuousHRData(withMode: m, withStartDate: from) as Data
        case "getHrv":           return sdk.getHRVData(withMode: m, withStartDate: from) as Data
        case "getAutoSpo2":      return sdk.getAutomaticSpo2Data(withMode: m, withStartDate: from) as Data
        case "getManualSpo2":    return sdk.getManualSpo2Data(withMode: m, withStartDate: from) as Data
        case "getTemperature":   return sdk.getTemperatureData(withMode: m, withStartDate: from) as Data
        case "getAxillaryTemperature":
            return sdk.getAxillaryTemperatureData(withMode: m, withStartDate: from) as Data
        case "ppg":
            return sdk.ppg(withMode: int32(args["ppgMode"], 1), ppgStatus: int32(args["ppgStatus"], 0)) as Data
        default: return Data()
        }
    }

    private static func buildV8(_ cmd: String, _ m: Int32, _ from: Date, _ args: [String: Any]) -> Data {
        let sdk = BleSDK_V8.sharedManager()
        switch cmd {
        case "getDeviceTime":    return sdk.getDeviceTime() as Data
        case "setDeviceTime":    return sdk.setDeviceTime(deviceTimeV8()) as Data
        case "getPersonalInfo":  return sdk.getPersonalInfo() as Data
        case "setPersonalInfo":  return sdk.setPersonalInfo(personalInfoV8(args)) as Data
        case "getBattery":       return sdk.getDeviceBatteryLevel() as Data
        case "getVersion":       return sdk.getDeviceVersion() as Data
        case "getMacAddress":    return sdk.getDeviceMacAddress() as Data
        case "getDeviceName":    return sdk.getDeviceName() as Data
        case "getTotalActivity": return sdk.getTotalActivityData(withMode: m, withStartDate: from) as Data
        case "getDetailActivity":return sdk.getDetailActivityData(withMode: m, withStartDate: from) as Data
        case "getDetailSleep":   return sdk.getDetailSleepData(withMode: m, withStartDate: from) as Data
        case "getStaticHr":      return sdk.getSingleHRData(withMode: m, withStartDate: from) as Data
        case "getDynamicHr":     return sdk.getContinuousHRData(withMode: m, withStartDate: from) as Data
        case "getHrv":           return sdk.getHRVData(withMode: m, withStartDate: from) as Data
        case "getAutoSpo2":      return sdk.getAutomaticSpo2Data(withMode: m, withStartDate: from) as Data
        case "getManualSpo2":    return sdk.getManualSpo2Data(withMode: m, withStartDate: from) as Data
        case "getTemperature":   return sdk.getTemperatureData(withMode: m, withStartDate: from) as Data
        case "ppg":
            return sdk.ppg(withMode: int32(args["ppgMode"], 1), ppgStatus: int32(args["ppgStatus"], 0)) as Data
        default: return Data()
        }
    }

    // ── decoding ────────────────────────────────────────────────────────────

    static func parse(variant: String, data: Data) -> [String: Any] {
        let decoded: (code: Int, end: Bool, dict: [AnyHashable: Any])
        if variant == "j2208a" {
            let d = BleSDK_J2208A.sharedManager().dataParsing(with: data)
            decoded = (d.dataType.rawValue, d.dataEnd, d.dicData ?? [:])
        } else {
            let d = BleSDK_V8.sharedManager().dataParsing(with: data)
            decoded = (d.dataType.rawValue, d.dataEnd, d.dicData ?? [:])
        }

        return [
            "type": JstylePacketTypes.name(variant: variant, code: decoded.code),
            // Kept so an unrecognised packet is reportable rather than merely unhandled.
            "rawType": decoded.code,
            "end": decoded.end,
            "data": convert(decoded.dict) as? [String: Any] ?? [:],
        ]
    }

    /**
     * Clearing the parser's state is **not possible on iOS**, and this is a real asymmetry.
     *
     * Android keeps its decode flags in `protected static` fields that reflection can
     * clear. The iOS SDKs keep theirs inside a singleton with no reset in either header —
     * `Reset` and `ClearAllHistoryData` are commands sent to the *bracelet*, not to the
     * codec, and calling either here would factory-reset somebody's watch.
     *
     * What makes that survivable is the session always opening a read with `start` rather
     * than `next`, which re-establishes what the SDK is decoding. So the flags being stale
     * after a dropped connection costs at most the first packet of the next read, and the
     * reader's `end`-flag accounting notices the short batch and re-asks.
     */
    static func reset(variant: String) { /* no facility exists; see the note above */ }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static func int32(_ value: Any?, _ fallback: Int32) -> Int32 {
        (value as? NSNumber)?.int32Value ?? fallback
    }

    /**
     * The vendor's dictionary, made safe to send across the bridge.
     *
     * `NSData` is the one that matters: an ECG or PPG waveform arrives as bytes, and bytes
     * that reached the bridge unconverted become an object with one numbered key per
     * sample. Unrolling it to an array of integers here keeps a waveform a waveform.
     */
    private static func convert(_ value: Any) -> Any {
        switch value {
        case let dict as [AnyHashable: Any]:
            return dict.reduce(into: [String: Any]()) { out, kv in
                out["\(kv.key)"] = convert(kv.value)
            }
        case let array as [Any]:
            return array.map(convert)
        case let data as Data:
            return [UInt8](data).map(Int.init)
        case let number as NSNumber:
            return number
        case let string as String:
            return string
        default:
            // A vendor model with no converter of its own. Its description beats dropping
            // it: the value stays legible in a log when something needs explaining.
            return "\(value)"
        }
    }

    private static func deviceTime2208A() -> MyDeviceTime_J2208A {
        let c = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second], from: Date())
        return MyDeviceTime_J2208A(
            year: Int32(c.year ?? 2026), month: Int32(c.month ?? 1), day: Int32(c.day ?? 1),
            hour: Int32(c.hour ?? 0), minute: Int32(c.minute ?? 0), second: Int32(c.second ?? 0))
    }

    private static func deviceTimeV8() -> MyDeviceTime_V8 {
        let c = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second], from: Date())
        return MyDeviceTime_V8(
            year: Int32(c.year ?? 2026), month: Int32(c.month ?? 1), day: Int32(c.day ?? 1),
            hour: Int32(c.hour ?? 0), minute: Int32(c.minute ?? 0), second: Int32(c.second ?? 0))
    }

    /**
     * Stride defaults to 41% of height.
     *
     * The bracelet converts steps to distance on-device with this number, so leaving it at
     * the vendor default makes every distance it reports wrong for anyone who is not an
     * average adult — and wrong in a way that reads as a bad pedometer rather than a field
     * nobody set.
     */
    private static func strideCm(_ info: [String: Any], _ heightCm: Int32) -> Int32 {
        int32(info["strideCm"], heightCm * 41 / 100)
    }

    private static func personalInfo2208A(_ args: [String: Any]) -> MyPersonalInfo_J2208A {
        let info = args["personalInfo"] as? [String: Any] ?? [:]
        let height = int32(info["heightCm"], 170)
        return MyPersonalInfo_J2208A(
            // Vendor encoding: 1 male, 0 female.
            gender: (info["gender"] as? String) == "female" ? 0 : 1,
            age: int32(info["ageYears"], 30),
            height: height,
            weight: int32(info["weightKg"], 70),
            stride: strideCm(info, height))
    }

    private static func personalInfoV8(_ args: [String: Any]) -> MyPersonalInfo_V8 {
        let info = args["personalInfo"] as? [String: Any] ?? [:]
        let height = int32(info["heightCm"], 170)
        return MyPersonalInfo_V8(
            gender: (info["gender"] as? String) == "female" ? 0 : 1,
            age: int32(info["ageYears"], 30),
            height: height,
            weight: int32(info["weightKg"], 70),
            stride: strideCm(info, height))
    }
}
