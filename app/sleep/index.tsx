/**
 * Sleep dashboard — `Design/sleep.svg` frames 6 (empty) and 7 (populated).
 *
 * The screen somebody opens at 7am, which decides most of what it does.
 *
 * 1. **What the server already has is drawn first, then the device is synced.** The nights
 *    come from Health Connect and HealthKit through `runSync()`, and a first sync after a
 *    reinstall is a backfill of tens of seconds. Awaiting it would put a spinner on the one
 *    screen people open before they are awake. The stored figures paint immediately and the
 *    screen fills in if the sync moved anything — the arrangement `app/activity/index.tsx`
 *    documents.
 * 2. **Last night is shown even when it is not this morning's.** A watch that has not synced
 *    yet would otherwise give somebody an empty ring at breakfast. The card says which night
 *    it is describing rather than implying it is today's.
 * 3. **A section with nothing in it is not drawn.** The design's empty dashboard puts a card
 *    for every feature on the screen — no data, no schedule, no goal, no insight — which is
 *    four cards of things somebody has not done, above the one thing they have. Each is
 *    earned by having something to report, and the setup rows at the bottom are where the
 *    rest goes. Same rule the home screen holds.
 * 4. **Nothing model-backed is awaited before the first paint.** Everything here is a
 *    database read.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { SourceBanner } from '@/components/metric/SourceBanner';
import { SleepRing } from '@/components/sleep/SleepRing';
import { WeekStrip } from '@/components/sleep/WeekStrip';
import { NightRow } from '@/components/sleep/NightRow';
import { ScheduleCard } from '@/components/sleep/ScheduleCard';
import { StageRows } from '@/components/sleep/StageRows';
import { BedIllustration } from '@/components/sleep/BedIllustration';
import {
    getOverview, listNights, updateSchedule, formatMinutes, formatClock, splitMinutes,
    dayLabel, STAGE_ORDER,
    type SleepOverview, type SleepNight,
} from '@/lib/sleep';
import { getWearableStatus, type WearableStatus } from '@/lib/activity';
import { probe, type HealthCapability } from '@/lib/health';
import { runSync } from '@/lib/health/sync';
import { ApiError } from '@/lib/api';

/** A titled block with an optional action on the right. Matches the home screen's section. */
function Section({
    title, action, onAction, children,
}: {
    title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {action && onAction ? (
                    <Pressable onPress={onAction} hitSlop={8}>
                        <Text style={styles.sectionAction}>{action}</Text>
                    </Pressable>
                ) : null}
            </View>
            {children}
        </View>
    );
}

/** A row offering something the person has not set up. The design's empty cards, compressed. */
function SetupRow({
    icon, title, body, cta, onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string; body: string; cta: string; onPress: () => void;
}) {
    return (
        <Pressable style={styles.setupRow} onPress={onPress}>
            <View style={styles.setupIcon}>
                <Ionicons name={icon} size={18} color={Palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.setupTitle}>{title}</Text>
                <Text style={styles.setupBody}>{body}</Text>
            </View>
            <Text style={styles.setupCta}>{cta}</Text>
        </Pressable>
    );
}

export default function SleepDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [range, setRange] = useState<MetricRange>('1w');
    const [overview, setOverview] = useState<SleepOverview | null>(null);
    const [recent, setRecent] = useState<SleepNight[]>([]);
    const [status, setStatus] = useState<WearableStatus | null>(null);
    const [capability, setCapability] = useState<HealthCapability | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** Guards the state writes that follow the sync, which outlives a quick back-navigation. */
    const mounted = useRef(true);

    const fetchAll = useCallback(async () => {
        const [data, nights, st, cap] = await Promise.all([
            getOverview(range),
            listNights({ limit: 3, sort: 'recent' }),
            getWearableStatus(),
            probe(),
        ]);
        if (!mounted.current) return null;
        setOverview(data);
        setRecent(nights.nights);
        setStatus(st);
        setCapability(cap);
        return data;
    }, [range]);

    const load = useCallback(async () => {
        try {
            setError(null);
            await fetchAll();
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your sleep.');
            return;
        } finally {
            if (mounted.current) { setLoading(false); setRefreshing(false); }
        }

        // Non-throwing by contract and throttled: a sync that cannot run leaves the
        // dashboard showing what the server already had.
        if (mounted.current) setSyncing(true);
        const result = await runSync();
        if (!mounted.current) return;
        setSyncing(false);

        if (!result.daysUpdated.length) return;
        try {
            await fetchAll();
        } catch {
            // The sync landed; only the redraw failed. What is on screen is still true.
        }
    }, [fetchAll, router]);

    useFocusEffect(useCallback(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; };
    }, [load]));

    const latest = overview?.latest ?? null;
    const split = splitMinutes(latest?.asleepMin);

    /** Every stage the latest night reported, for the breakdown card. */
    const stageRows = useMemo(() => STAGE_ORDER.map((stage) => {
        const minutes = latest?.stages?.[`${stage}Min` as keyof typeof latest.stages] ?? null;
        const asleep = latest?.asleepMin ?? 0;
        return {
            stage,
            minutes: minutes as number | null,
            share: Number.isFinite(minutes as number) && asleep > 0
                ? ((minutes as number) / asleep) * 100
                : null,
        };
    }), [latest]);

    const hasStages = stageRows.some((r) => Number.isFinite(r.minutes as number));
    const hasHistory = recent.length > 0;
    const chartWidth = width - Spacing.xl * 2 - Spacing.lg * 2;

    const toggleSchedule = async (id: string, enabled: boolean) => {
        // Optimistic: the switch is the whole interaction, and a round trip before it moves
        // makes it feel broken. A failure reloads, which puts it back where it was.
        setOverview((prev) => prev && {
            ...prev,
            schedules: prev.schedules.map((s) => (s._id === id ? { ...s, enabled } : s)),
        });
        try {
            await updateSchedule(id, { enabled });
        } catch {
            load();
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="cloud-offline-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retry} onPress={() => { setLoading(true); load(); }}>
                        <Text style={styles.retryLabel}>Try again</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} hitSlop={10}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>
                            {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
                        </Text>
                        <Text style={styles.headerDate}>
                            {new Date().toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                            })}
                        </Text>
                    </View>
                    {syncing ? <ActivityIndicator size="small" color={Palette.primary} /> : null}
                    <Pressable style={styles.headerAdd} onPress={() => router.push('/sleep/log')}>
                        <Ionicons name="add" size={20} color={Palette.white} />
                    </Pressable>
                </View>

                {overview ? (
                    <WeekStrip series={overview.series} today={overview.today} />
                ) : null}

                <SleepRing
                    score={latest?.score ?? null}
                    band={latest?.band ?? null}
                    size={Math.min(260, width - Spacing.xl * 2 - 40)}
                    onExplain={() => router.push('/sleep/score')}
                    onLeftAction={() => router.push('/sleep/goal')}
                    onRightAction={() => router.push('/sleep/insight')}
                />

                {/* Which night this is. Only said when it is not this morning's, because
                    saying "last night" about last night is noise. */}
                {latest && !overview?.isToday ? (
                    <Text style={styles.staleNote}>
                        {`Showing ${dayLabel(latest.day)} — today has not synced yet.`}
                    </Text>
                ) : null}

                <View style={styles.figures}>
                    <View style={styles.figure}>
                        <View style={styles.figureHead}>
                            <View style={[styles.figureDot, { backgroundColor: Palette.primary }]} />
                            <Text style={styles.figureValue}>
                                {split ? `${split.hours}h ${split.mins}m` : '—'}
                            </Text>
                        </View>
                        <Text style={styles.figureLabel}>Total sleep</Text>
                    </View>
                    <View style={styles.figure}>
                        <View style={styles.figureHead}>
                            <Text style={styles.figureValue}>
                                {formatMinutes(latest?.stages?.remMin)}
                            </Text>
                            <View style={[styles.figureDot, { backgroundColor: Palette.primaryDeep }]} />
                        </View>
                        <Text style={styles.figureLabel}>REM sleep</Text>
                    </View>
                </View>

                {/* ---------------------------------------------------- goal */}
                <Section title="Sleep goal" action="Edit" onAction={() => router.push('/sleep/goal')}>
                    <Pressable style={styles.goalCard} onPress={() => router.push('/sleep/goal')}>
                        <LinearGradient
                            colors={[Palette.primarySurface, Palette.white]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.goalGradient}
                        >
                            <View style={styles.goalHead}>
                                <Ionicons name="sparkles" size={16} color={Palette.primary} />
                                <Text style={styles.goalValue}>
                                    {formatMinutes(overview?.goal.minutes)}
                                </Text>
                            </View>
                            <Text style={styles.goalCaption}>
                                {overview?.goal.setByUser ? 'Your sleep goal' : 'Suggested from your plan'}
                            </Text>
                        </LinearGradient>

                        <View style={styles.goalGrid}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.goalKey}>Bedtime</Text>
                                <Text style={styles.goalTime}>
                                    {overview?.goal.suggestedBedtimeMin !== null
                                        && overview?.goal.suggestedBedtimeMin !== undefined
                                        ? formatClock(overview.goal.suggestedBedtimeMin)
                                        : 'Not set'}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.goalKey}>Wake up</Text>
                                <Text style={styles.goalTime}>
                                    {overview?.goal.wakeMin !== null && overview?.goal.wakeMin !== undefined
                                        ? formatClock(overview.goal.wakeMin)
                                        : 'Not set'}
                                </Text>
                            </View>
                        </View>

                        {/* The design's "Next bedtime: 7h 20m from now" is only true once a
                            wake time exists to derive a bedtime from. Without one there is
                            no bedtime to count down to, so the card says what is missing. */}
                        <Text style={styles.goalHint}>
                            {overview?.goal.suggestedBedtimeMin === null
                                ? 'Set when you get up and we will work back to a bedtime.'
                                : overview?.goal.explanation}
                        </Text>
                    </Pressable>
                </Section>

                {/* ------------------------------------------------- the trend */}
                {overview && overview.series.some((p) => Number.isFinite(p.asleepMin as number)) ? (
                    <Section title="Sleep over time" action="Insight" onAction={() => router.push('/sleep/insight')}>
                        <View style={styles.card}>
                            <RangeTabs value={range} onChange={setRange} />
                            <MetricAreaChart
                                points={overview.series.map((p) => ({
                                    day: p.day,
                                    // Charted in hours: a y-axis in minutes prints 480 and
                                    // makes somebody divide to read their own night.
                                    value: Number.isFinite(p.asleepMin as number)
                                        ? Math.round(((p.asleepMin as number) / 60) * 10) / 10
                                        : null,
                                }))}
                                width={chartWidth}
                                unit="h"
                                color={Palette.primary}
                            />
                            <Text style={styles.chartNote}>
                                {overview.averages.nights > 0
                                    ? `Averaging ${formatMinutes(overview.averages.asleepMin)} across ${overview.averages.nights} ${overview.averages.nights === 1 ? 'night' : 'nights'}.`
                                    : 'No nights recorded in this range.'}
                            </Text>
                        </View>
                    </Section>
                ) : null}

                {/* ------------------------------------------------ the stages */}
                {hasStages ? (
                    <Section title="Last night's stages" action="Details" onAction={() => latest && router.push(`/sleep/${latest._id}`)}>
                        <View style={styles.card}>
                            <StageRows rows={stageRows} />
                        </View>
                    </Section>
                ) : null}

                {/* ----------------------------------------------- the history */}
                {hasHistory ? (
                    <Section title="Sleep history" action="See all" onAction={() => router.push('/sleep/history')}>
                        <View style={{ gap: Spacing.sm }}>
                            {recent.map((n) => (
                                <NightRow
                                    key={n._id}
                                    night={n}
                                    showSource
                                    onPress={() => router.push(`/sleep/${n._id}`)}
                                />
                            ))}
                        </View>
                    </Section>
                ) : null}

                {/* ---------------------------------------------- the schedule */}
                {overview && overview.schedules.length > 0 ? (
                    <Section title="Sleep schedule" action="See all" onAction={() => router.push('/sleep/schedule')}>
                        <View style={{ gap: Spacing.sm }}>
                            {overview.schedules.slice(0, 2).map((schedule) => (
                                <ScheduleCard
                                    key={schedule._id}
                                    schedule={schedule}
                                    onPress={() => router.push(`/sleep/schedule/${schedule._id}`)}
                                    onToggle={(enabled) => toggleSchedule(schedule._id, enabled)}
                                />
                            ))}
                        </View>
                    </Section>
                ) : null}

                {/* --------------------------------------------- plan guidance */}
                {overview && overview.guidance.length > 0 ? (
                    <Section title="From your health plan">
                        <View style={styles.card}>
                            {overview.guidance.map((g, i) => (
                                <View key={`${g.key}-${i}`} style={styles.guidanceRow}>
                                    <Ionicons name="leaf-outline" size={16} color={Palette.primary} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.guidanceDirective}>{g.directive}</Text>
                                        {g.rationale ? (
                                            <Text style={styles.guidanceRationale}>{g.rationale}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </Section>
                ) : null}

                {/* -------------------------------------------- the empty state */}
                {!latest ? (
                    <View style={styles.empty}>
                        <BedIllustration width={Math.min(239, width - Spacing.xl * 4)} />
                        <Text style={styles.emptyTitle}>No sleep recorded yet</Text>
                        <Text style={styles.emptyBody}>
                            Sleep comes from a watch or your phone&apos;s health store. Connect one and
                            your nights will appear here — or add a night by hand.
                        </Text>
                    </View>
                ) : null}

                <SourceBanner
                    capability={capability}
                    sources={status?.sources || []}
                    onManage={() => router.push('/activity/sources')}
                    onConnect={() => router.push('/activity/sources')}
                    onLogManually={() => router.push('/sleep/log')}
                />

                {/* ------------------------------------------- what is not set up */}
                <Section title="Get more from sleep tracking">
                    <View style={{ gap: Spacing.sm }}>
                        {overview && !overview.schedules.length ? (
                            <SetupRow
                                icon="alarm-outline"
                                title="Set a sleep schedule"
                                body="A bedtime, a wake time, and a reminder to wind down."
                                cta="Set up"
                                onPress={() => router.push('/sleep/schedule/new')}
                            />
                        ) : null}
                        {overview && !overview.goal.setByUser ? (
                            <SetupRow
                                icon="moon-outline"
                                title="Choose your own goal"
                                body={`We suggest ${formatMinutes(overview.goal.minutes)} from your plan. You can set your own.`}
                                cta="Choose"
                                onPress={() => router.push('/sleep/goal')}
                            />
                        ) : null}
                        {overview && !overview.onboarded ? (
                            <SetupRow
                                icon="options-outline"
                                title="Tell us about your sleep"
                                body="Four questions. It shapes your goal and what the app suggests."
                                cta="Start"
                                onPress={() => router.push('/sleep/setup')}
                            />
                        ) : null}
                        <SetupRow
                            icon="stats-chart-outline"
                            title="See your sleep insight"
                            body="Stage balance, weekday patterns and how steady your schedule is."
                            cta="Open"
                            onPress={() => router.push('/sleep/insight')}
                        />
                    </View>
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl * 2, gap: Spacing.xl },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
    errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center' },
    retry: {
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    retryLabel: { color: Palette.white, fontFamily: Fonts.semibold, fontSize: 14 },

    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headerTitle: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    headerDate: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    headerAdd: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primary,
    },

    staleNote: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', marginTop: -Spacing.sm,
    },

    figures: { flexDirection: 'row', gap: Spacing.md },
    figure: {
        flex: 1, padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.surface, gap: 4,
    },
    figureHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    figureDot: { width: 8, height: 8, borderRadius: 4 },
    figureValue: { flex: 1, fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    figureLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    section: { gap: Spacing.md },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    sectionAction: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.primary },

    card: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.background,
        borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.md,
        ...Shadow.card,
    },
    chartNote: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    goalCard: {
        borderRadius: Radius.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: Palette.borderLight,
        backgroundColor: Palette.background,
    },
    goalGradient: { padding: Spacing.lg, gap: 2 },
    goalHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    goalValue: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    goalCaption: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    goalGrid: {
        flexDirection: 'row', gap: Spacing.lg,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    },
    goalKey: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    goalTime: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    goalHint: {
        fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted,
        padding: Spacing.lg, paddingTop: Spacing.md,
    },

    guidanceRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    guidanceDirective: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    guidanceRationale: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingHorizontal: Spacing.lg, lineHeight: 19,
    },

    setupRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.canvas,
    },
    setupIcon: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white,
    },
    setupTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    setupBody: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 1 },
    setupCta: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.primary },
});
