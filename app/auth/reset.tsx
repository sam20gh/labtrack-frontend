/**
 * Deep-link landing for `labtrack://auth/reset`.
 *
 * Reached from the password-reset email. Supabase's link carries a PKCE `code`; exchanging
 * it yields a short-lived session that authorises exactly one thing — setting a new
 * password via `updateUser`.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '@/constants/supabase';

export default function ResetPassword() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const establishSession = async () => {
            const code = typeof params.code === 'string' ? params.code : null;

            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (exchangeError) {
                    setError('This reset link has expired. Please request a new one.');
                    return;
                }
            }

            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                setError('This reset link has expired. Please request a new one.');
                return;
            }
            setReady(true);
        };

        establishSession();
    }, []);

    const handleSave = async () => {
        if (password.length < 8) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Password must be at least 8 characters' });
            return;
        }
        if (password !== confirm) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match' });
            return;
        }

        setSaving(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setSaving(false);

        if (updateError) {
            Toast.show({ type: 'error', text1: 'Error', text2: updateError.message });
            return;
        }

        Toast.show({ type: 'success', text1: 'Password updated', text2: 'Please sign in with your new password' });
        await supabase.auth.signOut();
        router.replace('/(auth)/loginscreen');
    };

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Ionicons name="time-outline" size={48} color="#DC2626" />
                    <Text style={styles.title}>Link expired</Text>
                    <Text style={styles.body}>{error}</Text>
                    <TouchableOpacity style={styles.button} onPress={() => router.replace('/forgot-password')}>
                        <Text style={styles.buttonText}>Request a new link</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!ready) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                    <Text style={styles.body}>Verifying your link…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <View style={styles.content}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="lock-closed-outline" size={32} color="#7C3AED" />
                    </View>
                    <Text style={styles.title}>Set a new password</Text>
                    <Text style={styles.body}>Choose a password you haven't used before.</Text>

                    <View style={styles.inputRow}>
                        <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.input}
                            placeholder="New password"
                            placeholderTextColor="#9CA3AF"
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputRow}>
                        <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm new password"
                            placeholderTextColor="#9CA3AF"
                            secureTextEntry={!showPassword}
                            value={confirm}
                            onChangeText={setConfirm}
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, styles.fullWidth, saving && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.buttonText}>Update password</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    iconCircle: {
        width: 64, height: 64, borderRadius: 16, backgroundColor: '#F3E8FF',
        alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
    body: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 28 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
    },
    input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1F2937' },
    button: {
        backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 40,
        borderRadius: 12, alignItems: 'center', marginTop: 12,
    },
    fullWidth: { width: '100%' },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
