/**
 * Activity dashboard — frames 6 (empty) and 7 (populated) of `Design/activity.svg`.
 *
 * Reached from the home screen, not a tab: the tab bar is full at five and the fifth is
 * deliberately the assistant.
 *
 * The empty state is not an error and gets as much care as the populated one. Until the
 * native health modules ship, *every* device is in it — so "no data yet" has to explain
 * why and offer the thing that does work, which is logging an activity by hand.
 *
 * **Everything the rollup holds is on this screen.** It used to draw two numbers — active
 * minutes and the range's average burn — out of the eleven `DailyMetrics` stores, so a
 * connected phone that was syncing steps, distance, floors and a full day of heart rate
 * showed a single kcal figure and looked broken. The chart switches metric, the strip
 * reaches any day in the range, and the tile grid renders whatever that day reported.
 *
 * Two rules hold across all of it, both inherited from the nutrition tracker: a figure
 * nobody reported is **absent, not zero**, and a day nothing was recorded says so in words
 * rather than drawing a grid of zeros.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { MetricPicker, availableMetrics, CHART_METRICS } from '@/components/metric/MetricPicker';
import { DayStrip, hasData } from '@/components/metric/DayStrip';
import { DayStats } from '@/components/metric/DayStats';
import { SessionCard } from '@/components/metric/SessionCard';
import { SourceBanner } from '@/components/metric/SourceBanner';
import { GoalRings } from '@/components/metric/GoalRings';
import { PlanGuidanceCard } from '@/components/metric/PlanGuidanceCard';
import {
    getSummary, getDay, getWearableStatus, today, formatDistance,
    type ActivitySummary, type ActivitySession, type WearableStatus,
    type ActivityMetricKey, type DayMetrics,
} from '@/lib/activity';
import { probe, type HealthCapability } from '@/lib/health';
import { runSync } from '@/lib/health/sync';
import { ApiError } from '@/lib/api';

/** `Today`, `Yesterday`, or the date — the two words people actually navigate by. */
const dayLabel = (day: string): string => {
    const now = today();
    if (day === now) return 'Today';

    const yesterday = new Date(`${now}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = new Date(`${day}T00:00:00`);
    if (day === localKey(yesterday)) return 'Yesterday';

    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

/**
 * `YYYY-MM-DD` from a local `Date`.
 *
 * Built from the local getters rather than `toISOString`, which converts to UTC first and
 * so hands back yesterday for anyone west of Greenwich for part of every day.
 */
function localKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The range's average for one metric, worded with the days it was actually measured over. */
const averageLine = (
    summary: ActivitySummary | null,
    key: ActivityMetricKey,
): { value: string; label: string; days: number } | null => {
    const avg = summary?.averages?.[key];
    if (!avg) return null;

    const metric = CHART_METRICS.find((m) => m.key === key);
    const value = key === 'distanceM'
        ? formatDistance(avg.value) || '—'
        : `${Math.round(avg.value).toLocaleString()}${metric?.unit ? ` ${metric.unit}` : ''}`;

    return { value, label: metric?.label || key, days: avg.days };
};

export default function ActivityDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [range, setRange] = useState<MetricRange>('1w');
    const [metric, setMetric] = useState<ActivityMetricKey>('exerciseMin');
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>(today);
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [dayMetrics, setDayMetrics] = useState<DayMetrics | null>(null);
    const [status, setStatus] = useState<WearableStatus | null>(null);
    const [capability, setCapability] = useState<HealthCapability | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        const [s, st, cap] = await Promise.all([
            getSummary(range),
            getWearableStatus(),
            probe(),
        ]);
        setSummary(s);
        setStatus(st);
        setCapability(cap);
        return s;
    }, [range]);

    /**
     * Draw what the server already has, then sync, then redraw if anything moved.
     *
     * The sync used to be awaited first, which meant the screen sat on a spinner for the
     * whole of it. That is tolerable for an incremental read and not for a backfill — 90
     * days of records plus the per-session aggregates is tens of seconds, and it happens
     * to everyone once, on the first open after the reader learns something new. Showing
     * the stored figures immediately makes that a screen that fills in rather than a screen
     * that hangs.
     */
    const load = useCallback(async () => {
        try {
            setError(null);
            await fetchSummary();
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your activity.');
            return;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }

        // Non-throwing by contract, and throttled: a sync that cannot run leaves the
        // dashboard showing what it already has.
        setSyncing(true);
        const result = await runSync();
        setSyncing(false);

        if (!result.daysUpdated.length) return;
        try {
            await fetchSummary();
            // Only when the sync actually touched the day being looked at.
            if (result.daysUpdated.includes(selectedDayRef.current)) {
                await loadDayRef.current(selectedDayRef.current);
            }
        } catch {
            // The sync landed; only the redraw failed. What is on screen is still true.
        }
    }, [fetchSummary, router]);

    /**
     * The selected day, fetched on its own.
     *
     * Separate from `load` so moving along the strip is one small request rather than a
     * re-sync and a full summary refetch — the difference between a day picker that feels
     * like a control and one that feels like a page load.
     */
    const loadDay = useCallback(async (day: string) => {
        try {
            const result = await getDay(day);
            setSessions(result.sessions);
            setDayMetrics(result.metrics);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            // The day failing is not the screen failing. The chart and the goal above it are
            // still true, so this clears the day rather than replacing the whole dashboard
            // with an error.
            setSessions([]);
            setDayMetrics(null);
        }
    }, [router]);

    /**
     * Read through a ref rather than a dependency.
     *
     * `load` runs on focus and after a range change. Depending on `selectedDay` would make
     * every tap on the day strip re-run the whole load — sync included — which is the exact
     * cost `loadDay` exists to avoid.
     */
    const selectedDayRef = useRef(selectedDay);
    const loadDayRef = useRef(loadDay);
    useEffect(() => { selectedDayRef.current = selectedDay; }, [selectedDay]);
    useEffect(() => { loadDayRef.current = loadDay; }, [loadDay]);

    // Refetch on focus: someone logs an activity, comes back, and expects to see it.
    useFocusEffect(useCallback(() => { load(); }, [load]));
    useEffect(() => { loadDay(selectedDay); }, [selectedDay, loadDay]);

    // Memoised because the fallback `[]` would otherwise be a new array every render, and
    // `availableMetrics` below would recompute on each one.
    const series = useMemo(() => summary?.series || [], [summary]);

    // Only offer a metric this range can actually draw. See `availableMetrics`.
    const metrics = useMemo(() => availableMetrics(series), [series]);
    const active = metrics.find((m) => m.key === metric) || metrics[0];

    // A range change can drop the metric that was selected — a week with heart-rate data
    // and a year without. Falling back keeps the chart drawn instead of blank.
    useEffect(() => {
        if (active && active.key !== metric) setMetric(active.key);
    }, [active, metric]);

    const chartPoints = series.map((p) => {
        const raw = active ? (p[active.key] as number | null) : null;
        return {
            day: p.day,
            value: Number.isFinite(raw as number) && active?.scale
                ? active.scale(raw as number)
                : raw,
        };
    });

    const sessionCount = summary?.totals.sessions || 0;
    // A phone that synced a week of steps and no workouts has data. Telling that person to
    // "log your first activity" reads as the app not having seen anything at all.
    const hasMeasured = series.some(hasData);

    // The range summary, in the order a person reads them. Each is dropped when no day in
    // the range reported it, so this row is never a list of dashes.
    const averages = ([
        'steps', 'activeKcal', 'distanceM', 'restingBpm',
    ] as ActivityMetricKey[])
        .map((key) => ({ key, line: averageLine(summary, key) }))
        .filter((a): a is { key: ActivityMetricKey; line: NonNullable<ReturnType<typeof averageLine>> } => Boolean(a.line));

    // Every metric is averaged over its own reported days, and they need not agree — a
    // watch records heart rate on the days it is worn and the phone counts steps every day.
    // The note only claims one figure when one figure is true.
    const averageDays = [...new Set(averages.map((a) => a.line.days))];

    const isToday = selectedDay === today();

    /**
     * Changing the range can strand the selected day outside it.
     *
     * A day picked three weeks back then a switch to `1w` leaves the header naming a date
     * the strip below no longer contains. Snapping back to today is the only option that
     * leaves the two agreeing.
     */
    useEffect(() => {
        if (series.length && !series.some((p) => p.day === selectedDay)) setSelectedDay(today());
    }, [series, selectedDay]);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.heroBar}>
                        <Pressable
                            onPress={() => router.back()}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                        >
                            <Ionicons name="chevron-back" size={24} color={Palette.white} />
                        </Pressable>
                        <Text style={styles.heroDate}>
                            {new Date().toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                            })}
                        </Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {/*
                      The score only exists once there is a plan to measure against. Until
                      then the hero shows active minutes rather than a zero — a 0 score
                      would be telling someone they failed at a target nobody set.
                    */}
                    <Text style={styles.score}>
                        {summary?.score ?? (summary?.totals.sessions ? summary.totals.exerciseMin : 0)}
                    </Text>
                    <Text style={styles.scoreLabel}>
                        {summary?.score !== null && summary?.score !== undefined
                            ? 'Your activity score'
                            : 'Active minutes'}
                    </Text>
                    <Text style={styles.scoreCaption}>
                        {summary?.band?.label
                            || (sessionCount > 0
                                ? `${sessionCount} ${sessionCount === 1 ? 'activity' : 'activities'} this ${range === '1d' ? 'day' : 'period'}`
                                : hasMeasured
                                    ? 'No workouts this period — your daily figures are below'
                                    : 'Let’s log your first activity')}
                    </Text>
                </LinearGradient>

                <View style={styles.section}>
                    <RangeTabs value={range} onChange={setRange} />
                    {syncing && (
                        // Said out loud because the first sync after an update is a 90-day
                        // backfill and a screen that changes its own numbers a few seconds
                        // after it settled, silently, reads as a glitch.
                        <View style={styles.syncing}>
                            <ActivityIndicator size="small" color={Palette.textMuted} />
                            <Text style={styles.syncingText}>Checking your health app for new data…</Text>
                        </View>
                    )}
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={Palette.primary} />
                ) : error ? (
                    <View style={styles.section}>
                        <Text style={styles.error}>{error}</Text>
                        <Pressable onPress={load} accessibilityRole="button">
                            <Text style={styles.link}>Try again</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <View style={styles.section}>
                            <MetricPicker metrics={metrics} value={active?.key ?? metric} onChange={setMetric} />
                            <View style={{ height: Spacing.md }} />
                            <MetricAreaChart
                                points={chartPoints}
                                width={width - Spacing.xl * 2}
                                unit={active?.unit}
                                color={active?.color}
                                fillColor={active?.fill}
                                // A month or a year of days cannot carry a label each.
                                maxXLabels={range === '1w' || range === '1d' ? 7 : 6}
                            />
                        </View>

                        <View style={styles.section}>
                            <SourceBanner
                                capability={capability}
                                sources={status?.sources || []}
                                onConnect={() => router.push('/activity/sources')}
                                onManage={() => router.push('/activity/sources')}
                                onLogManually={() => router.push('/activity/log')}
                            />
                        </View>

                        {summary && summary.streak > 0 && (
                            <View style={styles.section}>
                                <View style={styles.streak}>
                                    <Ionicons name="flame" size={22} color={Palette.amber} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.streakTitle}>
                                            {summary.streak}-day streak
                                        </Text>
                                        <Text style={styles.streakBody}>
                                            You’ve been active {summary.streak} days running. Keep it up.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {averages.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Daily average</Text>
                                <View style={styles.averages}>
                                    {averages.map(({ key, line }) => (
                                        <View key={key} style={styles.average}>
                                            <Text style={styles.averageValue}>{line.value}</Text>
                                            <Text style={styles.averageLabel}>{line.label}</Text>
                                        </View>
                                    ))}
                                </View>
                                {/*
                                  Averaged over the days that reported, and it says so. A
                                  figure divided by days a watch was not worn is a smaller
                                  number wearing the word "average".
                                */}
                                <Text style={styles.averageNote}>
                                    {averageDays.length === 1
                                        ? `Across ${averageDays[0]} ${averageDays[0] === 1 ? 'day' : 'days'} with data`
                                        : 'Each averaged over the days it was recorded'}
                                    {summary ? ` in the last ${summary.days.length} days` : ''}
                                </Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>{dayLabel(selectedDay)}</Text>
                                <Pressable
                                    onPress={() => router.push('/activity/history')}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.link}>See all</Text>
                                </Pressable>
                            </View>

                            {/* Any day the loaded range covers, not just today. */}
                            <DayStrip series={series} value={selectedDay} onChange={setSelectedDay} />

                            <View style={{ height: Spacing.md }} />

                            <DayStats
                                metrics={dayMetrics}
                                emptyNote={
                                    capability?.granted
                                        // Deliberately not a grid of zeros. A day nothing was
                                        // measured and a day of no steps are different facts.
                                        ? 'No figures were recorded for this day. Days your phone or watch didn’t measure stay blank rather than showing zeros.'
                                        : capability?.reason
                                            || 'Connect a health app and your steps, distance, calories and heart rate will appear here.'
                                }
                            />

                            <View style={{ height: Spacing.md }} />

                            {sessions.length === 0 ? (
                                <View style={styles.empty}>
                                    <Ionicons name="fitness-outline" size={26} color={Palette.textMuted} />
                                    <Text style={styles.emptyTitle}>
                                        {isToday ? 'Nothing logged today' : 'No activities that day'}
                                    </Text>
                                    <Text style={styles.emptyBody}>
                                        {isToday
                                            ? 'Log an activity and it will show up here, on your calendar and in your plan.'
                                            : 'No workout was synced or logged for this day.'}
                                    </Text>
                                    {/*
                                      The log screen opens on the current time, so offering it
                                      from a day three weeks back would hand somebody a form
                                      pointing at the wrong date.
                                    */}
                                    {isToday && (
                                        <Pressable
                                            onPress={() => router.push('/activity/log')}
                                            style={styles.emptyCta}
                                            accessibilityRole="button"
                                        >
                                            <Text style={styles.emptyCtaText}>Log activity</Text>
                                            <Ionicons name="add" size={16} color={Palette.white} />
                                        </Pressable>
                                    )}
                                </View>
                            ) : (
                                <View style={{ gap: Spacing.sm }}>
                                    {sessions.map((s) => (
                                        <SessionCard
                                            key={s._id}
                                            session={s}
                                            onPress={() => router.push(`/activity/session/${s._id}`)}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>

                        {summary?.goal && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Weekly goal</Text>
                                    <Pressable
                                        onPress={() => router.push('/activity/goal')}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.link}>Edit</Text>
                                    </Pressable>
                                </View>
                                <GoalRings goal={summary.goal} band={summary.band?.label} />
                            </View>
                        )}

                        {summary && summary.guidance.length > 0 && (
                            <View style={styles.section}>
                                <PlanGuidanceCard guidance={summary.guidance} />
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <Pressable
                style={styles.fab}
                onPress={() => router.push('/activity/log')}
                accessibilityRole="button"
                accessibilityLabel="Log a new activity"
            >
                <Ionicons name="add" size={26} color={Palette.white} />
            </Pressable>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    content: { paddingBottom: 120 },

    hero: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xxxl,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        alignItems: 'center',
    },
    heroBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
        marginBottom: Spacing.xl,
    },
    heroDate: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.white },
    score: { fontSize: 56, fontFamily: Fonts.bold, color: Palette.white, lineHeight: 62 },
    scoreLabel: { fontSize: 18, fontFamily: Fonts.semibold, color: Palette.white },
    scoreCaption: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.white,
        opacity: 0.85,
        marginTop: 4,
    },

    section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },
    syncing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    syncingText: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginBottom: Spacing.md },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    error: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.danger, marginBottom: Spacing.sm },

    streak: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.warningSurface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    streakTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    streakBody: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },

    averages: {
        flexDirection: 'row',
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
    },
    average: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
    averageValue: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    averageLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center' },
    averageNote: {
        fontSize: 11.5,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        marginTop: Spacing.sm,
    },

    empty: {
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.xxl,
    },
    emptyTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    emptyBody: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 19,
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Palette.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: Radius.pill,
        marginTop: Spacing.sm,
    },
    emptyCtaText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },

    fab: {
        position: 'absolute',
        right: Spacing.xl,
        bottom: Spacing.xxxl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
});
