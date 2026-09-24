import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramNumber } from './params';
import { sleepLevels } from './options';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';


export default function SleepLevelScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedLevel, setSelectedLevel] = useState(paramNumber(params.sleepLevel, 5));

    const currentSleep = sleepLevels.find(s => s.level === selectedLevel) || sleepLevels[4];

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/exercise-type',
            params: {
                ...params,
                sleepLevel: selectedLevel.toString(),
                sleepLabel: currentSleep.label,
                sleepHours: currentSleep.hoursValue.toString()
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/exercise-type',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 9 / 20;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
                <Text style={styles.title}>How would you rate your sleep level?</Text>

                {/* Sleep Display */}
                <View style={styles.displayContainer}>
                    <Text style={styles.displayNumber}>{selectedLevel}</Text>
                    <Text style={styles.displayLabel}>{currentSleep.label}</Text>
                </View>

                {/* Level Buttons */}
                <View style={styles.levelButtonsContainer}>
                    {[1, 2, 3, 4, 5].map((level) => (
                        <TouchableOpacity
                            key={level}
                            style={[
                                styles.levelButton,
                                selectedLevel === level && styles.levelButtonSelected
                            ]}
                            onPress={() => setSelectedLevel(level)}
                        >
                            <Text style={[
                                styles.levelButtonText,
                                selectedLevel === level && styles.levelButtonTextSelected
                            ]}>
                                {level}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Hours Info */}
                <View style={styles.hoursContainer}>
                    <Ionicons name="moon-outline" size={16} color={Palette.textSecondary} />
                    <Text style={styles.hoursText}>I sleep {currentSleep.hours}</Text>
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color={Palette.white} />
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
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.text,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 48,
    },
    displayContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    displayNumber: {
        fontSize: 96,
        fontWeight: '300',
        color: Palette.text,
        lineHeight: 110,
    },
    displayLabel: {
        fontSize: 20,
        color: Palette.textSecondary,
        marginTop: -8,
    },
    levelButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    levelButton: {
        width: 48,
        height: 48,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.background,
    },
    levelButtonSelected: {
        borderColor: Palette.text,
        backgroundColor: tone('#F9FAFB'),
    },
    levelButtonText: {
        fontSize: 18,
        color: Palette.textSecondary,
        fontWeight: '500',
    },
    levelButtonTextSelected: {
        color: Palette.text,
        fontWeight: '600',
    },
    hoursContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tone('#F9FAFB'),
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    hoursText: {
        fontSize: 14,
        color: Palette.textSecondary,
        marginLeft: 8,
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
    continueButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
}));
