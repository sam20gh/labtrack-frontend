import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/config';
import Toast from 'react-native-toast-message';

const ResetPasswordEmailScreen = () => {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSendPassword = async () => {
        if (!email) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your email address' });
            return;
        }

        if (!isValidEmail(email)) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid email address' });
            return;
        }

        setLoading(true);

        try {
            // API call to send reset password email
            const response = await fetch(`${API_URL}/users/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            setLoading(false);

            // Navigate to confirmation screen regardless of API response
            // (for security, we don't reveal if email exists)
            router.push({
                pathname: '/password-reset-sent',
                params: { email },
            });
        } catch (error) {
            setLoading(false);
            // Still navigate to confirmation for security
            router.push({
                pathname: '/password-reset-sent',
                params: { email },
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="chevron-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Illustration */}
                    <View style={styles.illustrationContainer}>
                        <View style={styles.illustration}>
                            <View style={styles.personContainer}>
                                <View style={styles.personHead} />
                                <View style={styles.personBody} />
                            </View>
                            <View style={styles.lockContainer}>
                                <Ionicons name="lock-closed" size={40} color="#7C3AED" />
                                <View style={styles.dotsContainer}>
                                    {[...Array(6)].map((_, i) => (
                                        <View key={i} style={styles.dot} />
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Forgot Password</Text>
                    <Text style={styles.subtitle}>
                        Please enter your email address to reset your password.
                    </Text>

                    {/* Email Input */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                placeholder="elementary221b@gmail.com"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onChangeText={setEmail}
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Send Password Button */}
                    <TouchableOpacity
                        style={[styles.sendButton, !email && styles.sendButtonDisabled]}
                        onPress={handleSendPassword}
                        disabled={loading || !email}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.sendButtonText}>Send Password</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Help Text */}
                    <View style={styles.helpContainer}>
                        <Text style={styles.helpText}>Don't remember your email?</Text>
                        <Text style={styles.helpText}>
                            Contact us at: <Text style={styles.helpLink}>help@labtrackhealth.ai</Text>
                        </Text>
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
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    illustrationContainer: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    illustration: {
        width: 200,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    personContainer: {
        alignItems: 'center',
        position: 'absolute',
        left: 30,
    },
    personHead: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FDE68A',
    },
    personBody: {
        width: 60,
        height: 80,
        backgroundColor: '#7C3AED',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -10,
    },
    lockContainer: {
        position: 'absolute',
        right: 20,
        alignItems: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#1F2937',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 24,
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
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#1F2937',
    },
    sendButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    helpContainer: {
        marginTop: 32,
        alignItems: 'center',
    },
    helpText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    helpLink: {
        color: '#7C3AED',
        textDecorationLine: 'underline',
    },
});

export default ResetPasswordEmailScreen;
