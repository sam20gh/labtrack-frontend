package com.labtrack.jstyleble

import android.util.Base64
import com.jstyle.blesdk2208a.Util.BleSDK as Sdk2208A
import com.jstyle.blesdk2208a.callback.DataListener2025
import com.jstyle.blesdk2208a.model.MyPersonalInfo as PersonalInfo2208A
import com.jstyle.blesdkv8.Util.BleSDK as SdkV8
import com.jstyle.blesdkv8.callback.DataListener2301
import com.jstyle.blesdkv8.model.MyPersonalInfo as PersonalInfoV8

/**
 * The two vendor codecs behind one vocabulary.
 *
 * Both jars expose a class literally called `BleSDK` in a package that differs only by the
 * model name, with static methods that return command bytes and one static parser that
 * takes a listener. They are imported aliased above because otherwise the names collide on
 * sight and a call meant for one device silently compiles against the other.
 *
 * ## Read modes
 *
 * The mode byte is **pagination**, not history depth. `0x00` opens a read and the bracelet
 * answers with at most 50 packets before falling silent; `0x02` asks for the next batch. A
 * reader that waits for an end flag without counting to 50 and asking again waits out its
 * timeout on a device that has already said everything it was asked for.
 *
 * `0x99` acknowledges what was read so the bracelet can free the space, and **it destroys
 * data**. A bracelet holds a few weeks in a ring buffer and is the only copy until a sync
 * lands, so `session.ts` issues it only once the server has acknowledged the rows.
 */
internal object Codec {

    private const val MODE_START: Byte = 0x00
    private const val MODE_CONTINUE: Byte = 0x02

    /**
     * Delete is `0x99`, which is -103 in a signed Kotlin byte.
     *
     * Written as a hex literal cast rather than as a decimal, because `BleSDK` also carries
     * a `DATA_DELETE = 99` constant — decimal 99, `0x63` — that is *not* this value. Every
     * vendor demo passes `(byte) 0x99`, and taking the named constant instead sends `0x63`,
     * which is not a delete and not an error either: the bracelet ignores it, the space is
     * never freed, and the ring buffer quietly starts overwriting unread history.
     */
    private val MODE_DELETE: Byte = 0x99.toByte()

    private fun modeByte(mode: String?): Byte = when (mode) {
        "next" -> MODE_CONTINUE
        "delete" -> MODE_DELETE
        // `start` is the default: a read that does not say where it is, is beginning.
        else -> MODE_START
    }

    /**
     * Commands each variant can encode.
     *
     * Not cosmetic — the two SDKs genuinely differ, and so do the two platforms:
     *
     * 1. **Axillary temperature is 2208A-only**, here and on iOS.
     * 2. **The V8 reads a manual SpO2 history on iOS and not here.** `BleSDK_V8.h` declares
     *    `GetManualSpo2DataWithMode`; this jar exposes only `Oxygen_data`, the automatic
     *    history. Same bracelet, two SDKs written a year apart. `ios/JstyleCodec.swift`
     *    therefore lists a command this file does not, on purpose — discarding readings an
     *    iPhone can collect, so that two tables match, would be the wrong way round.
     *
     * A caller that assumed one shape would send a command the other device answers with
     * something else entirely, and the reply would be decoded under whichever flag was last
     * set — a wrong row rather than an error, which is why this is a table and not a
     * convention.
     */
    val CAPABILITIES: Map<String, List<String>> = mapOf(
        "j2208a" to listOf(
            "getDeviceTime", "setDeviceTime", "getPersonalInfo", "setPersonalInfo",
            "getBattery", "getVersion", "getMacAddress", "getDeviceName",
            "getTotalActivity", "getDetailActivity", "getDetailSleep",
            "getStaticHr", "getDynamicHr", "getHrv",
            "getAutoSpo2", "getManualSpo2",
            "getTemperature", "getAxillaryTemperature",
            "ppg",
        ),
        "v8" to listOf(
            "getDeviceTime", "setDeviceTime", "getPersonalInfo", "setPersonalInfo",
            "getBattery", "getVersion", "getMacAddress", "getDeviceName",
            "getTotalActivity", "getDetailActivity", "getDetailSleep",
            "getStaticHr", "getDynamicHr", "getHrv",
            // No `getManualSpo2`: `Oxygen_data` returns both histories together.
            "getAutoSpo2",
            // No `getAxillaryTemperature`: the V8 SDK has no such command.
            "getTemperature",
            "ppg",
        ),
    )

    fun build(variant: String, command: String, args: Map<String, Any?>): ByteArray {
        val supported = CAPABILITIES[variant]
            ?: throw IllegalArgumentException("Unknown bracelet variant '$variant'.")
        if (!supported.contains(command)) {
            throw IllegalArgumentException(
                "The $variant bracelet has no '$command' command. Check `supports()` first.",
            )
        }

        val mode = modeByte(args["mode"] as? String)
        // The vendor takes a date string and every demo passes "", meaning "wherever you
        // are". A resume point is the bracelet's own bookmark, not ours.
        val date = (args["startDate"] as? String) ?: ""

        return if (variant == "j2208a") build2208A(command, mode, date, args)
        else buildV8(command, mode, date, args)
    }

    private fun build2208A(cmd: String, mode: Byte, date: String, args: Map<String, Any?>) =
        when (cmd) {
            "getDeviceTime" -> Sdk2208A.GetDeviceTime()
            "setDeviceTime" -> Sdk2208A.SetDeviceTime(deviceTime2208A())
            "getPersonalInfo" -> Sdk2208A.GetPersonalInfo()
            "setPersonalInfo" -> Sdk2208A.SetPersonalInfo(personalInfo2208A(args))
            "getBattery" -> Sdk2208A.GetDeviceBatteryLevel()
            "getVersion" -> Sdk2208A.GetDeviceVersion()
            "getMacAddress" -> Sdk2208A.GetDeviceMacAddress()
            "getDeviceName" -> Sdk2208A.GetDeviceName()
            "getTotalActivity" -> Sdk2208A.GetTotalActivityDataWithMode(mode, date)
            "getDetailActivity" -> Sdk2208A.GetDetailActivityDataWithMode(mode, date)
            "getDetailSleep" -> Sdk2208A.GetDetailSleepDataWithMode(mode, date)
            "getStaticHr" -> Sdk2208A.GetStaticHRWithMode(mode, date)
            "getDynamicHr" -> Sdk2208A.GetDynamicHRWithMode(mode, date)
            "getHrv" -> Sdk2208A.GetHRVDataWithMode(mode, date)
            "getAutoSpo2" -> Sdk2208A.GetBloodOxygen(mode, date)
            "getManualSpo2" -> Sdk2208A.Obtain_The_data_of_manual_blood_oxygen_test(mode)
            "getTemperature" -> Sdk2208A.GetTemperature_historyDataWithMode(mode, date)
            "getAxillaryTemperature" -> Sdk2208A.GetAxillaryTemperatureDataWithMode(mode, date)
            "ppg" -> Sdk2208A.OpenECGPPG(intArg(args, "ppgMode", 1), intArg(args, "ppgStatus", 0))
            else -> throw IllegalArgumentException("Unhandled command '$cmd'.")
        }

    private fun buildV8(cmd: String, mode: Byte, date: String, args: Map<String, Any?>) =
        when (cmd) {
            "getDeviceTime" -> SdkV8.GetDeviceTime()
            "setDeviceTime" -> SdkV8.SetDeviceTime(deviceTimeV8())
            "getPersonalInfo" -> SdkV8.GetPersonalInfo()
            "setPersonalInfo" -> SdkV8.SetPersonalInfo(personalInfoV8(args))
            "getBattery" -> SdkV8.GetDeviceBatteryLevel()
            "getVersion" -> SdkV8.GetDeviceVersion()
            "getMacAddress" -> SdkV8.GetDeviceMacAddress()
            "getDeviceName" -> SdkV8.GetDeviceName()
            "getTotalActivity" -> SdkV8.GetTotalActivityDataWithMode(mode, date)
            "getDetailActivity" -> SdkV8.GetDetailActivityDataWithMode(mode, date)
            "getDetailSleep" -> SdkV8.GetDetailSleepDataWithMode(mode, date)
            "getStaticHr" -> SdkV8.GetStaticHRWithMode(mode, date)
            "getDynamicHr" -> SdkV8.GetDynamicHRWithMode(mode, date)
            "getHrv" -> SdkV8.GetHRVDataWithMode(mode, date)
            "getAutoSpo2" -> SdkV8.Oxygen_data(mode, date)
            "getTemperature" -> SdkV8.GetTemperature_historyData(mode, date)
            "ppg" -> SdkV8.ppgWithMode(intArg(args, "ppgMode", 1), intArg(args, "ppgStatus", 0))
            else -> throw IllegalArgumentException("Unhandled command '$cmd'.")
        }

    /**
     * Decode one notification.
     *
     * The vendor parser is push-shaped — it calls a listener rather than returning — but a
     * single notification produces at most one dictionary, so the listener is collapsed
     * back into a return value here. Callers get a value to inspect instead of a callback
     * to thread through the bridge.
     */
    fun parse(variant: String, bytes: ByteArray): Map<String, Any?> {
        var captured: Map<String, Any?>? = null

        if (variant == "j2208a") {
            Sdk2208A.DataParsingWithData(bytes, object : DataListener2025 {
                override fun dataCallback(map: MutableMap<String, Any>?) {
                    if (map != null) captured = HashMap(map)
                }
                override fun dataCallback(raw: ByteArray?) { /* echo of the frame */ }
            })
        } else {
            SdkV8.DataParsingWithData(bytes, object : DataListener2301 {
                override fun dataCallback(map: MutableMap<String, Any>?) {
                    if (map != null) captured = HashMap(map)
                }
                override fun dataCallback(raw: ByteArray?) { /* echo of the frame */ }
            })
        }

        return captured ?: emptyMap()
    }

    /**
     * Clear the parser's static decode flags.
     *
     * `BleSDK` remembers what it is in the middle of decoding in `protected static boolean`
     * fields — `GetTotalActivityDataWithMode`, `Delete_GetDetailSleepData` and a dozen
     * siblings — which is how a multi-packet history read knows what its next packet means.
     * A connection that drops mid-read leaves them set, and the first packet of the next
     * connection is then decoded as the tail of a read that is no longer happening.
     *
     * The vendor exposes no reset, so this walks the declared fields reflectively. That is
     * a deliberate trade: the alternative is a codec whose state survives a disconnect, and
     * the symptom of that is a battery reply stored as a sleep record — a wrong row rather
     * than an error. Reflection failing is survivable and is swallowed; a stuck flag is not.
     */
    fun reset(variant: String) {
        val cls = if (variant == "j2208a") Sdk2208A::class.java else SdkV8::class.java
        cls.declaredFields.forEach { field ->
            if (field.type == java.lang.Boolean.TYPE && java.lang.reflect.Modifier.isStatic(field.modifiers)) {
                try {
                    field.isAccessible = true
                    field.setBoolean(null, false)
                } catch (_: Throwable) { /* a locked-down field is not worth a failed sync */ }
            }
        }
    }

    // ── argument helpers ────────────────────────────────────────────────────

    private fun intArg(args: Map<String, Any?>, key: String, fallback: Int): Int =
        (args[key] as? Number)?.toInt() ?: fallback

    private fun deviceTime2208A() = com.jstyle.blesdk2208a.model.MyDeviceTime().apply {
        val now = java.util.Calendar.getInstance()
        year = now.get(java.util.Calendar.YEAR)
        month = now.get(java.util.Calendar.MONTH) + 1
        day = now.get(java.util.Calendar.DAY_OF_MONTH)
        hour = now.get(java.util.Calendar.HOUR_OF_DAY)
        minute = now.get(java.util.Calendar.MINUTE)
        second = now.get(java.util.Calendar.SECOND)
    }

    private fun deviceTimeV8() = com.jstyle.blesdkv8.model.MyDeviceTime().apply {
        val now = java.util.Calendar.getInstance()
        year = now.get(java.util.Calendar.YEAR)
        month = now.get(java.util.Calendar.MONTH) + 1
        day = now.get(java.util.Calendar.DAY_OF_MONTH)
        hour = now.get(java.util.Calendar.HOUR_OF_DAY)
        minute = now.get(java.util.Calendar.MINUTE)
        second = now.get(java.util.Calendar.SECOND)
    }

    /**
     * Stride defaults to 41% of height when the caller has none.
     *
     * The bracelet turns steps into distance on-device using this number, so leaving it at
     * the vendor default means every distance it reports is wrong for anyone who is not an
     * average adult — and wrong in a way that reads as a bad pedometer rather than an unset
     * field. 41% is the usual walking-stride approximation.
     */
    private fun strideFor(args: Map<String, Any?>, heightCm: Int): Int =
        (args["strideCm"] as? Number)?.toInt() ?: (heightCm * 41 / 100)

    private fun personalInfo2208A(args: Map<String, Any?>): PersonalInfo2208A {
        val info = args["personalInfo"] as? Map<*, *> ?: emptyMap<String, Any>()
        val height = (info["heightCm"] as? Number)?.toInt() ?: 170
        return PersonalInfo2208A().apply {
            setHeight(height)
            setWeight((info["weightKg"] as? Number)?.toInt() ?: 70)
            setAge((info["ageYears"] as? Number)?.toInt() ?: 30)
            setSex(if (info["gender"] == "female") 0 else 1) // vendor: 1 male, 0 female
            setStepLength(strideFor(info as Map<String, Any?>, height))
        }
    }

    private fun personalInfoV8(args: Map<String, Any?>): PersonalInfoV8 {
        val info = args["personalInfo"] as? Map<*, *> ?: emptyMap<String, Any>()
        val height = (info["heightCm"] as? Number)?.toInt() ?: 170
        return PersonalInfoV8().apply {
            setHeight(height)
            setWeight((info["weightKg"] as? Number)?.toInt() ?: 70)
            setAge((info["ageYears"] as? Number)?.toInt() ?: 30)
            setSex(if (info["gender"] == "female") 0 else 1) // vendor: 1 male, 0 female
            setStepLength(strideFor(info as Map<String, Any?>, height))
        }
    }

    fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    fun decode(base64: String): ByteArray = Base64.decode(base64, Base64.NO_WRAP)
}
