/**
 * Voice Mode — asking the assistant a question out loud.
 *
 * The kit draws this as a full-screen takeover with three things on it: the words, a
 * waveform, and a row of three buttons. The centre button runs the recorder; the cross and
 * the tick either side are discard and confirm. Everything else is deliberately absent —
 * there is no transcript to scroll and no composer, because the whole screen is one
 * question.
 *
 * **Where this departs from the kit, and why.** The kit shows the person's words appearing
 * live as they speak. Transcription here is a single call once the recording stops
 * (Whisper-compatible endpoints are not streaming), so the words arrive at the end rather
 * than during. Rather than fake a live transcript, the screen shows a real waveform driven
 * by real microphone metering while recording, and then shows the transcript in the same
 * large type the kit puts it in — with the same discard/confirm pair, which is now doing
 * something more useful than it was in the kit: **nothing is sent until the person has read
 * back what was heard.** A mis-transcribed symptom that goes straight to a health assistant
 * is the failure this arrangement exists to prevent.
 *
 * Transcribing writes nothing to the conversation. The confirmed text is handed back to the
 * calling screen as a param, and that screen sends it like any other message — so the
 * answer appears where the person was, under the orb, rather than on a screen they left.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ApiError } from '@/lib/api';
import { transcribe } from '@/lib/assistant';
import {
    SPEECH_RECORDING_OPTIONS, recordingUpload, beginSession, endSession,
    meteringToLevel, formatDuration, MAX_RECORDING_MS,
} from '@/lib/voice';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

/** How many bars the waveform holds. At a 100ms cadence this is the last four seconds. */
const BARS = 40;

type Phase = 'idle' | 'recording' | 'transcribing' | 'review';

/**
 * The waveform.
 *
 * Bars are laid out oldest-to-newest so the trace scrolls leftwards as someone speaks, and
 * the array is padded from the left while it fills — starting from a full bank of zeroes
 * rather than growing from one bar keeps the row from jumping about on the first word.
 */
const Waveform = ({ levels, active }: { levels: number[]; active: boolean }) => (
    <View style={styles.waveform}>
        {levels.map((level, i) => (
            <View
                key={i}
                style={[
                    styles.bar,
                    {
                        // A floor of 2pt: a bar of zero height disappears, and a waveform
                        // with gaps in it reads as a rendering fault rather than as silence.
                        height: Math.max(2, level * 56),
                        backgroundColor: active ? Palette.primary : Palette.border,
                        opacity: active ? 0.45 + level * 0.55 : 1,
                    },
                ]}
            />
        ))}
    </View>
);

export default function VoiceMode() {
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const returnTo = params.returnTo || '/assistant/immersive';

    const [phase, setPhase] = useState<Phase>('idle');
    const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0));
    const [duration, setDuration] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recordingRef = useRef<Audio.Recording | null>(null);
    /**
     * Whether this screen is still mounted.
     *
     * Both `stopAndUnloadAsync` and the transcription round-trip outlive a person tapping
     * close, and setting state after that is the warning nobody reads and the memory leak
     * everybody keeps.
     */
    const alive = useRef(true);

    /**
     * Tear the recorder down.
     *
     * Called from four places — cancel, confirm, unmount, and the failure path — so it has
     * to tolerate being called when there is nothing to tear down. Returns the file's URI
     * when there was one, which is what makes it usable as both cleanup and "finish".
     */
    const teardown = useCallback(async (): Promise<string | null> => {
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (!recording) {
            await endSession().catch(() => { });
            return null;
        }
        try {
            await recording.stopAndUnloadAsync();
            return recording.getURI();
        } catch {
            // Stopping a recorder that never started throws. There is nothing to recover
            // and nothing the person can do about it, so it does not become an error.
            return null;
        } finally {
            await endSession().catch(() => { });
        }
    }, []);

    useEffect(() => () => {
        alive.current = false;
        teardown();
    }, [teardown]);

    const start = async () => {
        setError(null);
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                setError('Microphone access is needed to ask out loud. You can type your question instead.');
                return;
            }

            await beginSession();

            const { recording } = await Audio.Recording.createAsync(
                SPEECH_RECORDING_OPTIONS,
                (status) => {
                    if (!alive.current || !status.isRecording) return;
                    setDuration(status.durationMillis);
                    setLevels((prev) => [...prev.slice(1), meteringToLevel(status.metering)]);
                    // Stopped here rather than on a timer, so the cap is measured against
                    // the recorder's own clock rather than against wall time the app may
                    // have spent backgrounded.
                    if (status.durationMillis >= MAX_RECORDING_MS) finish();
                },
                100
            );

            recordingRef.current = recording;
            setDuration(0);
            setLevels(new Array(BARS).fill(0));
            setPhase('recording');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        } catch (err) {
            console.warn('Could not start recording', err);
            await endSession().catch(() => { });
            setError('The microphone could not be started. You can type your question instead.');
        }
    };

    /** Stop, then transcribe. Still sends nothing — the person confirms on the next screen state. */
    const finish = async () => {
        if (!recordingRef.current) return;

        setPhase('transcribing');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

        const uri = await teardown();
        if (!alive.current) return;

        if (!uri) {
            setPhase('idle');
            setError('Nothing was recorded. Try holding the phone a little closer.');
            return;
        }

        try {
            const text = await transcribe(recordingUpload(uri));
            if (!alive.current) return;
            setTranscript(text);
            setPhase('review');
        } catch (err) {
            if (!alive.current) return;
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setPhase('idle');
            setError(err instanceof ApiError ? err.message : 'That recording could not be transcribed.');
        }
    };

    /** Throw the recording or the transcript away without leaving the screen. */
    const discard = async () => {
        await teardown();
        if (!alive.current) return;
        setPhase('idle');
        setTranscript('');
        setDuration(0);
        setLevels(new Array(BARS).fill(0));
    };

    const close = async () => {
        await teardown();
        router.replace(returnTo as any);
    };

    /**
     * Hand the words back to the screen that opened this one.
     *
     * `replace` rather than `back`: this screen is entered with `push` from a composer, and
     * popping would land on a screen that has to be told the question anyway. Passing it as
     * a param means the answer generates where the person was.
     */
    const confirm = () => {
        router.replace({ pathname: returnTo as any, params: { spoken: transcript } });
    };

    const recording = phase === 'recording';

    const headline =
        phase === 'review' ? transcript
            : phase === 'transcribing' ? 'Making out your words…'
                : recording ? 'Listening…'
                    : 'Say anything…';

    const caption =
        phase === 'review' ? 'Send it, or try again'
            : phase === 'transcribing' ? ''
                : recording ? formatDuration(duration)
                    : 'Ready?';

    return (
        <View style={styles.container}>
            {/* The kit washes the screen purple while recording. Rendered always and faded
                by opacity so the transition is one property rather than a mounted view. */}
            <LinearGradient
                colors={[Palette.primaryLight, Palette.background]}
                style={[styles.wash, { opacity: recording ? 0.55 : 0.15 }]}
                pointerEvents="none"
            />

            <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close voice mode">
                        <Ionicons name="close" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Voice Mode</Text>
                    </View>
                    {/* Balances the close button so the badge sits on the screen's centre. */}
                    <View style={styles.topBarSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                >
                    <Text
                        style={[styles.headline, phase === 'review' && styles.headlineTranscript]}
                        accessibilityLiveRegion="polite"
                    >
                        {headline}
                    </Text>

                    {phase === 'review' ? (
                        <Text style={styles.reviewNote}>
                            Check this is what you meant before sending it — a misheard word changes
                            the answer.
                        </Text>
                    ) : null}

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                </ScrollView>

                <Waveform levels={levels} active={recording} />

                <View style={styles.controls}>
                    {/* Discard. Inert at rest, because there is nothing yet to discard. */}
                    <TouchableOpacity
                        style={[
                            styles.sideButton,
                            recording || phase === 'review' ? styles.sideButtonDanger : styles.sideButtonIdle,
                        ]}
                        onPress={discard}
                        disabled={phase === 'idle' || phase === 'transcribing'}
                        accessibilityLabel="Discard"
                    >
                        <Ionicons
                            name="close"
                            size={22}
                            color={recording || phase === 'review' ? Palette.danger : Palette.textMuted}
                        />
                    </TouchableOpacity>

                    <View style={styles.centreWrap}>
                        <TouchableOpacity
                            style={[styles.centreButton, recording && styles.centreButtonRecording]}
                            onPress={recording ? finish : start}
                            disabled={phase === 'transcribing'}
                            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
                        >
                            {phase === 'transcribing'
                                ? <ActivityIndicator color={Palette.white} />
                                : recording
                                    ? <View style={styles.stopSquare} />
                                    : <Ionicons name="mic" size={30} color={Palette.white} />}
                        </TouchableOpacity>
                        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
                    </View>

                    {/* Confirm — stop and transcribe while recording, send once reviewed. */}
                    <TouchableOpacity
                        style={[
                            styles.sideButton,
                            recording || phase === 'review' ? styles.sideButtonConfirm : styles.sideButtonIdle,
                        ]}
                        onPress={phase === 'review' ? confirm : finish}
                        disabled={phase === 'idle' || phase === 'transcribing'}
                        accessibilityLabel={phase === 'review' ? 'Send this question' : 'Stop and transcribe'}
                    >
                        <Ionicons
                            name="checkmark"
                            size={22}
                            color={recording || phase === 'review' ? Palette.primary : Palette.textMuted}
                        />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    wash: { position: 'absolute', left: 0, right: 0, top: 0, height: '55%' },

    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    topBarSpacer: { width: 24 },
    badge: {
        borderWidth: 1, borderColor: Palette.primaryLight, backgroundColor: Palette.primarySurface,
        borderRadius: Radius.pill, paddingVertical: 6, paddingHorizontal: Spacing.md,
    },
    badgeText: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.primaryDark },

    body: {
        flexGrow: 1, justifyContent: 'center',
        paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xl, gap: Spacing.lg,
    },
    headline: {
        fontSize: 26, lineHeight: 36, fontFamily: Fonts.semibold, color: Palette.text,
        textAlign: 'center',
    },
    // A transcript can run to several sentences where a prompt is three words. Dropping the
    // size keeps a long question on the screen without it needing to be scrolled to be read.
    headlineTranscript: { fontSize: 21, lineHeight: 30, textAlign: 'left' },
    reviewNote: {
        fontSize: 12, lineHeight: 17, fontFamily: Fonts.regular, color: Palette.textSecondary,
    },
    error: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Palette.danger,
        textAlign: 'center',
    },

    waveform: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 3, height: 60, paddingHorizontal: Spacing.xl,
    },
    bar: { width: 3, borderRadius: 2 },

    controls: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xxl, paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg, paddingBottom: Spacing.xxl,
    },
    centreWrap: { alignItems: 'center', gap: Spacing.sm },
    centreButton: {
        width: 76, height: 76, borderRadius: 38, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    centreButtonRecording: { backgroundColor: Palette.danger },
    stopSquare: { width: 24, height: 24, borderRadius: 4, backgroundColor: Palette.white },
    caption: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },

    sideButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    sideButtonIdle: { backgroundColor: Palette.borderLight },
    sideButtonDanger: { backgroundColor: Palette.dangerSurface },
    sideButtonConfirm: { backgroundColor: Palette.primarySurface },
});
