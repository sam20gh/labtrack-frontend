/**
 * The prediction hub — the design's frame 2.
 *
 * ```
 * purple header      avatar, greeting, metrics predicted, improvement, Predict My Health
 * Turing Score       the score forecast as a min/average/max band
 * Health Metric      one expandable row per metric that has a prediction
 * Past Predictions   what was claimed, and whether it landed
 * Recommended        clinicians, drawn from the directory
 * ```
 *
 * Three things about it are deliberate:
 *
 * 1. **Nothing here generates a prediction.** `GET /predictions/overview` reads what has
 *    already been written. Running a forecast on a screen open would put an Opus call inside
 *    a `useFocusEffect`, which is the rule `app/nutrition/index.tsx` exists to demonstrate.
 *    The button is what runs one, and it is a whole flow with its own screen.
 * 2. **"+25% Improvement" is computed or it is absent.** The kit prints it unconditionally.
 *    Here it is the share of *resolved* predictions that moved the way that metric's better
 *    direction points, and it renders nothing at all until something has resolved — the
 *    distinction `alignment: 'unassessed'` makes, applied to a headline figure.
 * 3. **Accuracy is on this screen, not buried.** How often the interval actually contained
 *    the measured value is the only honest answer to "does this work", and a feature that
 *    hides its own scorecard is one nobody should trust.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
    ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '@/lib/api';
import {
    getOverview, getPredictableMetrics,
    type Overview, type MetricKey, type PredictableMetric,
} from '@/lib/prediction';
import { BandChart } from '@/components/predict/BandChart';
import { MetricPredictionCard, PastPredictionRow } from '@/components/predict/PredictionCards';
import { PredictionDisclaimer } from '@/components/predict/Chips';
import { Avatar } from '@/components/Avatar';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

/** "Dr. Doug Mathers" → "DM". Falls back to one letter rather than to an empty circle. */
const initialsOf = (name: string) =>
    name.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '').join('') || name[0]?.toUpperCase() || '?';

export default function PredictHubScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [data, setData] = useState<Overview | null>(null);
    const [metrics, setMetrics] = useState<PredictableMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            // Both are database reads. Neither is model-backed, so both may be awaited before
            // the first paint — the rule the home screen states about `getPlan()`.
            const [overview, catalogue] = await Promise.all([
                getOverview(),
                getPredictableMetrics().catch(() => ({ metrics: [] as PredictableMetric[] })),
            ]);
            setData(overview);
            setMetrics(catalogue.metrics);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const betterWhenOf = (metric: MetricKey) =>
        metrics.find((m) => m.key === metric)?.betterWhen ?? null;

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const chartWidth = width - Spacing.lg * 2 - Spacing.lg * 2;
    const ready = metrics.filter((m) => m.ready);

    return (
        <View style={styles.screen}>
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
                    <SafeAreaView edges={['top']}>
                        <View style={styles.heroTop}>
                            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                                <Ionicons name="chevron-back" size={22} color={Palette.white} />
                            </TouchableOpacity>
                            <Text style={styles.heroTitle}>Predictions</Text>
                            <TouchableOpacity
                                onPress={() => router.push('/predict/how')}
                                hitSlop={12}
                                accessibilityLabel="How do we predict?"
                            >
                                <Ionicons name="help-circle-outline" size={22} color={Palette.white} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.statRow}>
                            <View style={styles.statBlock}>
                                <Text style={styles.statValue}>{data?.metricsPredicted ?? 0}</Text>
                                <Text style={styles.statLabel}>
                                    {data?.metricsPredicted === 1 ? 'Metric predicted' : 'Metrics predicted'}
                                </Text>
                            </View>

                            <View style={styles.statBlock}>
                                {/* Absent rather than zero until something has resolved. */}
                                {data?.improvement ? (
                                    <>
                                        <Text style={styles.statValue}>
                                            {data.improvement.pct > 0 ? '+' : ''}{data.improvement.pct}%
                                        </Text>
                                        <Text style={styles.statLabel}>
                                            Improved, of {data.improvement.of} checked
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.statValueMuted}>—</Text>
                                        <Text style={styles.statLabel}>Nothing checked yet</Text>
                                    </>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.cta}
                            onPress={() => router.push('/predict/select')}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaText}>Predict My Health</Text>
                            <Ionicons name="search" size={18} color={Palette.white} />
                        </TouchableOpacity>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {data?.accuracy ? (
                        <Pressable
                            style={styles.accuracy}
                            onPress={() => router.push('/predict/accuracy')}
                            accessibilityRole="button"
                        >
                            <Ionicons name="checkmark-done-outline" size={18} color={Palette.successDeep} />
                            <Text style={styles.accuracyText}>
                                {data.accuracy.withinIntervalPct}% of your {data.accuracy.resolved} checked
                                predictions landed inside their range
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                        </Pressable>
                    ) : null}

                    {/* ── Turing Score ─────────────────────────────────────────── */}
                    {data?.scorePrediction ? (
                        <>
                            <Text style={styles.section}>Turing Score Prediction</Text>
                            {/* The card opens the score's own prediction screen — the design's
                                frame 3, with the horizon chips. The run that produced these
                                figures is still reachable from "See full prediction" there. */}
                            <Pressable
                                style={styles.scoreCard}
                                onPress={() => router.push('/predict/score')}
                                accessibilityRole="button"
                            >
                                <View style={styles.scoreHead}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.scoreValueRow}>
                                            <Text style={styles.scoreValue}>
                                                {data.scorePrediction.display?.range}
                                            </Text>
                                            <Text style={styles.scoreUnit}>pts</Text>
                                        </View>
                                        <Text style={styles.scoreCaption}>
                                            Range within {data.scorePrediction.horizonLabel.replace('Next ', 'the next ')}
                                        </Text>
                                    </View>
                                    <View style={styles.scoreOpen}>
                                        <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                                    </View>
                                </View>

                                <BandChart
                                    points={data.scorePrediction.series.projected}
                                    width={chartWidth}
                                />
                            </Pressable>
                        </>
                    ) : null}

                    {/* ── Health Metric Prediction ─────────────────────────────── */}
                    <View style={styles.sectionRow}>
                        <Text style={styles.section}>Health Metric Prediction</Text>
                        {data?.metricPredictions.length ? (
                            <TouchableOpacity onPress={() => router.push('/predict/select')}>
                                <Text style={styles.sectionAction}>Add</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {data?.metricPredictions.length ? (
                        data.metricPredictions.map((p) => (
                            <MetricPredictionCard
                                key={p.id}
                                prediction={p}
                                betterWhen={betterWhenOf(p.metric)}
                                onOpen={() => router.push(`/predict/${p.id}`)}
                            />
                        ))
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="sparkles-outline" size={28} color={Palette.primary} />
                            <Text style={styles.emptyTitle}>Nothing predicted yet</Text>
                            <Text style={styles.emptyBody}>
                                {ready.length
                                    ? `You have enough history for ${ready.length} ${ready.length === 1 ? 'metric' : 'metrics'}. `
                                    + 'Pick one and we will project it forward.'
                                    : 'Log a few readings on any tracker and we can start projecting them forward.'}
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyCta}
                                onPress={() => router.push('/predict/select')}
                                accessibilityRole="button"
                            >
                                <Text style={styles.emptyCtaText}>Choose a metric</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── Past Predictions ─────────────────────────────────────── */}
                    {data?.past.length ? (
                        <>
                            <View style={styles.sectionRow}>
                                <Text style={styles.section}>Past Predictions</Text>
                                <TouchableOpacity onPress={() => router.push('/predict/past')}>
                                    <Text style={styles.sectionAction}>See all</Text>
                                </TouchableOpacity>
                            </View>
                            {data.past.slice(0, 3).map((p) => (
                                <PastPredictionRow
                                    key={p.id}
                                    item={p}
                                    betterWhen={betterWhenOf(p.metric)}
                                    onOpen={() => router.push(`/predict/${p.id}`)}
                                />
                            ))}
                        </>
                    ) : null}

                    {/* ── Recommended professionals ────────────────────────────── */}
                    {data?.professionals.length ? (
                        <>
                            <Text style={styles.section}>Recommended Professionals</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.rail}
                            >
                                {data.professionals.map((p) => (
                                    <Pressable
                                        key={p.id}
                                        style={styles.pro}
                                        onPress={() => router.push({
                                            pathname: '/professionalDetails',
                                            params: { id: p.id },
                                        } as never)}
                                        accessibilityRole="button"
                                    >
                                        <Avatar uri={p.image} initials={initialsOf(p.name)} size={56} />
                                        <Text style={styles.proName} numberOfLines={1}>{p.name}</Text>
                                        <Text style={styles.proSpec} numberOfLines={1}>{p.speciality}</Text>
                                        {/* No star rating: nothing models patient reviews of a
                                            clinician, and drawing stars with no data behind them
                                            is the dummy control this app keeps removing. */}
                                        <Text style={styles.proRate}>£{p.hourlyRate}/hr</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </>
                    ) : null}

                    <PredictionDisclaimer text={data?.disclaimer ?? ''} tone="card" />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: Spacing.xxxl },

    hero: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    heroTop: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    },
    heroTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },

    statRow: { flexDirection: 'row', gap: Spacing.xxl, marginBottom: Spacing.lg },
    statBlock: { flex: 1 },
    statValue: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.white },
    statValueMuted: { fontSize: 26, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.55)' },
    statLabel: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, paddingVertical: 15, borderRadius: Radius.lg,
        ...Shadow.card,
    },
    ctaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    body: { padding: Spacing.lg, gap: 0 },

    accuracy: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.successSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.lg,
    },
    accuracyText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: Fonts.medium, color: Palette.text },

    section: {
        fontSize: 16, fontFamily: Fonts.bold, color: Palette.text,
        marginTop: Spacing.lg, marginBottom: Spacing.md,
    },
    sectionRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    sectionAction: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    scoreCard: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },
    scoreHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
    scoreValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    scoreValue: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text },
    scoreUnit: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary },
    scoreCaption: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
    scoreOpen: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.text,
        alignItems: 'center', justifyContent: 'center',
    },

    empty: {
        alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
    },
    emptyTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
    },
    emptyCta: {
        marginTop: Spacing.sm, backgroundColor: Palette.primary,
        paddingHorizontal: Spacing.xl, paddingVertical: 11, borderRadius: Radius.lg,
    },
    emptyCtaText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },

    rail: { gap: Spacing.md, paddingRight: Spacing.lg },
    pro: {
        width: 140, alignItems: 'center', gap: 4, padding: Spacing.md,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
    },
    proName: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 6 },
    proSpec: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    proRate: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.primary, marginTop: 2 },
});
