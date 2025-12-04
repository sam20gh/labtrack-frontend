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

interface MoodOption {
    id: string;
    emoji: string;
    label: string;
    color: string;
}

const moodOptions: MoodOption[] = [
    { id: 'very_sad', emoji: '😢', label: "I'm feeling very sad", color: '#3B82F6' },
    { id: 'sad', emoji: '😔', label: "I'm feeling sad", color: '#6B7280' },
    { id: 'neutral', emoji: '😐', label: "I'm feeling okay", color: '#9CA3AF' },
    { id: 'happy', emoji: '😊', label: "I'm feeling happy", color: '#F59E0B' },
    { id: 'very_happy', emoji: '😄', label: "I'm feeling very happy", color: '#EAB308' },
];

export default function MoodScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedMood, setSelectedMood] = useState<string | null>('very_happy');

    const currentMood = moodOptions.find(m => m.id === selectedMood);

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/eating-habits',
            params: {
                ...params,
                mood: selectedMood || '',
                moodLabel: currentMood?.label || ''
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/eating-habits',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 11 / 20;

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
                <Text style={styles.title}>What's your current mood right now?</Text>

                {/* Sparkle indicator */}
                {selectedMood === 'very_happy' && (
                    <Text style={styles.sparkle}>✨</Text>
                )}

                {/* Emoji Display */}
                <View style={styles.emojiContainer}>
                    {moodOptions.map((mood, index) => {
                        const isSelected = selectedMood === mood.id;
                        const isCenter = index === 2;
                        return (
                            <TouchableOpacity
                                key={mood.id}
                                style={[
                                    styles.emojiButton,
                                    isSelected && styles.emojiButtonSelected,
                                ]}
                                onPress={() => setSelectedMood(mood.id)}
                            >
                                <Text style={[
                                    styles.emoji,
                                    isSelected && styles.emojiSelected,
                                ]}>
                                    {mood.emoji}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Mood Label */}
                {currentMood && (
                    <Text style={styles.moodLabel}>{currentMood.label}</Text>
                )}
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedMood && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedMood}
                >
                    <Text style={[styles.continueButtonText, !selectedMood && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedMood ? '#fff' : '#9CA3AF'}
                    />
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
    sparkle: {
        fontSize: 24,
        marginBottom: 16,
    },
    emojiContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 32,
    },
    emojiButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    emojiButtonSelected: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEF3C7',
        borderWidth: 3,
        borderColor: '#F59E0B',
    },
    emoji: {
        fontSize: 28,
        opacity: 0.5,
    },
    emojiSelected: {
        fontSize: 40,
        opacity: 1,
    },
    moodLabel: {
        fontSize: 18,
        color: '#1F2937',
        fontWeight: '500',
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
    continueButtonDisabled: {
        backgroundColor: '#F3F4F6',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    continueButtonTextDisabled: {
        color: '#9CA3AF',
    },
});
