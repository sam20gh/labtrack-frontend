/**
 * The audio player, and the transcript behind it — the kit's frames 9, 10 and 11.
 *
 * Two visual states in one screen: playing draws the purple ground with a white transport,
 * paused draws the light ground with a purple one. The kit has them as separate frames; they
 * are the same screen and swapping the palette on `isPlaying` is what makes the transition
 * read as one control rather than two.
 *
 * ## The transcript is the accessibility surface, not a decoration
 *
 * Every cue carries a start time, so tapping a line seeks to it and the line being spoken is
 * highlighted. A transcript that only scrolls is a wall of text; one you can steer is how
 * someone who cannot follow audio uses this at all.
 *
 * ## Three things that will bite
 *
 *   1. **The sound must be unloaded.** `expo-av` keeps playing after the screen unmounts if
 *      it is not, so the teardown runs from the unmount effect and from every failure path.
 *   2. **`playsInSilentModeIOS` has to be set** or the whole feature is silent on any iPhone
 *      with the ringer switch down, which is most of them. Same trap `lib/voice.ts` documents
 *      for recording.
 *   3. **Progress is posted on a timer, not per tick.** `onPlaybackStatusUpdate` fires several
 *      times a second; posting each one would be hundreds of writes per listen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';

import { ApiError } from '@/lib/api';
import {
    getResource, saveProgress, toggleLike, formatDuration,
    PROGRESS_INTERVAL_MS, type ResourceDetail,
} from '@/lib/resources';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AudioPlayerScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();

    const [resource, setResource] = useState<ResourceDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const [liked, setLiked] = useState(false);

    const soundRef = useRef<Audio.Sound | null>(null);
    const lastReported = useRef(0);

    /** Stop, unload and forget. Safe to call twice — every failure path calls it. */
    const teardown = useCallback(async () => {
        const sound = soundRef.current;
        soundRef.current = null;
        if (!sound) return;
        try {
            await sound.stopAsync();
        } catch { /* already stopped */ }
        try {
            await sound.unloadAsync();
        } catch { /* already unloaded */ }
    }, []);

    const onStatus = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        setIsPlaying(status.isPlaying);
        setPosition(status.positionMillis / 1000);
        if (status.durationMillis) setDuration(status.durationMillis / 1000);

        const seconds = status.positionMillis / 1000;
        if (slug && seconds - lastReported.current >= PROGRESS_INTERVAL_MS / 1000) {
            lastReported.current = seconds;
            saveProgress(String(slug), seconds, status.didJustFinish === true).catch(() => { });
        }
    }, [slug]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const data = await getResource(String(slug));
                if (cancelled) return;

                setResource(data.resource);
                setLiked(Boolean(data.resource.stats.liked));

                const url = data.resource.media.audioUrl;
                if (!url) {
                    setError(data.resource.locked
                        ? 'This is a Pro resource. Go Pro to listen.'
                        : 'This resource has no audio.');
                    return;
                }

                // Without this the player is silent on any phone with the ringer switch down.
                await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

                const { sound } = await Audio.Sound.createAsync(
                    { uri: url },
                    {
                        shouldPlay: false,
                        // Resume where they left off, which is the point of storing progress.
                        positionMillis: (data.resource.stats.progressSeconds ?? 0) * 1000,
                        progressUpdateIntervalMillis: 500,
                    },
                    onStatus,
                );

                if (cancelled) {
                    await sound.unloadAsync();
                    return;
                }
                soundRef.current = sound;
                setPosition(data.resource.stats.progressSeconds ?? 0);
                setDuration(data.resource.durationSeconds ?? 0);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof ApiError && err.isAuthError) {
                    router.replace('/(auth)/loginscreen');
                    return;
                }
                await teardown();
                setError(err instanceof Error ? err.message : 'Could not load this audio');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; teardown(); };
    }, [slug, onStatus, teardown, router]);

    const togglePlay = async () => {
        const sound = soundRef.current;
        if (!sound) return;
        if (isPlaying) await sound.pauseAsync();
        else await sound.playAsync();
    };

    const seekTo = async (seconds: number) => {
        const sound = soundRef.current;
        if (!sound) return;
        await sound.setPositionAsync(Math.max(0, seconds) * 1000);
        setPosition(Math.max(0, seconds));
    };

    const skip = (delta: number) => seekTo(position + delta);

    const onLike = async () => {
        if (!resource) return;
        const next = !liked;
        setLiked(next);
        try {
            await toggleLike(resource.slug, next);
        } catch {
            setLiked(!next);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.light} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error || !resource) {
        return (
            <SafeAreaView style={styles.light} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="volume-mute-outline" size={40} color={Palette.textMuted} />
                    <Text style={styles.errorText}>{error ?? 'Not found'}</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.errorAction}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const total = duration || resource.durationSeconds || 0;
    const progress = total ? Math.min(1, position / total) : 0;
    const cues = resource.media.transcript;
    const activeCue = cues.findIndex((cue, i) =>
        position >= cue.startSeconds && (cue.endSeconds != null ? position < cue.endSeconds : i === cues.length - 1));

    // ── transcript ──────────────────────────────────────────────────────────
    if (showTranscript) {
        return (
            <SafeAreaView style={styles.light} edges={['top']}>
                <View style={styles.transcriptBar}>
                    <TouchableOpacity onPress={() => setShowTranscript(false)} hitSlop={12}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.transcriptTitle}>Audio Transcript</Text>
                    <View style={styles.iconSpacer} />
                </View>

                <View style={styles.transcriptProgress}>
                    <Text style={styles.timeSmall}>{formatDuration(position)}</Text>
                    <View style={styles.track}>
                        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.timeSmall}>{formatDuration(total)}</Text>
                </View>

                <ScrollView contentContainerStyle={styles.transcriptBody} showsVerticalScrollIndicator={false}>
                    {cues.length === 0 ? (
                        <Text style={styles.noTranscript}>
                            No transcript has been published for this recording yet.
                        </Text>
                    ) : cues.map((cue, index) => (
                        <TouchableOpacity key={index} onPress={() => seekTo(cue.startSeconds)} activeOpacity={0.7}>
                            <Text style={[styles.cue, index === activeCue && styles.cueActive]}>
                                {cue.text}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.transcriptControls}>
                    <TouchableOpacity style={styles.ghostButton} onPress={() => skip(-15)}>
                        <Ionicons name="play-back" size={22} color={Palette.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.playButtonPurple} onPress={togglePlay}>
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={Palette.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostButton} onPress={() => skip(15)}>
                        <Ionicons name="play-forward" size={22} color={Palette.text} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── player ──────────────────────────────────────────────────────────────
    const dark = isPlaying;

    return (
        <SafeAreaView style={dark ? styles.dark : styles.light} edges={['top', 'bottom']}>
            <View style={styles.playerBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={dark ? Palette.white : Palette.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTranscript(true)} hitSlop={12}>
                    <Ionicons name="document-text-outline" size={22} color={dark ? Palette.white : Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.playerBody}>
                <Text style={[styles.playerTitle, dark && styles.onDark]}>{resource.title}</Text>

                {!!resource.author && (
                    <View style={styles.playerAuthor}>
                        {resource.author.avatar
                            ? <Image source={{ uri: resource.author.avatar }} style={styles.playerAvatar} />
                            : <View style={[styles.playerAvatar, styles.avatarFallback]} />}
                        <Text style={[styles.playerAuthorName, dark && styles.onDarkMuted]}>
                            {resource.author.name}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.bigButton, dark ? styles.bigButtonOnDark : styles.bigButtonOnLight]}
                    onPress={togglePlay}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={36}
                        color={dark ? Palette.primary : Palette.white}
                    />
                </TouchableOpacity>

                {/* A bar chart standing in for a waveform. It is drawn from the position so
                    it moves with playback — a static decorative waveform on a player that is
                    not playing is exactly the dummy control this app keeps removing. */}
                <View style={styles.waveform}>
                    {Array.from({ length: 44 }).map((_, i) => {
                        const played = i / 44 <= progress;
                        const height = 8 + Math.abs(Math.sin(i * 1.7)) * 40;
                        return (
                            <View
                                key={i}
                                style={[
                                    styles.waveBar,
                                    { height },
                                    { backgroundColor: dark
                                        ? (played ? Palette.white : 'rgba(255,255,255,0.35)')
                                        : (played ? Palette.primary : Palette.border) },
                                ]}
                            />
                        );
                    })}
                </View>

                <View style={styles.transport}>
                    <TouchableOpacity onPress={() => skip(-15)} hitSlop={12}>
                        <Ionicons name="play-skip-back" size={26} color={dark ? Palette.white : Palette.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onLike} hitSlop={12}>
                        <Ionicons
                            name={liked ? 'heart' : 'heart-outline'}
                            size={26}
                            color={liked ? (dark ? Palette.white : Palette.primary) : (dark ? Palette.white : Palette.text)}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => skip(15)} hitSlop={12}>
                        <Ionicons name="play-skip-forward" size={26} color={dark ? Palette.white : Palette.text} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.track, styles.playerTrack]}>
                    <View style={[
                        styles.trackFill,
                        { width: `${progress * 100}%`, backgroundColor: dark ? Palette.white : Palette.primary },
                    ]} />
                </View>
                <View style={styles.timeRow}>
                    <Text style={[styles.timeSmall, dark && styles.onDarkMuted]}>{formatDuration(position)}</Text>
                    <Text style={[styles.timeSmall, dark && styles.onDarkMuted]}>{formatDuration(total)}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    light: { flex: 1, backgroundColor: Palette.background },
    dark: { flex: 1, backgroundColor: Palette.primary },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    errorText: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xxxl },
    errorAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    iconSpacer: { width: 24 },

    playerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    playerBody: { flex: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxxl },
    playerTitle: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 38 },
    onDark: { color: Palette.white },
    onDarkMuted: { color: 'rgba(255,255,255,0.85)' },
    playerAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
    playerAvatar: { width: 28, height: 28, borderRadius: 14 },
    avatarFallback: { backgroundColor: Palette.borderLight },
    playerAuthorName: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.textSecondary },

    bigButton: {
        width: 92, height: 92, borderRadius: 46,
        alignItems: 'center', justifyContent: 'center',
        alignSelf: 'center', marginTop: Spacing.xxxl * 2,
    },
    bigButtonOnDark: { backgroundColor: Palette.white },
    bigButtonOnLight: { backgroundColor: Palette.primary },

    waveform: {
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
        height: 56, marginTop: 'auto', marginBottom: Spacing.xxl,
    },
    waveBar: { width: 4, borderRadius: 2 },

    transport: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxxl, marginBottom: Spacing.xxl,
    },

    track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Palette.border, overflow: 'hidden' },
    playerTrack: { flex: 0, width: '100%' },
    trackFill: { height: '100%', borderRadius: 2, backgroundColor: Palette.primary },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm, marginBottom: Spacing.xl },
    timeSmall: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },

    transcriptBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    transcriptTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    transcriptProgress: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    transcriptBody: { padding: Spacing.xl, gap: Spacing.lg },
    cue: {
        fontSize: 16, fontFamily: Fonts.regular, color: Palette.textMuted,
        lineHeight: 26, textAlign: 'center', marginBottom: Spacing.lg,
    },
    cueActive: { color: Palette.text, fontFamily: Fonts.semibold },
    noTranscript: {
        fontSize: 15, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', marginTop: Spacing.xxxl, lineHeight: 22,
    },
    transcriptControls: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl,
        paddingVertical: Spacing.xl, borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    ghostButton: {
        width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    playButtonPurple: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
});
