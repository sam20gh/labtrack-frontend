import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface SleepLevel {
    level: number;
    label: string;
    hours: string;
}

const sleepLevels: SleepLevel[] = [
    { level: 1, label: 'Very Poor', hours: 'Less than 4 hours daily' },
    { level: 2, label: 'Poor', hours: '4 - 5 hours daily' },
    { level: 3, label: 'Fair', hours: '5 - 6 hours daily' },
    { level: 4, label: 'Good', hours: '6 - 7 hours daily' },
    { level: 5, label: 'Moderate', hours: '6 - 7 hours daily' },
];

export default function SleepLevelScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedLevel, setSelectedLevel] = useState(5);

    const currentSleep = sleepLevels.find(s => s.level === selectedLevel) || sleepLevels[4];

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/exercise-type',
            params: {
                ...params,
                sleepLevel: selectedLevel.toString(),
                sleepLabel: currentSleep.label
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
                    <Ionicons name="chevron-back" size={24} color="#1F2937" />
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
                    <Ionicons name="moon-outline" size={16} color="#6B7280" />
                    <Text style={styles.hoursText}>I sleep {currentSleep.hours}</Text>
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    screenTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
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
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginHorizontal: 16,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#7C3AED',
        borderRadius: 2,
    },
    skipText: {
        color: '#7C3AED',
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
        color: '#1F2937',
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
        color: '#1F2937',
        lineHeight: 110,
    },
    displayLabel: {
        fontSize: 20,
        color: '#6B7280',
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
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    levelButtonSelected: {
        borderColor: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    levelButtonText: {
        fontSize: 18,
        color: '#6B7280',
        fontWeight: '500',
    },
    levelButtonTextSelected: {
        color: '#1F2937',
        fontWeight: '600',
    },
    hoursContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    hoursText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    continueButton: {
        backgroundColor: '#7C3AED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
});
