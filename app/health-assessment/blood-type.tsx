import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paramString } from './params';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';

const bloodTypes = ['A', 'B', 'AB', 'O'];
const rhFactors = ['+', '-'];

export default function BloodTypeScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();
    // Stored as one string ("AB+"); the screen picks the group and the factor separately.
    const seededBloodType = paramString(params.bloodType);
    const seededRh = seededBloodType?.slice(-1);
    const [selectedType, setSelectedType] = useState<string | null>(
        seededBloodType ? seededBloodType.replace(/[+-]$/, '') : 'A'
    );
    const [selectedRh, setSelectedRh] = useState<string | null>(
        seededRh === '+' || seededRh === '-' ? seededRh : null
    );

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
                        <Ionicons name="add" size={24} color={selectedRh === '+' ? '#fff' : activePalette().text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.rhButton, selectedRh === '-' && styles.rhButtonSelected]}
                        onPress={() => setSelectedRh('-')}
                    >
                        <Ionicons name="remove" size={24} color={selectedRh === '-' ? '#fff' : activePalette().text} />
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
                        color={selectedType ? '#fff' : activePalette().textMuted}
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
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Palette.text,
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
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.background,
    },
    bloodTypeButtonSelected: {
        borderColor: Palette.text,
        backgroundColor: tone('#F9FAFB'),
    },
    bloodTypeText: {
        fontSize: 16,
        color: Palette.textSecondary,
        fontWeight: '500',
    },
    bloodTypeTextSelected: {
        color: Palette.text,
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
        color: Palette.text,
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
        backgroundColor: tone('#EF4444'),
    },
    rhBadgeNegative: {
        backgroundColor: tone('#3B82F6'),
    },
    rhBadgeText: {
        fontSize: 18,
        fontWeight: '700',
        color: Palette.white,
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
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.background,
    },
    rhButtonSelected: {
        borderColor: Palette.primary,
        backgroundColor: Palette.primaryFill,
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
