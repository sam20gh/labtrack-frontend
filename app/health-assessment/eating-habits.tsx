import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramString } from './params';
import { eatingHabits } from './options';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64) / 2;


export default function EatingHabitsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedHabit, setSelectedHabit] = useState<string | null>(paramString(params.eatingHabits) ?? null);

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/calorie-intake',
            params: {
                ...params,
                eatingHabits: selectedHabit || ''
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/calorie-intake',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 12 / 20;

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
                <Text style={styles.title}>What is your usual eating habits?</Text>

                {/* Habits Grid */}
                <View style={styles.gridContainer}>
                    {eatingHabits.map((habit) => {
                        const isSelected = selectedHabit === habit.id;
                        return (
                            <TouchableOpacity
                                key={habit.id}
                                style={[styles.habitCard, isSelected && styles.habitCardSelected]}
                                onPress={() => setSelectedHabit(habit.id)}
                            >
                                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                                    <Ionicons
                                        name={habit.icon}
                                        size={24}
                                        color={isSelected ? activePalette().primary : activePalette().textSecondary}
                                    />
                                </View>
                                <Text style={[styles.habitLabel, isSelected && styles.habitLabelSelected]}>
                                    {habit.label}
                                </Text>
                                <Text style={styles.habitDescription} numberOfLines={2}>
                                    {habit.description}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedHabit && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedHabit}
                >
                    <Text style={[styles.continueButtonText, !selectedHabit && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedHabit ? '#fff' : activePalette().textMuted}
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
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    habitCard: {
        width: CARD_WIDTH,
        padding: 16,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 16,
        backgroundColor: Palette.background,
    },
    habitCardSelected: {
        borderColor: Palette.primary,
        backgroundColor: tone('#FAF5FF'),
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Palette.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    iconContainerSelected: {
        backgroundColor: tone('#EDE9FE'),
    },
    habitLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Palette.text,
        marginBottom: 4,
    },
    habitLabelSelected: {
        color: Palette.primary,
    },
    habitDescription: {
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 16,
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
