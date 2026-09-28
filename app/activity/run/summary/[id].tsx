/**
 * After the run — the replay, then the poster (plan §2.4).
 *
 * 1. **Replay.** The camera pitches to 60° and flies the route while the Ember trail draws
 *    itself up to the dot and the numbers count up with it. About eight seconds; drag the
 *    scrubber to move through it, or skip. Reduce Motion, or a build without the map, goes
 *    straight to the poster — nothing the replay shows is lost there.
 * 2. **The poster.** The route as neon line art on the violet, the distance huge, and Share.
 *    Privacy-trimmed: the first and last 250 m are not in the picture. Share is outside the
 *    captured view (anything inside would be in the image).
 * 3. **Effort** — the one thing the person rates, and what moves the score bonus.
 *
 * Every figure here is the **server's** (`getSession`) — the record — never the live
 * screen's provisional numbers. The replay reads the stored track.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, Pressable, ScrollView, ActivityIndicator, PanResponder, useWindowDimensions, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import RunMap from '@/components/run/RunMap';
import RoutePoster from '@/components/run/RoutePoster';
import TickerNumber from '@/components/run/TickerNumber';
import { getSession, getSessionTrack, updateSession, type ActivitySession } from '@/lib/activity';
import { ApiError } from '@/lib/api';
import { trailFromTrack, EMBER_DARK, withAlpha, type Trail } from '@/lib/run/afterglow';
import { cumulative, replayFrame } from '@/lib/run/replay';
import { lightPresetFor } from '@/lib/run/sun';
import { mapUnavailableReason } from '@/lib/run/map';
import { shareRunImage } from '@/lib/run/share';
import { distanceParts, formatClock, paceParts, TYPE_LABEL } from '@/lib/run/format';
import { TRACKABLE_TYPES, type Track, type TrackableType } from '@/lib/run/trackMath';
import { formatEnergy, useUnits } from '@/lib/units';

const REPLAY_MS = 8000;
const FRAME_MS = 66; // ~15 fps: the camera animates linearly between frames, so it reads smooth
const EFFORT_LABELS = ['', 'Very light', 'Light', 'Moderate', 'High effort', 'Maximum'];

// The replay and the poster are a brand surface: dark, violet, Ember. Fixed in both schemes.
const P = Palettes.dark;
const HERO = Palettes.light;

export default function RunSummary() {
    const { id, replay: replayParam } = useLocalSearchParams<{ id: string; replay?: string }>();
    const router = useRouter();
    const units = useUnits();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const focused = useIsFocused();
    const reduceMotion = useReducedMotion();

    const [session, setSession] = useState<ActivitySession | null>(null);
    const [track, setTrack] = useState<Track | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [stage, setStage] = useState<'loading' | 'replay' | 'poster'>('loading');
    const [progress, setProgress] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [sharing, setSharing] = useState(false);
    const poster = useRef<View>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [s, t] = await Promise.all([
                    getSession(id),
                    getSessionTrack(id).then((r) => r.track as Track).catch(() => null),
                ]);
                if (!mounted) return;
                setSession(s.session);
                setTrack(t);
                const canReplay = !!t && !reduceMotion && mapUnavailableReason() == null;
                setStage(canReplay ? 'replay' : 'poster');
            } catch (err) {
                if (!mounted) return;
                if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
                setError(err);
            }
        })();
        return () => { mounted = false; };
    }, [id, reduceMotion, router, replayParam]);

    const type: TrackableType = session && TRACKABLE_TYPES.includes(session.type as TrackableType)
        ? session.type as TrackableType : 'jogging';
    const trail: Trail = useMemo(
        () => trailFromTrack(track ?? undefined, type, EMBER_DARK),
        [track, type],
    );
    const cum = useMemo(() => cumulative(trail.coordinates), [trail.coordinates]);

    // Autoplay: advance the progress on a timer; the camera animates between frames.
    useEffect(() => {
        if (stage !== 'replay' || !playing) return undefined;
        const id2 = setInterval(() => {
            setProgress((p) => Math.min(1, p + FRAME_MS / REPLAY_MS));
        }, FRAME_MS);
        return () => clearInterval(id2);
    }, [stage, playing]);

    // The end of an autoplay: a beat on the finished route, then the poster. A scrub to the
    // end does not trigger it — the person is looking at something.
    useEffect(() => {
        if (stage !== 'replay' || !playing || progress < 1) return undefined;
        setPlaying(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        const t = setTimeout(() => setStage('poster'), 900);
        return () => clearTimeout(t);
    }, [progress, stage, playing]);

    const setEffort = async (value: number) => {
        if (!session) return;
        Haptics.selectionAsync().catch(() => undefined);
        const next = session.effort === value ? undefined : value;
        setSession({ ...session, effort: next });
        try {
            await updateSession(session._id, { effort: next as number });
        } catch {
            setSession(session);
            Alert.alert('Not saved', 'Your rating could not be saved. Please try again.');
        }
    };

    if (error) {
        return (
            <View style={[styles.fill, styles.centre, { backgroundColor: P.canvas }]}>
                <Text style={[styles.title, { color: P.text }]}>This activity could not be loaded</Text>
                <Pressable onPress={() => router.replace('/activity')} style={[styles.pill, { backgroundColor: P.primaryFill }]} accessibilityRole="button">
                    <Text style={styles.pillText}>Back to activity</Text>
                </Pressable>
            </View>
        );
    }
    if (stage === 'loading' || !session) {
        return (
            <View style={[styles.fill, styles.centre, { backgroundColor: P.canvas }]}>
                <ActivityIndicator color={EMBER_DARK[3]} />
            </View>
        );
    }

    const distance = distanceParts(session.distanceM ?? 0, units);
    const pace = paceParts(
        session.distanceM && session.distanceM > 10 ? session.durationSec / (session.distanceM / 1000) : null,
        type,
        units,
    );
    const title = TYPE_LABEL[type];
    const date = new Date(session.startedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const kcal = Number.isFinite(session.activeKcal as number) ? formatEnergy(session.activeKcal as number, units) : null;

    // ---- replay ---------------------------------------------------------------------------
    if (stage === 'replay' && trail.coordinates.length >= 2) {
        const frame = replayFrame(trail.coordinates, cum, progress);
        const total = cum[cum.length - 1] || 1;
        const shownDistance = distanceParts((session.distanceM ?? 0) * (frame.distanceM / total), units);
        const first = trail.coordinates[0];
        return (
            <View style={[styles.fill, { backgroundColor: P.canvas }]}>
                {focused && <StatusBar style="light" />}
                <RunMap
                    mode="replay"
                    trail={trail}
                    accent={EMBER_DARK[3]}
                    lightPreset={lightPresetFor(new Date(session.startedAt), first[1], first[0])}
                    replay={{ center: frame.center, heading: frame.heading, progress, durationMs: FRAME_MS }}
                />
                <View style={[styles.replayTop, { paddingTop: insets.top + Spacing.md }]} pointerEvents="none">
                    <Text style={[styles.replayTitle, { color: HERO.white }]}>{title}</Text>
                    <View style={styles.row}>
                        <TickerNumber value={shownDistance.value} size={52} color={HERO.white} />
                        <Text style={[styles.replayUnit, { color: HERO.white }]}>{shownDistance.unit}</Text>
                    </View>
                    <Text style={[styles.replayClock, { color: HERO.white }]}>{formatClock(session.durationSec * progress)}</Text>
                </View>
                <View style={[styles.replayBottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
                    <Scrubber
                        value={progress}
                        onScrub={(v) => { setPlaying(false); setProgress(v); }}
                        onRelease={() => undefined}
                    />
                    <View style={styles.replayActions}>
                        <Pressable
                            onPress={() => {
                                if (progress >= 1) setProgress(0);
                                setPlaying((p) => !p);
                            }}
                            style={styles.iconBtn}
                            accessibilityRole="button"
                            accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}
                        >
                            <Ionicons name={playing ? 'pause' : 'play'} size={20} color={HERO.white} />
                        </Pressable>
                        <Pressable onPress={() => setStage('poster')} style={[styles.pill, styles.ghost]} accessibilityRole="button">
                            <Text style={styles.pillText}>Skip</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

    // ---- poster -----------------------------------------------------------------------------
    const stats = [
        { label: 'Time', value: formatClock(session.durationSec) },
        ...(pace ? [{ label: type === 'biking' ? 'Speed' : 'Pace', value: `${pace.value} ${pace.unit}` }] : []),
        ...(Number.isFinite(session.elevationM as number) && (session.elevationM as number) >= 5
            ? [{ label: 'Climb', value: `${Math.round(session.elevationM as number)} m` }] : []),
    ];
    const posterWidth = Math.min(420, width - Spacing.xl * 2);

    const share = async () => {
        setSharing(true);
        try {
            const outcome = await shareRunImage(
                poster,
                `${title}: ${distance.value} ${distance.unit} in ${formatClock(session.durationSec)}${pace ? ` (${pace.value} ${pace.unit})` : ''}.`,
            );
            if (outcome === 'text') Alert.alert('Shared as text', 'The picture could not be made on this phone, so the numbers were sent instead.');
        } finally {
            setSharing(false);
        }
    };

    return (
        <View style={[styles.fill, { backgroundColor: P.canvas }]}>
            {focused && <StatusBar style="light" />}
            <ScrollView contentContainerStyle={[styles.posterScroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }]}>
                <View style={styles.posterFrame}>
                    <RoutePoster
                        ref={poster}
                        coordinates={trail.coordinates.length >= 2 ? trail.coordinates : (session.route?.coordinates ?? [])}
                        title={title}
                        distance={distance}
                        stats={stats}
                        date={date}
                        width={posterWidth}
                    />
                </View>

                {/* Outside the captured view: anything inside the poster is in the picture. */}
                <View style={styles.shareRow}>
                    <Pressable onPress={share} disabled={sharing} style={[styles.share, { backgroundColor: P.primaryFill }]} accessibilityRole="button" accessibilityLabel="Share this picture">
                        {sharing ? <ActivityIndicator color={HERO.white} /> : (
                            <>
                                <Ionicons name="share-outline" size={20} color={HERO.white} />
                                <Text style={styles.pillText}>Share</Text>
                            </>
                        )}
                    </Pressable>
                    {track && mapUnavailableReason() == null && (
                        <Pressable onPress={() => { setProgress(0); setPlaying(true); setStage('replay'); }} style={[styles.share, styles.ghost]} accessibilityRole="button">
                            <Ionicons name="refresh" size={18} color={HERO.white} />
                            <Text style={styles.pillText}>Replay</Text>
                        </Pressable>
                    )}
                </View>
                <Text style={[styles.note, { color: P.textSecondary }]}>
                    The picture leaves out the first and last 250 m of your route, so it does not show where you started.
                </Text>

                <View style={[styles.card, { backgroundColor: P.background, borderColor: P.border }]}>
                    <Text style={[styles.cardTitle, { color: P.text }]}>How did it feel?</Text>
                    <View style={styles.flames}>
                        {[1, 2, 3, 4, 5].map((v) => (
                            <Pressable key={v} onPress={() => setEffort(v)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Effort: ${EFFORT_LABELS[v]}`} accessibilityState={{ selected: session.effort === v }}>
                                <Ionicons name="flame" size={32} color={(session.effort ?? 0) >= v ? P.amber : P.border} />
                            </Pressable>
                        ))}
                    </View>
                    <Text style={[styles.note, { color: P.textSecondary }]}>
                        {session.effort ? EFFORT_LABELS[session.effort] : 'Only you set this. It is never worked out from your pace.'}
                    </Text>
                    {kcal && <Text style={[styles.note, { color: P.textSecondary }]}>About {kcal} burned, estimated from your pace and weight.</Text>}
                </View>

                <View style={styles.shareRow}>
                    <Pressable onPress={() => router.replace(`/activity/session/${session._id}`)} style={[styles.share, styles.ghost]} accessibilityRole="button">
                        <Text style={styles.pillText}>Details</Text>
                    </Pressable>
                    <Pressable onPress={() => router.replace('/activity')} style={[styles.share, { backgroundColor: P.primaryFill }]} accessibilityRole="button">
                        <Text style={styles.pillText}>Done</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

/** A plain track the thumb drags along. PanResponder, for the same reason SlideToUnlock is. */
function Scrubber({ value, onScrub, onRelease }: { value: number; onScrub: (v: number) => void; onRelease: () => void }) {
    const widthRef = useRef(1);
    const startX = useRef(0);
    const scrub = useCallback((x: number) => onScrub(Math.max(0, Math.min(1, x / widthRef.current))), [onScrub]);
    const responder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => { startX.current = e.nativeEvent.locationX; scrub(startX.current); },
        onPanResponderMove: (_, g) => scrub(startX.current + g.dx),
        onPanResponderRelease: onRelease,
    }), [scrub, onRelease]);
    return (
        <View
            {...responder.panHandlers}
            onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
            style={styles.scrub}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Replay position"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => onScrub(Math.max(0, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
        >
            <View style={[styles.scrubTrack, { backgroundColor: withAlpha(HERO.white, 0.25) }]}>
                <View style={[styles.scrubFill, { width: `${value * 100}%`, backgroundColor: EMBER_DARK[3] }]} />
            </View>
            <View style={[styles.scrubThumb, { left: `${value * 100}%`, backgroundColor: HERO.white }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    centre: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xxl },
    title: { fontFamily: Fonts.bold, fontSize: 20, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    replayTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, gap: 2 },
    replayTitle: { fontFamily: Fonts.bold, fontSize: 16, letterSpacing: 2, opacity: 0.85 },
    replayUnit: { fontFamily: Fonts.semibold, fontSize: 20, opacity: 0.85 },
    replayClock: { ...BodyFont.semibold, fontSize: 18, fontVariant: ['tabular-nums'], opacity: 0.85 },
    replayBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.xl, gap: Spacing.lg },
    replayActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(P.canvas, 0.55) },
    scrub: { height: 32, justifyContent: 'center' },
    scrubTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    scrubFill: { height: '100%' },
    scrubThumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9 },
    posterScroll: { alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.lg },
    posterFrame: { borderRadius: 24, overflow: 'hidden' },
    shareRow: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch' },
    share: { flex: 1, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md + 2, borderRadius: Radius.pill },
    ghost: { borderWidth: 1, borderColor: withAlpha(HERO.white, 0.35) },
    pill: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.pill },
    pillText: { fontFamily: Fonts.bold, fontSize: 15, color: HERO.white },
    note: { ...BodyFont.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    card: { alignSelf: 'stretch', borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' },
    cardTitle: { fontFamily: Fonts.bold, fontSize: 16 },
    flames: { flexDirection: 'row', gap: Spacing.lg },
});
