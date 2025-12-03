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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const ResetPasswordSMSScreen = () => {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        if (!phone) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your phone number' });
            return;
        }

        setLoading(true);

        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            Toast.show({ type: 'success', text1: 'Success', text2: 'Verification code sent to your phone' });
            // Navigate to verification screen (to be implemented)
        }, 1500);
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
                            <View style={styles.phoneIconContainer}>
                                <Ionicons name="phone-portrait" size={60} color="#7C3AED" />
                                <View style={styles.messageIcon}>
                                    <Ionicons name="chatbubble" size={24} color="#10B981" />
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
                            <Ionicons name="call-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                placeholder="+1 (555) 123-4567"
                                placeholderTextColor="#9CA3AF"
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
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.sendButtonText}>Send Code</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
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
    phoneIconContainer: {
        position: 'relative',
    },
    messageIcon: {
        position: 'absolute',
        top: -10,
        right: -20,
        backgroundColor: '#D1FAE5',
        borderRadius: 20,
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

export default ResetPasswordSMSScreen;
