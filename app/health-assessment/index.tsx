import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStyles, usePalette } from '@/hooks/useTheme';

const { width } = Dimensions.get('window');

export default function HealthAssessmentWelcome() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [userName, setUserName] = useState('');

    useEffect(() => {
        loadUserName();
    }, []);

    const loadUserName = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            // Could fetch user name from API if needed
        } catch (error) {
            console.log('Error loading user name:', error);
        }
    };

    const handleReady = () => {
        router.push('/health-assessment/name');
    };

    const handleNeedHelp = () => {
        // Could open a help modal or navigate to help screen
        console.log('Need help pressed');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Screen Title */}
            <Text style={styles.screenTitle}>Health Assessment</Text>

            {/* Progress Steps */}
            <View style={styles.progressContainer}>
                <View style={styles.stepContainer}>
                    <View style={[styles.stepDot, styles.stepActive]}>
                        <View style={styles.stepDotInner} />
                    </View>
                    <Text style={[styles.stepText, styles.stepTextActive]}>Assessment</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.stepContainer}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Personal Info</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.stepContainer}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Choose Plan</Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="add" size={40} color={Palette.primary} />
                </View>

                {/* Title */}
                <Text style={styles.title}>
                    Let's fully set up your{'\n'}Predyqt health{'\n'}account.
                </Text>

                {/* Subtitle */}
                <Text style={styles.subtitle}>
                    Here's what we'll do over the next few minutes.
                </Text>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleReady}>
                    <Text style={styles.primaryButtonText}>I'm Ready</Text>
                    <Ionicons name="arrow-forward" size={20} color={Palette.white} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.helpButton} onPress={handleNeedHelp}>
                    <Ionicons name="help-circle-outline" size={20} color={Palette.primary} />
                    <Text style={styles.helpButtonText}>I need help</Text>
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
        fontSize: 14,
        fontWeight: '600',
        color: Palette.primary,
        textAlign: 'center',
        paddingTop: 8,
        marginBottom: 8,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    stepContainer: {
        alignItems: 'center',
    },
    stepDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepActive: {
        borderColor: Palette.primary,
        backgroundColor: Palette.primaryFill,
    },
    stepDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Palette.background,
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: Palette.border,
        marginHorizontal: 8,
        marginBottom: 24,
    },
    stepText: {
        fontSize: 12,
        color: Palette.textMuted,
    },
    stepTextActive: {
        color: Palette.text,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: Palette.text,
        lineHeight: 38,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
        lineHeight: 24,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    primaryButton: {
        backgroundColor: Palette.primaryFill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    primaryButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    helpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    helpButtonText: {
        color: Palette.primary,
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
}));
