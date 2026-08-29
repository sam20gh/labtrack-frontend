/**
 * Activity dashboard — frames 6 (empty) and 7 (populated) of `Design/activity.svg`.
 *
 * Reached from the home screen, not a tab: the tab bar is full at five and the fifth is
 * deliberately the assistant.
 *
 * The empty state is not an error and gets as much care as the populated one. Until the
 * native health modules ship, *every* device is in it — so "no data yet" has to explain
 * why and offer the thing that does work, which is logging an activity by hand.
 */
import React, { useCallback, useState } from 'react';
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
import { SessionCard } from '@/components/metric/SessionCard';
import { SourceBanner } from '@/components/metric/SourceBanner';
import { GoalRings } from '@/components/metric/GoalRings';
import { PlanGuidanceCard } from '@/components/metric/PlanGuidanceCard';
import {
    getSummary, getDay, getWearableStatus,
    type ActivitySummary, type ActivitySession, type WearableStatus,
} from '@/lib/activity';
import { probe, type HealthCapability } from '@/lib/health';
import { ApiError } from '@/lib/api';

export default function ActivityDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [range, setRange] = useState<MetricRange>('1w');
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [status, setStatus] = useState<WearableStatus | null>(null);
    const [capability, setCapability] = useState<HealthCapability | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const [s, day, st, cap] = await Promise.all([
                getSummary(range),
                getDay(),
                getWearableStatus(),
                probe(),
            ]);
            setSummary(s);
            setSessions(day.sessions);
            setStatus(st);
            setCapability(cap);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your activity.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range, router]);

    // Refetch on focus: someone logs an activity, comes back, and expects to see it.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const chartPoints = (summary?.series || []).map((p) => ({
        day: p.day,
        value: p.exerciseMin,
    }));

    const hasAnyData = (summary?.totals.sessions || 0) > 0;

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
                            || (hasAnyData
                                ? `${summary?.totals.sessions} ${summary?.totals.sessions === 1 ? 'activity' : 'activities'} this ${range === '1d' ? 'day' : 'period'}`
                                : 'Let’s log your first activity')}
                    </Text>
                </LinearGradient>

                <View style={styles.section}>
                    <RangeTabs value={range} onChange={setRange} />
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
                            <MetricAreaChart
                                points={chartPoints}
                                width={width - Spacing.xl * 2}
                                unit="min"
                            />
                        </View>

                        <View style={styles.section}>
                            <SourceBanner
                                capability={capability}
                                sources={status?.sources || []}
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

                        {summary?.highlight.avgKcal !== null && summary?.highlight.avgKcal !== undefined && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Highlight</Text>
                                <View style={styles.highlight}>
                                    <Text style={styles.highlightValue}>
                                        {summary.highlight.avgKcal}
                                        <Text style={styles.highlightUnit}> kcal</Text>
                                    </Text>
                                    <Text style={styles.highlightLabel}>
                                        Average daily burn across {summary.highlight.daysReported}{' '}
                                        {summary.highlight.daysReported === 1 ? 'day' : 'days'} with data
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Today</Text>
                                <Pressable
                                    onPress={() => router.push('/activity/history')}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.link}>See all</Text>
                                </Pressable>
                            </View>

                            {sessions.length === 0 ? (
                                <View style={styles.empty}>
                                    <Ionicons name="fitness-outline" size={26} color={Palette.textMuted} />
                                    <Text style={styles.emptyTitle}>Nothing logged today</Text>
                                    <Text style={styles.emptyBody}>
                                        Log an activity and it will show up here, on your calendar and
                                        in your plan.
                                    </Text>
                                    <Pressable
                                        onPress={() => router.push('/activity/log')}
                                        style={styles.emptyCta}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.emptyCtaText}>Log activity</Text>
                                        <Ionicons name="add" size={16} color={Palette.white} />
                                    </Pressable>
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

    highlight: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    highlightValue: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    highlightUnit: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary },
    highlightLabel: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },

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
