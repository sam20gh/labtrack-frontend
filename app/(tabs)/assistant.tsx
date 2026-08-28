/**
 * The AI assistant — Chatbot Mode.
 *
 * Took the tab slot the profile used to hold. Structure follows the kit's chat screens: a
 * top nav carrying the assistant's identity, the transcript, and a composer docked to the
 * keyboard. What the kit calls a Custom Chat Widget is `AssistantWidgetCard` — the model
 * answers with a card drawn from the person's own records, and the bubble is the framing.
 *
 * Two gates run before the conversation is reachable, both resolved from the server rather
 * than local storage so neither re-asks after a reinstall:
 *   - the precautions have not been accepted → `/assistant/intro`
 *   - they chose Immersive Mode → `/assistant/immersive`
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import MessageBubble from '@/components/assistant/MessageBubble';
import TypingIndicator from '@/components/assistant/TypingIndicator';
import InputDock from '@/components/assistant/InputDock';
import {
    getConversation, sendMessage, STARTERS,
    type AssistantMessage, type AssistantCapabilities, type ImageUpload,
} from '@/lib/assistant';

/** Text on, the rest off, until the server has said otherwise. See `assistant/immersive.tsx`. */
const NO_CAPABILITIES: AssistantCapabilities = { text: true, vision: false, voice: false };

export default function AssistantScreen() {
    const router = useRouter();
    // Set by `assistant/voice.tsx` when a transcript has been read back and confirmed.
    const params = useLocalSearchParams<{ spoken?: string }>();
    const scrollRef = useRef<ScrollView>(null);
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [available, setAvailable] = useState(true);
    const [capabilities, setCapabilities] = useState<AssistantCapabilities>(NO_CAPABILITIES);

    const load = useCallback(async () => {
        try {
            const conversation = await getConversation();

            if (!conversation.acceptedPrecautions) {
                router.replace('/assistant/intro');
                return;
            }
            if (conversation.mode === 'immersive') {
                router.replace('/assistant/immersive');
                return;
            }

            setMessages(conversation.messages);
            setAvailable(conversation.available !== false);
            setCapabilities(conversation.capabilities ?? NO_CAPABILITIES);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof ApiError ? err.message : 'Could not load your conversation.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Scroll after layout has settled, or the new message is still above the fold. */
    const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const send = useCallback(async (
        text: string,
        image: ImageUpload | null = null,
        spoken = false
    ) => {
        // The person's message is rendered immediately rather than after the round-trip.
        // The server persists it before calling the model, so the optimistic bubble is not
        // a lie about what was saved — it matches what the server already has.
        //
        // The picture is shown from the local file the picker returned. The server's stored
        // copy takes over on the next load, and `url: null` there is what the bubble falls
        // back to when storage refused it.
        const optimistic: AssistantMessage = {
            role: 'user',
            text,
            attachment: image
                ? { kind: 'image', url: image.uri, mimeType: image.mimeType }
                : spoken ? { kind: 'voice', url: null, mimeType: null }
                    : null,
            widget: null, suggestions: [], escalate: false,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        setSending(true);
        setError(null);
        scrollToEnd();

        try {
            const { message } = await sendMessage(text, { image, spoken });
            setMessages((prev) => [...prev, message]);
            scrollToEnd();
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            // The question stays in the transcript — the server kept it too, so removing it
            // here would put the two out of step and lose what they typed.
            setError(err instanceof ApiError ? err.message : 'The assistant could not reply.');
        } finally {
            setSending(false);
        }
    }, [router]);

    /**
     * Send a question that arrived from Voice Mode.
     *
     * Cleared the moment it is taken so a re-render cannot resend and so asking the same
     * thing twice still works. Mirrors `assistant/immersive.tsx`.
     */
    const consuming = useRef(false);
    useEffect(() => {
        const spoken = typeof params.spoken === 'string' ? params.spoken.trim() : '';
        if (!spoken || loading || consuming.current) return;

        consuming.current = true;
        router.setParams({ spoken: '' });
        send(spoken, null, true).finally(() => { consuming.current = false; });
    }, [params.spoken, loading, router, send]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* This tab group sets headerShown: false and draws no app bar, so the screen
                owns its own top inset and title. */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Ionicons name="sparkles" size={18} color={Palette.white} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.headerName}>LabTrack AI</Text>
                    <Text style={styles.headerCaption}>
                        {sending ? 'Thinking…' : 'Knows your results and your plan'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/assistant/settings')}
                    accessibilityLabel="Assistant settings"
                    style={styles.headerButton}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color={Palette.textSecondary} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                // The tab bar sits under the composer; without this offset the dock lifts
                // to the keyboard but leaves a tab-bar-shaped gap beneath it on iOS.
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.flex}
                    contentContainerStyle={styles.transcript}
                    onContentSizeChange={scrollToEnd}
                    keyboardDismissMode="interactive"
                >
                    {messages.length === 0 ? (
                        <View style={styles.empty}>
                            <View style={styles.emptyBadge}>
                                <Ionicons name="sparkles" size={26} color={Palette.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>Ask me anything about your health</Text>
                            <Text style={styles.emptyBody}>
                                I can read your results, your genetic findings, and your plan — so ask about
                                yours, not health in general.
                            </Text>
                            <View style={styles.starters}>
                                {STARTERS.map((s) => (
                                    <TouchableOpacity key={s} style={styles.starter} onPress={() => send(s)}>
                                        <Text style={styles.starterText}>{s}</Text>
                                        <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        messages.map((m, i) => (
                            <MessageBubble
                                key={`${m.createdAt}-${i}`}
                                message={m}
                                onSuggestion={sending ? undefined : send}
                            />
                        ))
                    )}

                    {sending ? <TypingIndicator /> : null}

                    {error ? (
                        <View style={styles.error}>
                            <Ionicons name="cloud-offline-outline" size={16} color={Palette.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                {available ? (
                    <InputDock
                        onSend={send}
                        busy={sending}
                        allowImages={capabilities.vision}
                        onVoice={() => router.push({
                            pathname: '/assistant/voice',
                            params: { returnTo: '/(tabs)/assistant' },
                        })}
                        voiceDisabledReason={capabilities.voice
                            ? null
                            : 'This LabTrack server has no speech-to-text configured, '
                              + 'so questions have to be typed for now.'}
                    />
                ) : (
                    <View style={styles.unavailable}>
                        <Text style={styles.unavailableText}>
                            The assistant is not configured on this server yet.
                        </Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Palette.borderLight,
    },
    avatar: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center',
    },
    headerText: { flex: 1, gap: 1 },
    headerName: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    headerCaption: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },
    headerButton: { padding: Spacing.xs },

    transcript: { padding: Spacing.xl, paddingBottom: Spacing.md, flexGrow: 1 },

    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.xxxl },
    emptyBadge: {
        width: 62, height: 62, borderRadius: 31,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    emptyTitle: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    emptyBody: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.lg,
    },
    starters: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.xxl },
    starter: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.lg,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    },
    starterText: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },

    error: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.dangerSurface, borderRadius: Radius.lg, padding: Spacing.md,
    },
    errorText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, color: Palette.danger },

    unavailable: {
        padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    unavailableText: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center',
    },
});
