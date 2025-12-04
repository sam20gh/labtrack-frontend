import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NameScreen() {
    const router = useRouter();
    const [name, setName] = useState('');

    const handleContinue = () => {
        if (name.trim()) {
            router.push({
                pathname: '/health-assessment/health-goals',
                params: { name: name.trim() }
            });
        }
    };

    const handleSkip = () => {
        router.push('/health-assessment/health-goals');
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 1 / 20; // Step 1 of ~20 steps

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
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
                    <Text style={styles.title}>What's your full legal name?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Enter your name..."
                        placeholderTextColor="#9CA3AF"
                        value={name}
                        onChangeText={setName}
                        autoFocus
                    />

                    <View style={styles.infoContainer}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#9CA3AF" />
                        <Text style={styles.infoText}>
                            For regulatory purposes, please enter name stated on your state ID.
                        </Text>
                    </View>
                </View>

                {/* Bottom Button */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={[styles.continueButton, !name.trim() && styles.continueButtonDisabled]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={[styles.continueButtonText, !name.trim() && styles.continueButtonTextDisabled]}>
                            Continue
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color={name.trim() ? '#fff' : '#9CA3AF'}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    keyboardView: {
        flex: 1,
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
        paddingTop: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 32,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: '#1F2937',
        textAlign: 'center',
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingHorizontal: 20,
    },
    infoText: {
        fontSize: 13,
        color: '#9CA3AF',
        marginLeft: 8,
        textAlign: 'center',
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
