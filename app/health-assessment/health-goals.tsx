import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { parseArrayParam } from './params';
import { healthGoals } from './options';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';


export default function HealthGoalsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedGoals, setSelectedGoals] = useState<string[]>(parseArrayParam(params.healthGoals));

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
                                        color={isSelected ? activePalette().primary : activePalette().textSecondary}
                                    />
                                </View>
                                <Text style={[styles.goalLabel, isSelected && styles.goalLabelSelected]}>
                                    {goal.label}
                                </Text>
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                    {isSelected && <Ionicons name="checkmark" size={14} color={Palette.white} />}
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
                        color={selectedGoals.length > 0 ? '#fff' : activePalette().textMuted}
                    />
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
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.text,
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
        borderColor: Palette.border,
        borderRadius: 12,
        backgroundColor: Palette.background,
    },
    goalItemSelected: {
        borderColor: Palette.primary,
        backgroundColor: tone('#FAF5FF'),
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: Palette.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerSelected: {
        backgroundColor: tone('#EDE9FE'),
    },
    goalLabel: {
        flex: 1,
        fontSize: 15,
        color: tone('#4B5563'),
        marginLeft: 12,
    },
    goalLabelSelected: {
        color: Palette.primary,
        fontWeight: '500',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: tone('#D1D5DB'),
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: Palette.primaryFill,
        borderColor: Palette.primary,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 16,
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
