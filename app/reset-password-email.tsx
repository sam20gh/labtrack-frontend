import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from '@/lib/auth';
import Toast from 'react-native-toast-message';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

const ResetPasswordEmailScreen = () => {
    const Palette = usePalette();
    const styles = useStyles();
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

        // Supabase sends the reset link. The result is deliberately not surfaced: revealing
        // whether an address is registered would leak account existence.
        await sendPasswordResetEmail(email);
        setLoading(false);

        router.push({
            pathname: '/password-reset-sent',
            params: { email },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
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
                                <Ionicons name="lock-closed" size={40} color={Palette.primary} />
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
                            <Ionicons name="mail-outline" size={20} color={Palette.textMuted} style={styles.inputIcon} />
                            <TextInput
                                placeholder="elementary221b@gmail.com"
                                placeholderTextColor={Palette.textMuted}
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
                            <ActivityIndicator size="small" color={Palette.white} />
                        ) : (
                            <>
                                <Text style={styles.sendButtonText}>Send Password</Text>
                                <Ionicons name="arrow-forward" size={20} color={Palette.white} />
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

const useStyles = makeStyles((Palette) => ({
    container: {
        flex: 1,
        backgroundColor: Palette.background,
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
        backgroundColor: tone('#FDE68A'),
    },
    personBody: {
        width: 60,
        height: 80,
        backgroundColor: Palette.primaryFill,
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
        backgroundColor: Palette.text,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: Palette.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
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
        borderColor: Palette.border,
        borderRadius: 12,
        backgroundColor: tone('#F9FAFB'),
    },
    inputIcon: {
        marginLeft: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        fontSize: 16,
        color: Palette.text,
    },
    sendButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Palette.primaryFill,
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    sendButtonDisabled: {
        backgroundColor: tone('#D1D5DB'),
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Palette.white,
    },
    helpContainer: {
        marginTop: 32,
        alignItems: 'center',
    },
    helpText: {
        fontSize: 14,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    helpLink: {
        color: Palette.primary,
        textDecorationLine: 'underline',
    },
}));

export default ResetPasswordEmailScreen;
