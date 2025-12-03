import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const LoginScreen = () => {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [keepSignedIn, setKeepSignedIn] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (name: string, value: string) => {
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

        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: form.email, password: form.password }),
            });

            const data = await response.json();
            setLoading(false);

            if (response.ok) {
                if (!data.user || !data.user._id || !data.token) {
                    setError('Authentication failed');
                    return;
                }

                await AsyncStorage.setItem('userId', data.user._id);
                await AsyncStorage.setItem('authToken', data.token);
                if (keepSignedIn) {
                    await AsyncStorage.setItem('keepSignedIn', 'true');
                }

                router.replace('(tabs)/ProfileScreen');
            } else {
                setError(data.message || 'Incorrect email or password!');
            }
        } catch (error) {
            setLoading(false);
            setError('Failed to connect to the server');
        }
    };

    const handleGoogleSignIn = () => {
        Toast.show({ type: 'info', text1: 'Coming Soon', text2: 'Google Sign In will be available soon' });
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoIcon}>
                            <Ionicons name="add" size={32} color="#7C3AED" />
                        </View>
                        <Text style={styles.logoText}>LabTrack</Text>
                    </View>

                    {/* Tagline */}
                    <Text style={styles.tagline}>Sign in to access all-in-one intelligent health.</Text>

                    {/* Error Banner */}
                    {error ? (
                        <View style={styles.errorBanner}>
                            <Ionicons name="warning" size={18} color="#DC2626" />
                            <Text style={styles.errorText}>ERROR: {error}</Text>
                            <TouchableOpacity onPress={() => setError('')} style={styles.errorClose}>
                                <Ionicons name="close" size={18} color="#DC2626" />
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* Email Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder="Enter your email address..."
                                placeholderTextColor="#9CA3AF"
                                value={form.email}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onChangeText={(text) => handleChange('email', text)}
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                placeholder="••••••••••••••"
                                placeholderTextColor="#9CA3AF"
                                value={form.password}
                                autoCapitalize="none"
                                secureTextEntry={!showPassword}
                                onChangeText={(text) => handleChange('password', text)}
                                style={[styles.input, styles.passwordInput]}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Keep signed in & Forgot Password */}
                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setKeepSignedIn(!keepSignedIn)}
                        >
                            <View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>
                                {keepSignedIn && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={styles.checkboxLabel}>Keep me signed in</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                            <Text style={styles.forgotPassword}>Forgot Password</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sign In Button */}
                    <TouchableOpacity
                        style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.signInButtonText}>Sign In</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Google Sign In */}
                    <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
                        <Image
                            source={{ uri: 'https://www.google.com/favicon.ico' }}
                            style={styles.googleIcon}
                        />
                        <Text style={styles.googleButtonText}>Sign In With Google</Text>
                    </TouchableOpacity>

                    {/* Sign Up Link */}
                    <View style={styles.signUpContainer}>
                        <Text style={styles.signUpText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/signup')}>
                            <Text style={styles.signUpLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <Toast />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoIcon: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    logoText: {
        fontSize: 28,
        fontWeight: '600',
        color: '#7C3AED',
    },
    tagline: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 32,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#DC2626',
        marginLeft: 8,
    },
    errorClose: {
        padding: 4,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
    },
    inputIcon: {
        marginLeft: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1F2937',
    },
    passwordInput: {
        paddingLeft: 8,
    },
    eyeIcon: {
        padding: 16,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    checkboxChecked: {
        backgroundColor: '#7C3AED',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#374151',
    },
    forgotPassword: {
        fontSize: 14,
        color: '#7C3AED',
        textDecorationLine: 'underline',
    },
    signInButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    signInButtonDisabled: {
        backgroundColor: '#A78BFA',
    },
    signInButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        color: '#9CA3AF',
    },
    googleButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 12,
    },
    googleIcon: {
        width: 20,
        height: 20,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    signUpText: {
        fontSize: 14,
        color: '#6B7280',
    },
    signUpLink: {
        fontSize: 14,
        color: '#7C3AED',
        textDecorationLine: 'underline',
    },
});

export default LoginScreen;
