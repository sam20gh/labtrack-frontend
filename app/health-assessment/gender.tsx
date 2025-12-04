import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface GenderOption {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description?: string;
}

const genderOptions: GenderOption[] = [
    { id: 'Male', icon: 'male-outline', label: 'I am Male' },
    { id: 'Female', icon: 'female-outline', label: 'I am Female' },
    { id: 'Other', icon: 'transgender-outline', label: 'I am Other' },
];

export default function GenderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedGender, setSelectedGender] = useState<string | null>(null);
    const [customDescription, setCustomDescription] = useState('');

    const handleContinue = () => {
        if (selectedGender) {
            router.push({
                pathname: '/health-assessment/weight',
                params: {
                    ...params,
                    gender: selectedGender,
                    genderDescription: selectedGender === 'Other' ? customDescription : ''
                }
            });
        }
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/weight',
            params: { ...params }
        });
    };

    const handlePreferNotToSay = () => {
        router.push({
            pathname: '/health-assessment/weight',
            params: {
                ...params,
                gender: 'PreferNotToSay'
            }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 4 / 20;

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
                <Text style={styles.title}>What is your gender?</Text>
                <Text style={styles.subtitle}>
                    For the purpose of regulation, please specify your gender truthfully.
                </Text>

                <View style={styles.optionsContainer}>
                    {genderOptions.map((option) => {
                        const isSelected = selectedGender === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                                onPress={() => setSelectedGender(option.id)}
                            >
                                <Ionicons
                                    name={option.icon}
                                    size={20}
                                    color={isSelected ? '#7C3AED' : '#6B7280'}
                                />
                                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                    {option.label}
                                </Text>
                                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                    {isSelected && <View style={styles.radioInner} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    {/* Custom description for "Other" */}
                    {selectedGender === 'Other' && (
                        <View style={styles.customContainer}>
                            <Text style={styles.customLabel}>
                                Quantumfluid – Exists in multiple gender states simultaneously until observed, collapsing into one form when interacting socially.
                            </Text>
                            <TextInput
                                style={styles.customInput}
                                placeholder="Describe your gender identity (optional)"
                                placeholderTextColor="#9CA3AF"
                                value={customDescription}
                                onChangeText={setCustomDescription}
                                maxLength={30}
                                multiline
                            />
                            <Text style={styles.charCount}>{customDescription.length}/30</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedGender && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedGender}
                >
                    <Text style={[styles.continueButtonText, !selectedGender && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedGender ? '#fff' : '#9CA3AF'}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.preferNotButton} onPress={handlePreferNotToSay}>
                    <Ionicons name="close" size={16} color="#7C3AED" />
                    <Text style={styles.preferNotText}>Prefer not to say</Text>
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
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
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
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: '#7C3AED',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#7C3AED',
    },
    customContainer: {
        backgroundColor: '#FAF5FF',
        borderRadius: 12,
        padding: 16,
        marginTop: 4,
    },
    customLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
        lineHeight: 18,
    },
    customInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#fff',
        minHeight: 60,
    },
    charCount: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'right',
        marginTop: 4,
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
    preferNotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    preferNotText: {
        color: '#7C3AED',
        fontSize: 15,
        fontWeight: '500',
        marginLeft: 8,
    },
});
