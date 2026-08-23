/**
 * Supabase client.
 *
 * Supabase owns credentials (email/password, Google, and — once enabled — phone OTP).
 * The LabTrack API owns medical data and trusts Supabase access tokens, verifying them
 * against the project's public JWKS. See `labtrack-backend/config/supabase.js`.
 *
 * The publishable key below is *designed* to be shipped inside clients — it grants only
 * what your Row Level Security and auth rules allow, and it is embedded in every app
 * binary regardless. It is not the secret key, which must never reach this repo.
 */
import 'react-native-url-polyfill/auto';
// Must precede createClient: supabase-js reads `crypto` when building the PKCE challenge,
// and silently downgrades to Math.random + a plain challenge when it is missing.
import '@/lib/crypto-polyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://boztcjlylvzhahwvqejn.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
    process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable__OB9677gMFFE0Z7RTAtaaQ_Wqx7Djnl';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        // Sessions live in AsyncStorage so they survive app restarts
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native has no URL bar to parse tokens out of; the OAuth callback is
        // handled explicitly in lib/auth.ts instead.
        detectSessionInUrl: false,
        flowType: 'pkce',
    },
});
