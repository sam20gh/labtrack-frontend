/**
 * Health Metrics Insight.
 *
 * The kit's insight screen: one card per metric with a chart, a written reading of it, and a
 * "See suggestion" that goes somewhere useful.
 *
 * **The written line is derived here, not generated.** The kit's mockup shows the same
 * sentence under three different charts, which is a placeholder — but it would also be the
 * natural outcome of asking a model for a sentence per metric on every screen open: cost on a
 * screen someone scrolls, and non-determinism on text that describes their health. These are
 * simple, honest readings of the series (direction, spread, how much of the window reported),
 * and the model-written interpretation is one tap away where it already exists.
 *
 * "See suggestion" routes to the plan or the assistant with the metric in hand, rather than
 * being an inert link — an affordance that promises advice and produces nothing is worse than
 * no affordance.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '@/lib/api';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import {
    getOverview, METRIC_TINT, METRIC_ROUTE,
    type MetricCard, type MetricsOverview,
} from '@/lib/metrics';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const WINDOW_DAYS = 30;

export default function MetricsInsightScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [data, setData] = useState<MetricsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await getOverview(WINDOW_DAYS));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Metrics with something to say. A card with no data is not an insight. */
    const cards = useMemo(
        () => (data?.metrics ?? []).filter((m) => m.series.some((p) => p.value !== null)),
        [data],
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
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
                    <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.heroIcon}>
                        <Ionicons name="bulb-outline" size={22} color={Palette.primary} />
                    </View>
                    <Text style={styles.heroTitle}>Health Metrics Insight</Text>
                    <Text style={styles.heroBlurb}>
                        Track and analyse your key health indicators over the last {WINDOW_DAYS} days.
                    </Text>
                </LinearGradient>

                {cards.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.empty}>
                            Nothing to analyse yet. Log a weight, a drink or a blood-pressure reading,
                            or connect a device, and this fills in.
                        </Text>
                    </View>
                ) : cards.map((m) => (
                    <InsightCard
                        key={m.key}
                        metric={m}
                        width={width - Spacing.lg * 2 - Spacing.md * 2}
                        onOpen={() => router.push(METRIC_ROUTE[m.key] as never)}
                        onSuggestion={() => router.push({
                            pathname: '/(tabs)/assistant',
                            params: { prompt: promptFor(m) },
                        } as never)}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const InsightCard = ({ metric, width, onOpen, onSuggestion }: {
    metric: MetricCard; width: number; onOpen: () => void; onSuggestion: () => void;
}) => {
    const tint = METRIC_TINT[metric.key];
    const reading = readingFor(metric);

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardHead} onPress={onOpen} activeOpacity={0.7}>
                <Text style={styles.cardTitle}>{metric.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
            </TouchableOpacity>

            <Text style={styles.value}>
                {metric.value ?? '--'}
                <Text style={styles.unit}> {metric.unit}</Text>
            </Text>
            <Text style={[styles.status, metric.statusColour ? { color: metric.statusColour } : null]}>
                {metric.status}
            </Text>

            <MetricAreaChart
                points={metric.series.map((p) => ({ day: p.day, value: p.value }))}
                width={width}
                height={140}
                color={tint}
                unit={metric.unit}
                maxXLabels={6}
            />

            <Text style={styles.reading}>{reading}</Text>

            <TouchableOpacity style={styles.suggestion} onPress={onSuggestion}>
                <Text style={[styles.suggestionText, { color: tint }]}>See suggestion</Text>
                <Ionicons name="arrow-forward" size={14} color={tint} />
            </TouchableOpacity>
        </View>
    );
};

/**
 * A plain reading of the series.
 *
 * Three facts, in the order that matters: **how much of the window actually reported**, which
 * governs how much the rest is worth; the **direction**; and the **spread**. Coverage comes
 * first deliberately — "trending down" over four days out of thirty is not a trend, and a
 * sentence that says the second without the first invites someone to act on noise.
 */
const readingFor = (metric: MetricCard): string => {
    const points = metric.series.filter((p) => p.value !== null).map((p) => p.value as number);
    const coverage = points.length;
    const total = metric.series.length;

    if (coverage < 2) {
        return `Only ${coverage} day of the last ${total} has a reading, so there is no pattern to describe yet.`;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const delta = last - first;
    const pct = first !== 0 ? Math.abs(delta / first) * 100 : 0;
    const min = Math.min(...points);
    const max = Math.max(...points);

    const parts: string[] = [];
    parts.push(`${coverage} of the last ${total} days have a reading.`);

    // Under 3% over a window is drift, not a direction. Saying "rising" about it would have
    // someone acting on rounding.
    if (pct < 3) {
        parts.push(`It has held steady, between ${fmt(min)} and ${fmt(max)}.`);
    } else {
        parts.push(
            `It has ${delta > 0 ? 'risen' : 'fallen'} from ${fmt(first)} to ${fmt(last)} `
            + `${metric.unit}, ranging between ${fmt(min)} and ${fmt(max)}.`,
        );
    }

    if (coverage < total / 2) {
        parts.push('With this many gaps, treat the trend as indicative rather than settled.');
    }

    return parts.join(' ');
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** What the assistant is asked, with the metric in hand so the answer is about their data. */
const promptFor = (metric: MetricCard) =>
    `My ${metric.label.toLowerCase()} is currently ${metric.value ?? 'not recorded'} ${metric.unit} `
    + `(${metric.status.toLowerCase()}). What does that mean for me, and what should I do about it?`;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: Spacing.xl * 2, gap: Spacing.md },

    hero: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
    back: { position: 'absolute', left: Spacing.lg, top: Spacing.lg },
    heroIcon: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
    },
    heroTitle: { fontFamily: Fonts.bold, fontSize: 24, color: '#FFFFFF', textAlign: 'center' },
    heroBlurb: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 19 },

    card: {
        backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md,
        marginHorizontal: Spacing.lg, gap: Spacing.xs, ...Shadow.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    value: { fontFamily: Fonts.bold, fontSize: 28, color: Palette.text },
    unit: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.textMuted },
    status: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginBottom: Spacing.xs },
    reading: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, lineHeight: 18, marginTop: Spacing.xs },
    suggestion: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.sm, marginTop: Spacing.xs,
    },
    suggestionText: { fontFamily: Fonts.semibold, fontSize: 13 },
    empty: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted, textAlign: 'center', lineHeight: 19, paddingVertical: Spacing.lg },
});
