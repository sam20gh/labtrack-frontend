import Foundation

/**
 * The two iOS SDKs' packet numbering, mapped onto the names `src/types.ts` declares.
 *
 * **Two tables, because the two SDKs disagree.** `DATATYPE_J2208A` and `DATATYPE_V8` are
 * separate enums written a year apart, and the V8 inserted values in the middle rather than
 * appending: HRV is 38 on the 2208A and 41 on the V8, ECG history is 48 and 51. Neither
 * matches Android, which keys the same ideas by numeric *string* on a third scheme again —
 * HRV is "42" there.
 *
 * Three numbering schemes for one set of ideas, and no compiler anywhere checks that a
 * caller picked the right one. That is the whole reason a number never leaves this file:
 * getting it wrong does not crash, it stores a temperature as a sleep stage.
 */
enum JstylePacketTypes {

    /// `DATATYPE_J2208A`, from `BleSDK_Header_J2208A.h`.
    static let j2208a: [Int: String] = [
        0: "deviceTime", 2: "personalInfo", 4: "deviceInfo",
        9: "battery", 10: "macAddress", 11: "version", 15: "deviceName",
        24: "realTimeStep", 25: "totalActivity", 26: "detailActivity", 27: "detailSleep",
        28: "dynamicHr", 29: "staticHr", 30: "activityModeData",
        33: "deviceSendData", 38: "hrv",
        42: "autoSpo2", 43: "manualSpo2",
        45: "temperature", 46: "axillaryTemperature",
        47: "sos", 48: "ecgHistory",
        51: "ecgRaw", 52: "ecgResult", 53: "ecgStatus", 54: "ecgFailed",
        55: "deviceMeasurementHr", 56: "deviceMeasurementHrv",
        57: "deviceMeasurementSpo2", 58: "deviceMeasurementTemperature",
        44: "findPhone",
        67: "ppgRaw", 68: "ppgStarted", 69: "ppgStartFailed", 70: "ppgResult",
        71: "ppgStopped", 72: "ppgStopped", 73: "ppgProgress",
        255: "error",
    ]

    /// `DATATYPE_V8`, from `BleSDK_Header_V8.h`. Note every value past 30 has shifted.
    static let v8: [Int: String] = [
        0: "deviceTime", 2: "personalInfo", 4: "deviceInfo",
        9: "battery", 10: "macAddress", 11: "version", 15: "deviceName",
        24: "realTimeStep", 25: "totalActivity", 26: "detailActivity", 27: "detailSleep",
        28: "dynamicHr", 29: "staticHr", 30: "activityModeData",
        36: "deviceSendData", 41: "hrv",
        45: "autoSpo2", 46: "manualSpo2",
        47: "findPhone", 48: "temperature", 49: "axillaryTemperature",
        50: "sos", 51: "ecgHistory",
        54: "ecgRaw", 55: "ecgResult", 56: "ecgStatus", 57: "ecgFailed",
        58: "deviceMeasurementHr", 59: "deviceMeasurementHrv", 60: "deviceMeasurementSpo2",
        70: "ppgRaw", 71: "ppgStarted", 72: "ppgStartFailed", 73: "ppgResult",
        74: "ppgStopped", 75: "ppgStopped", 76: "ppgProgress",
        81: "detailSleep",
        255: "error",
    ]

    static func name(variant: String, code: Int) -> String {
        let table = variant == "j2208a" ? j2208a : v8
        return table[code] ?? "unknown"
    }
}
