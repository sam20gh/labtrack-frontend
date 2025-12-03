import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64) / 2;

interface EatingHabit {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
}

const eatingHabits: EatingHabit[] = [
    {
        id: 'balanced',
        icon: 'restaurant-outline',
        label: 'Balanced Diet',
        description: "I'm eating a very balanced diet"
    },
    {
        id: 'vegetarian',
        icon: 'leaf-outline',
        label: 'Vegetarian',
        description: "I was a rabbit on my previous life"
    },
    {
        id: 'low_carb',
        icon: 'nutrition-outline',
        label: 'Low Carb',
        description: "I am allergic to carbohydrates"
    },
    {
        id: 'gluten_free',
        icon: 'ban-outline',
        label: 'Gluten Free',
        description: "I hate glutens with all of my life"
    },
];

export default function EatingHabitsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/calorie-intake',
            params: {
                ...params,
                eatingHabit: selectedHabit || ''
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
        <SafeAreaView style={styles.container}>
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
                                        color={isSelected ? '#7C3AED' : '#6B7280'}
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
                        color={selectedHabit ? '#fff' : '#9CA3AF'}
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
        borderColor: '#E5E7EB',
        borderRadius: 16,
        backgroundColor: '#fff',
    },
    habitCardSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    iconContainerSelected: {
        backgroundColor: '#EDE9FE',
    },
    habitLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    habitLabelSelected: {
        color: '#7C3AED',
    },
    habitDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
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
