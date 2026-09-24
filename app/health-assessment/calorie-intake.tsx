import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramNumber } from './params';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette } from '@/constants/theme';

export default function CalorieIntakeScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    // 'unknown' is a real answer from the Don't know button; it is not a number.
    const [calories, setCalories] = useState(paramNumber(params.calorieIntake, 0));

    const incrementCalories = (amount: number) => {
        setCalories(prev => Math.max(0, prev + amount));
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/medications',
            params: {
                ...params,
                calorieIntake: calories.toString()
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/medications',
            params: { ...params }
        });
    };

    const handleDontKnow = () => {
        router.push({
            pathname: '/health-assessment/medications',
            params: {
                ...params,
                calorieIntake: 'unknown'
            }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const formatCalories = (value: number) => {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const progress = 13 / 20;

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
                <Text style={styles.title}>What's your daily calorie intake?</Text>

                {/* Label */}
                <Text style={styles.label}>Daily Intake (kcal)</Text>

                {/* Calorie Counter */}
                <View style={styles.counterContainer}>
                    <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => incrementCalories(-100)}
                    >
                        <Ionicons name="remove" size={24} color={Palette.primary} />
                    </TouchableOpacity>

                    <View style={styles.calorieDisplay}>
                        <TextInput
                            style={styles.calorieInput}
                            value={calories.toLocaleString()}
                            onChangeText={(text) => {
                                const num = parseInt(text.replace(/,/g, ''), 10);
                                if (!isNaN(num)) {
                                    setCalories(num);
                                } else if (text === '') {
                                    setCalories(0);
                                }
                            }}
                            keyboardType="numeric"
                            textAlign="center"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => incrementCalories(100)}
                    >
                        <Ionicons name="add" size={24} color={Palette.primary} />
                    </TouchableOpacity>
                </View>

                {/* Summary Text */}
                <Text style={styles.summaryText}>
                    I consume around <Text style={styles.summaryBold}>{calories.toLocaleString()}</Text> kcal
                </Text>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, calories === 0 && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={calories === 0}
                >
                    <Text style={[styles.continueButtonText, calories === 0 && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={calories > 0 ? '#fff' : activePalette().textMuted}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.dontKnowButton} onPress={handleDontKnow}>
                    <Text style={styles.dontKnowText}>I don't know</Text>
                    <Ionicons name="help-circle-outline" size={18} color={Palette.textSecondary} />
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
    label: {
        fontSize: 14,
        color: Palette.textSecondary,
        marginBottom: 16,
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    counterButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Palette.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calorieDisplay: {
        marginHorizontal: 24,
    },
    calorieInput: {
        fontSize: 48,
        fontWeight: '300',
        color: Palette.text,
        minWidth: 150,
    },
    summaryText: {
        fontSize: 15,
        color: Palette.textSecondary,
    },
    summaryBold: {
        fontWeight: '600',
        color: Palette.text,
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
    dontKnowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
    },
    dontKnowText: {
        fontSize: 15,
        color: Palette.textSecondary,
        marginRight: 8,
    },
}));
