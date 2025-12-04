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

interface FitnessLevel {
    level: number;
    label: string;
    description: string;
    color: string;
}

const fitnessLevels: FitnessLevel[] = [
    { level: 1, label: 'Sedentary', description: 'I rarely exercise', color: '#EF4444' },
    { level: 2, label: 'Light', description: 'I exercise 1 - 2 times weekly', color: '#F97316' },
    { level: 3, label: 'Moderate', description: 'I exercise 2 - 3 times weekly', color: '#EAB308' },
    { level: 4, label: 'Athletic', description: 'I exercise 3 - 4 times weekly', color: '#22C55E' },
    { level: 5, label: 'Elite', description: 'I exercise 5+ times weekly', color: '#10B981' },
];

export default function FitnessLevelScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedLevel, setSelectedLevel] = useState(4);

    const currentFitness = fitnessLevels.find(f => f.level === selectedLevel) || fitnessLevels[3];

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/sleep-level',
            params: {
                ...params,
                fitnessLevel: selectedLevel.toString(),
                fitnessLabel: currentFitness.label
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/sleep-level',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 8 / 20;

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
                <Text style={styles.title}>How would you rate your fitness level?</Text>

                {/* Level Label */}
                <Text style={styles.levelLabel}>LEVEL {selectedLevel}</Text>

                {/* Slider Track */}
                <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                        {fitnessLevels.map((level, index) => (
                            <TouchableOpacity
                                key={level.level}
                                style={[
                                    styles.sliderDot,
                                    { backgroundColor: level.color },
                                    selectedLevel === level.level && styles.sliderDotSelected
                                ]}
                                onPress={() => setSelectedLevel(level.level)}
                            />
                        ))}
                        {/* Slider Thumb */}
                        <View
                            style={[
                                styles.sliderThumb,
                                {
                                    left: `${((selectedLevel - 1) / 4) * 100}%`,
                                    backgroundColor: currentFitness.color
                                }
                            ]}
                        >
                            <View style={styles.thumbInner}>
                                <View style={[styles.thumbLine, { backgroundColor: currentFitness.color }]} />
                                <View style={[styles.thumbLine, { backgroundColor: currentFitness.color }]} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Fitness Label */}
                <Text style={[styles.fitnessLabel, { color: currentFitness.color }]}>
                    {currentFitness.label}
                </Text>

                {/* Description */}
                <Text style={styles.description}>{currentFitness.description}</Text>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.infoText}>Drag the slider to adjust</Text>
                </View>

                {/* Level buttons */}
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
        marginBottom: 32,
    },
    levelLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7C3AED',
        letterSpacing: 1,
        marginBottom: 24,
    },
    sliderContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 32,
    },
    sliderTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        position: 'relative',
    },
    sliderDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    sliderDotSelected: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    sliderThumb: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -16,
        top: 4,
    },
    thumbInner: {
        flexDirection: 'row',
        gap: 3,
    },
    thumbLine: {
        width: 2,
        height: 12,
        borderRadius: 1,
    },
    fitnessLabel: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8,
    },
    description: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 16,
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    infoText: {
        fontSize: 13,
        color: '#9CA3AF',
        marginLeft: 6,
    },
    levelButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    levelButton: {
        width: 44,
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    levelButtonSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    levelButtonText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    levelButtonTextSelected: {
        color: '#7C3AED',
        fontWeight: '600',
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
