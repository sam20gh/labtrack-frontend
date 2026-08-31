/**
 * The video course player — the kit's frames 12 and 13.
 *
 * The video fills the screen; controls fade in on tap and out again after a few seconds,
 * which is what the two frames are showing. A persistent control bar over a lecture is the
 * alternative and it covers the slide.
 *
 * A course is a list of lessons, so the session list is part of the player rather than a
 * separate screen: finishing one lesson and having to navigate back to pick the next is the
 * friction that stops people finishing courses. The lesson currently playing is marked, and
 * a Pro course's locked lessons are listed but not playable — the list is the pitch.
 *
 * Progress is posted on the same throttle the audio player uses, and the same teardown rules
 * apply: unload on unmount or the audio keeps playing over the next screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

import { ApiError } from '@/lib/api';
import {
    getResource, saveProgress, formatDuration, PROGRESS_INTERVAL_MS,
    type CourseSession, type ResourceDetail,
} from '@/lib/resources';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const CONTROLS_TIMEOUT_MS = 3500;

export default function VideoPlayerScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();

    const videoRef = useRef<Video>(null);
    const lastReported = useRef(0);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [resource, setResource] = useState<ResourceDetail | null>(null);
    const [session, setSession] = useState<CourseSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [listOpen, setListOpen] = useState(false);

    const revealControls = useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_TIMEOUT_MS);
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const data = await getResource(String(slug));
                if (cancelled) return;

                setResource(data.resource);

                // A course opens on its first playable lesson; anything else opens on its
                // own video. A locked course has no playable lesson and says so.
                const first = data.resource.course?.sessions.find((s) => s.videoUrl) ?? null;
                setSession(first);

                if (!first?.videoUrl && !data.resource.media.videoUrl) {
                    setError(data.resource.locked
                        ? 'This is a Pro course. Go Pro to watch every lesson.'
                        : 'This resource has no video.');
                }
                setPosition(data.resource.stats.progressSeconds ?? 0);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof ApiError && err.isAuthError) {
                    router.replace('/(auth)/loginscreen');
                    return;
                }
                setError(err instanceof Error ? err.message : 'Could not load this video');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (hideTimer.current) clearTimeout(hideTimer.current);
            videoRef.current?.unloadAsync().catch(() => { });
        };
    }, [slug, router]);

    const onStatus = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setIsPlaying(status.isPlaying);
        setPosition(status.positionMillis / 1000);
        if (status.durationMillis) setDuration(status.durationMillis / 1000);

        const seconds = status.positionMillis / 1000;
        if (slug && seconds - lastReported.current >= PROGRESS_INTERVAL_MS / 1000) {
            lastReported.current = seconds;
            saveProgress(String(slug), seconds, status.didJustFinish === true).catch(() => { });
        }
    };

    const togglePlay = async () => {
        revealControls();
        if (isPlaying) await videoRef.current?.pauseAsync();
        else await videoRef.current?.playAsync();
    };

    const seekBy = async (delta: number) => {
        revealControls();
        await videoRef.current?.setPositionAsync(Math.max(0, (position + delta) * 1000));
    };

    const playSession = async (next: CourseSession) => {
        if (!next.videoUrl) return;
        setSession(next);
        setListOpen(false);
        lastReported.current = 0;
        setPosition(0);
        await videoRef.current?.loadAsync({ uri: next.videoUrl }, { shouldPlay: true }, false);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.white} /></View>
            </SafeAreaView>
        );
    }

    const uri = session?.videoUrl ?? resource?.media.videoUrl ?? null;

    if (error || !resource || !uri) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="videocam-off-outline" size={40} color={Palette.textMuted} />
                    <Text style={styles.errorText}>{error ?? 'Not found'}</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.errorAction}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const total = duration || session?.durationSeconds || resource.durationSeconds || 0;
    const progress = total ? Math.min(1, position / total) : 0;
    const sessions = resource.course?.sessions ?? [];

    return (
        <View style={styles.screen}>
            <Pressable style={styles.videoWrap} onPress={() => (controlsVisible ? setControlsVisible(false) : revealControls())}>
                <Video
                    ref={videoRef}
                    style={styles.video}
                    source={{ uri }}
                    resizeMode={ResizeMode.CONTAIN}
                    onPlaybackStatusUpdate={onStatus}
                    shouldPlay={false}
                    positionMillis={(resource.stats.progressSeconds ?? 0) * 1000}
                    progressUpdateIntervalMillis={500}
                    useNativeControls={false}
                />

                {controlsVisible && (
                    <>
                        <SafeAreaView edges={['top']} style={styles.topBar}>
                            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                                <Ionicons name="chevron-back" size={24} color={Palette.white} />
                            </TouchableOpacity>
                            <Text style={styles.topTitle}>
                                {resource.type === 'course' ? 'Video Course' : 'Video'}
                            </Text>
                            <TouchableOpacity onPress={() => setListOpen((v) => !v)} hitSlop={12}>
                                <Ionicons name="list-outline" size={22} color={Palette.white} />
                            </TouchableOpacity>
                        </SafeAreaView>

                        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
                            <Text style={styles.lessonTitle} numberOfLines={1}>
                                {session?.title ?? resource.title}
                            </Text>

                            <View style={styles.track}>
                                <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                            </View>
                            <View style={styles.timeRow}>
                                <Text style={styles.time}>{formatDuration(position)}</Text>
                                <Text style={styles.time}>{formatDuration(total)}</Text>
                            </View>

                            <View style={styles.transport}>
                                <TouchableOpacity onPress={() => seekBy(-15)} hitSlop={12}>
                                    <Ionicons name="play-skip-back" size={26} color={Palette.white} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
                                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={Palette.white} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => seekBy(15)} hitSlop={12}>
                                    <Ionicons name="play-skip-forward" size={26} color={Palette.white} />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </>
                )}
            </Pressable>

            {listOpen && sessions.length > 0 && (
                <View style={styles.sessionPanel}>
                    <View style={styles.sessionHeader}>
                        <Text style={styles.sessionHeaderText}>
                            {sessions.length} session{sessions.length === 1 ? '' : 's'}
                        </Text>
                        <TouchableOpacity onPress={() => setListOpen(false)} hitSlop={12}>
                            <Ionicons name="close" size={22} color={Palette.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.sessionList}>
                        {sessions.map((item, index) => {
                            const playable = Boolean(item.videoUrl);
                            const current = session?.id === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.sessionRow, current && styles.sessionRowActive]}
                                    onPress={() => playSession(item)}
                                    disabled={!playable}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.sessionIndex}>
                                        <Text style={styles.sessionIndexText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.sessionBody}>
                                        <Text
                                            style={[styles.sessionTitle, !playable && styles.sessionTitleLocked]}
                                            numberOfLines={2}
                                        >
                                            {item.title}
                                        </Text>
                                        <Text style={styles.sessionMeta}>
                                            {formatDuration(item.durationSeconds)}
                                            {item.preview ? '  ·  Free preview' : ''}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name={playable ? (current ? 'volume-medium' : 'play-circle-outline') : 'lock-closed'}
                                        size={22}
                                        color={playable ? Palette.primary : Palette.textMuted}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000' },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    errorText: {
        fontSize: 15, fontFamily: Fonts.medium, color: Palette.white,
        textAlign: 'center', paddingHorizontal: Spacing.xxxl,
    },
    errorAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primaryLight },

    videoWrap: { flex: 1 },
    video: { flex: 1 },

    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    topTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    lessonTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white, marginBottom: Spacing.md },
    track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 2, backgroundColor: Palette.primary },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    time: { fontSize: 12, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.85)' },
    transport: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xxxl,
        paddingVertical: Spacing.lg,
    },
    playButton: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },

    sessionPanel: {
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '55%',
        backgroundColor: Palette.background,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
    },
    sessionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    sessionHeaderText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    sessionList: { padding: Spacing.lg, gap: Spacing.sm },
    sessionRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.md, borderRadius: Radius.lg,
    },
    sessionRowActive: { backgroundColor: Palette.primarySurface },
    sessionIndex: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    sessionIndexText: { fontSize: 12, fontFamily: Fonts.bold, color: Palette.textSecondary },
    sessionBody: { flex: 1 },
    sessionTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    sessionTitleLocked: { color: Palette.textMuted },
    sessionMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
});
