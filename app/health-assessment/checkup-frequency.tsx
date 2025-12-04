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

const frequencies = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'bi-weekly', label: 'Bi-weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'bi-monthly', label: 'Bi-monthly' },
    { id: 'yearly', label: 'Yearly' },
];

export default function CheckupFrequencyScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedFrequency, setSelectedFrequency] = useState<string | null>('monthly');

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
                        <Ionicons name="calendar-outline" size={48} color="#7C3AED" />
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
                        color={selectedFrequency ? '#fff' : '#9CA3AF'}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.neverButton} onPress={handleNever}>
                    <Ionicons name="close" size={16} color="#6B7280" />
                    <Text style={styles.neverButtonText}>I never do health checkup</Text>
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
        fontSize: 14,
        fontWeight: '600',
        color: '#7C3AED',
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
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
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
        borderColor: '#E5E7EB',
        borderRadius: 12,
        alignItems: 'center',
    },
    frequencyItemSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    frequencyText: {
        fontSize: 16,
        color: '#6B7280',
    },
    frequencyTextSelected: {
        color: '#7C3AED',
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
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
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
        marginBottom: 12,
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
    neverButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    neverButtonText: {
        fontSize: 15,
        color: '#7C3AED',
        marginLeft: 8,
    },
});
