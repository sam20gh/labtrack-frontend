/**
 * Authentication for LabTrack.
 *
 * Two token families exist during the Supabase migration:
 *   1. Supabase access tokens — the target state, auto-refreshed by supabase-js
 *   2. Legacy tokens issued by the LabTrack API and stored in AsyncStorage under
 *      'authToken' — kept working so existing installs are not signed out by an update
 *
 * `getAccessToken()` is the single place that decides which to use. Every API call goes
 * through `apiFetch` in lib/api.ts, so no screen needs to know which family is in play.
 *
 * After any successful Supabase sign-in the client MUST call `syncAccount()`: Supabase
 * owns the credential, but medical records hang off a LabTrack `User` document, and
 * `POST /api/auth/supabase/sync` is the only thing that creates or links it. Until it
 * runs, the API answers 403 for that token by design.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/constants/supabase';
import { API_URL } from '@/constants/config';

/** AsyncStorage keys shared across the app. */
export const STORAGE_KEYS = {
    userId: 'userId',
    /** Legacy LabTrack-issued JWT. Absent for Supabase-only accounts. */
    legacyToken: 'authToken',
    keepSignedIn: 'keepSignedIn',
    hasSeenOnboarding: 'hasSeenOnboarding',
} as const;

/**
 * Current bearer token: a fresh Supabase access token when signed in through Supabase,
 * otherwise the legacy token. supabase-js refreshes expiring tokens on read, so this is
 * always safe to call immediately before a request.
 */
export const getAccessToken = async (): Promise<string | null> => {
    try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) return data.session.access_token;
    } catch {
        // Fall through to the legacy token
    }
    return AsyncStorage.getItem(STORAGE_KEYS.legacyToken);
};

/** The signed-in LabTrack user id, or null. */
export const getUserId = async (): Promise<string | null> =>
    AsyncStorage.getItem(STORAGE_KEYS.userId);

export const isSignedIn = async (): Promise<boolean> => {
    const [token, userId] = await Promise.all([getAccessToken(), getUserId()]);
    return Boolean(token && userId);
};

/**
 * Create or link the LabTrack account behind the current Supabase identity and cache its
 * id. Idempotent — safe to call after every sign-in.
 */
export const syncAccount = async (): Promise<{ ok: boolean; userId?: string; error?: string }> => {
    const token = await getAccessToken();
    if (!token) return { ok: false, error: 'Not signed in' };

    try {
        const res = await fetch(`${API_URL}/auth/supabase/sync`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.message || 'Could not sync your account' };

        const userId = data?.user?._id;
        if (userId) await AsyncStorage.setItem(STORAGE_KEYS.userId, String(userId));
        return { ok: true, userId };
    } catch {
        return { ok: false, error: 'Network error. Please try again.' };
    }
};

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });

    if (error) {
        // Supabase reports unconfirmed accounts through this code
        if (error.code === 'email_not_confirmed') {
            return { ok: false as const, needsConfirmation: true, error: 'Please confirm your email address first.' };
        }
        return { ok: false as const, error: error.message };
    }
    if (!data.session) return { ok: false as const, error: 'Sign in failed' };

    const synced = await syncAccount();
    if (!synced.ok) return { ok: false as const, error: synced.error };
    return { ok: true as const, userId: synced.userId };
};

/**
 * Email sign-up.
 *
 * This project has email confirmation enabled (`mailer_autoconfirm: false`), so Supabase
 * returns a user but NO session — the account cannot be used until the emailed link is
 * clicked. Callers must show a "check your email" state rather than navigating into the
 * app. `needsConfirmation` says exactly that.
 */
export const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: Linking.createURL('/auth/callback') },
    });

    if (error) return { ok: false as const, error: error.message };

    if (!data.session) {
        // Expected path with confirmation enabled
        return { ok: true as const, needsConfirmation: true };
    }

    // Only reached if confirmation is later disabled in the Supabase dashboard
    const synced = await syncAccount();
    if (!synced.ok) return { ok: false as const, error: synced.error };
    return { ok: true as const, needsConfirmation: false, userId: synced.userId };
};

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

/**
 * Google sign-in via the system browser, returning through the `labtrack://` deep link
 * declared in app.json. Requires the same redirect URL to be listed in the Supabase
 * dashboard under Authentication → URL Configuration.
 */
export const signInWithGoogle = async () => {
    const redirectTo = Linking.createURL('/auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { ok: false as const, error: error.message };
    if (!data?.url) return { ok: false as const, error: 'Could not start Google sign in' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
        return { ok: false as const, cancelled: true, error: 'Google sign in was cancelled' };
    }

    // PKCE: the callback carries a code we exchange for a session
    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (!code) {
        const err = url.searchParams.get('error_description') || 'No authorization code returned';
        return { ok: false as const, error: err };
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { ok: false as const, error: exchangeError.message };

    const synced = await syncAccount();
    if (!synced.ok) return { ok: false as const, error: synced.error };
    return { ok: true as const, userId: synced.userId };
};

// ---------------------------------------------------------------------------
// Phone / SMS OTP
//
// Enable Authentication → Phone in the Supabase dashboard for these to work. Until then
// Supabase answers with a "provider is not enabled" error, which the screens surface
// as-is rather than failing silently.
// ---------------------------------------------------------------------------

/** Normalise to E.164, which Supabase requires (e.g. +971501234567). */
export const normalisePhone = (phone: string): string => {
    const trimmed = phone.replace(/[\s()-]/g, '');
    if (trimmed.startsWith('+')) return trimmed;
    if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`;
    return `+${trimmed}`;
};

export const sendPhoneOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone: normalisePhone(phone) });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
};

export const verifyPhoneOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
        phone: normalisePhone(phone),
        token,
        type: 'sms',
    });
    if (error) return { ok: false as const, error: error.message };
    if (!data.session) return { ok: false as const, error: 'Verification failed' };

    const synced = await syncAccount();
    if (!synced.ok) return { ok: false as const, error: synced.error };
    return { ok: true as const, userId: synced.userId };
};

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Always resolves ok — the caller must not reveal whether an address is registered.
 * Errors are logged, not surfaced.
 */
export const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: Linking.createURL('/auth/reset'),
    });
    if (error) console.warn('Password reset request failed:', error.message);
    return { ok: true as const };
};

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export const signOut = async () => {
    try {
        await supabase.auth.signOut();
    } catch {
        // Clearing local state below matters more than a clean server sign-out
    }
    await AsyncStorage.multiRemove([
        STORAGE_KEYS.userId,
        STORAGE_KEYS.legacyToken,
        STORAGE_KEYS.keepSignedIn,
    ]);
};
