/**
 * The live session — R1 form: map above, numbers below, pause and hold-to-finish.
 *
 * A view of `lib/run/recorder`, never the owner of anything. Leaving this screen does not
 * stop the run; coming back redraws it from the recorder, which redraws itself from the
 * journal if it has to. The Afterglow faces (Map / Focus / Splits, the countdown, the lock,
 * the pace trail) are R2 and replace this layout; the wiring underneath does not change.
 *
 * Finishing is a **hold**, not a tap and not a dialog: a pocket can tap, and a confirm box is
 * a second tap somebody out of breath has to aim. The hold is the confirmation.
 *
 * After finishing, the upload is tried at once. Saved → the session's own detail screen,
 * which shows the server's figures (the record). Not reachable → the run stays on the phone
 * and says so; `uploadPending()` sends it at the next launch. Never a spinner that blocks.
 */
import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import RunMap from '@/components/run/RunMap';
import * as recorder from '@/lib/run/recorder';
import { uploadRun, type UploadResult } from '@/lib/run/upload';
import { distanceParts, formatClock, paceParts, TYPE_LABEL } from '@/lib/run/format';
import { formatEnergy, useUnits } from '@/lib/units';

const HOLD_MS = 1200;

/** Re-read the recorder every second so the clock ticks between fixes. */
const useRecorder = () => {
    const [, tick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, []);
    // Every change (a fix, a pause) bumps the version; the tick covers the seconds between.
    const version = useSyncExternalStore(recorder.subscribe, recorder.getVersion);
    return { state: recorder.getState(), version };
};

type Ending = { kind: 'saving' } | { kind: 'offline' } | { kind: 'rejected'; reason: string } | null;

export default function LiveRunScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const units = useUnits();
    const [ending, setEnding] = useState<Ending>(null);
    const [holding, setHolding] = useState(false);

    useEffect(() => {
        // Arriving here with nothing recording (a stale link, a finished run) goes back to
        // the launch pad rather than drawing zeros.
        if (!recorder.hydrate() || recorder.getState().phase === 'idle') router.replace('/activity/run');
    }, [router]);

    const { state, version } = useRecorder();
    // The route redraws when the recorder changes, not on the clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const coordinates = React.useMemo(() => recorder.routeCoordinates(), [version]);

    const finish = useCallback(async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setEnding({ kind: 'saving' });
        const id = await recorder.finish();
        if (!id) { router.replace('/activity'); return; }
        const result: UploadResult = await uploadRun(id);
        if (result.status === 'saved') {
            recorder.reset();
            router.replace(`/activity/session/${result.session._id}`);
        } else if (result.status === 'rejected') {
            setEnding({ kind: 'rejected', reason: result.reason });
        } else if (result.status === 'pending' && result.authError) {
            // The run is safe on disk; sign in and it uploads at the next launch.
            router.replace('/(auth)/loginscreen');
        } else {
            setEnding({ kind: 'offline' });
        }
    }, [router]);

    const discard = () => {
        Alert.alert('Discard this activity?', 'Everything recorded so far will be deleted.', [
            { text: 'Keep going', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: async () => { await recorder.discard(); router.replace('/activity'); } },
        ]);
    };

    if (ending) {
        return (
            <SafeAreaView style={[styles.screen, styles.centre]} edges={['top', 'bottom']}>
                {ending.kind === 'saving' ? (
                    <>
                        <ActivityIndicator color={Palette.primary} />
                        <Text style={styles.endTitle}>Saving your {state.type ? TYPE_LABEL[state.type].toLowerCase() : 'activity'}…</Text>
                    </>
                ) : (
                    <>
                        <Ionicons
                            name={ending.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                            size={40}
                            color={Palette.textSecondary}
                        />
                        <Text style={styles.endTitle}>
                            {ending.kind === 'offline' ? 'Saved on this phone' : 'Kept on this phone'}
                        </Text>
                        <Text style={styles.endBody}>
                            {ending.kind === 'offline'
                                ? 'It will upload the next time Predyqt can reach the server. Nothing is lost.'
                                : `The server could not read it (${ending.reason}). It stays on this phone so it can be sent once that is fixed.`}
                        </Text>
                        <Pressable
                            style={styles.cta}
                            onPress={() => { recorder.reset(); router.replace('/activity'); }}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaText}>Done</Text>
                        </Pressable>
                    </>
                )}
            </SafeAreaView>
        );
    }

    const live = state.live;
    const distance = distanceParts(live?.distanceM ?? 0, units);
    const pace = state.type ? paceParts(live?.currentPacePerKm ?? null, state.type, units) : null;
    const avgPace = state.type ? paceParts(live?.avgPacePerKm ?? null, state.type, units) : null;
    const paused = state.phase === 'paused';
    const autoPaused = !paused && !!live?.stationary;
    const waitingForGps = state.lastFixAt == null || (state.accuracyM != null && state.accuracyM > 25);

    return (
        <View style={styles.screen}>
            <View style={styles.mapWrap}>
                <RunMap coordinates={coordinates} type={state.type ?? 'jogging'} />
                <SafeAreaView edges={['top']} style={styles.mapOverlay} pointerEvents="box-none">
                    <View style={[styles.chip, paused && styles.chipPaused]}>
                        <View style={[styles.dot, { backgroundColor: paused ? Palette.textSecondary : Palette.danger }]} />
                        <Text style={styles.chipText}>
                            {paused ? 'Paused' : autoPaused ? 'Auto-paused' : waitingForGps ? 'Waiting for GPS' : 'Recording'}
                        </Text>
                    </View>
                </SafeAreaView>
            </View>

            <SafeAreaView edges={['bottom']} style={styles.panel}>
                <View style={styles.hero} accessible accessibilityLabel={`${distance.value} ${distance.unit}`}>
                    <Text style={styles.heroValue}>{distance.value}</Text>
                    <Text style={styles.heroUnit}>{distance.unit}</Text>
                </View>

                <View style={styles.stats}>
                    <Stat label="Time" value={formatClock(state.activeSec)} />
                    <Stat label="Pace" value={pace ? pace.value : '—'} unit={pace?.unit} />
                    <Stat label="Avg pace" value={avgPace ? avgPace.value : '—'} unit={avgPace?.unit} />
                    <Stat
                        label="Calories"
                        value={state.kcal != null ? (formatEnergy(state.kcal, units) ?? '—') : '—'}
                        note={!state.weightKnown ? 'needs weight' : undefined}
                    />
                </View>

                <View style={styles.controls}>
                    <Pressable onPress={discard} hitSlop={12} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Discard activity">
                        <Ionicons name="trash-outline" size={22} color={Palette.textSecondary} />
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                            if (paused) recorder.resume(); else recorder.pause();
                        }}
                        style={styles.mainBtn}
                        accessibilityRole="button"
                        accessibilityLabel={paused ? 'Resume' : 'Pause'}
                    >
                        <Ionicons name={paused ? 'play' : 'pause'} size={30} color={Palette.white} />
                    </Pressable>

                    <Pressable
                        onPressIn={() => setHolding(true)}
                        onPressOut={() => setHolding(false)}
                        onLongPress={finish}
                        delayLongPress={HOLD_MS}
                        style={[styles.sideBtn, holding && styles.sideBtnHolding]}
                        accessibilityRole="button"
                        accessibilityLabel="Finish"
                        accessibilityHint="Press and hold to finish and save"
                        // Screen readers cannot hold; give them the action directly.
                        accessibilityActions={[{ name: 'activate', label: 'Finish and save' }]}
                        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate') finish(); }}
                    >
                        <Ionicons name="stop" size={22} color={holding ? Palette.white : Palette.text} />
                    </Pressable>
                </View>
                <Text style={styles.hint}>{holding ? 'Keep holding…' : 'Hold ■ to finish'}</Text>
            </SafeAreaView>
        </View>
    );
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
    const styles = useStyles();
    return (
        <View style={styles.stat} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''} ${note ?? ''}`}>
            <Text style={styles.statValue}>
                {value}
                {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
            </Text>
            <Text style={styles.statLabel}>{note ? `${label} · ${note}` : label}</Text>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },
    mapWrap: { flex: 1 },
    mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, alignItems: 'flex-start' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Radius.pill,
        backgroundColor: Palette.background,
    },
    chipPaused: { backgroundColor: Palette.canvas },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    panel: {
        backgroundColor: Palette.background,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        marginTop: -Radius.xl,
    },
    hero: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm },
    // Tabular figures only work in the system face (Chakra Petch has none), so the
    // numbers that tick are set in BodyFont until R2's fixed-width TickerNumber.
    heroValue: { ...BodyFont.semibold, fontSize: 64, color: Palette.text, fontVariant: ['tabular-nums'] },
    heroUnit: { fontSize: 20, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg, marginTop: Spacing.lg },
    stat: { width: '50%', alignItems: 'center', gap: 2 },
    statValue: { ...BodyFont.semibold, fontSize: 24, color: Palette.text, fontVariant: ['tabular-nums'] },
    statUnit: { ...BodyFont.regular, fontSize: 14, color: Palette.textSecondary },
    statLabel: { ...BodyFont.regular, fontSize: 13, color: Palette.textSecondary },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: Spacing.xxl,
    },
    mainBtn: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: Palette.primaryFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideBtnHolding: { backgroundColor: Palette.primaryFill, borderColor: Palette.primaryFill },
    hint: { ...BodyFont.regular, fontSize: 12, color: Palette.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.md },
    endTitle: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    endBody: { ...BodyFont.regular, fontSize: 15, lineHeight: 22, color: Palette.textSecondary, textAlign: 'center' },
    cta: {
        marginTop: Spacing.lg,
        backgroundColor: Palette.primaryFill,
        borderRadius: Radius.pill,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xxxl,
    },
    ctaText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
}));
