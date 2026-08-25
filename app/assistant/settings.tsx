/**
 * Assistant settings: interaction mode, and clearing the conversation.
 *
 * The kit's version of the destructive screen is headed "Clear AI Assistant Data & Reset
 * Memory?" and warns that the chatbot "will lose knowledge about your health data". That
 * second half is not true of this build and is not repeated here: the assistant's knowledge
 * of someone comes from their results, reports and assessment, which this does not touch.
 * What clearing removes is the transcript — the things they typed, which is the sensitive
 * part and the reason the control exists. Saying it accurately is the difference between a
 * privacy control and a scare.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import {
    getConversation, clearConversation, savePreferences,
    type AssistantMode, type Conversation,
} from '@/lib/assistant';

const MODE_LABEL: Record<AssistantMode, string> = {
    chat: 'Chat',
    immersive: 'Immersive',
};

export default function AssistantSettings() {
    const router = useRouter();
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setConversation(await getConversation());
            } catch (err) {
                if (err instanceof ApiError && err.isAuthError) {
                    router.replace('/(auth)/loginscreen');
                    return;
                }
                setError(err instanceof ApiError ? err.message : 'Could not load your settings.');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    const setMode = async (mode: AssistantMode) => {
        if (!conversation || conversation.mode === mode) return;
        // Optimistic, then reconciled from the server response — the radio should move
        // under the finger, not a round-trip later.
        setConversation({ ...conversation, mode });
        try {
            setConversation(await savePreferences({ mode }));
        } catch (err) {
            setConversation({ ...conversation });
            setError(err instanceof ApiError ? err.message : 'Could not save that.');
        }
    };

    const confirmClear = () => {
        Alert.alert(
            'Clear your conversation?',
            'This deletes every message you and the assistant have exchanged. Your results, reports and plan are not affected. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        setError(null);
                        try {
                            setConversation(await clearConversation());
                        } catch (err) {
                            setError(err instanceof ApiError ? err.message : 'Could not clear your conversation.');
                        } finally {
                            setBusy(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const messageCount = conversation?.messages.length ?? 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI assistant</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.summary}>
                    <View style={styles.summaryTile}>
                        <Text style={styles.summaryValue}>{conversation?.lifetimeMessages ?? 0}</Text>
                        <Text style={styles.summaryLabel}>messages all time</Text>
                    </View>
                    <View style={styles.summaryTile}>
                        <Text style={styles.summaryValue}>{messageCount}</Text>
                        <Text style={styles.summaryLabel}>in your history</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Interaction mode</Text>
                <View style={styles.group}>
                    {(['chat', 'immersive'] as AssistantMode[]).map((mode) => {
                        const selected = conversation?.mode === mode;
                        return (
                            <TouchableOpacity
                                key={mode}
                                style={styles.row}
                                onPress={() => setMode(mode)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                            >
                                <Text style={styles.rowText}>{MODE_LABEL[mode]}</Text>
                                <Ionicons
                                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                                    size={20}
                                    color={selected ? Palette.primary : Palette.border}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.sectionTitle}>Your conversation</Text>
                <View style={styles.note}>
                    <Text style={styles.noteText}>
                        The assistant answers from your results, reports and health assessment. Clearing
                        your conversation deletes the messages — it does not delete any of your health
                        data, and the assistant will still know your results next time you ask.
                    </Text>
                </View>

                {conversation?.clearedAt ? (
                    <Text style={styles.cleared}>
                        Last cleared {new Date(conversation.clearedAt).toLocaleDateString()}
                    </Text>
                ) : null}

                <TouchableOpacity
                    style={[styles.destructive, (busy || messageCount === 0) && styles.destructiveDisabled]}
                    onPress={confirmClear}
                    disabled={busy || messageCount === 0}
                >
                    {busy
                        ? <ActivityIndicator color={Palette.danger} />
                        : (
                            <Text style={styles.destructiveText}>
                                {messageCount === 0 ? 'Nothing to clear' : 'Clear conversation'}
                            </Text>
                        )}
                </TouchableOpacity>

                {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    backButton: { marginLeft: -8, padding: 4 },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    headerSpacer: { width: 28 },

    body: { padding: Spacing.xl, gap: Spacing.lg },

    summary: { flexDirection: 'row', gap: Spacing.md },
    summaryTile: {
        flex: 1, backgroundColor: Palette.surface, borderRadius: Radius.xl,
        padding: Spacing.lg, gap: 2,
    },
    summaryValue: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    summaryLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },

    sectionTitle: {
        fontSize: 12, fontFamily: Fonts.semibold, color: Palette.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.md,
    },
    group: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl, overflow: 'hidden',
    },
    row: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border,
    },
    rowText: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },

    note: { backgroundColor: Palette.surface, borderRadius: Radius.xl, padding: Spacing.lg },
    noteText: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },
    cleared: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    destructive: {
        height: 50, borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.danger,
        alignItems: 'center', justifyContent: 'center',
    },
    destructiveDisabled: { borderColor: Palette.border },
    destructiveText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.danger },

    error: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.danger },
});
