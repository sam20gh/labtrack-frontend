import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramString } from './params';
import { checkupFrequencies as frequencies } from './options';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';


export default function CheckupFrequencyScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedFrequency, setSelectedFrequency] = useState<string | null>(paramString(params.checkupFrequency) ?? 'monthly');

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/health-notes',
            params: {
                ...params,
                checkupFrequency: selectedFrequency || ''
            }
        });
    };

    const handleNever = () => {
        router.push({
            pathname: '/health-assessment/health-notes',
            params: {
                ...params,
                checkupFrequency: 'never'
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/health-notes',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 17 / 20;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <Text style={styles.screenTitle}>Health Assessment</Text>
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
                <Text style={styles.title}>How often do you do health checkup?</Text>

                {/* Frequency Options */}
                <View style={styles.frequencyContainer}>
                    {frequencies.map((freq) => {
                        const isSelected = selectedFrequency === freq.id;
                        return (
                            <TouchableOpacity
                                key={freq.id}
                                style={[styles.frequencyItem, isSelected && styles.frequencyItemSelected]}
                                onPress={() => setSelectedFrequency(freq.id)}
                            >
                                <Text style={[styles.frequencyText, isSelected && styles.frequencyTextSelected]}>
                                    {freq.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustration}>
                        <Ionicons name="calendar-outline" size={48} color={Palette.primary} />
                    </View>
                </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedFrequency && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedFrequency}
                >
                    <Text style={[styles.continueButtonText, !selectedFrequency && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedFrequency ? '#fff' : activePalette().textMuted}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.neverButton} onPress={handleNever}>
                    <Ionicons name="close" size={16} color={Palette.textSecondary} />
                    <Text style={styles.neverButtonText}>I never do health checkup</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    screenTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Palette.primary,
        textAlign: 'center',
        paddingTop: 8,
        marginBottom: 8,
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
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.text,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    frequencyContainer: {
        gap: 8,
    },
    frequencyItem: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
        alignItems: 'center',
    },
    frequencyItemSelected: {
        borderColor: Palette.primary,
        backgroundColor: tone('#FAF5FF'),
    },
    frequencyText: {
        fontSize: 16,
        color: Palette.textSecondary,
    },
    frequencyTextSelected: {
        color: Palette.primary,
        fontWeight: '600',
    },
    illustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustration: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Palette.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
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
        marginBottom: 12,
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
    neverButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
    },
    neverButtonText: {
        fontSize: 15,
        color: Palette.primary,
        marginLeft: 8,
    },
}));
