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

export default function AllergiesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [hasAllergies, setHasAllergies] = useState<boolean | null>(null);
    const [allergyInput, setAllergyInput] = useState('');
    const [allergies, setAllergies] = useState<string[]>([]);

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
                allergies: ''
            }
        });
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/conditions',
            params: {
                ...params,
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
                    <Text style={styles.title}>Do you have any ongoing allergy?</Text>

                    {/* Illustration */}
                    <View style={styles.illustrationSmall}>
                        <Ionicons name="alert-circle-outline" size={60} color="#F59E0B" />
                    </View>

                    {/* Input */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.allergyInput}
                            placeholder="Type your allergy..."
                            placeholderTextColor="#9CA3AF"
                            value={allergyInput}
                            onChangeText={setAllergyInput}
                            onSubmitEditing={addAllergy}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={addAllergy}>
                            <Ionicons name="add" size={20} color="#7C3AED" />
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
                                            <Ionicons name="close" size={16} color="#6B7280" />
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
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.noneButton} onPress={handleNo}>
                        <Ionicons name="close" size={16} color="#6B7280" />
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
                <Text style={styles.title}>Do you have any ongoing allergy?</Text>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustrationPlaceholder}>
                        <Ionicons name="warning-outline" size={80} color="#F59E0B" />
                    </View>
                </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.yesButton} onPress={handleYes}>
                    <Text style={styles.yesButtonText}>Yes, I have them</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.noButton} onPress={handleNo}>
                    <Ionicons name="close" size={16} color="#7C3AED" />
                    <Text style={styles.noButtonText}>I don't have any</Text>
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
        backgroundColor: '#FEF3C7',
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
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    allergyInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
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
        backgroundColor: '#F3F4F6',
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 20,
    },
    chipText: {
        fontSize: 13,
        color: '#4B5563',
        marginRight: 6,
    },
    countText: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'right',
        marginTop: 8,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    yesButton: {
        backgroundColor: '#7C3AED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    yesButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
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
    continueButtonText: {
        color: '#fff',
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
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    noButtonText: {
        fontSize: 15,
        color: '#7C3AED',
        marginLeft: 8,
    },
    noneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    noneButtonText: {
        fontSize: 15,
        color: '#6B7280',
        marginLeft: 8,
    },
});
