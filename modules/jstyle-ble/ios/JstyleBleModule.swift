import ExpoModulesCore
import JStyleVendor

/**
 * The bracelet codec, exposed to JavaScript.
 *
 * Mirrors `android/.../JstyleBleModule.kt` function for function, and the two are expected
 * to stay in step by hand — they wrap two different vendor SDKs with two different packet
 * numberings behind one vocabulary, so there is nothing that can generate one from the
 * other.
 *
 * Both vendor SDKs are singletons (`sharedManager`), so there is no instance to own here.
 * The radio belongs to `lib/health/jstyle/transport.ts`; this file speaks no Bluetooth.
 */
public final class JstyleBleModule: Module {
    public func definition() -> ModuleDefinition {
        Name("JstyleBleModule")

        Function("buildCommand") { (variant: String, command: String, args: [String: Any]) -> String in
            let data = try JstyleCodec.build(variant: variant, command: command, args: args)
            return data.base64EncodedString()
        }

        Function("parsePacket") { (variant: String, base64: String) -> [String: Any] in
            guard let data = Data(base64Encoded: base64) else {
                return ["type": "unknown", "rawType": -1, "end": false, "data": [:]]
            }
            return JstyleCodec.parse(variant: variant, data: data)
        }

        Function("capabilities") { (variant: String) -> [String: Any] in
            ["commands": JstyleCodec.capabilities(variant: variant)]
        }

        Function("resetCodec") { (variant: String) in
            JstyleCodec.reset(variant: variant)
        }
    }
}
