import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramString } from './params';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette } from '@/constants/theme';

export default function NameScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [name, setName] = useState(paramString(params.fullName) ?? '');

    const handleContinue = () => {
        if (name.trim()) {
            router.push({
                pathname: '/health-assessment/health-goals',
                params: { ...params, fullName: name.trim() }
            });
        }
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/health-goals',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 1 / 20; // Step 1 of ~20 steps

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Screen Title */}
                <Text style={styles.screenTitle}>Health Assessment</Text>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                    </View>
                    <TouchableOpacity onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>What's your full legal name?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Enter your name..."
                        placeholderTextColor={Palette.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                    />

                    <View style={styles.infoContainer}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={Palette.textMuted} />
                        <Text style={styles.infoText}>
                            For regulatory purposes, please enter name stated on your state ID.
                        </Text>
                    </View>
                </View>

                {/* Bottom Button */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={[styles.continueButton, !name.trim() && styles.continueButtonDisabled]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={[styles.continueButtonText, !name.trim() && styles.continueButtonTextDisabled]}>
                            Continue
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color={name.trim() ? '#fff' : activePalette().textMuted}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    keyboardView: {
        flex: 1,
    },
    screenTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Palette.text,
        textAlign: 'center',
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    progressBarContainer: {
        flex: 1,
        height: 4,
        backgroundColor: Palette.border,
        borderRadius: 2,
        marginHorizontal: 16,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Palette.primaryFill,
        borderRadius: 2,
    },
    skipText: {
        color: Palette.primary,
        fontSize: 16,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.text,
        textAlign: 'center',
        marginBottom: 32,
    },
    input: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: Palette.text,
        textAlign: 'center',
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingHorizontal: 20,
    },
    infoText: {
        fontSize: 13,
        color: Palette.textMuted,
        marginLeft: 8,
        textAlign: 'center',
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    continueButton: {
        backgroundColor: Palette.primaryFill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
    },
    continueButtonDisabled: {
        backgroundColor: Palette.borderLight,
    },
    continueButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    continueButtonTextDisabled: {
        color: Palette.textMuted,
    },
}));
