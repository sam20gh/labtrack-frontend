import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { parseArrayParam, parseBooleanParam } from './params';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

export default function AllergiesScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [hasAllergies, setHasAllergies] = useState<boolean | null>(
        params.hasAllergies !== undefined ? parseBooleanParam(params.hasAllergies) : null
    );
    const [allergyInput, setAllergyInput] = useState('');
    const [allergies, setAllergies] = useState<string[]>(parseArrayParam(params.allergies));

    const addAllergy = () => {
        if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
            setAllergies(prev => [...prev, allergyInput.trim()]);
            setAllergyInput('');
        }
    };

    const removeAllergy = (allergy: string) => {
        setAllergies(prev => prev.filter(a => a !== allergy));
    };

    const handleYes = () => {
        setHasAllergies(true);
    };

    const handleNo = () => {
        router.push({
            pathname: '/health-assessment/conditions',
            params: {
                ...params,
                hasAllergies: 'false',
                allergies: ''
            }
        });
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/conditions',
            params: {
                ...params,
                hasAllergies: 'true',
                allergies: allergies.join(',')
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/conditions',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 15 / 20;

    // Show allergy input view if user selected "Yes"
    if (hasAllergies) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                {/* Screen Title */}
                <Text style={styles.screenTitle}>Health Assessment</Text>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setHasAllergies(null)} style={styles.backButton}>
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
                    <Text style={styles.title}>Do you have any ongoing allergy?</Text>

                    {/* Illustration */}
                    <View style={styles.illustrationSmall}>
                        <Ionicons name="alert-circle-outline" size={60} color={tone('#F59E0B')} />
                    </View>

                    {/* Input */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.allergyInput}
                            placeholder="Type your allergy..."
                            placeholderTextColor={Palette.textMuted}
                            value={allergyInput}
                            onChangeText={setAllergyInput}
                            onSubmitEditing={addAllergy}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={addAllergy}>
                            <Ionicons name="add" size={20} color={Palette.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Allergy chips */}
                    {allergies.length > 0 && (
                        <View style={styles.chipsWrapper}>
                            <View style={styles.chipsContainer}>
                                {allergies.map((allergy) => (
                                    <View key={allergy} style={styles.chip}>
                                        <Text style={styles.chipText}>{allergy}</Text>
                                        <TouchableOpacity onPress={() => removeAllergy(allergy)}>
                                            <Ionicons name="close" size={16} color={Palette.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.countText}>{allergies.length}/10</Text>
                        </View>
                    )}
                </View>

                {/* Bottom Buttons */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                        <Text style={styles.continueButtonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color={Palette.white} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.noneButton} onPress={handleNo}>
                        <Ionicons name="close" size={16} color={Palette.textSecondary} />
                        <Text style={styles.noneButtonText}>I don't have any</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Initial yes/no question view
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
                <Text style={styles.title}>Do you have any ongoing allergy?</Text>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustrationPlaceholder}>
                        <Ionicons name="warning-outline" size={80} color={tone('#F59E0B')} />
                    </View>
                </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.yesButton} onPress={handleYes}>
                    <Text style={styles.yesButtonText}>Yes, I have them</Text>
                    <Ionicons name="arrow-forward" size={20} color={Palette.white} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.noButton} onPress={handleNo}>
                    <Ionicons name="close" size={16} color={Palette.primary} />
                    <Text style={styles.noButtonText}>I don't have any</Text>
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
        marginBottom: 32,
    },
    illustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustrationPlaceholder: {
        width: 200,
        height: 200,
        backgroundColor: tone('#FEF3C7'),
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    illustrationSmall: {
        marginBottom: 32,
    },
    inputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    allergyInput: {
        flex: 1,
        fontSize: 15,
        color: Palette.text,
        paddingVertical: 14,
    },
    addButton: {
        padding: 8,
    },
    chipsWrapper: {
        width: '100%',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.borderLight,
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 20,
    },
    chipText: {
        fontSize: 13,
        color: tone('#4B5563'),
        marginRight: 6,
    },
    countText: {
        fontSize: 12,
        color: Palette.textMuted,
        textAlign: 'right',
        marginTop: 8,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    yesButton: {
        backgroundColor: Palette.primaryFill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    yesButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
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
    continueButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    noButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
    },
    noButtonText: {
        fontSize: 15,
        color: Palette.primary,
        marginLeft: 8,
    },
    noneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
    },
    noneButtonText: {
        fontSize: 15,
        color: Palette.textSecondary,
        marginLeft: 8,
    },
}));
