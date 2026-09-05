/**
 * Hydration Insight — `Design/hydration.svg` frame 6.
 *
 * Four questions about a window: what you drink out of, where the day landed, how much it
 * adds up to, and which days you actually drink on.
 *
 * Two departures from the kit, both the same departure the rest of this app makes:
 *
 * - **The frequency chart is bars, not a ridgeline.** The design draws a smooth stacked
 *   density across Mon–Sun, which is a beautiful shape and interpolates a value for every
 *   weekday including the ones with no data. A weekday nobody logged on gets **no bar** here,
 *   because a zero-height bar and a missing bar look identical and only one of them is a
 *   claim. Same rule `nutritionInsight.js` states as dividing by days logged, never by the
 *   window.
 * - **Averages divide by days logged.** "1x weekly average" under a vessel divides by
 *   calendar weeks, because *frequency* is a claim about calendar time; the millilitre
 *   averages divide by days with entries, because those are claims about behaviour on days
 *   somebody tracked. The two denominators are different on purpose.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

import {
    getHistory, getHydrationToday, today as localToday,
    type MetricHistory, type HydrationToday,
} from '@/lib/metrics';
import {
    busiestHour, changeVsPrevious, consumptionBySize, splitVolume, summarise, typicalServingMl,
    weekdayAverages, containerLabel, containerFor,
} from '@/lib/hydration';
import { useUnits, formatVolume } from '@/lib/units';
import { ContainerGlass } from '@/components/hydration/ContainerGlass';
import { Sparkline } from '@/components/hydration/Sparkline';
import { WaterHeader, SectionHeader, EmptyNote, cardStyles } from '@/components/hydration/HydrationChrome';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const SPAN: Record<MetricRange, number> = { '1d': 7, '1w': 7, '1m': 31, '1y': 365, all: 365 };

export default function HydrationInsightScreen() {
    const router = useRouter();
    const units = useUnits();
    const { width } = useWindowDimensions();
    const day = localToday();

    const [range, setRange] = useState<MetricRange>('1m');
    const [history, setHistory] = useState<MetricHistory | null>(null);
    const [today, setToday] = useState<HydrationToday | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (days: number) => {
        try {
            const [h, t] = await Promise.allSettled([getHistory('water', days), getHydrationToday()]);
            if (h.status === 'fulfilled') setHistory(h.value);
            if (t.status === 'fulfilled') setToday(t.value);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(SPAN[range]); }, [load, range]));

    // Memoised: `?? []` is a new array each render and every derivation below depends on it.
    const logs = useMemo(() => history?.logs ?? [], [history]);
    const series = useMemo(() => history?.series ?? [], [history]);
    const windowDays = SPAN[range];

    const stats = useMemo(() => summarise(series, day), [series, day]);
    const vessels = useMemo(() => consumptionBySize(logs, windowDays), [logs, windowDays]);
    const weekdays = useMemo(() => weekdayAverages(series, day), [series, day]);
    const change = useMemo(() => changeVsPrevious(series, day), [series, day]);
    const typical = typicalServingMl(logs);
    const hour = busiestHour(logs);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const empty = stats.daysLogged === 0;
    const typicalSplit = splitVolume(typical, units);
    const level = today?.level ?? null;
    const levelNumber = level && today?.levels?.length
        ? today.levels.length - today.levels.findIndex((l) => l.key === level.key)
        : null;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <WaterHeader title="Hydration Insight" />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <RangeTabs value={range} onChange={setRange} />

                {empty && (
                    <View style={cardStyles.card}>
                        <EmptyNote>
                            Nothing logged in this window, so there is nothing to take an average of
                            yet. Log a few drinks and this fills in.
                        </EmptyNote>
                    </View>
                )}

                {/* ---- Most consumed --------------------------------------------- */}
                {vessels.length > 0 && (
                    <>
                        <SectionHeader title="Most Consumed" />
                        <View style={cardStyles.card}>
                            <Text style={styles.big}>
                                {typicalSplit.value}<Text style={styles.bigUnit}>{typicalSplit.unit}</Text>
                            </Text>
                            <Text style={styles.blurb}>
                                Your typical serving. You reach for a{' '}
                                {containerLabel(containerFor(typical)).toLowerCase()} most often.
                            </Text>

                            <View style={styles.vessels}>
                                {vessels.map((v, i) => (
                                    <View key={v.size} style={[styles.vessel, i > 0 && styles.vesselDivided]}>
                                        <View style={styles.vesselSlot}>
                                            <ContainerGlass size={v.size} height={52} />
                                        </View>
                                        <View style={styles.flex}>
                                            <Text style={styles.vesselCount}>{v.count}×</Text>
                                            <Text style={styles.vesselTotal}>
                                                {formatVolume(v.totalMl, units)} total
                                            </Text>
                                            <Text style={styles.vesselRate}>
                                                {v.perWeek}× a week on average
                                            </Text>
                                        </View>
                                        <Text style={styles.vesselLabel}>{v.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                {/* ---- Level ------------------------------------------------------ */}
                <SectionHeader title="Hydration Level" />
                <Pressable
                    style={[cardStyles.card, styles.levelCard]}
                    onPress={() => router.push('/metrics/water/level')}
                    accessibilityRole="button"
                    accessibilityLabel="What your hydration level means"
                >
                    <Ring
                        percent={level?.percent ?? 0}
                        label={levelNumber !== null ? String(levelNumber) : '—'}
                        dim={!level}
                    />
                    <View style={styles.flex}>
                        <Text style={styles.levelTitle}>
                            {level ? level.label : 'Not tracked today'}
                        </Text>
                        <Text style={styles.levelBlurb}>
                            {level
                                ? level.blurb
                                : 'Nothing logged today, so there is no level to report — which is not the same as being dehydrated.'}
                        </Text>
                        <View style={styles.learn}>
                            <Text style={styles.learnText}>What the levels mean</Text>
                            <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                        </View>
                    </View>
                </Pressable>

                {/* ---- Consumption rate ------------------------------------------ */}
                <SectionHeader title="Consumption Rate" />
                <View style={cardStyles.card}>
                    <Row
                        value={formatVolume(stats.totalMl, units) ?? '--'}
                        label={`Logged across ${stats.daysLogged} ${stats.daysLogged === 1 ? 'day' : 'days'}`}
                        values={series.map((p) => p.value)}
                        colour="#16A34A"
                    />
                    <View style={styles.divider} />
                    <Row
                        value={formatVolume(stats.weeklyAverageMl, units) ?? '--'}
                        label="Weekly average, from your daily average"
                        values={series.map((p) => p.value)}
                        colour="#2563EB"
                    />
                    <View style={styles.divider} />
                    <View style={styles.factRow}>
                        <Fact label="Days on target" value={`${stats.metCount}`} />
                        <Fact label="Current streak" value={stats.streak ? `${stats.streak}d` : '—'} />
                        <Fact
                            label="Best day"
                            value={stats.best ? formatVolume(stats.best.ml, units) ?? '--' : '—'}
                        />
                    </View>
                </View>

                {/* ---- Frequency -------------------------------------------------- */}
                <SectionHeader title="Frequency" />
                <View style={cardStyles.card}>
                    <Text style={styles.big}>
                        {splitVolume(stats.dailyAverageMl, units).value}
                        <Text style={styles.bigUnit}>{splitVolume(stats.dailyAverageMl, units).unit}</Text>
                    </Text>
                    {change !== null ? (
                        <View style={styles.changeRow}>
                            <Ionicons
                                name={change >= 0 ? 'trending-up' : 'trending-down'}
                                size={15}
                                color={change >= 0 ? Palette.successDeep : Palette.warning}
                            />
                            <Text style={[styles.changeText, { color: change >= 0 ? Palette.successDeep : Palette.warning }]}>
                                {Math.abs(change)}% {change >= 0 ? 'more' : 'less'} than the first half of this window
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.blurb}>
                            Not enough logged days yet to compare one half of this window with the other.
                        </Text>
                    )}

                    <WeekdayBars data={weekdays} width={width - Spacing.lg * 4 - 2} />

                    <Text style={styles.caption}>
                        {stats.best
                            ? `Your biggest day was ${new Date(`${stats.best.day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}, at ${formatVolume(stats.best.ml, units)}.`
                            : 'No day in this window has anything on it yet.'}
                        {hour !== null && ` Most drinks land around ${String(hour).padStart(2, '0')}:00.`}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

/** The design's level ring. Dimmed rather than empty when nothing was logged. */
function Ring({ percent, label, dim }: { percent: number; label: string; dim?: boolean }) {
    const SIZE = 72;
    const STROKE = 6;
    const r = (SIZE - STROKE) / 2;
    const c = 2 * Math.PI * r;
    const filled = Math.max(0, Math.min(1, percent / 100));

    return (
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                    <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={Palette.border} strokeWidth={STROKE} fill="none" />
                    {!dim && filled > 0 && (
                        <Circle
                            cx={SIZE / 2} cy={SIZE / 2} r={r}
                            stroke={Palette.primary} strokeWidth={STROKE}
                            strokeDasharray={c} strokeDashoffset={c * (1 - filled)}
                            strokeLinecap="round" fill="none"
                        />
                    )}
                </G>
            </Svg>
            <Text style={[styles.ringLabel, dim && { color: Palette.textMuted }]}>{label}</Text>
        </View>
    );
}

/**
 * Average millilitres per weekday.
 *
 * A weekday with no logged days draws its label and nothing above it — see the header note.
 */
function WeekdayBars({ data, width }: { data: { label: string; ml: number | null }[]; width: number }) {
    const values = data.map((d) => d.ml).filter((v): v is number => v !== null);
    const max = values.length ? Math.max(...values) : 0;
    const H = 108;

    if (!values.length) {
        return <EmptyNote>Nothing logged in this window, so there is no weekday pattern yet.</EmptyNote>;
    }

    return (
        <View style={[styles.bars, { width }]}>
            {data.map((d) => (
                <View key={d.label} style={styles.barCol}>
                    <View style={[styles.barTrack, { height: H }]}>
                        {d.ml !== null && (
                            <View style={[styles.bar, { height: Math.max(4, (d.ml / max) * H) }]} />
                        )}
                    </View>
                    <Text style={styles.barLabel}>{d.label}</Text>
                </View>
            ))}
        </View>
    );
}

const Row = ({ value, label, values, colour }: {
    value: string; label: string; values: (number | null)[]; colour: string;
}) => (
    <View style={styles.row}>
        <View style={styles.flex}>
            <Text style={styles.rowValue}>{value}</Text>
            <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <Sparkline values={values} color={colour} />
    </View>
);

const Fact = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.fact}>
        <Text style={styles.factValue}>{value}</Text>
        <Text style={styles.factLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.lg },

    big: { fontFamily: Fonts.bold, fontSize: 30, color: Palette.text },
    bigUnit: { fontFamily: Fonts.medium, fontSize: 15, color: Palette.textSecondary },
    blurb: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: 2, lineHeight: 19 },
    changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
    changeText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
    caption: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, marginTop: Spacing.md, lineHeight: 18 },
    divider: { height: 1, backgroundColor: Palette.border, marginVertical: Spacing.lg },

    vessels: { marginTop: Spacing.lg },
    vessel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
    vesselSlot: { width: 44, alignItems: 'center', justifyContent: 'center' },
    vesselDivided: { borderTopWidth: 1, borderTopColor: Palette.border },
    vesselCount: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    vesselTotal: { fontFamily: Fonts.medium, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 },
    vesselRate: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, marginTop: 1 },
    vesselLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textMuted },

    levelCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    ringLabel: { fontFamily: Fonts.bold, fontSize: 22, color: Palette.primary },
    levelTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    levelBlurb: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, marginTop: 3, lineHeight: 18 },
    learn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
    learnText: { fontFamily: Fonts.semibold, fontSize: 12.5, color: Palette.primary },

    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowValue: { fontFamily: Fonts.bold, fontSize: 23, color: Palette.text },
    rowLabel: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 },

    factRow: { flexDirection: 'row' },
    fact: { flex: 1, alignItems: 'center', gap: 2 },
    factValue: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    factLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, textAlign: 'center' },

    bars: { flexDirection: 'row', alignItems: 'flex-end', marginTop: Spacing.xl, gap: Spacing.xs },
    barCol: { flex: 1, alignItems: 'center', gap: 6 },
    barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '68%', borderRadius: Radius.sm, backgroundColor: '#3B82F6' },
    barLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
});
