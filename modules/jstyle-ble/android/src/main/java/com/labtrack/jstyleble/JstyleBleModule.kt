package com.labtrack.jstyleble

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bracelet codec, exposed to JavaScript.
 *
 * Three synchronous functions and no state of its own. Everything with a lifecycle — the
 * radio, the connection, the retry policy, the queue — lives in
 * `lib/health/jstyle/transport.ts`, so there is nothing here to start, stop or leak.
 *
 * Synchronous on purpose. Each call is a few hundred bytes of arithmetic, and a history
 * read is a conversation of dozens of packets: making every one of them a promise would put
 * a microtask between a notification arriving and being decoded, for no gain, in the one
 * path where ordering is the thing that matters.
 */
class JstyleBleModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("JstyleBleModule")

        Function("buildCommand") { variant: String, command: String, args: Map<String, Any?> ->
            Codec.encode(Codec.build(variant, command, args))
        }

        Function("parsePacket") { variant: String, base64: String ->
            val decoded = Codec.parse(variant, Codec.decode(base64))
            JsPacket.from(decoded)
        }

        Function("capabilities") { variant: String ->
            mapOf("commands" to (Codec.CAPABILITIES[variant] ?: emptyList<String>()))
        }

        Function("resetCodec") { variant: String ->
            Codec.reset(variant)
        }
    }
}

/**
 * The vendor's dictionary, made safe to send across the bridge.
 *
 * Two jobs. It lifts the SDK's framing keys onto the packet, so a caller reads `end` rather
 * than knowing the vendor spells it `dataEnd` and returns it as the string `"true"` about
 * as often as a boolean. And it walks the rest, because the parser hands back nested maps,
 * `ArrayList`s, boxed numbers and raw `byte[]` — and a `byte[]` that reached the bridge
 * unconverted would arrive as an object of numbered keys, which is how an ECG waveform
 * turns into a 2,000-property object.
 */
internal object JsPacket {
    fun from(raw: Map<String, Any?>): Map<String, Any?> {
        val code = raw[PacketTypes.KEY_TYPE]?.toString()
        val name = code?.let { PacketTypes.BY_CODE[it] } ?: "unknown"

        // The vendor nests the payload under `dicData` for some types and flattens it for
        // others. Preferring the nested one and falling back to the whole map keeps both
        // shapes readable without the caller knowing which it got.
        @Suppress("UNCHECKED_CAST")
        val payload = (raw[PacketTypes.KEY_DATA] as? Map<String, Any?>)
            ?: raw.filterKeys { it != PacketTypes.KEY_TYPE && it != PacketTypes.KEY_END }

        return mapOf(
            "type" to name,
            // Kept so an `unknown` is reportable rather than merely unhandled. A bracelet
            // on newer firmware is a support question, and "type 131" is the answer to it.
            "rawType" to (code?.toIntOrNull() ?: -1),
            "end" to truthy(raw[PacketTypes.KEY_END]),
            "data" to (convert(payload) as? Map<*, *> ?: emptyMap<String, Any?>()),
        )
    }

    /**
     * The end flag arrives as a Boolean, as `"true"`, and as 1, depending on the packet.
     *
     * Reading only one of those spellings is how a history read never terminates: the flag
     * is set, the reader does not see it, and the sync waits out its timeout on a
     * conversation that finished.
     */
    private fun truthy(value: Any?): Boolean = when (value) {
        is Boolean -> value
        is Number -> value.toInt() != 0
        is String -> value.equals("true", true) || value == "1"
        else -> false
    }

    private fun convert(value: Any?): Any? = when (value) {
        null -> null
        is String, is Boolean -> value
        is Int, is Long, is Short, is Byte -> (value as Number).toInt()
        is Float, is Double -> (value as Number).toDouble()
        is ByteArray -> value.map { it.toInt() and 0xFF }
        is IntArray -> value.toList()
        is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to convert(v) }
        is Iterable<*> -> value.map { convert(it) }
        // A vendor model object with no converter of its own. `toString()` beats dropping
        // it: the value is still legible in a log when something needs explaining.
        else -> value.toString()
    }
}
