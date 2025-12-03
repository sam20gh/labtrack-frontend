import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const PasswordResetSentScreen = () => {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();

    // Mask email for display (e.g., "***221b@gmail.com")
    const maskEmail = (email: string) => {
        if (!email) return '';
        const [localPart, domain] = email.split('@');
        if (localPart.length <= 4) {
            return `***@${domain}`;
        }
        return `***${localPart.slice(-4)}@${domain}`;
    };

    const handleOpenEmail = () => {
        Linking.openURL('message://');
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:help@labtrackhealth.ai');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.push('/(auth)/loginscreen')}
                >
                    <Ionicons name="chevron-back" size={24} color="#1F2937" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustration}>
                        {/* Phone with email */}
                        <View style={styles.phoneContainer}>
                            <View style={styles.phone}>
                                <View style={styles.phoneScreen}>
                                    <Ionicons name="mail" size={24} color="#7C3AED" />
                                </View>
                            </View>
                            {/* Stars */}
                            <Ionicons name="star" size={16} color="#FCD34D" style={styles.star1} />
                            <Ionicons name="star" size={12} color="#FCD34D" style={styles.star2} />
                            <Ionicons name="star" size={14} color="#FCD34D" style={styles.star3} />
                            {/* Checkmark */}
                            <View style={styles.checkmarkContainer}>
                                <Ionicons name="checkmark" size={20} color="#10B981" />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>Password Reset Sent</Text>
                <Text style={styles.subtitle}>
                    Please check your email in a few minutes - we've sent "{maskEmail(email || '')}" an email containing password recovery link.
                </Text>

                {/* Open Email Button */}
                <TouchableOpacity
                    style={styles.openEmailButton}
                    onPress={handleOpenEmail}
                >
                    <Text style={styles.openEmailButtonText}>Open my email</Text>
                    <Ionicons name="mail-outline" size={20} color="#fff" />
                </TouchableOpacity>

                {/* Help Text */}
                <View style={styles.helpContainer}>
                    <Text style={styles.helpText}>Didn't receive the email?</Text>
                    <Text style={styles.helpText}>
                        Contact us at: <Text style={styles.helpLink} onPress={handleContactSupport}>help@labtrackhealth.ai</Text>
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        marginTop: -60,
    },
    illustrationContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    illustration: {
        width: 200,
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneContainer: {
        position: 'relative',
    },
    phone: {
        width: 80,
        height: 140,
        backgroundColor: '#1F2937',
        borderRadius: 16,
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneScreen: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    star1: {
        position: 'absolute',
        top: 0,
        right: -20,
    },
    star2: {
        position: 'absolute',
        top: 30,
        right: -30,
    },
    star3: {
        position: 'absolute',
        top: 10,
        left: -25,
    },
    checkmarkContainer: {
        position: 'absolute',
        bottom: -10,
        right: -10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    openEmailButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    openEmailButtonText: {
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

export default PasswordResetSentScreen;
