import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

export default function ConditionsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams();

    const handleYes = () => {
        router.push({
            pathname: '/health-assessment/conditions-list',
            params: { ...params, hasConditions: 'true' }
        });
    };

    const handleNo = () => {
        router.push({
            pathname: '/health-assessment/checkup-frequency',
            params: {
                ...params,
                hasConditions: 'false',
                conditions: ''
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/checkup-frequency',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 16 / 20;

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
                <Text style={styles.title}>Do you have any medical conditions?</Text>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustrationPlaceholder}>
                        <Ionicons name="fitness-outline" size={60} color={Palette.primary} />
                        <View style={styles.heartBadge}>
                            <Ionicons name="heart" size={20} color={Palette.primary} />
                        </View>
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
        width: 180,
        height: 180,
        backgroundColor: Palette.borderLight,
        borderRadius: 90,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    heartBadge: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: tone('#EDE9FE'),
        alignItems: 'center',
        justifyContent: 'center',
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
}));
