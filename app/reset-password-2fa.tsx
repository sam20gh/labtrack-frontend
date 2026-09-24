import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { verifyPhoneOtp } from '@/lib/auth';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

const ResetPassword2FAScreen = () => {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { phone } = useLocalSearchParams();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef<TextInput[]>([]);

    const handleCodeChange = (text: string, index: number) => {
        const newCode = [...code];
        newCode[index] = text;
        setCode(newCode);

        // Auto-focus next input
        if (text && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter the complete 6-digit code' });
            return;
        }

        if (!phone) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Missing phone number — please start again' });
            return;
        }

        setLoading(true);

        const result = await verifyPhoneOtp(String(phone), fullCode);
        setLoading(false);

        if (!result.ok) {
            Toast.show({ type: 'error', text1: 'Verification failed', text2: result.error });
            return;
        }

        // A verified OTP is a full sign-in, so go straight into the app
        Toast.show({ type: 'success', text1: 'Verified', text2: 'Signed in successfully' });
        router.replace('/(tabs)');
    };

    const isCodeComplete = code.every(digit => digit !== '');

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
                            <View style={styles.shieldContainer}>
                                <Ionicons name="shield-checkmark" size={60} color={Palette.primary} />
                                <View style={styles.keyIcon}>
                                    <Ionicons name="key" size={20} color={tone('#FCD34D')} />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>2FA Verification</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code from your authenticator app.
                    </Text>

                    {/* Code Input */}
                    <View style={styles.codeContainer}>
                        {code.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                                style={[styles.codeInput, digit && styles.codeInputFilled]}
                                value={digit}
                                onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity
                        style={[styles.verifyButton, !isCodeComplete && styles.verifyButtonDisabled]}
                        onPress={handleVerify}
                        disabled={loading || !isCodeComplete}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={Palette.white} />
                        ) : (
                            <>
                                <Text style={styles.verifyButtonText}>Verify Code</Text>
                                <Ionicons name="arrow-forward" size={20} color={Palette.white} />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Help Text */}
                    <View style={styles.helpContainer}>
                        <Text style={styles.helpText}>Lost access to your authenticator?</Text>
                        <TouchableOpacity onPress={() => router.push('/reset-password-email')}>
                            <Text style={styles.helpLink}>Try email recovery instead</Text>
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
    shieldContainer: {
        position: 'relative',
    },
    keyIcon: {
        position: 'absolute',
        bottom: -10,
        right: -15,
        backgroundColor: tone('#FEF3C7'),
        borderRadius: 16,
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
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 32,
    },
    codeInput: {
        width: 48,
        height: 56,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
        backgroundColor: tone('#F9FAFB'),
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '600',
        color: Palette.text,
    },
    codeInputFilled: {
        borderColor: Palette.primary,
        backgroundColor: Palette.primarySurface,
    },
    verifyButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Palette.primaryFill,
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    verifyButtonDisabled: {
        backgroundColor: tone('#D1D5DB'),
    },
    verifyButtonText: {
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

export default ResetPassword2FAScreen;
