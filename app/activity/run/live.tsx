/**
 * The live session — Afterglow (plan §2.2–2.3).
 *
 * A view of `lib/run/recorder`, never the owner of anything: leaving does not stop the run,
 * and coming back redraws it from the recorder, which redraws itself from the journal if it
 * has to. Three faces, swiped between, over one control bar that never moves:
 *
 *   Map     the sun-lit monochrome map with the Ember trail, and a frosted instrument panel
 *   Focus   OLED black, three numbers you can read at arm's length, the goal or lap ring
 *   Splits  each kilometre (or mile) landing as a bar, the current one filling
 *
 * The screen is its own surface, dark by default and black-on-white with "High contrast"
 * (for full sun). It does not follow the app's Light/Dark choice: it is read mid-stride, and
 * the choice between them is about the light outside, not about taste.
 *
 * **Arriving with `start`** (from the launch pad) runs the countdown and only then starts
 * recording, so the three seconds stood still are not on the clock. Arriving without it
 * resumes the drawing of a run already going.
 *
 * Finishing is the hold. Saved → the session's own screen, with the server's figures (the
 * record). Unreachable → "saved on this phone", sent at the next launch. Never a spinner that
 * blocks.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
    View, Text, Pressable, Alert, ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useReducedMotion } from 'react-native-reanimated';
import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import RunMap from '@/components/run/RunMap';
import CountdownOverlay from '@/components/run/CountdownOverlay';
import HoldToFinish from '@/components/run/HoldToFinish';
import SlideToUnlock from '@/components/run/SlideToUnlock';
import PaceRibbon from '@/components/run/PaceRibbon';
import FocusFace, { type HudColours } from '@/components/run/FocusFace';
import SplitsFace from '@/components/run/SplitsFace';
import TickerNumber from '@/components/run/TickerNumber';
import * as recorder from '@/lib/run/recorder';
import { uploadRun, type UploadResult } from '@/lib/run/upload';
import { distanceParts, formatClock, paceParts, TYPE_LABEL } from '@/lib/run/format';
import { buildTrail, EMBER_DARK, EMBER_LIGHT, recentPace, withAlpha } from '@/lib/run/afterglow';
import { goalProgress, type RunGoal } from '@/lib/run/goal';
import { lightPresetFor } from '@/lib/run/sun';
import { zoneFor } from '@/lib/run/zones';
import { useRunSettings } from '@/lib/run/settings';
import { splitSegments, TRACKABLE_TYPES, MAX_ACCURACY_M, type TrackableType } from '@/lib/run/trackMath';
import { formatEnergy, useUnits } from '@/lib/units';

const M_PER_MILE = 1609.344;
const FACES = ['Map', 'Focus', 'Splits'] as const;
type HeroKind = 'distance' | 'time' | 'pace';

/** Re-read the recorder on every change, and every second so the clock ticks between fixes. */
const useRecorder = () => {
    const [, tick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, []);
    const version = useSyncExternalStore(recorder.subscribe, recorder.getVersion);
    return { state: recorder.getState(), version };
};

type Ending = { kind: 'saving' } | { kind: 'offline' } | { kind: 'server'; httpStatus: number } | { kind: 'rejected'; reason: string } | null;

const parseGoal = (raw: string | undefined): RunGoal | undefined => {
    if (!raw) return undefined;
    try { return JSON.parse(raw) as RunGoal; } catch { return undefined; }
};

export default function LiveRunScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ start?: string; w?: string; hr?: string; goal?: string }>();
    const settings = useRunSettings();
    const units = useUnits();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const focused = useIsFocused();
    const reduceMotion = useReducedMotion();

    const light = settings.highContrast;
    const P = light ? Palettes.light : Palettes.dark;
    const ramp = light ? EMBER_LIGHT : EMBER_DARK;
    const accent = ramp[ramp.length - (light ? 1 : 2)];
    const hud: HudColours = {
        background: light ? P.background : P.canvas,
        text: P.text,
        secondary: P.textSecondary,
        track: P.border,
        accent,
    };

    const pending = TRACKABLE_TYPES.includes(params.start as TrackableType) ? (params.start as TrackableType) : null;
    const [counting, setCounting] = useState(() => !!pending && recorder.getState().phase === 'idle' && settings.countdown);
    const [ending, setEnding] = useState<Ending>(null);
    const [page, setPage] = useState(0);
    const [locked, setLocked] = useState(false);
    const [hero, setHero] = useState<HeroKind>('distance');
    const [ribbonWidth, setRibbonWidth] = useState(0);
    const startedHere = useRef(false);

    const begin = useCallback(async () => {
        if (startedHere.current) return;
        startedHere.current = true;
        setCounting(false);
        try {
            const w = params.w ? Number(params.w) : NaN;
            const hr = params.hr ? Number(params.hr) : NaN;
            await recorder.start({
                type: pending!,
                weightKg: Number.isFinite(w) ? w : null,
                maxHr: Number.isFinite(hr) ? hr : null,
                goal: parseGoal(params.goal),
            });
        } catch (err) {
            if (!(err instanceof recorder.RunAlreadyActiveError)) {
                Alert.alert('Could not start', err instanceof Error ? err.message : 'Please try again.');
                router.replace('/activity/run');
            }
        }
    }, [params.goal, params.w, params.hr, pending, router]);

    useEffect(() => {
        const phase = recorder.hydrate() ? recorder.getState().phase : 'idle';
        if (phase !== 'idle') return;
        if (!pending) { router.replace('/activity/run'); return; }
        if (!settings.countdown) begin();
        // Mount only: the params and the setting are read once, at arrival.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { state, version } = useRecorder();

    // Keep the screen on only on Focus, only if asked, only while recording in the foreground.
    useEffect(() => {
        const want = focused && page === 1 && settings.keepAwakeOnFocus && state.phase === 'recording';
        if (want) activateKeepAwakeAsync('run-focus').catch(() => undefined);
        else deactivateKeepAwake('run-focus').catch(() => undefined);
        return () => { deactivateKeepAwake('run-focus').catch(() => undefined); };
    }, [focused, page, settings.keepAwakeOnFocus, state.phase]);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the recorder changes, not on the clock
    const view = useMemo(() => recorder.trackView(), [version]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const trail = useMemo(() => buildTrail(view.points, view.segments, ramp), [view, light]);
    const ribbon = useMemo(() => recentPace(view.segments), [view]);
    const lastPoint = view.points[view.points.length - 1];
    const preset = light ? 'day' : lightPresetFor(new Date(), lastPoint?.lat ?? 25, lastPoint?.lng ?? 55);

    const unitM = units.distance === 'mi' ? M_PER_MILE : 1000;
    // Kilometres come straight off the accumulator; miles are re-split from the same segments.
    const mileSplits = useMemo(() => (unitM === 1000 ? null : splitSegments(view.segments, unitM)), [view, unitM]);
    const splits = mileSplits ?? {
        closed: state.live?.splits ?? [],
        current: state.live?.currentSplit ?? { distanceM: 0, durationSec: 0 },
    };

    const finish = useCallback(async () => {
        setEnding({ kind: 'saving' });
        const id = await recorder.finish();
        if (!id) { router.replace('/activity'); return; }
        const result: UploadResult = await uploadRun(id);
        if (result.status === 'saved') {
            recorder.reset();
            router.replace(`/activity/run/summary/${result.session._id}`);
        } else if (result.status === 'rejected') {
            setEnding({ kind: 'rejected', reason: result.reason });
        } else if (result.status === 'pending' && result.authError) {
            router.replace('/(auth)/loginscreen');
        } else if (result.status === 'pending' && result.kind === 'server') {
            setEnding({ kind: 'server', httpStatus: result.httpStatus });
        } else {
            setEnding({ kind: 'offline' });
        }
    }, [router]);

    const discard = () => {
        Alert.alert('Discard this activity?', 'Everything recorded so far will be deleted from this phone.', [
            { text: 'Keep it', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: async () => { await recorder.discard(); router.replace('/activity'); } },
        ]);
    };

    const togglePause = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        if (state.phase === 'paused') recorder.resume(); else recorder.pause();
    };

    // ---- the ending ---------------------------------------------------------------------
    if (ending) {
        return (
            <View style={[styles.fill, styles.centre, { backgroundColor: hud.background, paddingTop: insets.top }]}>
                {focused && <StatusBar style={light ? 'dark' : 'light'} />}
                {ending.kind === 'saving' ? (
                    <>
                        <ActivityIndicator color={accent} />
                        <Text style={[styles.endTitle, { color: hud.text }]}>
                            Saving your {state.type ? TYPE_LABEL[state.type].toLowerCase() : 'activity'}…
                        </Text>
                    </>
                ) : (
                    <>
                        <Ionicons name={ending.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'} size={44} color={hud.secondary} />
                        <Text style={[styles.endTitle, { color: hud.text }]}>
                            {ending.kind === 'offline' ? 'Saved on this phone' : 'Kept on this phone'}
                        </Text>
                        <Text style={[styles.endBody, { color: hud.secondary }]}>
                            {ending.kind === 'offline'
                                ? 'The phone could not reach Predyqt. It uploads by itself when you are back online. Nothing is lost.'
                                : ending.kind === 'server'
                                    ? `Predyqt's server did not accept it yet (error ${ending.httpStatus}). It is safe on this phone and is retried every time you open the app. Nothing is lost.`
                                    : `The server could not read it (${ending.reason}). It stays on this phone so it can be sent once that is fixed.`}
                        </Text>
                        <Pressable
                            style={[styles.done, { backgroundColor: P.primaryFill }]}
                            onPress={() => { recorder.reset(); router.replace('/activity'); }}
                            accessibilityRole="button"
                        >
                            <Text style={styles.doneText}>Done</Text>
                        </Pressable>
                    </>
                )}
            </View>
        );
    }

    // ---- the numbers ------------------------------------------------------------------------
    const live = state.live;
    const type = state.type ?? pending ?? 'jogging';
    const distance = distanceParts(live?.distanceM ?? 0, units);
    const pace = paceParts(live?.currentPacePerKm ?? null, type, units);
    const avgPace = paceParts(live?.avgPacePerKm ?? null, type, units);
    const clock = formatClock(state.activeSec);
    const paused = state.phase === 'paused';
    const autoPaused = !paused && !!live?.stationary;
    const noFix = state.phase !== 'idle' && (state.lastFixAt == null || (state.accuracyM != null && state.accuracyM > MAX_ACCURACY_M));
    const goal = state.goal ?? parseGoal(params.goal) ?? null;
    const progress = goalProgress(goal ?? undefined, {
        distanceM: live?.distanceM ?? 0, movingSec: live?.movingSec ?? 0, activeSec: state.activeSec,
    });
    const ringFraction = progress.fraction ?? (splits.current.distanceM / unitM);
    const ringLabel = goal?.kind === 'distance'
        ? `of ${distanceParts(goal.metres, units).value.replace(/\.00$/, '')} ${distance.unit}`
        : goal?.kind === 'time'
            ? `of ${Math.round(goal.seconds / 60)} min`
            : `this ${units.distance === 'mi' ? 'mile' : 'km'}`;
    const paceLabel = type === 'biking' ? 'Speed' : 'Pace';
    const kcal = state.kcal != null ? formatEnergy(state.kcal, units) : null;

    const heroValue = hero === 'distance'
        ? { value: distance.value, unit: distance.unit, label: 'Distance' }
        : hero === 'time'
            ? { value: clock, unit: '', label: 'Time' }
            : { value: pace?.value ?? '—', unit: pace?.unit ?? '', label: paceLabel };
    const nextHero: Record<HeroKind, HeroKind> = { distance: 'time', time: 'pace', pace: 'distance' };

    // How far off the signal is, when there is one. "±2 km" is approximate location, which the
    // launch pad now refuses (`ensureLocationPermission`); "no signal" is the system not
    // delivering fixes at all. The two have different fixes, so the screen tells them apart.
    const fixNote = state.accuracyM == null || state.lastFixAt == null
        ? 'no signal'
        : state.accuracyM >= 1000 ? `±${(state.accuracyM / 1000).toFixed(1)} km` : `±${Math.round(state.accuracyM)} m`;
    const statusText = paused ? 'Paused' : autoPaused ? 'Auto-paused' : noFix ? `Waiting for GPS · ${fixNote}` : 'Recording';
    const zone = zoneFor(state.heartRate, state.maxHr);
    const heartLabel = state.heartLink === 'lost' ? 'Bracelet reconnecting…'
        : state.heartLink === 'connecting' ? 'Connecting bracelet…'
            : null;

    return (
        <View style={[styles.fill, { backgroundColor: hud.background }]}>
            {/* Only while focused: status-bar settings stack, and a covered screen must not keep forcing its style. */}
            {focused && <StatusBar style={light || (page === 0 && preset === 'day') ? 'dark' : 'light'} />}

            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!locked && !counting}
                onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
                style={styles.fill}
            >
                {/* Face A — Map */}
                <View style={{ width }}>
                    {/* Mounted only on this face: on Focus the GPU stops drawing tiles and the OLED goes black. */}
                    {page === 0 ? (
                        <RunMap trail={trail} lightPreset={preset} accent={accent} />
                    ) : <View style={styles.fill} />}
                    <View style={[styles.panelWrap, { paddingBottom: 132 + insets.bottom }]} pointerEvents="box-none">
                        <BlurView intensity={60} tint={light ? 'light' : 'dark'} style={[styles.panel, { borderColor: hud.track }]}>
                            <Pressable
                                onPress={() => setHero(nextHero[hero])}
                                style={styles.heroRow}
                                accessibilityRole="button"
                                accessibilityLabel={`${heroValue.label} ${heroValue.value} ${heroValue.unit}. Tap to change.`}
                            >
                                <TickerNumber value={heroValue.value} size={58} color={hud.text} />
                                {!!heroValue.unit && <Text style={[styles.heroUnit, { color: hud.secondary }]}>{heroValue.unit}</Text>}
                            </Pressable>
                            <View style={styles.statsRow}>
                                {hero !== 'time' && <MiniStat hud={hud} label="Time" value={clock} />}
                                {hero !== 'distance' && <MiniStat hud={hud} label="Distance" value={distance.value} unit={distance.unit} />}
                                {hero !== 'pace' && <MiniStat hud={hud} label={paceLabel} value={pace?.value ?? '—'} unit={pace?.unit} />}
                                {state.heartRate != null
                                    ? <MiniStat hud={hud} label={zone ? `Heart · zone ${zone}` : 'Heart'} value={String(state.heartRate)} unit="bpm" />
                                    : <MiniStat hud={hud} label={state.weightStatus === 'missing' ? 'Calories · needs weight' : 'Calories'} value={kcal ?? '—'} />}
                            </View>
                            <View onLayout={(e) => setRibbonWidth(e.nativeEvent.layout.width)}>
                                <PaceRibbon
                                    paces={ribbon}
                                    targetSecPerKm={goal?.kind === 'pace' ? goal.secPerKm : null}
                                    width={ribbonWidth}
                                    stroke={accent}
                                    band={hud.track}
                                />
                            </View>
                            {avgPace && <Text style={[styles.caption, { color: hud.secondary }]}>Average {avgPace.value} {avgPace.unit}</Text>}
                        </BlurView>
                    </View>
                </View>

                {/* Face B — Focus */}
                <View style={{ width, paddingBottom: 120 + insets.bottom, paddingTop: insets.top + 40 }}>
                    <FocusFace
                        hud={hud}
                        clock={clock}
                        distance={distance}
                        pace={pace}
                        paceLabel={paceLabel}
                        ring={ringFraction}
                        ringLabel={ringLabel}
                        ghostGapSec={progress.ghostGapSec}
                        heart={state.heartRate != null ? { bpm: state.heartRate, zone, estimated: state.maxHr != null } : null}
                        cadence={state.cadence}
                    />
                </View>

                {/* Face C — Splits */}
                <View style={{ width, paddingBottom: 120 + insets.bottom }}>
                    <SplitsFace
                        hud={hud}
                        ramp={ramp}
                        splits={splits.closed}
                        current={splits.current}
                        unitM={unitM}
                        formatPace={(s) => {
                            const p = paceParts(s, type, units);
                            return p ? `${p.value} ${p.unit}` : '—';
                        }}
                    />
                </View>
            </ScrollView>

            {/* The status chip and the face dots, over every face */}
            <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]} pointerEvents="none">
                <View style={[styles.chip, { backgroundColor: hud.background, borderColor: hud.track }]}>
                    <RecDot colour={paused ? hud.secondary : P.danger} pulse={!paused && !reduceMotion} />
                    <Text style={[styles.chipText, { color: hud.text }]}>{statusText}</Text>
                    {state.heartRate != null && (
                        <Text style={[styles.chipText, { color: hud.text }]}>  ♥ {state.heartRate}</Text>
                    )}
                    {heartLabel && <Text style={[styles.chipText, { color: hud.secondary }]}>  · {heartLabel}</Text>}
                </View>
                <View style={styles.dots} accessible accessibilityLabel={`${FACES[page]} view, ${page + 1} of ${FACES.length}. Swipe for more.`}>
                    {FACES.map((f, i) => (
                        <View key={f} style={[styles.dot, { backgroundColor: i === page ? hud.text : hud.track }]} />
                    ))}
                </View>
            </View>

            {/* Paused: the faces desaturate under a veil; the controls stay live above it */}
            {paused && (
                <View style={[StyleSheet.absoluteFill, styles.veil, { backgroundColor: withAlpha(hud.background, light ? 0.55 : 0.62) }]} pointerEvents="none">
                    <Breathing reduce={reduceMotion}>
                        <Text style={[styles.pausedText, { color: hud.text }]}>PAUSED</Text>
                    </Breathing>
                </View>
            )}

            {/* The control bar */}
            <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: hud.background, borderColor: hud.track }]}>
                {locked ? (
                    <SlideToUnlock onUnlock={() => setLocked(false)} track={hud.track} thumb={P.primaryFill} text={hud.text} icon={Palettes.light.white} />
                ) : (
                    <View style={styles.controlRow}>
                        {paused ? (
                            <Pressable onPress={discard} style={styles.side} accessibilityRole="button" accessibilityLabel="Discard activity">
                                <Ionicons name="trash-outline" size={22} color={hud.secondary} />
                                <Text style={[styles.sideLabel, { color: hud.secondary }]}>Discard</Text>
                            </Pressable>
                        ) : (
                            <Pressable onPress={() => setLocked(true)} style={styles.side} accessibilityRole="button" accessibilityLabel="Lock the controls">
                                <Ionicons name="lock-open-outline" size={22} color={hud.secondary} />
                                <Text style={[styles.sideLabel, { color: hud.secondary }]}>Lock</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={togglePause}
                            disabled={state.phase === 'idle'}
                            style={[styles.main, { backgroundColor: P.primaryFill }]}
                            accessibilityRole="button"
                            accessibilityLabel={paused ? 'Resume' : 'Pause'}
                        >
                            <Ionicons name={paused ? 'play' : 'pause'} size={32} color={Palettes.light.white} />
                        </Pressable>
                        <View style={styles.side}>
                            <HoldToFinish onComplete={finish} track={hud.track} fill={P.primaryFill} icon={hud.text} disabled={state.phase === 'idle'} />
                            <Text style={[styles.sideLabel, { color: hud.secondary }]}>Hold</Text>
                        </View>
                    </View>
                )}
            </View>

            {counting && <CountdownOverlay onDone={begin} />}
        </View>
    );
}

function MiniStat({ hud, label, value, unit }: { hud: HudColours; label: string; value: string; unit?: string }) {
    return (
        <View style={styles.mini} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
            <Text style={[styles.miniValue, { color: hud.text }]}>
                {value}{unit ? <Text style={[styles.miniUnit, { color: hud.secondary }]}> {unit}</Text> : null}
            </Text>
            <Text style={[styles.miniLabel, { color: hud.secondary }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

/** The recording dot. It pulses only while recording — a heartbeat that stops when you do. */
function RecDot({ colour, pulse }: { colour: string; pulse: boolean }) {
    const v = useRef(new RNAnimated.Value(1)).current;
    useEffect(() => {
        if (!pulse) { v.setValue(1); return undefined; }
        const loop = RNAnimated.loop(RNAnimated.sequence([
            RNAnimated.timing(v, { toValue: 0.25, duration: 700, useNativeDriver: true }),
            RNAnimated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse, v]);
    return <RNAnimated.View style={[styles.recDot, { backgroundColor: colour, opacity: v }]} />;
}

function Breathing({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
    const v = useRef(new RNAnimated.Value(1)).current;
    useEffect(() => {
        if (reduce) return undefined;
        const loop = RNAnimated.loop(RNAnimated.sequence([
            RNAnimated.timing(v, { toValue: 0.45, duration: 1300, useNativeDriver: true }),
            RNAnimated.timing(v, { toValue: 1, duration: 1300, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [reduce, v]);
    return <RNAnimated.View style={{ opacity: v }}>{children}</RNAnimated.View>;
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    centre: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },
    top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    },
    chipText: { fontFamily: Fonts.semibold, fontSize: 13, letterSpacing: 0.4 },
    recDot: { width: 8, height: 8, borderRadius: 4 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.md },
    panel: {
        borderRadius: Radius.xl + 8, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.md, borderWidth: StyleSheet.hairlineWidth,
    },
    heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm },
    heroUnit: { fontFamily: Fonts.semibold, fontSize: 20 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    mini: { flex: 1, alignItems: 'center', gap: 2 },
    miniValue: { ...BodyFont.semibold, fontSize: 18, fontVariant: ['tabular-nums'] },
    miniUnit: { ...BodyFont.regular, fontSize: 12 },
    miniLabel: { ...BodyFont.regular, fontSize: 11 },
    caption: { ...BodyFont.regular, fontSize: 12, textAlign: 'center' },
    veil: { alignItems: 'center', justifyContent: 'center' },
    pausedText: { fontFamily: Fonts.bold, fontSize: 40, letterSpacing: 8 },
    controls: {
        position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: Spacing.lg, paddingHorizontal: Spacing.xxl,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    side: { width: 72, alignItems: 'center', gap: 4 },
    sideLabel: { ...BodyFont.regular, fontSize: 11 },
    main: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
    endTitle: { fontFamily: Fonts.bold, fontSize: 22, textAlign: 'center' },
    endBody: { ...BodyFont.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    done: { marginTop: Spacing.lg, borderRadius: Radius.pill, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxxl },
    doneText: { fontFamily: Fonts.bold, fontSize: 16, color: Palettes.light.white },
});
