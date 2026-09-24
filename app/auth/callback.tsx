/**
 * Deep-link landing for `labtrack://auth/callback`.
 *
 * Reached when the user taps the email-confirmation link Supabase sends after sign-up.
 * (The Google OAuth flow does NOT land here — `WebBrowser.openAuthSessionAsync` intercepts
 * that redirect and returns the URL to `signInWithGoogle` directly.)
 *
 * Supabase appends a PKCE `code`, which is exchanged for a session; the Predyqt account
 * is then created or linked before the app is entered.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/constants/supabase';
import { syncAccount } from '@/lib/auth';
import { makeStyles, usePalette } from '@/hooks/useTheme';

export default function AuthCallback() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const complete = async () => {
            const code = typeof params.code === 'string' ? params.code : null;
            const errorDescription =
                typeof params.error_description === 'string' ? params.error_description : null;

            if (errorDescription) {
                setError(errorDescription);
                return;
            }

            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (exchangeError) {
                    setError(exchangeError.message);
                    return;
                }
            }

            // No code can still mean a valid session (already-confirmed link re-opened)
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                setError('This link has expired or was already used. Please sign in.');
                return;
            }

            const synced = await syncAccount();
            if (!synced.ok) {
                setError(synced.error || 'Could not finish setting up your account');
                return;
            }

            router.replace('/(tabs)');
        };

        complete();
    }, []);

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={Palette.danger} />
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.body}>{error}</Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => router.replace('/(auth)/loginscreen')}
                    >
                        <Text style={styles.buttonText}>Go to Sign In</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Palette.primary} />
                <Text style={styles.body}>Confirming your account…</Text>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    title: { fontSize: 20, fontWeight: '700', color: Palette.text, marginTop: 16, marginBottom: 8 },
    body: { fontSize: 15, color: Palette.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 },
    button: {
        backgroundColor: Palette.primaryFill, paddingVertical: 14, paddingHorizontal: 40,
        borderRadius: 12, marginTop: 28,
    },
    buttonText: { color: Palette.white, fontSize: 16, fontWeight: '600' },
}));
