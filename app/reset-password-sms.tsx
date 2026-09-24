import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { sendPhoneOtp, normalisePhone } from '@/lib/auth';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';

const ResetPasswordSMSScreen = () => {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        if (!phone) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your phone number' });
            return;
        }

        setLoading(true);

        const result = await sendPhoneOtp(phone);
        setLoading(false);

        if (!result.ok) {
            // Until Authentication -> Phone is enabled in Supabase this reports
            // "provider is not enabled" — shown as-is rather than failing silently.
            Toast.show({ type: 'error', text1: 'Could not send code', text2: result.error });
            return;
        }

        Toast.show({ type: 'success', text1: 'Sent', text2: 'Verification code sent to your phone' });
        router.push({
            pathname: '/reset-password-2fa',
            params: { phone: normalisePhone(phone) },
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
                            <View style={styles.phoneIconContainer}>
                                <Ionicons name="phone-portrait" size={60} color={Palette.primary} />
                                <View style={styles.messageIcon}>
                                    <Ionicons name="chatbubble" size={24} color={tone('#10B981')} />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Reset via SMS</Text>
                    <Text style={styles.subtitle}>
                        Enter your registered phone number to receive a verification code.
                    </Text>

                    {/* Phone Input */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call-outline" size={20} color={Palette.textMuted} style={styles.inputIcon} />
                            <TextInput
                                placeholder="+1 (555) 123-4567"
                                placeholderTextColor={Palette.textMuted}
                                value={phone}
                                keyboardType="phone-pad"
                                onChangeText={setPhone}
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Send Code Button */}
                    <TouchableOpacity
                        style={[styles.sendButton, !phone && styles.sendButtonDisabled]}
                        onPress={handleSendCode}
                        disabled={loading || !phone}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={Palette.white} />
                        ) : (
                            <>
                                <Text style={styles.sendButtonText}>Send Code</Text>
                                <Ionicons name="arrow-forward" size={20} color={Palette.white} />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Help Text */}
                    <View style={styles.helpContainer}>
                        <Text style={styles.helpText}>Don't have access to your phone?</Text>
                        <TouchableOpacity onPress={() => router.push('/reset-password-email')}>
                            <Text style={styles.helpLink}>Try email instead</Text>
                        </TouchableOpacity>
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
    },
    phoneIconContainer: {
        position: 'relative',
    },
    messageIcon: {
        position: 'absolute',
        top: -10,
        right: -20,
        backgroundColor: activePalette().successBand,
        borderRadius: 20,
        padding: 8,
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
        gap: 8,
    },
    helpText: {
        fontSize: 14,
        color: Palette.textSecondary,
        textAlign: 'center',
    },
    helpLink: {
        fontSize: 14,
        color: Palette.primary,
        textDecorationLine: 'underline',
    },
}));

export default ResetPasswordSMSScreen;
