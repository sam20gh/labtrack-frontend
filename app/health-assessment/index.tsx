import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function HealthAssessmentWelcome() {
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
                    <Ionicons name="add" size={40} color="#7C3AED" />
                </View>

                {/* Title */}
                <Text style={styles.title}>
                    Let's fully set up your{'\n'}LabTrack health{'\n'}account.
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
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.helpButton} onPress={handleNeedHelp}>
                    <Ionicons name="help-circle-outline" size={20} color="#7C3AED" />
                    <Text style={styles.helpButtonText}>I need help</Text>
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
        fontSize: 14,
        fontWeight: '600',
        color: '#7C3AED',
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
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepActive: {
        borderColor: '#7C3AED',
        backgroundColor: '#7C3AED',
    },
    stepDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
        marginBottom: 24,
    },
    stepText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    stepTextActive: {
        color: '#1F2937',
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
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        lineHeight: 38,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        lineHeight: 24,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    primaryButton: {
        backgroundColor: '#7C3AED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    primaryButtonText: {
        color: '#fff',
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
        color: '#7C3AED',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
});
