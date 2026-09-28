/**
 * Activity detail — frame 8.
 *
 * Key Stats is built from what the session actually carries. The design's card lists mode,
 * start, end, elevation, cadence, speed, calories, distance and active minutes; a manually
 * logged walk has three of those. Rows for the rest are omitted rather than dashed, because
 * a table of em-dashes reads as a broken screen.
 *
 * A GPS session (`source: 'live'`) also draws its route — the Ember trail on the
 * monochrome map, fitted to the route, with the ramp's two ends as a legend — its splits as
 * bars, and its climb as a profile. The track is fetched *after* the first paint: the key
 * stats come from the session row, and a two-hour track should not hold them behind a
 * spinner (the rule `app/nutrition/index.tsx` documents). "Replay" opens the flyover.
 *
 * The Insight and Consult AI Assistant actions need the insight engine (phase 11.5) and are
 * not stubbed with a dead button here — the app has removed two of those already.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette, useTheme } from '@/hooks/useTheme';
import RunMap from '@/components/run/RunMap';
import ElevationProfile from '@/components/run/ElevationProfile';
import { LinearGradient } from 'expo-linear-gradient';
import { trailFromTrack, rampColor, EMBER_DARK, EMBER_LIGHT } from '@/lib/run/afterglow';
import { elevationSeries, TRACKABLE_TYPES, type Track, type TrackableType } from '@/lib/run/trackMath';
import { paceParts } from '@/lib/run/format';
import { formatDistanceIn, useUnits } from '@/lib/units';
import { ErrorState } from '@/components/errors';
import {
    getSession, getSessionTrack, updateSession, deleteSession,
    formatDuration, formatDistance, formatPace, formatType, type ActivitySession,
} from '@/lib/activity';
import { ApiError } from '@/lib/api';

const EFFORT_LABELS = ['', 'Very light', 'Light', 'Moderate', 'High effort', 'Maximum'];

export default function ActivityDetail() {
    const Palette = usePalette();
    const styles = useStyles();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const { scheme } = useTheme();
    const units = useUnits();
    const [session, setSession] = useState<ActivitySession | null>(null);
    const [track, setTrack] = useState<Track | null>(null);
    const [chartWidth, setChartWidth] = useState(0);
    const trackFor = useRef<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const load = useCallback(async () => {
        if (!id) return;
        try {
            setError(null);
            const result = await getSession(id);
            setSession(result.session);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // The track after the first paint, once, and only for a session that has a route.
    const hasRoute = (session?.route?.coordinates?.length ?? 0) >= 2;
    useEffect(() => {
        if (!session || !hasRoute || trackFor.current === session._id) return undefined;
        trackFor.current = session._id;
        let mounted = true;
        getSessionTrack(session._id)
            .then((r) => { if (mounted) setTrack(r.track as Track); })
            .catch(() => { /* the map falls back to the stored route; nothing else needs it */ });
        return () => { mounted = false; };
    }, [session, hasRoute]);

    const type: TrackableType = session && TRACKABLE_TYPES.includes(session.type as TrackableType)
        ? session.type as TrackableType : 'jogging';
    const ramp = scheme === 'dark' ? EMBER_DARK : EMBER_LIGHT;
    const trail = useMemo(() => {
        if (track) return trailFromTrack(track, type, ramp);
        // Before the track arrives: the stored route, in one colour.
        return { coordinates: session?.route?.coordinates ?? [], gradient: null, tail: null, paceRange: null };
    }, [track, type, ramp, session?.route?.coordinates]);
    const profile = useMemo(() => (track ? elevationSeries(track, type) : null), [track, type]);

    const setEffort = async (value: number) => {
        if (!session) return;
        const next = session.effort === value ? undefined : value;
        // Optimistic: the write is small and the failure path restores from the server
        setSession({ ...session, effort: next });
        try {
            await updateSession(session._id, { effort: next as number });
        } catch {
            load();
        }
    };

    const confirmDelete = () => {
        if (!session) return;
        const synced = session.source !== 'manual' && session.source !== 'live';
        Alert.alert(
            'Delete this activity?',
            synced
                // Saying so up front beats the row silently reappearing tomorrow
                ? 'This came from your health app, so it will come back the next time Predyqt syncs. To remove it for good, delete it there too.'
                : 'This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteSession(session._id);
                            router.back();
                        } catch (err) {
                            Alert.alert('Not deleted', err instanceof Error ? err.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (error || !session) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ErrorState
                    error={error ?? new ApiError('Activity not found.', 404)}
                    subject="this activity"
                    onRetry={load}
                    primary={{ label: 'Go back', icon: 'arrow-back-outline', onPress: () => router.back() }}
                />
            </SafeAreaView>
        );
    }

    const started = new Date(session.startedAt);
    const ended = session.endedAt ? new Date(session.endedAt) : null;
    const time = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    /**
     * Built from what is actually present. See the note at the top of the file.
     *
     * Each row carries a glyph, as frame 8 of `Design/activity.svg` draws them — on a list
     * this long the icon is what lets someone find the one figure they came for without
     * reading nine labels.
     */
    const stats: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
    stats.push({ icon: 'flag-outline', label: 'Start', value: time(started) });
    if (ended) stats.push({ icon: 'flag', label: 'End', value: time(ended) });
    stats.push({ icon: 'stopwatch-outline', label: 'Active minutes', value: formatDuration(session.durationSec) });

    const distance = formatDistance(session.distanceM);
    if (distance) stats.push({ icon: 'location-outline', label: 'Total distance', value: distance });

    // Derived from distance and duration, not read from anywhere — see `formatPace`. The
    // kit's 80mph jog is the placeholder this replaces.
    const pace = formatPace(session.distanceM, session.durationSec);
    if (pace) {
        stats.push({
            icon: 'speedometer-outline',
            label: pace.endsWith('/km') ? 'Average pace' : 'Average speed',
            value: pace,
        });
    }
    if (Number.isFinite(session.activeKcal as number)) {
        stats.push({ icon: 'flame-outline', label: 'Calories burned', value: `${Math.round(session.activeKcal as number)} kcal` });
    }
    if (Number.isFinite(session.avgBpm as number)) {
        stats.push({ icon: 'heart-outline', label: 'Average heart rate', value: `${Math.round(session.avgBpm as number)} bpm` });
    }
    if (Number.isFinite(session.maxBpm as number)) {
        stats.push({ icon: 'pulse-outline', label: 'Peak heart rate', value: `${Math.round(session.maxBpm as number)} bpm` });
    }
    if (Number.isFinite(session.elevationM as number)) {
        stats.push({ icon: 'trending-up-outline', label: 'Elevation', value: `${Math.round(session.elevationM as number)} m` });
    }
    if (Number.isFinite(session.cadence as number)) {
        stats.push({ icon: 'footsteps-outline', label: 'Cadence', value: `${Math.round(session.cadence as number)} spm` });
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Activity</Text>
                <Pressable onPress={confirmDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete activity">
                    <Ionicons name="trash-outline" size={20} color={Palette.danger} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.head}>
                    <Text style={styles.title}>{formatType(session.type)}</Text>
                    <Text style={styles.subtitle}>
                        {started.toLocaleDateString(undefined, {
                            weekday: 'long', month: 'long', day: 'numeric',
                        })}
                    </Text>
                    {session.scoreDelta > 0 && (
                        <View style={styles.scorePill}>
                            <Ionicons name="add" size={13} color={Palette.textSecondary} />
                            <Text style={styles.scorePillText}>{session.scoreDelta} score</Text>
                        </View>
                    )}
                </View>

                {hasRoute && (
                    <>
                        <View style={styles.mapCard}>
                            <RunMap
                                mode="overview"
                                trail={trail}
                                accent={ramp[ramp.length - 2]}
                                // A static route map follows the app's scheme, not the sun: it is
                                // read indoors, later, and has to match the screen around it.
                                lightPreset={scheme === 'dark' ? 'night' : 'day'}
                                interactive={false}
                            />
                            {track && (
                                <Pressable
                                    onPress={() => router.push({ pathname: '/activity/run/summary/[id]', params: { id: session._id, replay: '1' } })}
                                    style={styles.replayBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Replay this route"
                                >
                                    <Ionicons name="play" size={14} color={Palette.white} />
                                    <Text style={styles.replayText}>Replay</Text>
                                </Pressable>
                            )}
                        </View>
                        {trail.paceRange && (
                            <View style={styles.legend} accessible accessibilityLabel="Route colour: dimmer where you were slower, brighter where you were faster">
                                <Text style={styles.legendText}>
                                    {paceParts(trail.paceRange[0], type, units)?.value ?? ''} slower
                                </Text>
                                <LinearGradient
                                    colors={ramp as unknown as [string, string, ...string[]]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.legendBar}
                                />
                                <Text style={styles.legendText}>
                                    faster {paceParts(trail.paceRange[1], type, units)?.value ?? ''}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                <Text style={styles.sectionTitle}>Key stats</Text>
                <View style={styles.card}>
                    {stats.map((s, i) => (
                        <View key={s.label} style={[styles.row, i === stats.length - 1 && styles.rowLast]}>
                            <Ionicons name={s.icon} size={17} color={Palette.textMuted} />
                            <Text style={styles.rowLabel}>{s.label}</Text>
                            <Text style={styles.rowValue}>{s.value}</Text>
                        </View>
                    ))}
                </View>

                {(session.splits?.length ?? 0) > 0 && (() => {
                    const speeds = session.splits!.map((sp) => (sp.pacePerKm ? 1000 / sp.pacePerKm : 0));
                    const fastest = Math.max(0.1, ...speeds);
                    const positive = speeds.filter((v) => v > 0);
                    const slowest = positive.length ? Math.min(...positive) : fastest;
                    const span = fastest - slowest;
                    return (
                        <>
                            <Text style={styles.sectionTitle}>Splits</Text>
                            <View style={[styles.card, styles.splits]}>
                                {session.splits!.map((sp, i) => {
                                    const p = paceParts(sp.pacePerKm ?? null, type, units);
                                    const t = span < 0.05 ? 0.5 : (speeds[i] - slowest) / span;
                                    return (
                                        <View key={sp.order ?? i} style={styles.split} accessible accessibilityLabel={`${sp.label}, ${p ? `${p.value} ${p.unit}` : 'no pace'}`}>
                                            <Text style={styles.splitLabel}>{sp.label}</Text>
                                            <View style={styles.splitTrack}>
                                                <View style={[styles.splitBar, { width: `${Math.max(10, (speeds[i] / fastest) * 100)}%`, backgroundColor: rampColor(t, ramp) }]} />
                                            </View>
                                            <Text style={styles.splitPace}>{p ? `${p.value}` : '—'}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </>
                    );
                })()}

                {profile && Number.isFinite(session.elevationM as number) && (session.elevationM as number) > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Elevation</Text>
                        <View style={[styles.card, styles.elevation]} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - Spacing.lg * 2)}>
                            <ElevationProfile
                                series={profile}
                                width={chartWidth}
                                stroke={Palette.textSecondary}
                                label={`${Math.round(session.elevationM as number)} m climbed`}
                                formatDistance={(m) => formatDistanceIn(m, units) ?? ''}
                            />
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>How did it feel?</Text>
                <View style={styles.efforts}>
                    {[1, 2, 3, 4, 5].map((value) => {
                        const active = (session.effort || 0) >= value;
                        return (
                            <Pressable
                                key={value}
                                onPress={() => setEffort(value)}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`Set effort to ${EFFORT_LABELS[value]}`}
                            >
                                <Ionicons
                                    name="flame"
                                    size={28}
                                    color={active ? Palette.amber : Palette.borderLight}
                                />
                            </Pressable>
                        );
                    })}
                </View>
                {session.effort ? (
                    <Text style={styles.effortLabel}>{EFFORT_LABELS[session.effort]}</Text>
                ) : (
                    <Text style={styles.effortLabel}>Not rated</Text>
                )}

                {session.notes ? (
                    <>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <View style={styles.card}>
                            <Text style={styles.notes}>{session.notes}</Text>
                        </View>
                    </>
                ) : null}

                <View style={styles.provenance}>
                    <Ionicons
                        name={session.source === 'manual' ? 'create-outline' : session.source === 'live' ? 'navigate-outline' : 'watch-outline'}
                        size={14}
                        color={Palette.textMuted}
                    />
                    <Text style={styles.provenanceText}>
                        {session.source === 'manual'
                            ? 'Logged by you'
                            : session.source === 'live'
                                ? 'Recorded with GPS on this phone'
                                : `From ${session.sourceDevice?.name || 'your health app'}`}
                    </Text>
                </View>

                {session.source !== 'manual' && session.source !== 'live' && (
                    <Text style={styles.locked}>
                        Measured values on a synced activity can’t be edited here — only your effort
                        rating and notes.
                    </Text>
                )}
            </ScrollView>
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
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

    head: { alignItems: 'center', gap: 4, paddingVertical: Spacing.xl },
    title: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: Palette.primarySurface,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        marginTop: Spacing.sm,
    },
    scorePillText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },

    sectionTitle: {
        fontSize: 15,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginTop: Spacing.xxl,
        marginBottom: Spacing.md,
    },
    card: { backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Palette.borderLight,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { flex: 1, fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary },
    rowValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },

    efforts: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
    effortLabel: {
        fontSize: 13,
        ...BodyFont.medium,
        color: Palette.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    notes: {
        fontSize: 14,
        ...BodyFont.regular,
        color: Palette.text,
        lineHeight: 21,
        paddingVertical: Spacing.lg,
    },

    provenance: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        marginTop: Spacing.xxl,
    },
    provenanceText: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted },
    locked: {
        fontSize: 12,
        ...BodyFont.regular,
        color: Palette.textMuted,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 18,
    },

    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    mapCard: { height: 240, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Palette.surface },
    replayBtn: {
        position: 'absolute', right: Spacing.md, bottom: Spacing.md,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill,
        backgroundColor: Palette.primaryFill,
    },
    replayText: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.white },
    legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    legendBar: { flex: 1, height: 6, borderRadius: 3 },
    legendText: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, fontVariant: ['tabular-nums'] },
    splits: { paddingVertical: Spacing.md, gap: Spacing.sm },
    split: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    splitLabel: { width: 52, fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    splitTrack: { flex: 1, height: 14, borderRadius: 4, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    splitBar: { height: '100%', borderRadius: 4 },
    splitPace: { width: 48, textAlign: 'right', fontSize: 13, ...BodyFont.semibold, color: Palette.text, fontVariant: ['tabular-nums'] },
    elevation: { paddingVertical: Spacing.lg },
}));
