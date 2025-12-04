import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CalorieIntakeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [calories, setCalories] = useState(0);

    const incrementCalories = (amount: number) => {
        setCalories(prev => Math.max(0, prev + amount));
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/medications',
            params: {
                ...params,
                dailyCalories: calories.toString()
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
                dailyCalories: 'unknown'
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
                <Text style={styles.title}>What's your daily calorie intake?</Text>

                {/* Label */}
                <Text style={styles.label}>Daily Intake (kcal)</Text>

                {/* Calorie Counter */}
                <View style={styles.counterContainer}>
                    <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => incrementCalories(-100)}
                    >
                        <Ionicons name="remove" size={24} color="#7C3AED" />
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
                        <Ionicons name="add" size={24} color="#7C3AED" />
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
                        color={calories > 0 ? '#fff' : '#9CA3AF'}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.dontKnowButton} onPress={handleDontKnow}>
                    <Text style={styles.dontKnowText}>I don't know</Text>
                    <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
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
    label: {
        fontSize: 14,
        color: '#6B7280',
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
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calorieDisplay: {
        marginHorizontal: 24,
    },
    calorieInput: {
        fontSize: 48,
        fontWeight: '300',
        color: '#1F2937',
        minWidth: 150,
    },
    summaryText: {
        fontSize: 15,
        color: '#6B7280',
    },
    summaryBold: {
        fontWeight: '600',
        color: '#1F2937',
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
    dontKnowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    dontKnowText: {
        fontSize: 15,
        color: '#6B7280',
        marginRight: 8,
    },
});
