import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const bloodTypes = ['A', 'B', 'AB', 'O'];
const rhFactors = ['+', '-'];

export default function BloodTypeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedType, setSelectedType] = useState<string | null>('A');
    const [selectedRh, setSelectedRh] = useState<string | null>(null);

    const handleContinue = () => {
        if (selectedType) {
            router.push({
                pathname: '/health-assessment/fitness-level',
                params: {
                    ...params,
                    bloodType: selectedRh ? `${selectedType}${selectedRh}` : selectedType
                }
            });
        }
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/fitness-level',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 7 / 20;

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
                <Text style={styles.title}>What's your official blood type?</Text>

                {/* Blood Type Selection */}
                <View style={styles.bloodTypeContainer}>
                    {bloodTypes.map((type) => {
                        const isSelected = selectedType === type;
                        return (
                            <TouchableOpacity
                                key={type}
                                style={[styles.bloodTypeButton, isSelected && styles.bloodTypeButtonSelected]}
                                onPress={() => setSelectedType(type)}
                            >
                                <Text style={[styles.bloodTypeText, isSelected && styles.bloodTypeTextSelected]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Blood Type Display */}
                <View style={styles.displayContainer}>
                    <Text style={styles.displayText}>
                        {selectedType || '?'}
                    </Text>
                    <View style={[
                        styles.rhBadge,
                        selectedRh === '-' ? styles.rhBadgeNegative : styles.rhBadgePositive
                    ]}>
                        <Text style={styles.rhBadgeText}>{selectedRh || '?'}</Text>
                    </View>
                </View>

                {/* Rh Factor Selection */}
                <View style={styles.rhContainer}>
                    <TouchableOpacity
                        style={[styles.rhButton, selectedRh === '+' && styles.rhButtonSelected]}
                        onPress={() => setSelectedRh('+')}
                    >
                        <Ionicons name="add" size={24} color={selectedRh === '+' ? '#fff' : '#1F2937'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.rhButton, selectedRh === '-' && styles.rhButtonSelected]}
                        onPress={() => setSelectedRh('-')}
                    >
                        <Ionicons name="remove" size={24} color={selectedRh === '-' ? '#fff' : '#1F2937'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedType}
                >
                    <Text style={[styles.continueButtonText, !selectedType && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={selectedType ? '#fff' : '#9CA3AF'}
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
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    bloodTypeContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 48,
    },
    bloodTypeButton: {
        width: 56,
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    bloodTypeButtonSelected: {
        borderColor: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    bloodTypeText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    bloodTypeTextSelected: {
        color: '#1F2937',
        fontWeight: '600',
    },
    displayContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 48,
    },
    displayText: {
        fontSize: 120,
        fontWeight: '700',
        color: '#1F2937',
        lineHeight: 130,
    },
    rhBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginLeft: -8,
    },
    rhBadgePositive: {
        backgroundColor: '#EF4444',
    },
    rhBadgeNegative: {
        backgroundColor: '#3B82F6',
    },
    rhBadgeText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    rhContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    rhButton: {
        width: 80,
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    rhButtonSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#7C3AED',
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
