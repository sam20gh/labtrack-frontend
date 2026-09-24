import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramString } from './params';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';

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
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedGender, setSelectedGender] = useState<string | null>(paramString(params.gender) ?? null);
    const [customDescription, setCustomDescription] = useState(paramString(params.genderDescription) ?? '');

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
                                    color={isSelected ? activePalette().primary : activePalette().textSecondary}
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
                                placeholderTextColor={Palette.textMuted}
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
                        color={selectedGender ? '#fff' : activePalette().textMuted}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.preferNotButton} onPress={handlePreferNotToSay}>
                    <Ionicons name="close" size={16} color={Palette.primary} />
                    <Text style={styles.preferNotText}>Prefer not to say</Text>
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
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Palette.textSecondary,
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
        borderColor: Palette.border,
        borderRadius: 12,
        backgroundColor: Palette.background,
    },
    optionItemSelected: {
        borderColor: Palette.primary,
        backgroundColor: tone('#FAF5FF'),
    },
    optionLabel: {
        flex: 1,
        fontSize: 15,
        color: tone('#4B5563'),
        marginLeft: 12,
    },
    optionLabelSelected: {
        color: Palette.primary,
        fontWeight: '500',
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: tone('#D1D5DB'),
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: Palette.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Palette.primaryFill,
    },
    customContainer: {
        backgroundColor: tone('#FAF5FF'),
        borderRadius: 12,
        padding: 16,
        marginTop: 4,
    },
    customLabel: {
        fontSize: 13,
        color: Palette.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    customInput: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: Palette.text,
        backgroundColor: Palette.background,
        minHeight: 60,
    },
    charCount: {
        fontSize: 12,
        color: Palette.textMuted,
        textAlign: 'right',
        marginTop: 4,
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
    preferNotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
    },
    preferNotText: {
        color: Palette.primary,
        fontSize: 15,
        fontWeight: '500',
        marginLeft: 8,
    },
}));
