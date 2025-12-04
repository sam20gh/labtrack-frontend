import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type RecordingState = 'idle' | 'ready' | 'recording' | 'completed';

export default function VoiceAnalysisScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [hasRecording, setHasRecording] = useState(false);

    // Animation values for waveform
    const waveAnimations = useRef(
        Array.from({ length: 20 }, () => new Animated.Value(0.3))
    ).current;

    // Timer ref
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (recordingState === 'recording') {
            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            // Animate waveform
            const animations = waveAnimations.map((anim, index) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: Math.random() * 0.7 + 0.3,
                            duration: 150 + Math.random() * 100,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.3,
                            duration: 150 + Math.random() * 100,
                            useNativeDriver: true,
                        }),
                    ])
                );
            });

            Animated.parallel(animations).start();
        } else {
            // Stop timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            // Reset animations
            waveAnimations.forEach(anim => {
                anim.stopAnimation();
                anim.setValue(0.3);
            });
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [recordingState]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartRecording = () => {
        setRecordingState('ready');
        // In a real app, request microphone permissions here
        setTimeout(() => {
            setRecordingState('recording');
        }, 500);
    };

    const handleStopRecording = () => {
        setRecordingState('completed');
        setHasRecording(true);
    };

    const handleDeleteRecording = () => {
        Alert.alert(
            'Delete Recording',
            'Are you sure you want to delete this recording?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setRecordingState('idle');
                        setRecordingDuration(0);
                        setHasRecording(false);
                    }
                },
            ]
        );
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/complete',
            params: {
                ...params,
                hasVoiceRecording: hasRecording ? 'true' : 'false',
                voiceDuration: recordingDuration.toString(),
            },
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/complete',
            params: {
                ...params,
                hasVoiceRecording: 'false',
                voiceDuration: '0',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <Text style={styles.screenTitle}>Health Assessment</Text>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: '95%' }]} />
                    </View>
                </View>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title}>Voice Analysis</Text>
                <Text style={styles.subtitle}>
                    Record a brief description of how you're feeling today. This helps us understand your health better.
                </Text>

                {/* Recording Area */}
                <View style={styles.recordingArea}>
                    {/* Waveform Visualization */}
                    <View style={styles.waveformContainer}>
                        {recordingState === 'recording' ? (
                            <View style={styles.waveform}>
                                {waveAnimations.map((anim, index) => (
                                    <Animated.View
                                        key={index}
                                        style={[
                                            styles.waveBar,
                                            {
                                                transform: [{ scaleY: anim }],
                                                backgroundColor: index % 2 === 0 ? '#7C3AED' : '#A78BFA',
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        ) : recordingState === 'completed' ? (
                            <View style={styles.completedContainer}>
                                <View style={styles.completedIcon}>
                                    <Ionicons name="checkmark-circle" size={60} color="#10B981" />
                                </View>
                                <Text style={styles.completedText}>Recording saved!</Text>
                                <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                            </View>
                        ) : (
                            <View style={styles.idleContainer}>
                                <View style={styles.micIconContainer}>
                                    <Ionicons name="mic" size={50} color="#7C3AED" />
                                </View>
                                <Text style={styles.idleText}>
                                    {recordingState === 'ready' ? 'Getting ready...' : 'Tap to start recording'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Recording Timer */}
                    {recordingState === 'recording' && (
                        <View style={styles.timerContainer}>
                            <View style={styles.recordingIndicator} />
                            <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                        </View>
                    )}
                </View>

                {/* Recording Controls */}
                <View style={styles.controlsContainer}>
                    {recordingState === 'idle' || recordingState === 'ready' ? (
                        <TouchableOpacity
                            style={[styles.recordButton, recordingState === 'ready' && styles.recordButtonReady]}
                            onPress={handleStartRecording}
                            disabled={recordingState === 'ready'}
                        >
                            <Ionicons name="mic" size={32} color="#fff" />
                        </TouchableOpacity>
                    ) : recordingState === 'recording' ? (
                        <TouchableOpacity
                            style={styles.stopButton}
                            onPress={handleStopRecording}
                        >
                            <View style={styles.stopIcon} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.completedControls}>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={handleDeleteRecording}
                            >
                                <Ionicons name="trash-outline" size={24} color="#EF4444" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.reRecordButton}
                                onPress={() => {
                                    setRecordingState('idle');
                                    setRecordingDuration(0);
                                    setHasRecording(false);
                                }}
                            >
                                <Ionicons name="refresh" size={24} color="#7C3AED" />
                                <Text style={styles.reRecordText}>Re-record</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>Tips for a good recording:</Text>
                    <View style={styles.instructionItem}>
                        <Ionicons name="volume-high" size={18} color="#6B7280" />
                        <Text style={styles.instructionText}>Speak clearly and at a normal pace</Text>
                    </View>
                    <View style={styles.instructionItem}>
                        <Ionicons name="location" size={18} color="#6B7280" />
                        <Text style={styles.instructionText}>Find a quiet environment</Text>
                    </View>
                    <View style={styles.instructionItem}>
                        <Ionicons name="time" size={18} color="#6B7280" />
                        <Text style={styles.instructionText}>Keep it under 2 minutes</Text>
                    </View>
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.continueButton, !hasRecording && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueButtonText}>
                        {hasRecording ? 'Continue' : 'Record or Skip'}
                    </Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        padding: 4,
    },
    progressContainer: {
        flex: 1,
        marginHorizontal: 16,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#7C3AED',
        borderRadius: 4,
    },
    skipText: {
        fontSize: 16,
        color: '#7C3AED',
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        lineHeight: 24,
        marginBottom: 32,
    },
    recordingArea: {
        alignItems: 'center',
        marginBottom: 24,
    },
    waveformContainer: {
        width: '100%',
        height: 150,
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 80,
        gap: 4,
    },
    waveBar: {
        width: 4,
        height: 60,
        borderRadius: 2,
    },
    idleContainer: {
        alignItems: 'center',
    },
    micIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#EDE9FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    idleText: {
        fontSize: 16,
        color: '#6B7280',
    },
    completedContainer: {
        alignItems: 'center',
    },
    completedIcon: {
        marginBottom: 8,
    },
    completedText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#10B981',
        marginBottom: 4,
    },
    durationText: {
        fontSize: 14,
        color: '#6B7280',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
    },
    timerText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1F2937',
        fontVariant: ['tabular-nums'],
    },
    controlsContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    recordButtonReady: {
        opacity: 0.7,
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    stopIcon: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    completedControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    deleteButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reRecordButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#EDE9FE',
        borderRadius: 25,
        gap: 8,
    },
    reRecordText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#7C3AED',
    },
    instructionsContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
    },
    instructionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 14,
        color: '#6B7280',
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    continueButton: {
        backgroundColor: '#7C3AED',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: '#A78BFA',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
