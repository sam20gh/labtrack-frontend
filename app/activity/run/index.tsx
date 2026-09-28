/**
 * Start a live session — the launch pad (plan §2.1), R1 form.
 *
 * Functional first: pick a type, see whether GPS has a fix, start. The Afterglow treatment
 * (lock ring, type dial, goal chips) is R2 and lands on this same screen.
 *
 * Three things this screen owns that the live one does not:
 *
 * 1. **The permission prompt, at the moment Start is pressed.** Never on mount: an iOS
 *    denial cannot be asked again, and a location prompt with no run in front of it reads as
 *    surveillance. Once granted, the screen watches fixes so the person can see the lock
 *    arrive — and can start before it does ("distance begins when GPS locks").
 * 2. **An interrupted run.** If the journal says a run is recording and the radio is not
 *    (a force-quit, a restart), the choice is here: resume it, save it as it stands, or
 *    discard it. Starting another on top would orphan it.
 * 3. **A run already in progress** sends the person straight back to it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { typeStyle } from '@/lib/activityTypes';
import { getLiveContext } from '@/lib/activity';
import { ApiError } from '@/lib/api';
import * as recorder from '@/lib/run/recorder';
import { uploadRun } from '@/lib/run/upload';
import { ensureLocationPermission, watchLock, type LocationPermission } from '@/lib/run/gps';
import { TRACKABLE_TYPES, MAX_ACCURACY_M, type TrackableType } from '@/lib/run/trackMath';
import { TYPE_LABEL } from '@/lib/run/format';

const PERMISSION_COPY: Record<Exclude<LocationPermission, 'granted'>, string> = {
    denied: 'Location is needed to record your route. You can allow it next time you press Start.',
    blocked: 'Location is turned off for this app. Allow it in Settings to record a route.',
    services_off: 'Location services are off on this phone. Turn them on to record a route.',
};

type Interrupted = NonNullable<Awaited<ReturnType<typeof recorder.interruptedRun>>>;

export default function RunLaunchPad() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ type?: string }>();

    const initial = TRACKABLE_TYPES.includes(params.type as TrackableType) ? (params.type as TrackableType) : 'jogging';
    const [type, setType] = useState<TrackableType>(initial);
    const [permission, setPermission] = useState<LocationPermission | 'unknown'>('unknown');
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [starting, setStarting] = useState(false);
    const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
    const [weight, setWeight] = useState<number | null | 'unknown'>('unknown');
    const lockSub = useRef<Location.LocationSubscription | null>(null);

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
            // A run in the journal is either still going (go back to it) or interrupted
            // (offer the choice). Anything else — idle, or finished and uploading — is a
            // fresh start.
            const found = recorder.hydrate() ? await recorder.interruptedRun() : null;
            if (!mounted) return;
            const { phase } = recorder.getState();
            if (!found && (phase === 'recording' || phase === 'paused')) {
                router.replace('/activity/run/live');
                return;
            }
            setInterrupted(found);

            // Only *read* the permission here. If it is already granted, start the lock ring.
            const current = await Location.getForegroundPermissionsAsync().catch(() => null);
            if (!mounted) return;
            if (current?.granted) {
                setPermission('granted');
                beginLock();
            }

            getLiveContext()
                .then((ctx) => { if (mounted) setWeight(ctx.weightKg); })
                .catch((err) => {
                    if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
                    else if (mounted) setWeight(null);
                });
        })();
        return () => {
            mounted = false;
            stopLock();
        };
    }, [beginLock, router]));

    useEffect(() => stopLock, []);

    const start = async () => {
        if (starting) return;
        setStarting(true);
        try {
            const granted = await ensureLocationPermission();
            setPermission(granted);
            if (granted !== 'granted') return;
            stopLock(); // the recording task takes over the radio
            await recorder.start({ type, weightKg: typeof weight === 'number' ? weight : null });
            router.replace('/activity/run/live');
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
        if (result.status === 'saved') router.replace(`/activity/session/${result.session._id}`);
        else Alert.alert('Saved on this phone', 'It will upload the next time you are online.');
    };

    const discardInterrupted = () => {
        Alert.alert('Discard this activity?', 'The route and everything recorded will be deleted from this phone.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: async () => { await recorder.discard(); setInterrupted(null); } },
        ]);
    };

    const locked = accuracy != null && accuracy <= MAX_ACCURACY_M;
    const gpsLine = permission !== 'granted'
        ? (permission === 'unknown' ? 'Location is asked for when you press Start.' : PERMISSION_COPY[permission])
        : accuracy == null
            ? 'Finding your location…'
            : locked
                ? `GPS locked · ±${Math.round(accuracy)} m`
                : `Locking… ±${Math.round(accuracy)} m. You can start now; distance begins when GPS locks.`;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Start activity</Text>
                <View style={{ width: 24 }} />
            </View>

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
                            <Pressable style={styles.secondaryBtn} onPress={resumeInterrupted} accessibilityRole="button">
                                <Text style={styles.secondaryText}>Resume</Text>
                            </Pressable>
                            <Pressable style={styles.secondaryBtn} onPress={saveInterrupted} accessibilityRole="button">
                                <Text style={styles.secondaryText}>Save as is</Text>
                            </Pressable>
                            <Pressable style={styles.textBtn} onPress={discardInterrupted} accessibilityRole="button">
                                <Text style={styles.dangerText}>Discard</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                <Text style={styles.question}>What are you doing?</Text>
                <View style={styles.grid}>
                    {TRACKABLE_TYPES.map((t) => {
                        const active = t === type;
                        const look = typeStyle(t);
                        return (
                            <Pressable
                                key={t}
                                onPress={() => setType(t)}
                                style={[styles.tile, active && styles.tileActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                            >
                                <View style={[styles.tileIcon, { backgroundColor: look.surface }]}>
                                    <MaterialCommunityIcons name={look.icon} size={22} color={look.tint} />
                                </View>
                                <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>{TYPE_LABEL[t]}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View style={styles.status}>
                    <Ionicons
                        name={locked ? 'navigate' : 'navigate-outline'}
                        size={18}
                        color={locked ? Palette.success : Palette.textSecondary}
                    />
                    <Text style={styles.statusText} accessibilityLiveRegion="polite">{gpsLine}</Text>
                </View>
                {(permission === 'blocked') && (
                    <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link">
                        <Text style={styles.link}>Open Settings</Text>
                    </Pressable>
                )}

                {weight === null && (
                    <Pressable style={styles.status} onPress={() => router.push('/metrics/log/weight')} accessibilityRole="link">
                        <Ionicons name="scale-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.statusText}>
                            Calories need your weight. <Text style={styles.link}>Add it</Text>
                        </Text>
                    </Pressable>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    onPress={start}
                    disabled={starting || !!interrupted}
                    style={[styles.cta, (starting || !!interrupted) && styles.ctaDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${TYPE_LABEL[type].toLowerCase()}`}
                    accessibilityState={{ disabled: starting || !!interrupted }}
                >
                    {starting
                        ? <ActivityIndicator color={Palette.white} />
                        : <Text style={styles.ctaText}>Start {TYPE_LABEL[type].toLowerCase()}</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
    question: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        width: '47.5%',
        gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        minHeight: 92,
        justifyContent: 'space-between',
    },
    tileActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryTint },
    tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    tileLabelActive: { color: Palette.primary },
    status: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    statusText: { ...BodyFont.regular, flex: 1, fontSize: 14, lineHeight: 20, color: Palette.textSecondary },
    link: { ...BodyFont.medium, fontSize: 14, color: Palette.primary },
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    cardTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    body: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, color: Palette.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    secondaryBtn: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.primary,
    },
    secondaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    textBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    dangerText: { ...BodyFont.medium, fontSize: 14, color: Palette.danger },
    footer: { padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    cta: {
        backgroundColor: Palette.primaryFill,
        borderRadius: Radius.pill,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
}));
