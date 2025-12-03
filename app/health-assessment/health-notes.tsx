import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MAX_CHARS = 500;

export default function HealthNotesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [notes, setNotes] = useState('');
    const [history, setHistory] = useState<string[]>(['']);
    const [historyIndex, setHistoryIndex] = useState(0);

    const handleTextChange = (text: string) => {
        if (text.length <= MAX_CHARS) {
            setNotes(text);
            // Add to history for undo/redo
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(text);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setNotes(history[historyIndex - 1]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setNotes(history[historyIndex + 1]);
        }
    };

    const handleClear = () => {
        setNotes('');
        setHistory(['']);
        setHistoryIndex(0);
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/voice-analysis',
            params: {
                ...params,
                healthNotes: notes,
            },
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/voice-analysis',
            params: {
                ...params,
                healthNotes: '',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: '90%' }]} />
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>Add any health notes</Text>
                    <Text style={styles.subtitle}>
                        Share any additional health information, symptoms, or concerns you'd like us to know about.
                    </Text>

                    {/* Text Input Area */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type your health notes here..."
                            placeholderTextColor="#999"
                            multiline
                            value={notes}
                            onChangeText={handleTextChange}
                            textAlignVertical="top"
                        />

                        {/* Character Count */}
                        <Text style={styles.charCount}>
                            {notes.length}/{MAX_CHARS}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, historyIndex === 0 && styles.actionButtonDisabled]}
                            onPress={handleUndo}
                            disabled={historyIndex === 0}
                        >
                            <Ionicons
                                name="arrow-undo"
                                size={20}
                                color={historyIndex === 0 ? '#ccc' : '#7C3AED'}
                            />
                            <Text style={[
                                styles.actionButtonText,
                                historyIndex === 0 && styles.actionButtonTextDisabled
                            ]}>Undo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, historyIndex >= history.length - 1 && styles.actionButtonDisabled]}
                            onPress={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                        >
                            <Ionicons
                                name="arrow-redo"
                                size={20}
                                color={historyIndex >= history.length - 1 ? '#ccc' : '#7C3AED'}
                            />
                            <Text style={[
                                styles.actionButtonText,
                                historyIndex >= history.length - 1 && styles.actionButtonTextDisabled
                            ]}>Redo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, notes.length === 0 && styles.actionButtonDisabled]}
                            onPress={handleClear}
                            disabled={notes.length === 0}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color={notes.length === 0 ? '#ccc' : '#EF4444'}
                            />
                            <Text style={[
                                styles.actionButtonText,
                                { color: notes.length === 0 ? '#ccc' : '#EF4444' }
                            ]}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bottom Button */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                        <Text style={styles.continueButtonText}>Continue</Text>
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
        marginBottom: 24,
    },
    inputContainer: {
        flex: 1,
        maxHeight: 300,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
        marginBottom: 16,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        lineHeight: 24,
    },
    charCount: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'right',
        marginTop: 8,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        gap: 6,
    },
    actionButtonDisabled: {
        backgroundColor: '#F9FAFB',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#7C3AED',
    },
    actionButtonTextDisabled: {
        color: '#ccc',
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
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
