/**
 * The AI assistant — Immersive Mode.
 *
 * The kit's version is a dark, full-bleed screen: an animated orb, the assistant's words
 * across the top, the answer's card floating in the middle, and a pill composer at the
 * bottom. One exchange at a time, with no transcript to scroll.
 *
 * What that trades away is deliberate. Chat mode is for reading back over what you were
 * told; this is for asking one thing and getting a clear answer. Both write to the same
 * conversation on the server — switching modes does not fork the history, it changes how
 * the same history is presented, and the last exchange is what this shows on open.
 *
 * The kit drives its orb with voice input, and that is now real: the composer's microphone
 * opens `assistant/voice.tsx`, which records, transcribes, and hands the words back here as
 * a param for this screen to send — so the answer generates under the orb rather than on a
 * screen the person has left. The orb itself still responds to request state rather than to
 * live microphone level, because while a question is being answered there is no microphone
 * running to respond to.
 *
 * Both of the kit's non-text inputs depend on server keys the app cannot see, so
 * `capabilities` on the conversation decides what the composer offers. Voice in particular
 * needs a transcription key that is frequently unset; the microphone is then drawn greyed
 * and says why, rather than failing on tap.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing,
    ScrollView, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '@/lib/api';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import AssistantWidgetCard from '@/components/assistant/AssistantWidget';
import InputDock from '@/components/assistant/InputDock';
import {
    getConversation, sendMessage, savePreferences, STARTERS,
    type AssistantMessage, type AssistantCapabilities, type ImageUpload,
} from '@/lib/assistant';

/**
 * What the composer may offer before the server has said.
 *
 * Text on, the rest off. The alternative — assume everything works and switch controls off
 * when the conversation loads — flashes a live microphone for as long as the request takes
 * and disables it under the person's thumb.
 */
const NO_CAPABILITIES: AssistantCapabilities = { text: true, vision: false, voice: false };

/**
 * The orb.
 *
 * Two looping animations rather than one: a slow breath that runs always, so the screen is
 * never fully static, and a faster pulse layered on while a reply is generating. Both drive
 * transform and opacity only, which `useNativeDriver` can run off the JS thread — the JS
 * thread is busy awaiting the response, which is exactly when a JS-driven animation stutters.
 */
const Orb = ({ busy }: { busy: boolean }) => {
    const breath = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breath, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(breath, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [breath]);

    useEffect(() => {
        if (!busy) {
            pulse.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [busy, pulse]);

    const scale = Animated.add(
        breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
        pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] })
    );
    const haloOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

    return (
        <View style={styles.orbWrap} pointerEvents="none">
            <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale }] }]} />
            <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.orbFill}
                />
            </Animated.View>
        </View>
    );
};

export default function ImmersiveAssistant() {
    const router = useRouter();
    // Set by `assistant/voice.tsx` when a transcript has been read back and confirmed.
    const params = useLocalSearchParams<{ spoken?: string }>();

    const [last, setLast] = useState<AssistantMessage | null>(null);
    const [asked, setAsked] = useState<string | null>(null);
    /** The photograph on the question currently being shown, so it stays visible with it. */
    const [askedImage, setAskedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capabilities, setCapabilities] = useState<AssistantCapabilities>(NO_CAPABILITIES);

    useEffect(() => {
        (async () => {
            try {
                const conversation = await getConversation();
                if (!conversation.acceptedPrecautions) {
                    router.replace('/assistant/intro');
                    return;
                }
                setCapabilities(conversation.capabilities ?? NO_CAPABILITIES);
                // Open on the last *exchange*, so returning to the screen resumes rather
                // than resets. Taken as a pair from the end rather than as "the last
                // assistant message" and "the last user message" independently — when a
                // reply failed, the transcript ends on an unanswered question, and picking
                // those two separately would caption a stale answer with a newer question.
                const messages = conversation.messages;
                const tail = messages[messages.length - 1];
                if (tail?.role === 'assistant') {
                    setLast(tail);
                    const before = messages[messages.length - 2];
                    setAsked(before?.role === 'user' ? before.text : null);
                    // Only a stored URL can be redrawn — the local file the picker handed
                    // us is gone by the next launch, and `attachment.url` is null when the
                    // server could not keep a copy.
                    setAskedImage(before?.attachment?.kind === 'image' ? before.attachment.url : null);
                } else if (tail?.role === 'user') {
                    setLast(null);
                    setAsked(tail.text);
                    setAskedImage(tail.attachment?.kind === 'image' ? tail.attachment.url : null);
                }
            } catch (err) {
                if (err instanceof ApiError && err.isAuthError) {
                    router.replace('/(auth)/loginscreen');
                    return;
                }
                setError(err instanceof ApiError ? err.message : 'Could not reach the assistant.');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    const send = useCallback(async (
        text: string,
        image: ImageUpload | null = null,
        spoken = false
    ) => {
        setAsked(text);
        // The local file, not a stored URL: it is on the device already and shows while the
        // upload is still in flight. The server's copy replaces it on the next load.
        setAskedImage(image?.uri ?? null);
        setLast(null);
        setSending(true);
        setError(null);
        try {
            const { message } = await sendMessage(text, { image, spoken });
            setLast(message);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof ApiError ? err.message : 'The assistant could not reply.');
        } finally {
            setSending(false);
        }
    }, [router]);

    /**
     * Send a question that arrived from Voice Mode.
     *
     * The param is cleared the moment it is taken, for two reasons: a re-render must not
     * resend, and asking the same thing twice must still work — a guard that remembered the
     * last transcript would silently swallow the repeat.
     */
    const consuming = useRef(false);
    useEffect(() => {
        const spoken = typeof params.spoken === 'string' ? params.spoken.trim() : '';
        if (!spoken || loading || consuming.current) return;

        consuming.current = true;
        router.setParams({ spoken: '' });
        send(spoken, null, true).finally(() => { consuming.current = false; });
    }, [params.spoken, loading, router, send]);

    /** Switch to chat mode and stay there — the preference is what the tab reads on open. */
    const switchToChat = async () => {
        try {
            await savePreferences({ mode: 'chat' });
        } catch {
            // A failed save means the tab will bounce back here next time. Navigating anyway
            // is still the better outcome: the person asked to leave this screen now.
        }
        router.replace('/(tabs)/assistant');
    };

    const headline = sending
        ? 'Thinking about your data…'
        : last?.text ?? 'Ask me anything about your health.';

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
                <View style={styles.topBar}>
                    {/*
                      An explicit destination rather than `router.back()`. Both routes that
                      lead here — the tab and the intro — arrive via `replace`, so there is
                      no reliable entry beneath this one to pop back to; `back()` would
                      sometimes leave the app entirely.
                    */}
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} accessibilityLabel="Close">
                        <Ionicons name="close" size={24} color={Palette.white} />
                    </TouchableOpacity>
                    <Text style={styles.topBarTitle}>Immersive</Text>
                    <TouchableOpacity onPress={switchToChat} accessibilityLabel="Switch to chat mode">
                        <Ionicons name="chatbubbles-outline" size={21} color={Palette.white} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}><ActivityIndicator size="large" color={Palette.primaryLight} /></View>
                ) : (
                    <KeyboardAvoidingView
                        style={styles.flex}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <ScrollView contentContainerStyle={styles.body} keyboardDismissMode="interactive">
                            <Text style={styles.headline}>{headline}</Text>

                            {askedImage ? (
                                <Image
                                    source={{ uri: askedImage }}
                                    style={styles.askedImage}
                                    accessibilityLabel="The photo you sent"
                                />
                            ) : null}

                            {asked ? <Text style={styles.asked}>You asked: {asked}</Text> : null}

                            <Orb busy={sending} />

                            {last?.widget ? (
                                <View style={styles.cardSlot}>
                                    <AssistantWidgetCard widget={last.widget} />
                                </View>
                            ) : null}

                            {last?.escalate ? (
                                <View style={styles.escalate}>
                                    <Ionicons name="alert-circle" size={16} color={Palette.white} />
                                    <Text style={styles.escalateText}>
                                        Worth raising with a clinician rather than leaving to the app.
                                    </Text>
                                </View>
                            ) : null}

                            {!last && !sending ? (
                                <View style={styles.starters}>
                                    {STARTERS.slice(0, 3).map((s) => (
                                        <TouchableOpacity key={s} style={styles.starter} onPress={() => send(s)}>
                                            <Text style={styles.starterText}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}

                            {last?.suggestions?.length && !sending ? (
                                <View style={styles.starters}>
                                    {last.suggestions.map((s) => (
                                        <TouchableOpacity key={s} style={styles.starter} onPress={() => send(s)}>
                                            <Text style={styles.starterText}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}

                            {error ? <Text style={styles.error}>{error}</Text> : null}
                        </ScrollView>

                        <View style={styles.dock}>
                            <InputDock
                                onSend={send}
                                busy={sending}
                                placeholder="Type anything to LabTrack AI…"
                                allowImages={capabilities.vision}
                                onVoice={() => router.push({
                                    pathname: '/assistant/voice',
                                    params: { returnTo: '/assistant/immersive' },
                                })}
                                voiceDisabledReason={capabilities.voice
                                    ? null
                                    : 'This LabTrack server has no speech-to-text configured, '
                                      + 'so questions have to be typed for now.'}
                            />
                        </View>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    // Immersive mode is dark in the kit regardless of system theme — the orb and the
    // gradient are the screen, and they do not read on white.
    container: { flex: 1, backgroundColor: Palette.primaryDeep },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    topBarTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.white, opacity: 0.8 },

    body: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
    headline: {
        fontSize: 21, lineHeight: 29, fontFamily: Fonts.semibold, color: Palette.white,
        marginTop: Spacing.lg,
    },
    asked: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.primaryLight },
    // 16:10 rather than square: a photograph of a rash or a printed result is almost never
    // square, and cropping one to fit is cropping away the thing being asked about.
    askedImage: {
        width: '100%', aspectRatio: 1.6, borderRadius: Radius.lg,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },

    orbWrap: { alignItems: 'center', justifyContent: 'center', height: 220, marginVertical: Spacing.md },
    halo: {
        position: 'absolute', width: 210, height: 210, borderRadius: 105,
        backgroundColor: Palette.primaryLight,
    },
    orb: { width: 150, height: 150, borderRadius: 75, overflow: 'hidden' },
    orbFill: { flex: 1 },

    cardSlot: { marginTop: Spacing.sm },

    escalate: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.danger, borderRadius: Radius.lg, padding: Spacing.md,
    },
    escalateText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: Fonts.medium, color: Palette.white },

    starters: { gap: Spacing.sm },
    starter: {
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: Radius.pill,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    },
    starterText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.white },

    error: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.primaryLight },

    // The composer is the shared component, so it arrives light. Rounding and clipping it
    // here keeps one input implementation rather than a near-duplicate for the dark screen.
    dock: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
});
