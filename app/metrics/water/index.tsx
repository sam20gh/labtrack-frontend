/**
 * Hydration — `Design/hydration.svg` frames 1–3.
 *
 * The screen is one scroll: today at the top, then the range control, then Daily Goal,
 * Highlight, Hydration History, and a way to ask about it. Below the fold everything is a
 * summary with a "See All" into its own screen, which is the shape the design draws and the
 * reason this stopped being a branch of `app/metrics/[kind].tsx`.
 *
 * **The range control changes what is drawn, not just its span**, and the three views are the
 * three questions someone actually opens this for:
 *
 * | Range | View | The question |
 * |---|---|---|
 * | `1d` | the glass at today's level | am I on track right now |
 * | `1w`, `1m` | the month of ticks | is this a habit yet |
 * | `1y`, `all` | the trend chart | is it going anywhere |
 *
 * A year as 365 calendar squares is unreadable and a day as a one-point chart says nothing,
 * so a single view scaled by a span would be wrong at two of the five settings.
 *
 * Two things it does that the design does not:
 *
 * - **Where the target came from is on the screen.** The kit prints "Target: 2,000ml" as a
 *   given. This app derives it from body mass and recorded activity (`utils/hydrationTargets.js`),
 *   so `basis` is rendered under the goal card — an unexplained number is one people either
 *   ignore or, worse, chase.
 * - **The design's AI Recommendations rail is not built as a rail.** It is a carousel of
 *   stock photographs with captions, and there is no hydration recommendation endpoint behind
 *   it; nutrition's rail exists because `nutritionRecommender.js` does. What is real is the
 *   assistant, which already reads this person's biomarkers, plan and trackers — so the card
 *   composes the day into a question and opens it, the way `app/symptoms` does.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getHistory, getHydrationToday, today as localToday,
    type MetricHistory, type HydrationToday,
} from '@/lib/metrics';
import {
    attainment, changeVsPrevious, containerFor, describeEntry,
    drops, heroLine, splitVolume, summarise,
} from '@/lib/hydration';
import { useUnits, formatVolume } from '@/lib/units';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { WaterGlass } from '@/components/hydration/WaterGlass';
import { WaterDrop, DropRow } from '@/components/hydration/WaterDrop';
import { ContainerGlass } from '@/components/hydration/ContainerGlass';
import { HydrationCalendar } from '@/components/hydration/HydrationCalendar';
import { Sparkline } from '@/components/hydration/Sparkline';
import { WaterHeader, SectionHeader, EmptyNote, cardStyles } from '@/components/hydration/HydrationChrome';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

/** How many days each range asks the server for. The API clamps to 7–365. */
const SPAN: Record<MetricRange, number> = { '1d': 7, '1w': 31, '1m': 31, '1y': 365, all: 365 };

type ChartView = 'glass' | 'calendar' | 'chart';
const VIEW_FOR: Record<MetricRange, ChartView> = {
    '1d': 'glass', '1w': 'calendar', '1m': 'calendar', '1y': 'chart', all: 'chart',
};

export default function HydrationScreen() {
    const router = useRouter();
    const units = useUnits();
    const { width } = useWindowDimensions();

    const [range, setRange] = useState<MetricRange>('1d');
    const [month, setMonth] = useState(() => localToday().slice(0, 7));
    const [today, setToday] = useState<HydrationToday | null>(null);
    const [history, setHistory] = useState<MetricHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const day = localToday();

    const load = useCallback(async (days: number) => {
        try {
            const [t, h] = await Promise.allSettled([getHydrationToday(), getHistory('water', days)]);
            if (t.status === 'fulfilled') setToday(t.value);
            if (h.status === 'fulfilled') setHistory(h.value);

            const failure = [t, h].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
            if (failure?.reason instanceof ApiError && failure.reason.isAuthError) {
                router.replace('/(auth)/loginscreen');
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(SPAN[range]); }, [load, range]));

    // Memoised because `?? []` is a fresh array every render, which would make the
    // summaries below recompute on each one.
    const series = useMemo(() => history?.series ?? [], [history]);
    const stats = useMemo(() => summarise(series, day), [series, day]);
    const change = useMemo(() => changeVsPrevious(series, day), [series, day]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const consumed = today?.consumedMl ?? 0;
    const target = today?.targetMl ?? null;
    const level = today?.level ?? null;
    const hero = splitVolume(consumed, units);
    const percent = Math.round(attainment(consumed, target) * 100);
    const goalDrops = drops(consumed, target);
    const chartWidth = width - Spacing.lg * 2 - Spacing.lg * 2;
    const view = VIEW_FOR[range];
    // The window's entries, not just today's: a day with nothing on it would otherwise show
    // an empty History section on a screen whose whole point is that there is history.
    const recent = (history?.logs ?? []).slice(0, 3);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <WaterHeader
                pill={level?.label ?? null}
                onAdd={() => router.push('/metrics/log/water')}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(SPAN[range]); setRefreshing(false); }}
                        tintColor={Palette.primary}
                    />
                )}
            >
                {/* ---- Today ------------------------------------------------------- */}
                <View style={styles.hero}>
                    <View style={styles.heroRow}>
                        <WaterDrop size={26} color={Palette.primary} />
                        <Text style={styles.heroValue}>
                            {hero.value}
                            <Text style={styles.heroUnit}>{' '}{hero.unit}</Text>
                        </Text>
                    </View>

                    <Text style={styles.heroLine}>{heroLine(consumed, target, today?.logs ?? 0, units)}</Text>

                    <View style={styles.metaRow}>
                        <Meta icon="flag-outline" text={`Target: ${formatVolume(target, units) ?? '--'}`} />
                        {change !== null && (
                            <Meta
                                icon={change >= 0 ? 'trending-up' : 'trending-down'}
                                text={`${change > 0 ? '+' : ''}${change}%`}
                                tone={change >= 0 ? Palette.successDeep : Palette.warning}
                            />
                        )}
                        <Meta icon="list-outline" text={`${history?.logs.length ?? 0} logs`} />
                    </View>
                </View>

                {/* ---- The view the range picked ----------------------------------- */}
                {view === 'glass' && (
                    <View style={styles.glassWrap}>
                        <WaterGlass
                            fill={attainment(consumed, target)}
                            width={Math.min(240, width - Spacing.lg * 6)}
                            complete={target !== null && consumed >= target}
                        />
                    </View>
                )}

                {view === 'calendar' && (
                    <View style={cardStyles.raised}>
                        <HydrationCalendar
                            month={month}
                            series={series}
                            today={day}
                            onChangeMonth={setMonth}
                        />
                        <View style={styles.legend}>
                            <Legend colour="#22C55E" label="Target met" />
                            <Legend colour="#EF4444" label="Under target" />
                            <Legend colour={Palette.textSecondary} hollow label="Not logged" />
                        </View>
                    </View>
                )}

                {view === 'chart' && (
                    <View style={cardStyles.raised}>
                        {series.some((p) => p.value !== null) ? (
                            <MetricAreaChart
                                points={series.map((p) => ({ day: p.day, value: p.value }))}
                                width={chartWidth}
                                height={168}
                                color="#2563EB"
                                unit="ml"
                                maxXLabels={6}
                            />
                        ) : (
                            <EmptyNote>Nothing logged in this period yet.</EmptyNote>
                        )}
                    </View>
                )}

                <RangeTabs
                    value={range}
                    onChange={(r) => {
                        setRange(r);
                        // Walking back a month and switching to 1y left the calendar parked
                        // in April; coming back to it should show the month you are in.
                        if (VIEW_FOR[r] === 'calendar') setMonth(day.slice(0, 7));
                    }}
                />

                {/* ---- Daily Goal --------------------------------------------------- */}
                <SectionHeader title="Daily Goal" onSeeAll={() => router.push('/metrics/water/level')} />
                <View style={cardStyles.card}>
                    <Text style={styles.goalValue}>{formatVolume(target, units) ?? 'Not set'}</Text>
                    <Text style={styles.goalLine}>
                        {today?.logs
                            ? `You're ${percent}% there for today.`
                            : 'Nothing logged against it yet today.'}
                    </Text>

                    <View style={styles.divider} />
                    <DropRow filled={goalDrops.filled} total={goalDrops.total} />

                    {/*
                      The target is derived, so it says what from. See `computeTarget`.
                    */}
                    {today?.basis?.length ? (
                        <Text style={styles.basis}>From {today.basis.join(', plus ')}.</Text>
                    ) : null}
                </View>

                {/* ---- Highlight ---------------------------------------------------- */}
                <SectionHeader title="Highlight" onSeeAll={() => router.push('/metrics/water/insight')} />
                <View style={cardStyles.card}>
                    <Highlight
                        value={formatVolume(stats.totalMl, units) ?? '--'}
                        label={`Logged over ${stats.daysLogged || 'no'} ${stats.daysLogged === 1 ? 'day' : 'days'}`}
                        values={series.map((p) => p.value)}
                        colour="#16A34A"
                    />
                    <View style={styles.divider} />
                    <Highlight
                        value={formatVolume(stats.dailyAverageMl, units) ?? '--'}
                        label="Daily average, across days you logged"
                        values={series.map((p) => p.value)}
                        colour="#2563EB"
                    />
                    {stats.daysLogged === 0 && (
                        <EmptyNote>
                            Nothing in this window yet, so there is no average to take.
                        </EmptyNote>
                    )}
                </View>

                {/* ---- History ------------------------------------------------------ */}
                <SectionHeader title="Hydration History" onSeeAll={() => router.push('/metrics/water/history')} />
                {recent.length ? (
                    <View style={styles.entryList}>
                        {recent.map((log) => (
                            <Pressable
                                key={log._id}
                                style={styles.entry}
                                onPress={() => router.push(`/metrics/water/${log._id}`)}
                                accessibilityRole="button"
                                accessibilityLabel={`${formatVolume(log.ml, units)}, ${describeEntry(log)}`}
                            >
                                {/* Fixed slot: the vessels differ in size on purpose, and
                                    the rows still have to line up. */}
                                <View style={styles.vesselSlot}>
                                    <ContainerGlass size={containerFor(log.ml)} height={40} />
                                </View>
                                <View style={styles.flex}>
                                    <Text style={styles.entryValue}>{formatVolume(log.ml, units)}</Text>
                                    <Text style={styles.entryMeta}>{describeEntry(log)}</Text>
                                </View>
                                <Text style={styles.entryTime}>
                                    {new Date(log.measuredAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Ionicons name="chevron-forward" size={17} color={Palette.textMuted} />
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={cardStyles.card}>
                        <EmptyNote>Nothing logged today. Tap + to add a drink.</EmptyNote>
                    </View>
                )}

                {/* ---- Ask ----------------------------------------------------------- */}
                <Pressable
                    style={styles.ask}
                    onPress={() => router.push({
                        pathname: '/(tabs)/assistant',
                        params: {
                            // `prompt` is the param the assistant consumes and clears on
                            // arrival — see the `consuming` ref in `(tabs)/assistant.tsx`.
                            prompt: today?.logs
                                ? `I have drunk ${consumed} ml of water today against a target of ${target ?? 'unknown'} ml. What does that mean for me, and is there anything in my results that changes what I should be drinking?`
                                : 'I have not logged any water today. How much should I be drinking, and does anything in my results change that?',
                        },
                    })}
                    accessibilityRole="button"
                >
                    <View style={styles.askIcon}>
                        <Ionicons name="sparkles" size={18} color={Palette.primary} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.askTitle}>Ask LabTrack AI about your hydration</Text>
                        <Text style={styles.askBlurb}>
                            It reads your results, plan and trackers — so the answer is about you rather
                            than about water in general.
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                </Pressable>

                {/* The guide-not-a-prescription line, which travels with every target. */}
                {today?.note ? <Text style={styles.note}>{today.note}</Text> : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const Meta = ({ icon, text, tone }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; text: string; tone?: string;
}) => (
    <View style={styles.meta}>
        <Ionicons name={icon} size={13} color={tone ?? Palette.textMuted} />
        <Text style={[styles.metaText, tone ? { color: tone } : null]}>{text}</Text>
    </View>
);

const Legend = ({ colour, label, hollow }: { colour: string; label: string; hollow?: boolean }) => (
    <View style={styles.legendItem}>
        <View style={[
            styles.legendDot,
            hollow ? { borderWidth: 1.5, borderColor: colour } : { backgroundColor: colour },
        ]} />
        <Text style={styles.legendText}>{label}</Text>
    </View>
);

const Highlight = ({ value, label, values, colour }: {
    value: string; label: string; values: (number | null)[]; colour: string;
}) => (
    <View style={styles.highlight}>
        <View style={styles.flex}>
            <Text style={styles.highlightValue}>{value}</Text>
            <Text style={styles.highlightLabel}>{label}</Text>
        </View>
        <Sparkline values={values} color={colour} />
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.lg },

    hero: { alignItems: 'center', gap: Spacing.sm },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    heroValue: { fontFamily: Fonts.bold, fontSize: 44, color: Palette.text, letterSpacing: -1 },
    heroUnit: { fontFamily: Fonts.medium, fontSize: 17, color: Palette.textSecondary },
    heroLine: { fontFamily: Fonts.medium, fontSize: 15, color: Palette.textSecondary, textAlign: 'center' },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, marginTop: 2 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: Fonts.medium, fontSize: 12.5, color: Palette.textMuted },

    glassWrap: { alignItems: 'center', paddingVertical: Spacing.sm },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 11, height: 11, borderRadius: 6 },
    legendText: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textSecondary },

    goalValue: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text },
    goalLine: { fontFamily: Fonts.regular, fontSize: 13.5, color: Palette.textSecondary, marginTop: 2 },
    basis: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, marginTop: Spacing.md, lineHeight: 17 },
    divider: { height: 1, backgroundColor: Palette.border, marginVertical: Spacing.lg },

    highlight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    highlightValue: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.text },
    highlightLabel: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 },

    entryList: { gap: Spacing.sm },
    entry: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    },
    vesselSlot: { width: 34, alignItems: 'center', justifyContent: 'center' },
    entryValue: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    entryMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 1 },
    entryTime: { fontFamily: Fonts.medium, fontSize: 12.5, color: Palette.textSecondary },

    ask: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Palette.primaryLight,
        ...Shadow.card,
    },
    askIcon: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    askTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    askBlurb: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textSecondary, marginTop: 2, lineHeight: 16 },

    note: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, lineHeight: 17 },
});
