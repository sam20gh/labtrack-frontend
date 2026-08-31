/**
 * Sign in. Drawn from the "Authentication" frames in `Design/auth.png`.
 *
 * Everything a person can do here goes through `lib/auth` — the screen never touches
 * Supabase, a token, or `fetch`. `signInWithEmail` and `signInWithGoogle` both call
 * `syncAccount()` on success, which is the only thing that creates the LabTrack `User` the
 * API needs, so there is nothing to do here after they return `ok`.
 */
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AuthErrorBanner from '@/components/auth/AuthErrorBanner';
import AuthField from '@/components/auth/AuthField';
import AuthHeader from '@/components/auth/AuthHeader';
import GoogleMark from '@/components/auth/GoogleMark';
import { authStyles } from '@/components/auth/styles';
import { Fonts, Palette, Radius } from '@/constants/theme';
import { signInWithEmail, signInWithGoogle, STORAGE_KEYS } from '@/lib/auth';

const LoginScreen = () => {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [keepSignedIn, setKeepSignedIn] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (name: 'email' | 'password', value: string) => {
        setForm({ ...form, [name]: value });
        setError('');
    };

    const handleLogin = async () => {
        if (!form.email || !form.password) {
            setError('Please enter your email and password');
            return;
        }

        setLoading(true);
        setError('');

        const result = await signInWithEmail(form.email, form.password);
        setLoading(false);

        if (!result.ok) {
            setError(result.error || 'Incorrect email or password!');
            return;
        }

        if (keepSignedIn) {
            await AsyncStorage.setItem(STORAGE_KEYS.keepSignedIn, 'true');
        }

        router.replace('/(tabs)');
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');

        const result = await signInWithGoogle();
        setLoading(false);

        if (!result.ok) {
            // A cancelled browser session is a user choice, not an error worth shouting about
            if (!('cancelled' in result && result.cancelled)) {
                setError(result.error || 'Google sign in failed');
            }
            return;
        }

        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={authStyles.screen} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={authStyles.flex}
            >
                <ScrollView
                    contentContainerStyle={authStyles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {error ? (
                        <View style={styles.bannerSlot}>
                            <AuthErrorBanner message={error} onDismiss={() => setError('')} />
                        </View>
                    ) : null}

                    <AuthHeader tagline="Sign in to access all-in-one intelligent health" />

                    <View style={styles.form}>
                        <AuthField
                            label="Email Address"
                            icon="mail-outline"
                            placeholder="Enter your email address..."
                            value={form.email}
                            onChangeText={(text) => handleChange('email', text)}
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            returnKeyType="next"
                        />

                        <AuthField
                            label="Password"
                            icon="lock-closed-outline"
                            placeholder="••••••••••••••"
                            value={form.password}
                            onChangeText={(text) => handleChange('password', text)}
                            autoCapitalize="none"
                            autoComplete="current-password"
                            secureTextEntry={!showPassword}
                            returnKeyType="go"
                            onSubmitEditing={handleLogin}
                            accessory={
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    hitSlop={10}
                                    accessibilityRole="button"
                                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={20}
                                        color={Palette.textSecondary}
                                    />
                                </TouchableOpacity>
                            }
                        />

                        <View style={styles.optionsRow}>
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setKeepSignedIn(!keepSignedIn)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: keepSignedIn }}
                                accessibilityLabel="Keep me signed in"
                            >
                                <View style={[styles.checkbox, keepSignedIn && styles.checkboxOn]}>
                                    {keepSignedIn ? (
                                        <Ionicons name="checkmark" size={13} color={Palette.white} />
                                    ) : null}
                                </View>
                                <Text style={styles.checkboxLabel}>Keep me signed in</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/forgot-password')} hitSlop={8}>
                                <Text style={styles.forgotPassword}>Forgot Password</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[authStyles.primaryButton, loading && styles.buttonBusy]}
                            onPress={handleLogin}
                            disabled={loading}
                            accessibilityRole="button"
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={Palette.white} />
                            ) : (
                                <>
                                    <Text style={authStyles.primaryButtonText}>Sign In</Text>
                                    <Ionicons name="log-in-outline" size={20} color={Palette.white} />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={authStyles.divider}>
                            <View style={authStyles.dividerLine} />
                            <Text style={authStyles.dividerText}>OR</Text>
                            <View style={authStyles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleSignIn}
                            disabled={loading}
                            accessibilityRole="button"
                        >
                            <GoogleMark size={20} />
                            <Text style={styles.googleButtonText}>Sign In With Google</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={authStyles.footer}>
                        <Text style={authStyles.footerText}>Don&apos;t have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/signup')} hitSlop={8}>
                            <Text style={authStyles.footerLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <Toast />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    bannerSlot: {
        marginBottom: 16,
    },
    form: {
        marginTop: 44,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 28,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    /**
     * Round, not square. The kit draws this one as a filled disc — the only checkbox in the
     * app that is not a rounded rectangle, and the reason it is styled here rather than
     * pulled from a shared control.
     */
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: Palette.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxOn: {
        backgroundColor: Palette.primary,
        borderColor: Palette.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.text,
    },
    forgotPassword: {
        fontSize: 14,
        fontFamily: Fonts.bold,
        color: Palette.primary,
        textDecorationLine: 'underline',
    },
    buttonBusy: {
        backgroundColor: Palette.primaryDark,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: 48,
        borderRadius: Radius.sm,
        backgroundColor: Palette.black,
    },
    googleButtonText: {
        fontSize: 16,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },
});

export default LoginScreen;
