/**
 * The launch pad — Afterglow (plan §2.1).
 *
 * A violet stage with the GPS lock ring at its centre, whose radius **is** the reported
 * accuracy, so the person watches the fix tighten. Below it: what they are doing, and what
 * they set out to do. Start hands over to the live screen, which counts down and only then
 * records.
 *
 * What this screen owns:
 *
 * 1. **Permissions, at the moment Start is pressed** — location, then (iOS) motion. Never on
 *    mount: an iOS denial cannot be asked again, and a prompt with no run in front of it reads
 *    as surveillance. Once granted, fixes feed the ring on every later visit.
 * 2. **Starting before lock is allowed.** "Distance begins when GPS locks." Blocking a runner
 *    at their front door on a slow fix is how people go back to their watch.
 * 3. **An interrupted run** — resume it, save it as it stands, or discard it. Starting another
 *    on top would orphan it, so Start is disabled until the choice is made.
 * 4. **A run already going** sends the person straight back to it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { HeroStatusBar } from '@/components/ui/HeroStatusBar';
import GpsLockRing from '@/components/run/GpsLockRing';
import { typeStyle } from '@/lib/activityTypes';
import { getLiveContext } from '@/lib/activity';
import { ApiError } from '@/lib/api';
import * as recorder from '@/lib/run/recorder';
import { uploadRun } from '@/lib/run/upload';
import { ensureLocationPermission, watchLock, type LocationPermission } from '@/lib/run/gps';
import { prepareSteps } from '@/lib/run/steps';
import { TRACKABLE_TYPES, MAX_ACCURACY_M, type TrackableType } from '@/lib/run/trackMath';
import { paceParts, TYPE_LABEL } from '@/lib/run/format';
import { FREE, type RunGoal } from '@/lib/run/goal';
import { useUnits } from '@/lib/units';
import { getPaired } from '@/lib/health/jstyle/store';
import { isAvailable, supports } from '@/modules/jstyle-ble';

const PERMISSION_COPY: Record<Exclude<LocationPermission, 'granted'>, string> = {
    denied: 'Location is needed to record your route. You can allow it next time you press Start.',
    blocked: 'Location is off for this app. Allow it in Settings to record a route.',
    services_off: 'Location services are off on this phone. Turn them on to record a route.',
};

const M_PER_MILE = 1609.344;
/** A starting target pace per type, seconds per km; the stepper moves it. */
const DEFAULT_PACE: Record<Exclude<TrackableType, 'biking'>, number> = { jogging: 360, walking: 600, hiking: 900 };

type GoalKind = RunGoal['kind'];
type Interrupted = NonNullable<Awaited<ReturnType<typeof recorder.interruptedRun>>>;

export default function RunLaunchPad() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const units = useUnits();
    const params = useLocalSearchParams<{ type?: string }>();
    const hero = Palettes.light; // the stage is violet in both schemes (Dark mode rule 3)

    const initial = TRACKABLE_TYPES.includes(params.type as TrackableType) ? (params.type as TrackableType) : 'jogging';
    const [type, setType] = useState<TrackableType>(initial);
    const [goalKind, setGoalKind] = useState<GoalKind>('free');
    const [goalDistance, setGoalDistance] = useState(5000);
    const [goalTime, setGoalTime] = useState(30 * 60);
    const [goalPace, setGoalPace] = useState<number>(DEFAULT_PACE.jogging);
    const [permission, setPermission] = useState<LocationPermission | 'unknown'>('unknown');
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [starting, setStarting] = useState(false);
    const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
    const [weight, setWeight] = useState<number | null | 'unknown'>('unknown');
    const [maxHr, setMaxHr] = useState<number | null>(null);
    const [bracelet, setBracelet] = useState<string | null>(null);
    const lockSub = useRef<Location.LocationSubscription | null>(null);

    const miles = units.distance === 'mi';
    const distanceChoices = miles ? [1, 3, 5].map((m) => m * M_PER_MILE) : [3000, 5000, 10000];

    useEffect(() => {
        if (type !== 'biking') setGoalPace(DEFAULT_PACE[type]);
        if (type === 'biking' && goalKind === 'pace') setGoalKind('free');
    }, [type, goalKind]);

    useEffect(() => {
        if (!distanceChoices.some((d) => Math.abs(d - goalDistance) < 1)) setGoalDistance(distanceChoices[1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [miles]);

    const stopLock = () => {
        lockSub.current?.remove();
        lockSub.current = null;
    };

    const beginLock = useCallback(async () => {
        if (lockSub.current) return;
        try {
            lockSub.current = await watchLock((fix) => setAccuracy(fix.coords.accuracy ?? null));
        } catch {
            // No fix source: Start still works, and says distance begins at lock.
        }
    }, []);

    useFocusEffect(useCallback(() => {
        let mounted = true;
        (async () => {
            const found = recorder.hydrate() ? await recorder.interruptedRun() : null;
            if (!mounted) return;
            const { phase } = recorder.getState();
            if (!found && (phase === 'recording' || phase === 'paused')) {
                router.replace('/activity/run/live');
                return;
            }
            setInterrupted(found);

            const current = await Location.getForegroundPermissionsAsync().catch(() => null);
            if (!mounted) return;
            if (current?.granted) {
                setPermission('granted');
                beginLock();
            }

            getPaired()
                .then((p) => { if (mounted) setBracelet(p && isAvailable() && supports(p.variant, 'liveData') ? p.label : null); })
                .catch(() => undefined);

            getLiveContext()
                .then((ctx) => { if (mounted) { setWeight(ctx.weightKg); setMaxHr(ctx.maxHr ?? null); } })
                .catch((err) => {
                    // A failed lookup is not a missing weight: stay 'unknown', ask nothing, and
                    // let the recorder look it up again once the run starts.
                    if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
                });
        })();
        return () => {
            mounted = false;
            stopLock();
        };
    }, [beginLock, router]));

    useEffect(() => stopLock, []);

    const goal = (): RunGoal => {
        if (goalKind === 'distance') return { kind: 'distance', metres: goalDistance };
        if (goalKind === 'time') return { kind: 'time', seconds: goalTime };
        if (goalKind === 'pace') return { kind: 'pace', secPerKm: goalPace };
        return FREE;
    };

    const start = async () => {
        if (starting) return;
        setStarting(true);
        try {
            const granted = await ensureLocationPermission();
            setPermission(granted);
            if (granted !== 'granted') return;
            await prepareSteps(); // before the countdown, never over it
            stopLock(); // the recording task takes over the radio
            router.replace({
                pathname: '/activity/run/live',
                params: {
                    start: type,
                    w: typeof weight === 'number' ? String(weight) : '',
                    hr: maxHr ? String(maxHr) : '',
                    goal: JSON.stringify(goal()),
                },
            });
        } catch (err) {
            Alert.alert('Could not start', err instanceof Error ? err.message : 'Please try again.');
            beginLock();
        } finally {
            setStarting(false);
        }
    };

    const resumeInterrupted = async () => {
        try {
            await recorder.restartTracking();
            router.replace('/activity/run/live');
        } catch (err) {
            Alert.alert('Could not resume', err instanceof Error ? err.message : 'Please try again.');
        }
    };

    const saveInterrupted = async () => {
        const id = await recorder.finish();
        setInterrupted(null);
        if (!id) return;
        const result = await uploadRun(id);
        recorder.reset();
        if (result.status === 'saved') router.replace(`/activity/run/summary/${result.session._id}`);
        else Alert.alert('Saved on this phone', 'It will upload the next time you are online.');
    };

    const discardInterrupted = () => {
        Alert.alert('Discard this activity?', 'The route and everything recorded will be deleted from this phone.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: async () => { await recorder.discard(); setInterrupted(null); } },
        ]);
    };

    const locked = accuracy != null && accuracy <= MAX_ACCURACY_M;
    const lockTitle = permission !== 'granted'
        ? 'Ready when you are'
        : accuracy == null ? 'Finding you…' : locked ? 'GPS locked' : 'Locking on…';
    const lockLine = permission !== 'granted'
        ? (permission === 'unknown' ? 'Location is asked for when you press Start.' : PERMISSION_COPY[permission])
        : accuracy == null
            ? 'Stand somewhere with open sky.'
            : locked
                ? `Accurate to ±${Math.round(accuracy)} m`
                : `±${Math.round(accuracy)} m. You can start now; distance begins when GPS locks.`;

    const formatGoalDistance = (m: number) => `${Math.round(m / (miles ? M_PER_MILE : 1000))} ${miles ? 'mi' : 'km'}`;
    const pace = paceParts(goalPace, type, units);
    const blocked = starting || !!interrupted;

    return (
        <View style={styles.screen}>
            <HeroStatusBar />
            <LinearGradient colors={hero.heroGradient} style={styles.stage}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.bar}>
                        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                            <Ionicons name="chevron-back" size={24} color={hero.white} />
                        </Pressable>
                        <Text style={[styles.barTitle, { color: hero.white }]}>{TYPE_LABEL[type]}</Text>
                        <Pressable onPress={() => router.push('/activity/run/settings')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Activity settings">
                            <Ionicons name="options-outline" size={22} color={hero.white} />
                        </Pressable>
                    </View>
                </SafeAreaView>
                <View style={styles.ringWrap}>
                    <GpsLockRing
                        accuracyM={accuracy}
                        locked={locked}
                        searching={permission === 'granted'}
                        ring={hero.white}
                        core={hero.white}
                        size={200}
                    />
                </View>
                <Text style={[styles.lockTitle, { color: hero.white }]} accessibilityLiveRegion="polite">{lockTitle}</Text>
                <Text style={[styles.lockLine, { color: hero.white }]}>{lockLine}</Text>
                {permission === 'blocked' && (
                    <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link" style={styles.settingsLink}>
                        <Text style={[styles.settingsLinkText, { color: hero.white }]}>Open Settings</Text>
                    </Pressable>
                )}
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                {interrupted && (
                    <View style={styles.card} accessibilityRole="summary">
                        <Text style={styles.cardTitle}>An activity was interrupted</Text>
                        <Text style={styles.body}>
                            {TYPE_LABEL[interrupted.type]} started{' '}
                            {new Date(interrupted.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            , last recorded{' '}
                            {new Date(interrupted.lastT).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
                        </Text>
                        <View style={styles.row}>
                            <Pressable style={styles.outline} onPress={resumeInterrupted} accessibilityRole="button">
                                <Text style={styles.outlineText}>Resume</Text>
                            </Pressable>
                            <Pressable style={styles.outline} onPress={saveInterrupted} accessibilityRole="button">
                                <Text style={styles.outlineText}>Save as is</Text>
                            </Pressable>
                            <Pressable style={styles.textBtn} onPress={discardInterrupted} accessibilityRole="button">
                                <Text style={styles.dangerText}>Discard</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                <View style={styles.types} accessibilityRole="radiogroup">
                    {TRACKABLE_TYPES.map((t) => {
                        const active = t === type;
                        const look = typeStyle(t);
                        return (
                            <Pressable
                                key={t}
                                onPress={() => setType(t)}
                                style={[styles.type, active && styles.typeActive]}
                                accessibilityRole="radio"
                                accessibilityLabel={TYPE_LABEL[t]}
                                accessibilityState={{ selected: active }}
                            >
                                <View style={[styles.typeIcon, { backgroundColor: look.surface }]}>
                                    <MaterialCommunityIcons name={look.icon} size={24} color={look.tint} />
                                </View>
                                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{TYPE_LABEL[t]}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.section}>Goal</Text>
                <View style={styles.segment} accessibilityRole="radiogroup">
                    {(['free', 'distance', 'time', ...(type === 'biking' ? [] : ['pace'])] as GoalKind[]).map((k) => {
                        const active = k === goalKind;
                        return (
                            <Pressable
                                key={k}
                                onPress={() => setGoalKind(k)}
                                style={[styles.segmentItem, active && styles.segmentActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                            >
                                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                                    {k === 'free' ? 'Free' : k === 'distance' ? 'Distance' : k === 'time' ? 'Time' : 'Pace'}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {goalKind === 'distance' && (
                    <View style={styles.chips}>
                        {distanceChoices.map((m) => (
                            <Chip key={m} label={formatGoalDistance(m)} active={Math.abs(m - goalDistance) < 1} onPress={() => setGoalDistance(m)} />
                        ))}
                    </View>
                )}
                {goalKind === 'time' && (
                    <View style={styles.chips}>
                        {[20, 30, 45, 60].map((min) => (
                            <Chip key={min} label={`${min} min`} active={goalTime === min * 60} onPress={() => setGoalTime(min * 60)} />
                        ))}
                    </View>
                )}
                {goalKind === 'pace' && (
                    <View style={styles.stepper}>
                        <Pressable onPress={() => setGoalPace((p) => p + 5)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Slower by five seconds">
                            <Ionicons name="remove" size={22} color={Palette.primary} />
                        </Pressable>
                        <View style={styles.stepValue} accessible accessibilityLabel={`Target pace ${pace?.value} ${pace?.unit}`}>
                            <Text style={styles.stepNumber}>{pace?.value}</Text>
                            <Text style={styles.stepUnit}>{pace?.unit}</Text>
                        </View>
                        <Pressable onPress={() => setGoalPace((p) => Math.max(150, p - 5))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="Faster by five seconds">
                            <Ionicons name="add" size={22} color={Palette.primary} />
                        </Pressable>
                    </View>
                )}
                {goalKind === 'pace' && (
                    <Text style={styles.hint}>A ghost runs at this pace beside you. It pauses when you do.</Text>
                )}

                {bracelet && (
                    <View style={styles.note} accessible accessibilityLabel={`Heart rate from ${bracelet}`}>
                        <Ionicons name="heart" size={18} color={Palette.danger} />
                        <Text style={styles.noteText}>
                            Heart rate from {bracelet}{maxHr ? '' : '. Add your date of birth for heart-rate zones.'}
                        </Text>
                    </View>
                )}

                {weight === null && (
                    <Pressable style={styles.note} onPress={() => router.push('/metrics/log/weight')} accessibilityRole="link">
                        <Ionicons name="scale-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.noteText}>Calories need your weight. <Text style={styles.link}>Add it</Text></Text>
                    </Pressable>
                )}
            </ScrollView>

            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <Pressable
                    onPress={start}
                    disabled={blocked}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${TYPE_LABEL[type].toLowerCase()}`}
                    accessibilityState={{ disabled: blocked }}
                    style={({ pressed }) => [{ opacity: blocked ? 0.5 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                >
                    <LinearGradient colors={hero.actionGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                        {starting
                            ? <ActivityIndicator color={hero.white} />
                            : (
                                <>
                                    <Ionicons name="play" size={20} color={hero.white} />
                                    <Text style={[styles.ctaText, { color: hero.white }]}>Start</Text>
                                </>
                            )}
                    </LinearGradient>
                </Pressable>
            </SafeAreaView>
        </View>
    );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const styles = useStyles();
    return (
        <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </Pressable>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    stage: { paddingBottom: Spacing.xxl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, alignItems: 'center' },
    bar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, alignSelf: 'stretch', minWidth: '100%',
    },
    barTitle: { fontSize: 17, fontFamily: Fonts.bold, letterSpacing: 0.5 },
    ringWrap: { marginTop: Spacing.sm },
    lockTitle: { fontSize: 22, fontFamily: Fonts.bold, marginTop: Spacing.md },
    lockLine: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, opacity: 0.85, textAlign: 'center', paddingHorizontal: Spacing.xxl, marginTop: Spacing.xs },
    settingsLink: { marginTop: Spacing.sm },
    settingsLinkText: { fontFamily: Fonts.semibold, fontSize: 14, textDecorationLine: 'underline' },
    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl },
    types: { flexDirection: 'row', gap: Spacing.sm },
    type: {
        flex: 1, alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md,
        borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Palette.border, backgroundColor: Palette.background,
    },
    typeActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryTint },
    typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    typeLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    typeLabelActive: { color: Palette.primary },
    section: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.sm },
    segment: { flexDirection: 'row', backgroundColor: Palette.background, borderRadius: Radius.pill, padding: 4, borderWidth: 1, borderColor: Palette.border },
    segmentItem: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' },
    segmentActive: { backgroundColor: Palette.primaryFill },
    segmentText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    segmentTextActive: { color: Palette.white },
    chips: { flexDirection: 'row', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.background },
    chipActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryTint },
    chipText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    chipTextActive: { color: Palette.primary },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Palette.background, borderRadius: Radius.xl, padding: Spacing.sm, borderWidth: 1, borderColor: Palette.border },
    stepBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primaryTint },
    stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    stepNumber: { ...BodyFont.semibold, fontSize: 28, color: Palette.text, fontVariant: ['tabular-nums'] },
    stepUnit: { ...BodyFont.regular, fontSize: 15, color: Palette.textSecondary },
    hint: { ...BodyFont.regular, fontSize: 13, lineHeight: 18, color: Palette.textSecondary },
    note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    noteText: { ...BodyFont.regular, flex: 1, fontSize: 14, color: Palette.textSecondary },
    link: { ...BodyFont.medium, color: Palette.primary },
    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg, gap: Spacing.sm },
    cardTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    body: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, color: Palette.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    outline: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary },
    outlineText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    textBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    dangerText: { ...BodyFont.medium, fontSize: 14, color: Palette.danger },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, backgroundColor: Palette.canvas },
    cta: { flexDirection: 'row', gap: Spacing.sm, borderRadius: Radius.pill, paddingVertical: Spacing.lg + 2, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    ctaText: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: 1 },
}));
