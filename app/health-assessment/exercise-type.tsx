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

interface ExerciseType {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
}

const exerciseTypes: ExerciseType[] = [
    { id: 'jogging', icon: 'walk-outline', label: 'Jogging' },
    { id: 'cardio', icon: 'heart-outline', label: 'Cardio' },
    { id: 'swimming', icon: 'water-outline', label: 'Swimming' },
    { id: 'walking', icon: 'footsteps-outline', label: 'Walking' },
    { id: 'cycling', icon: 'bicycle-outline', label: 'Cycling' },
    { id: 'aerobics', icon: 'body-outline', label: 'Aerobics' },
    { id: 'other', icon: 'fitness-outline', label: 'Other' },
];

export default function ExerciseTypeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

    const toggleType = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(id => id !== typeId)
                : [...prev, typeId]
        );
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/mood',
            params: {
                ...params,
                exerciseTypes: selectedTypes.join(',')
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/mood',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 10 / 20;

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
                <Text style={styles.title}>What type of activity/ exercise do you prefer?</Text>

                <View style={styles.optionsContainer}>
                    {exerciseTypes.map((type) => {
                        const isSelected = selectedTypes.includes(type.id);
                        return (
                            <TouchableOpacity
                                key={type.id}
                                style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                                onPress={() => toggleType(type.id)}
                            >
                                <Ionicons
                                    name={type.icon}
                                    size={20}
                                    color={isSelected ? '#7C3AED' : '#6B7280'}
                                />
                                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                    {type.label}
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
                    style={[styles.continueButton, selectedTypes.length === 0 && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={selectedTypes.length === 0}
                >
                    <Text style={[styles.continueButtonText, selectedTypes.length === 0 && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedTypes.length > 0 ? '#fff' : '#9CA3AF'}
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
    optionsContainer: {
        gap: 12,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    optionItemSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    optionLabel: {
        flex: 1,
        fontSize: 15,
        color: '#4B5563',
        marginLeft: 12,
    },
    optionLabelSelected: {
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
