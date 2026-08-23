/**
 * WebCrypto shim for React Native.
 *
 * Hermes provides no `crypto` global, and supabase-js needs one for the PKCE flow it uses
 * to sign in. Without this shim it degrades silently rather than failing:
 *
 *   - `generatePKCEVerifier()` sees `typeof crypto === 'undefined'` and falls back to
 *     `Math.random()` — not a CSPRNG, so the verifier becomes predictable.
 *   - `generatePKCEChallenge()` sees no `crypto.subtle`, logs a console warning, and drops
 *     the challenge method from S256 to **plain**, which sends the verifier in the clear
 *     on the authorize request.
 *
 * Both weaken the protection PKCE exists to give. `expo-crypto` is a native module backed
 * by the platform CSPRNG and SHA implementations, so this shim restores real S256 PKCE.
 *
 * Import this once, before anything touches `supabase` — see `constants/supabase.ts`.
 */
import * as ExpoCrypto from 'expo-crypto';

type SubtleLike = { digest(algorithm: any, data: BufferSource): Promise<ArrayBuffer> };

const toAlgorithmName = (algorithm: any): string =>
    (typeof algorithm === 'string' ? algorithm : algorithm?.name ?? '').toUpperCase();

const DIGEST_ALGORITHMS: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
    'SHA-1': ExpoCrypto.CryptoDigestAlgorithm.SHA1,
    'SHA-256': ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    'SHA-384': ExpoCrypto.CryptoDigestAlgorithm.SHA384,
    'SHA-512': ExpoCrypto.CryptoDigestAlgorithm.SHA512,
};

const subtle: SubtleLike = {
    async digest(algorithm, data) {
        const name = toAlgorithmName(algorithm);
        const mapped = DIGEST_ALGORITHMS[name];
        if (!mapped) throw new Error(`Unsupported digest algorithm: ${name}`);
        return ExpoCrypto.digest(mapped, data);
    },
};

const globalScope = globalThis as any;

if (!globalScope.crypto) globalScope.crypto = {};

if (typeof globalScope.crypto.getRandomValues !== 'function') {
    globalScope.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}

if (!globalScope.crypto.subtle) {
    globalScope.crypto.subtle = subtle;
}

if (typeof globalScope.crypto.randomUUID !== 'function') {
    globalScope.crypto.randomUUID = ExpoCrypto.randomUUID;
}

export {};
