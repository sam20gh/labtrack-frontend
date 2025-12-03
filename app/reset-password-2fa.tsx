import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const ResetPassword2FAScreen = () => {
    const router = useRouter();
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

        setLoading(true);

        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            Toast.show({ type: 'success', text1: 'Success', text2: 'Code verified successfully' });
            // Navigate to password reset screen
        }, 1500);
    };

    const isCodeComplete = code.every(digit => digit !== '');

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
                            <View style={styles.shieldContainer}>
                                <Ionicons name="shield-checkmark" size={60} color="#7C3AED" />
                                <View style={styles.keyIcon}>
                                    <Ionicons name="key" size={20} color="#FCD34D" />
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
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.verifyButtonText}>Verify Code</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
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
    },
    shieldContainer: {
        position: 'relative',
    },
    keyIcon: {
        position: 'absolute',
        bottom: -10,
        right: -15,
        backgroundColor: '#FEF3C7',
        borderRadius: 16,
        padding: 8,
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
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '600',
        color: '#1F2937',
    },
    codeInputFilled: {
        borderColor: '#7C3AED',
        backgroundColor: '#F3E8FF',
    },
    verifyButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    verifyButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    verifyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    helpContainer: {
        marginTop: 32,
        alignItems: 'center',
        gap: 8,
    },
    helpText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    helpLink: {
        fontSize: 14,
        color: '#7C3AED',
        textDecorationLine: 'underline',
    },
});

export default ResetPassword2FAScreen;
