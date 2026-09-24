import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

type ResetOption = {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    route: string;
};

const resetOptions: ResetOption[] = [
    {
        id: 'email',
        icon: 'mail-outline',
        title: 'Send via Email',
        route: '/reset-password-email',
    },
    {
        id: 'sms',
        icon: 'chatbubble-outline',
        title: 'Send via SMS',
        route: '/reset-password-sms',
    },
    {
        id: '2fa',
        icon: 'shield-checkmark-outline',
        title: 'Send via 2FA',
        route: '/reset-password-2fa',
    },
];

const ForgotPasswordScreen = () => {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();

    const handleOptionPress = (route: string) => {
        router.push(route as any);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>
                    Please select the following options to reset your password.
                </Text>

                {/* Options */}
                <View style={styles.optionsContainer}>
                    {resetOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={styles.optionCard}
                            onPress={() => handleOptionPress(option.route)}
                        >
                            <View style={styles.optionLeft}>
                                <View style={styles.optionIconContainer}>
                                    <Ionicons name={option.icon} size={24} color={Palette.primary} />
                                </View>
                                <Text style={styles.optionTitle}>{option.title}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    );
};

const useStyles = makeStyles((Palette) => ({
    container: {
        flex: 1,
        backgroundColor: Palette.background,
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
        paddingTop: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: Palette.text,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
        lineHeight: 24,
        marginBottom: 40,
    },
    optionsContainer: {
        gap: 16,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: tone('#F9FAFB'),
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: Palette.primarySurface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: Palette.text,
    },
}));

export default ForgotPasswordScreen;
