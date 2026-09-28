/**
 * After the run — the replay, then the poster (plan §2.4).
 *
 * 1. **Replay.** The camera pitches down and flies the route while the Ember trail draws
 *    itself up to the dot and the numbers count up with it. 15–45 s, scaled to the distance
 *    (`replayDurationMs`), at 1× or 2×; drag the scrubber to move through it, or skip.
 *    Reduce Motion, or a build without the map, goes straight to the poster.
 *
 *    **How it stays smooth** — each of these fixed a judder the first version had on a real
 *    80-minute ride:
 *    - a `requestAnimationFrame` loop on real elapsed time, not a timer that drifts;
 *    - the camera is driven through its ref (`setCamera`, ~30 Hz, each a short `linearTo`
 *      the native side interpolates) rather than through props, which re-rendered the tree;
 *    - the position is interpolated along the route, never snapped to the nearest fix;
 *    - the heading looks along a chord ahead, and turns at a limited rate the short way
 *      round (`turnToward`), so a bend is a sweep and north is not a 340° spin;
 *    - React state (numbers, trail trim, scrubber) updates at ~20 Hz, and the dot is a screen
 *      overlay at the camera's focus, so the map is never redrawn to move it.
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
    Modal, Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import RunMap, { type CameraHandle, type MapHandle } from '@/components/run/RunMap';
import ReplayMoment from '@/components/run/ReplayMoment';
import BrandTag from '@/components/run/BrandTag';
import RoutePoster from '@/components/run/RoutePoster';
import TickerNumber from '@/components/run/TickerNumber';
import { getSession, getSessionTrack, updateSession, type ActivitySession } from '@/lib/activity';
import { ApiError } from '@/lib/api';
import { trailFromTrack, EMBER_DARK, withAlpha, type Trail } from '@/lib/run/afterglow';
import { cumulative, lookHeading, replayDurationMs, replayFrame, turnToward } from '@/lib/run/replay';
import { lightPresetFor } from '@/lib/run/sun';
import { mapUnavailableReason } from '@/lib/run/map';
import { shareRunImage } from '@/lib/run/share';
import { distanceParts, formatClock, paceParts, TYPE_LABEL } from '@/lib/run/format';
import { haversine, TRACKABLE_TYPES, type Track, type TrackableType } from '@/lib/run/trackMath';
import { formatEnergy, useUnits } from '@/lib/units';

const CAMERA_EVERY_MS = 33; // ~30 Hz, each a short linear animation the native side smooths
const UI_EVERY_MS = 50; // ~20 Hz for the numbers, the trail trim and the scrubber
const TURN_DEG_PER_S = 90; // at 1×; a bend becomes a sweep, never a snap
const FOCUS_FROM_TOP = 0.38; // the camera's focus sits in the lower third, looking ahead
const CHROME_HIDE_MS = 2500; // controls fade while playing, so a screen recording is clean
/**
 * A moment this close to the start or the finish is not offered for sharing: a map of where
 * a ride began or ended is a home address. The poster trims its ends for the same reason.
 */
const MOMENT_CLEARANCE_M = 400;
const EFFORT_LABELS = ['', 'Very light', 'Light', 'Moderate', 'High effort', 'Maximum'];

// The replay and the poster are a brand surface: dark, violet, Ember. Fixed in both schemes.
const P = Palettes.dark;
const HERO = Palettes.light;

export default function RunSummary() {
    const { id, replay: replayParam } = useLocalSearchParams<{ id: string; replay?: string }>();
    const router = useRouter();
    const units = useUnits();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const focused = useIsFocused();
    const reduceMotion = useReducedMotion();

    const [session, setSession] = useState<ActivitySession | null>(null);
    const [track, setTrack] = useState<Track | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [stage, setStage] = useState<'loading' | 'replay' | 'poster'>('loading');
    const [progress, setProgress] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [speed, setSpeed] = useState<1 | 2>(1);
    const cameraRef = useRef<CameraHandle>(null);
    const mapRef = useRef<MapHandle>(null);
    const momentRef = useRef<View>(null);
    const [chrome, setChrome] = useState(true);
    const chromeOpacity = useRef(new RNAnimated.Value(1)).current;
    const [moment, setMoment] = useState<{ uri: string; progress: number } | null>(null);
    const [snapping, setSnapping] = useState(false);
    const progressRef = useRef(0);
    const headingRef = useRef(0);
    const playingRef = useRef(true);
    const speedRef = useRef<1 | 2>(1);
    playingRef.current = playing;
    speedRef.current = speed;
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

    /**
     * The flight plan, from the route's length: how long it takes, how fast the camera moves,
     * and therefore how far ahead it looks and how high it flies. A fast camera close to the
     * ground is a blur; one that looks only 150 m ahead at 500 m/s turns too late.
     */
    const plan = useMemo(() => {
        const total = cum[cum.length - 1] || 0;
        const durationMs = replayDurationMs(total);
        const metresPerSec = total / (durationMs / 1000);
        return {
            total,
            durationMs,
            ahead: Math.max(150, Math.min(900, metresPerSec * 1.2)),
            zoom: Math.max(14.3, Math.min(16.8, 17.2 - Math.log2(Math.max(1, metresPerSec / 40)))),
            paddingTop: Math.round(height * FOCUS_FROM_TOP),
        };
    }, [cum, height]);

    const startHeading = useMemo(
        () => (trail.coordinates.length >= 2 ? lookHeading(trail.coordinates, cum, 0, plan.ahead) : 0),
        [trail.coordinates, cum, plan.ahead],
    );

    /** Put the camera at `p` at once — a scrub, a restart. */
    const snapTo = useCallback((p: number) => {
        progressRef.current = p;
        const f = replayFrame(trail.coordinates, cum, p, plan.ahead);
        headingRef.current = f.heading;
        cameraRef.current?.setCamera({ centerCoordinate: f.center, heading: f.heading, animationDuration: 0 });
        setProgress(p);
    }, [trail.coordinates, cum, plan.ahead]);

    // Controls fade out a moment into playback and come back on a tap or a pause, so the
    // replay can be screen-recorded clean — the branding and the numbers stay.
    useEffect(() => {
        if (!playing) setChrome(true);
        if (stage !== 'replay' || !playing || !chrome) return undefined;
        const t = setTimeout(() => setChrome(false), CHROME_HIDE_MS);
        return () => clearTimeout(t);
    }, [stage, playing, chrome]);
    useEffect(() => {
        RNAnimated.timing(chromeOpacity, { toValue: chrome ? 1 : 0, duration: 300, useNativeDriver: true }).start();
    }, [chrome, chromeOpacity]);

    // The flight: one animation-frame loop for as long as the replay is on screen.
    useEffect(() => {
        if (stage !== 'replay' || trail.coordinates.length < 2) return undefined;
        headingRef.current = startHeading;
        let raf = 0;
        let last: number | null = null;
        let lastCamera = 0;
        let lastUi = 0;
        const tick = (ts: number) => {
            const dt = last == null ? 0 : Math.min(64, ts - last);
            last = ts;
            if (playingRef.current && progressRef.current < 1) {
                progressRef.current = Math.min(1, progressRef.current + (dt * speedRef.current) / plan.durationMs);
            }
            const f = replayFrame(trail.coordinates, cum, progressRef.current, plan.ahead);
            headingRef.current = turnToward(headingRef.current, f.heading, (TURN_DEG_PER_S * speedRef.current * dt) / 1000);
            if (playingRef.current && ts - lastCamera >= CAMERA_EVERY_MS) {
                lastCamera = ts;
                cameraRef.current?.setCamera({
                    centerCoordinate: f.center,
                    heading: headingRef.current,
                    animationDuration: CAMERA_EVERY_MS + 10,
                    animationMode: 'linearTo',
                });
            }
            if (ts - lastUi >= UI_EVERY_MS || progressRef.current >= 1) {
                lastUi = ts;
                setProgress(progressRef.current);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [stage, trail.coordinates, cum, plan, startHeading]);

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
        const shownDistance = distanceParts((session.distanceM ?? 0) * progress, units);
        const first = trail.coordinates[0];
        // The camera keeps the current position at the centre of the padded viewport.
        const focusY = plan.paddingTop + (height - plan.paddingTop) / 2;
        const here = replayFrame(trail.coordinates, cum, progress, plan.ahead).center;
        const last = trail.coordinates[trail.coordinates.length - 1];
        const clearOfEnds = haversine(here[1], here[0], first[1], first[0]) >= MOMENT_CLEARANCE_M
            && haversine(here[1], here[0], last[1], last[0]) >= MOMENT_CLEARANCE_M;

        const takeMoment = async () => {
            setPlaying(false);
            setChrome(true);
            if (!clearOfEnds) {
                Alert.alert(
                    'Pick a moment further along',
                    'Moments near the start or finish are not shared, so a picture never shows where you set off from. Move the slider along the route and try again.',
                );
                return;
            }
            setSnapping(true);
            try {
                const uri = await mapRef.current?.takeSnap(true);
                if (uri) setMoment({ uri, progress: progressRef.current });
            } catch {
                Alert.alert('Could not capture this moment', 'Please try again.');
            } finally {
                setSnapping(false);
            }
        };

        // The shared picture is 4:5; the full-screen snapshot is cropped to it, centred, so
        // the dot's position is recomputed for the crop rather than assumed.
        const momentW = Math.min(360, width - Spacing.xl * 2);
        const momentH = Math.round(momentW * 1.25);
        const scale = Math.max(momentW / width, momentH / height);
        const dot = {
            x: ((width / 2) * scale + (momentW - width * scale) / 2) / momentW,
            y: (focusY * scale + (momentH - height * scale) / 2) / momentH,
        };
        return (
            <View style={[styles.fill, { backgroundColor: P.canvas }]}>
                {focused && <StatusBar style="light" />}
                <RunMap
                    mode="replay"
                    trail={trail}
                    accent={EMBER_DARK[3]}
                    lightPreset={lightPresetFor(new Date(session.startedAt), first[1], first[0])}
                    replay={{
                        progress,
                        start: { center: first, heading: startHeading, zoom: plan.zoom, paddingTop: plan.paddingTop },
                    }}
                    cameraRef={cameraRef}
                    mapRef={mapRef}
                />
                {/* A tap anywhere brings the faded controls back. */}
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setChrome(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Show replay controls"
                />
                {/* The rider: fixed on screen at the camera's focus, so the map never redraws to move it. */}
                <View pointerEvents="none" style={[styles.dotWrap, { top: focusY - 22, left: width / 2 - 22 }]}>
                    <View style={[styles.dotGlow, { backgroundColor: withAlpha(EMBER_DARK[3], 0.3) }]} />
                    <View style={[styles.dotCore, { backgroundColor: EMBER_DARK[3], borderColor: HERO.white }]} />
                </View>
                <View style={[styles.replayTop, { paddingTop: insets.top + Spacing.md }]} pointerEvents="none">
                    <Text style={[styles.replayTitle, { color: HERO.white }]}>{title}</Text>
                    <View style={styles.row}>
                        <TickerNumber value={shownDistance.value} size={52} color={HERO.white} />
                        <Text style={[styles.replayUnit, { color: HERO.white }]}>{shownDistance.unit}</Text>
                    </View>
                    <Text style={[styles.replayClock, { color: HERO.white }]}>{formatClock(session.durationSec * progress)}</Text>
                </View>
                <BrandTag style={[styles.brand, { top: insets.top + Spacing.md }]} />
                <RNAnimated.View
                    pointerEvents={chrome ? 'box-none' : 'none'}
                    style={[styles.replayBottom, { paddingBottom: insets.bottom + Spacing.lg, opacity: chromeOpacity }]}
                >
                    <Scrubber
                        value={progress}
                        onScrub={(v) => { setPlaying(false); snapTo(v); }}
                        onRelease={() => undefined}
                    />
                    <View style={styles.replayActions}>
                        <Pressable
                            onPress={() => {
                                if (progressRef.current >= 1) snapTo(0);
                                setPlaying((p) => !p);
                            }}
                            style={styles.iconBtn}
                            accessibilityRole="button"
                            accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}
                        >
                            <Ionicons name={playing ? 'pause' : 'play'} size={20} color={HERO.white} />
                        </Pressable>
                        <Pressable
                            onPress={() => setSpeed((v) => (v === 1 ? 2 : 1))}
                            style={[styles.pill, styles.ghost]}
                            accessibilityRole="button"
                            accessibilityLabel={`Replay speed ${speed} times. Tap to change.`}
                        >
                            <Text style={styles.pillText}>{speed}×</Text>
                        </Pressable>
                        <Pressable
                            onPress={takeMoment}
                            disabled={snapping}
                            style={[styles.pill, styles.ghost, styles.shareMoment]}
                            accessibilityRole="button"
                            accessibilityLabel="Share this moment of the replay"
                        >
                            {snapping
                                ? <ActivityIndicator size="small" color={HERO.white} />
                                : <Ionicons name="share-outline" size={16} color={HERO.white} />}
                            <Text style={styles.pillText}>Share</Text>
                        </Pressable>
                        <Pressable onPress={() => setStage('poster')} style={[styles.pill, styles.ghost]} accessibilityRole="button">
                            <Text style={styles.pillText}>Skip</Text>
                        </Pressable>
                    </View>
                </RNAnimated.View>

                <Modal visible={!!moment} transparent animationType="fade" onRequestClose={() => setMoment(null)}>
                    <View style={[styles.momentBackdrop, { backgroundColor: withAlpha(P.canvas, 0.92) }]}>
                        {moment && (
                            <>
                                <View style={styles.posterFrame}>
                                    <ReplayMoment
                                        ref={momentRef}
                                        uri={moment.uri}
                                        width={momentW}
                                        height={momentH}
                                        dot={dot}
                                        title={title}
                                        distance={distanceParts((session.distanceM ?? 0) * moment.progress, units)}
                                        clock={formatClock(session.durationSec * moment.progress)}
                                        date={date}
                                    />
                                </View>
                                {/* Outside the captured view: anything inside it is in the picture. */}
                                <View style={[styles.shareRow, { width: momentW }]}>
                                    <Pressable onPress={() => setMoment(null)} style={[styles.share, styles.ghost]} accessibilityRole="button">
                                        <Text style={styles.pillText}>Close</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={async () => {
                                            setSharing(true);
                                            try {
                                                await shareRunImage(momentRef, `${title} on Predyqt: ${distance.value} ${distance.unit} in ${formatClock(session.durationSec)}.`);
                                            } finally {
                                                setSharing(false);
                                            }
                                        }}
                                        disabled={sharing}
                                        style={[styles.share, { backgroundColor: P.primaryFill }]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Share this picture"
                                    >
                                        {sharing ? <ActivityIndicator color={HERO.white} /> : (
                                            <>
                                                <Ionicons name="share-outline" size={20} color={HERO.white} />
                                                <Text style={styles.pillText}>Share</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                                <Text style={[styles.note, { color: P.textSecondary, width: momentW }]}>
                                    This picture shows the map around this point of your route.
                                </Text>
                            </>
                        )}
                    </View>
                </Modal>
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
                        <Pressable onPress={() => { progressRef.current = 0; setProgress(0); setPlaying(true); setStage('replay'); }} style={[styles.share, styles.ghost]} accessibilityRole="button">
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
    brand: { position: 'absolute', right: Spacing.xl },
    shareMoment: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    momentBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
    dotWrap: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dotGlow: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
    dotCore: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
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
