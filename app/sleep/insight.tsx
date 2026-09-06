/**
 * Sleep Insight — `Design/sleep.svg` frames 12 and 13.
 *
 * Every figure comes from `utils/sleepInsight.js`, which is deterministic and tested.
 * **Nothing on this screen is a model's opinion about somebody's sleep** — the same line
 * `app/activity/index.tsx` holds about its own insight block, and the reason that module
 * exists rather than a prompt.
 *
 * Three things the kit does that this does not:
 *
 * 1. **No "your sleep score is strong!" paragraph.** The kit prints a sentence of praise
 *    under the chart. What is printed here instead is the comparison against the previous
 *    window, which is a fact, and it is null rather than "+100%" when there is no previous
 *    window to compare against.
 * 2. **No fixed 240h in the donut.** The total is whatever was actually measured, and the
 *    caption says over how many nights.
 * 3. **The consistency reading is named, not scored.** An irregular schedule is often a job,
 *    and grading it out of ten is the app taking a view on shift work.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { StageDonut, StageRows } from '@/components/sleep/StageRows';
import { WeekdayBars, StageRangeRows } from '@/components/sleep/SleepCharts';
import { BedIllustration } from '@/components/sleep/BedIllustration';
import {
    getInsight, formatMinutes, formatClock, type SleepInsight, type PeriodComparison,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/**
 * `▲ 2.5% vs last month`, or nothing at all.
 *
 * Rendered as null when the previous window reported nothing. The kit prints a green arrow
 * on every card; an improvement measured against no data is not an improvement.
 */
function Delta({ comparison, period }: { comparison: PeriodComparison; period: string }) {
    if (comparison.deltaPct === null || comparison.direction === null) {
        return (
            <Text style={styles.deltaMuted}>
                {comparison.previous === null ? 'No earlier period to compare with' : 'No change to report'}
            </Text>
        );
    }

    const up = comparison.direction === 'up';
    const flat = comparison.direction === 'flat';
    const tint = flat ? Palette.textSecondary : (up ? Palette.successDeep : Palette.warning);

    return (
        <View style={styles.deltaRow}>
            <Ionicons
                name={flat ? 'remove-outline' : (up ? 'trending-up' : 'trending-down')}
                size={15}
                color={tint}
            />
            <Text style={[styles.deltaValue, { color: tint }]}>
                {flat ? 'No change' : `${Math.abs(comparison.deltaPct)}%`}
            </Text>
            <Text style={styles.deltaLabel}>{`vs last ${period}`}</Text>
        </View>
    );
}

const PERIOD_LABEL: Record<MetricRange, string> = {
    '1d': 'day', '1w': 'week', '1m': 'month', '1y': 'year', all: 'period',
};

export default function SleepInsightScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [range, setRange] = useState<MetricRange>('1m');
    const [data, setData] = useState<SleepInsight | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await getInsight(range));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your sleep insight.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const chartWidth = width - Spacing.xl * 2 - Spacing.lg * 2;
    const empty = data !== null && data.nights === 0;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <LinearGradient
                colors={[Palette.primary, Palette.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
            >
                <View style={styles.heroRow}>
                    <Pressable onPress={() => router.back()} hitSlop={10}>
                        <Ionicons name="chevron-back" size={24} color={Palette.white} />
                    </Pressable>
                    <Text style={styles.heroTitle}>Sleep insight</Text>
                    <View style={{ width: 24 }} />
                </View>
                <RangeTabs value={range} onChange={setRange} />
            </LinearGradient>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
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
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {empty ? (
                        <View style={styles.empty}>
                            <BedIllustration width={200} />
                            <Text style={styles.emptyTitle}>Nothing to analyse yet</Text>
                            <Text style={styles.emptyBody}>
                                Once a few nights have synced, this screen shows your stage balance,
                                which nights you sleep best, and how steady your schedule is.
                            </Text>
                        </View>
                    ) : null}

                    {data && !empty ? (
                        <>
                            {/* --------------------------------------- sleep score */}
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Sleep score</Text>
                                <Text style={styles.bigValue}>
                                    {data.score.average !== null ? `${data.score.average} pts` : '—'}
                                </Text>
                                <Delta comparison={data.score.comparison} period={PERIOD_LABEL[range]} />
                                <MetricAreaChart
                                    points={data.series.map((p) => ({ day: p.day, value: p.score }))}
                                    width={chartWidth}
                                    color={Palette.primary}
                                />
                                <Text style={styles.cardNote}>
                                    {`Across ${data.nights} ${data.nights === 1 ? 'night' : 'nights'} with data.`}
                                </Text>
                            </View>

                            {/* ---------------------------------------- breakdown */}
                            {data.breakdown.totalMin !== null ? (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Sleep breakdown</Text>
                                    <StageDonut
                                        rows={data.breakdown.stages}
                                        totalLabel={formatMinutes(data.breakdown.totalMin)}
                                        caption={`over ${data.breakdown.nights} ${data.breakdown.nights === 1 ? 'night' : 'nights'}`}
                                    />
                                    <StageRows rows={data.breakdown.stages} />
                                </View>
                            ) : null}

                            {/* ----------------------------------- average sleep time */}
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Average sleep time</Text>
                                <Text style={styles.bigValue}>
                                    {formatMinutes(data.duration.average)}
                                </Text>
                                <Delta comparison={data.duration.comparison} period={PERIOD_LABEL[range]} />
                                <WeekdayBars days={data.weekday.days} averageMin={data.weekday.avgMin} />
                                {data.weekday.best && data.weekday.worst
                                    && data.weekday.best !== data.weekday.worst ? (
                                        <Text style={styles.cardNote}>
                                            {`You sleep longest on ${data.weekday.best} and shortest on ${data.weekday.worst}.`}
                                        </Text>
                                    ) : null}
                            </View>

                            {/* ------------------------------------- average range */}
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Average range</Text>
                                <StageRangeRows ranges={data.ranges} />
                            </View>

                            {/* -------------------------------------- consistency */}
                            {data.consistency.band ? (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>How steady your schedule is</Text>
                                    <Text style={styles.bigValue}>{data.consistency.band.label}</Text>
                                    <Text style={styles.cardNote}>
                                        {`Typically asleep around ${formatClock(data.consistency.bedtimeMin)} `
                                        + `and up around ${formatClock(data.consistency.wakeMin)}, `
                                        + `varying by about ${formatMinutes(data.consistency.spreadMin)}.`}
                                    </Text>
                                    {/* Named rather than graded. See the note at the top. */}
                                    <Text style={styles.cardFootnote}>
                                        This describes a pattern; it is not a score, and shift work or a
                                        new baby will move it for reasons that are not about your health.
                                    </Text>
                                </View>
                            ) : null}

                            {/* ----------------------------------- plan guidance */}
                            {data.guidance.length > 0 ? (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>What your plan says</Text>
                                    {data.guidance.map((g, i) => (
                                        <View key={`${g.key}-${i}`} style={styles.guidanceRow}>
                                            <Ionicons name="leaf-outline" size={15} color={Palette.primary} />
                                            <Text style={styles.guidanceText}>{g.directive}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hero: {
        paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, paddingTop: Spacing.md,
        gap: Spacing.lg,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },

    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    error: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.danger },

    card: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.background,
        borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.md,
        ...Shadow.card,
    },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    bigValue: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    cardNote: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
    cardFootnote: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 16 },

    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -Spacing.sm },
    deltaValue: { fontSize: 13, fontFamily: Fonts.semibold },
    deltaLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    deltaMuted: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: -Spacing.sm,
    },

    guidanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    guidanceText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 19 },

    empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingHorizontal: Spacing.lg, lineHeight: 19,
    },
});
