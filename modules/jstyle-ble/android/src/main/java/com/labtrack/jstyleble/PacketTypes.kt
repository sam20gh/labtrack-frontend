package com.labtrack.jstyleble

/**
 * The vendor's packet numbering, mapped onto the names `src/types.ts` declares.
 *
 * Both Android jars agree on these numbers — the tables in `blesdk2208a.constant.BleConst`
 * and `blesdkv8.constant.BleConst` were diffed key by key and no shared key disagrees — so
 * one table serves both. **iOS does not share it.** The two iOS SDKs each carry their own
 * `DATATYPE_` enum and neither matches this one: HRV is "42" here, 38 in `DATATYPE_J2208A`
 * and 41 in `DATATYPE_V8`. Three numbering schemes for one set of ideas is exactly why a
 * number is never allowed past this file.
 *
 * Anything absent decodes as `unknown`, carrying its raw value. A bracelet on firmware
 * newer than this build will send types that are not here, and dropping the whole sync over
 * one unrecognised packet would be the wrong trade.
 */
internal object PacketTypes {
    val BY_CODE: Map<String, String> = mapOf(
        // ── identity and settings ───────────────────────────────────────────
        "0" to "deviceTime",
        "2" to "personalInfo",
        "4" to "deviceInfo",
        "9" to "battery",
        "10" to "macAddress",
        "11" to "version",
        "15" to "deviceName",
        "63" to "macAddress",

        // ── history ─────────────────────────────────────────────────────────
        "23" to "realTimeStep",
        "24" to "totalActivity",
        "25" to "detailActivity",
        "26" to "detailSleep",
        "27" to "dynamicHr",
        "28" to "staticHr",
        "29" to "activityModeData",
        "42" to "hrv",
        "55" to "autoSpo2",
        "70" to "manualSpo2",
        "59" to "temperature",
        "36" to "temperature",
        "62" to "axillaryTemperature",
        "121" to "detailSleep",

        // ── ECG and PPG, all live rather than historical ────────────────────
        "37" to "ecgRaw",
        "38" to "ecgStatus",
        "39" to "ecgRaw",
        "53" to "ecgHistory",
        "66" to "ecgStatus",
        "67" to "ecgHistory",
        "64" to "ppgRaw",
        "99" to "ppgRaw",
        "102" to "ppgStarted",
        "103" to "ppgStartFailed",
        "104" to "ppgStopped",
        "105" to "ppgStopped",
        "106" to "ppgProgress",
        "107" to "ppgResult",
        "126" to "ppgRaw",
        "ECGResult" to "ecgResult",
        "ENTERECG" to "ecgStatus",

        // ── measurements the bracelet runs on its own ───────────────────────
        "73" to "deviceMeasurementHrv",
        "74" to "deviceMeasurementHr",
        "75" to "deviceMeasurementSpo2",

        // ── unprompted ──────────────────────────────────────────────────────
        "31" to "deviceSendData",
        "58" to "sos",
        "FindMobilePhoneMode" to "findPhone",
    )

    /**
     * Keys the SDK uses for its own framing.
     *
     * Lifted onto the packet rather than left in `data`, so a caller reads `packet.end`
     * instead of knowing that the vendor spells it `dataEnd`.
     */
    const val KEY_TYPE = "dataType"
    const val KEY_END = "dataEnd"
    const val KEY_DATA = "dicData"
}
