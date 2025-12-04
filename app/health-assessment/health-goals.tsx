import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface HealthGoal {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
}

const healthGoals: HealthGoal[] = [
    { id: 'improve_health', icon: 'fitness-outline', label: 'Improve my overall health' },
    { id: 'predict_health', icon: 'analytics-outline', label: 'I wanna predict my health' },
    { id: 'manage_medications', icon: 'medkit-outline', label: 'Manage my medications' },
    { id: 'try_ai', icon: 'chatbubble-ellipses-outline', label: 'I wanna try Dr. T AI assistant' },
    { id: 'track_activity', icon: 'footsteps-outline', label: 'I want to track activity' },
    { id: 'just_try', icon: 'phone-portrait-outline', label: 'Just wanna try the app' },
];

export default function HealthGoalsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

    const toggleGoal = (goalId: string) => {
        setSelectedGoals(prev =>
            prev.includes(goalId)
                ? prev.filter(id => id !== goalId)
                : [...prev, goalId]
        );
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/birth-year',
            params: {
                ...params,
                healthGoals: selectedGoals.join(',')
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/birth-year',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 2 / 20;

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
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>What is your health goal for the app?</Text>

                <View style={styles.goalsContainer}>
                    {healthGoals.map((goal) => {
                        const isSelected = selectedGoals.includes(goal.id);
                        return (
                            <TouchableOpacity
                                key={goal.id}
                                style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                                onPress={() => toggleGoal(goal.id)}
                            >
                                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                                    <Ionicons
                                        name={goal.icon}
                                        size={20}
                                        color={isSelected ? '#7C3AED' : '#6B7280'}
                                    />
                                </View>
                                <Text style={[styles.goalLabel, isSelected && styles.goalLabelSelected]}>
                                    {goal.label}
                                </Text>
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, selectedGoals.length === 0 && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={selectedGoals.length === 0}
                >
                    <Text style={[styles.continueButtonText, selectedGoals.length === 0 && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedGoals.length > 0 ? '#fff' : '#9CA3AF'}
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
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 32,
    },
    goalsContainer: {
        gap: 12,
    },
    goalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    goalItemSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerSelected: {
        backgroundColor: '#EDE9FE',
    },
    goalLabel: {
        flex: 1,
        fontSize: 15,
        color: '#4B5563',
        marginLeft: 12,
    },
    goalLabelSelected: {
        color: '#7C3AED',
        fontWeight: '500',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 16,
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
