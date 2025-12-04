import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MedicationsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const handleYes = () => {
        router.push({
            pathname: '/health-assessment/medications-list',
            params: { ...params }
        });
    };

    const handleNo = () => {
        router.push({
            pathname: '/health-assessment/allergies',
            params: {
                ...params,
                medications: ''
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/allergies',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 14 / 20;

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
                <Text style={styles.title}>Are you currently taking any medications?</Text>
                <Text style={styles.subtitle}>
                    We are asking this to get accurate result.
                </Text>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustrationPlaceholder}>
                        <Ionicons name="medkit-outline" size={80} color="#7C3AED" />
                        <View style={styles.heartBadge}>
                            <Ionicons name="heart" size={24} color="#EF4444" />
                        </View>
                    </View>
                </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.yesButton} onPress={handleYes}>
                    <Text style={styles.yesButtonText}>Yes, I take it</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.noButton} onPress={handleNo}>
                    <Text style={styles.noButtonText}>Nope, I don't take it</Text>
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
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 48,
    },
    illustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustrationPlaceholder: {
        width: 200,
        height: 200,
        backgroundColor: '#F3F4F6',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    heartBadge: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
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
    },
});
