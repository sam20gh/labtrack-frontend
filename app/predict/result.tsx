/**
 * The result card you land on straight after running a prediction — the design's frames 7
 * and 8, which are the same screen in its two tones.
 *
 * ```
 * split chart          measured history | today | the projected band
 * confidence chip      the forecast's own number, with the word that interprets it
 * band                 "Normal Range" / "Hypertension stage 2" — from the same table a
 *                      logged reading is staged by, so a predicted 126/96 can never read
 *                      more leniently than a measured one
 * the range            "126-96 mmHg ± 5"
 * one paragraph        what it rests on
 * Learn More           → the full details
 * Repeat Prediction    → run it again
 * ```
 *
 * **The colour comes from `betterWhen`, not from the direction.** The kit shows one screen
 * green and one red and calls them "Normal Range" and "Below Range"; what actually decides
 * the tone here is whether the movement is good *for this metric*, so a falling blood
 * pressure is green and a falling step count is not — and weight, which has no better
 * direction, is drawn in neither.
 *
 * **"Repeat Prediction" runs a new one and keeps the old.** `Prediction` is append-only, so
 * repeating never overwrites what somebody already read.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getPrediction, getPredictableMetrics, toneColour, bandColour, relativeDay,
    type Prediction, type BetterWhen,
} from '@/lib/prediction';
import { ForecastChart, type ScrubPoint } from '@/components/predict/ForecastChart';
import { ConfidenceChip, PredictionDisclaimer } from '@/components/predict/Chips';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function PredictionResultScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [betterWhen, setBetterWhen] = useState<BetterWhen>(null);
    const [loading, setLoading] = useState(true);
    /** Whichever day the chart handle is over, or null when it is resting on today. */
    const [scrub, setScrub] = useState<ScrubPoint | null>(null);

    const load = useCallback(async () => {
        try {
            const [{ prediction: row }, catalogue] = await Promise.all([
                getPrediction(id),
                getPredictableMetrics().catch(() => ({ metrics: [] })),
            ]);
            setPrediction(row);
            setBetterWhen(catalogue.metrics.find((m) => m.key === row.metric)?.betterWhen ?? null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading || !prediction) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const primary = prediction.components[0];
    const tone = toneColour(primary.direction, betterWhen);
    const chartWidth = width - Spacing.lg * 2 - Spacing.md * 2;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.replace('/predict')} hitSlop={12} accessibilityLabel="Close">
                    <Ionicons name="close" size={22} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>{prediction.metricLabel}</Text>
                <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.chartCard}>
                    <ForecastChart
                        history={prediction.series.history}
                        projected={prediction.series.projected}
                        width={chartWidth}
                        height={190}
                        tone={tone}
                        axis={false}
                        showSecondary={prediction.components.length > 1}
                        bandLabels={{ left: 'Current', right: prediction.horizonLabel.replace('Next ', '') }}
                        scrubbable
                        onScrub={setScrub}
                    />

                    {/*
                      The scrub readout.
                      It reports the interval for that day, not just the point — the same rule
                      the headline follows, and the reason the projected series carries a
                      `low`/`high` per day rather than only at the horizon. A measured day
                      shows no interval, because a reading is not a range.
                    */}
                    {scrub ? (
                        <View style={styles.scrub}>
                            <Text style={styles.scrubDay}>
                                {new Date(`${scrub.day}T00:00:00`).toLocaleDateString(undefined, {
                                    weekday: 'short', day: 'numeric', month: 'short',
                                })}
                                <Text style={styles.scrubKind}>
                                    {scrub.projected ? '  ·  projected' : '  ·  measured'}
                                </Text>
                            </Text>
                            <Text style={[styles.scrubValue, { color: scrub.projected ? tone : Palette.text }]}>
                                {scrub.secondary !== null
                                    ? `${Math.round(scrub.value)}/${Math.round(scrub.secondary)}`
                                    : scrub.value}
                                {prediction.unit ? <Text style={styles.scrubUnit}> {prediction.unit}</Text> : null}
                            </Text>
                            {scrub.projected && scrub.low !== null && scrub.high !== null ? (
                                <Text style={styles.scrubRange}>
                                    range {scrub.low}–{scrub.high}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                </View>

                <View style={styles.chipRow}>
                    <ConfidenceChip value={prediction.confidence} />
                </View>

                <Text style={[styles.band, { color: bandColour(prediction.band) }]}>
                    {prediction.band?.label ?? headingFor(primary.direction, betterWhen)}
                </Text>

                <Text style={styles.range}>
                    {prediction.display?.range}{prediction.unit ? ` ${prediction.unit}` : ''}
                    {'  '}
                    <Text style={styles.rangeMargin}>{prediction.display?.margin}</Text>
                </Text>

                <Text style={styles.body}>
                    {prediction.narrative.summary
                        ?? `Projected from ${primary.basis.points} of your own readings over `
                        + `${Math.round(primary.basis.spanDays)} days, for ${relativeDay(prediction.targetDate)}.`}
                </Text>

                {prediction.band?.crisis ? (
                    <View style={styles.crisis}>
                        <Ionicons name="warning" size={18} color={Palette.danger} />
                        <Text style={styles.crisisText}>
                            A reading in this range needs medical attention. If you measure one, seek care
                            now rather than waiting for this date.
                        </Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={styles.primaryCta}
                    onPress={() => router.push(`/predict/${prediction.id}`)}
                    accessibilityRole="button"
                >
                    <Text style={styles.primaryCtaText}>Learn More</Text>
                    <Ionicons name="arrow-forward" size={17} color={Palette.white} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={() => router.replace({
                        pathname: '/predict/running',
                        params: { metric: prediction.metric, horizon: prediction.horizonId },
                    } as never)}
                    accessibilityRole="button"
                >
                    <Text style={styles.secondaryCtaText}>Repeat Prediction</Text>
                    <Ionicons name="repeat" size={17} color={Palette.primary} />
                </TouchableOpacity>

                <PredictionDisclaimer text={prediction.disclaimer} />
            </ScrollView>
        </SafeAreaView>
    );
}

/**
 * The heading for a metric with no clinical band.
 *
 * Deliberately describes the movement rather than judging it — "Holding steady", "Trending
 * up" — because inventing a band for a step count would be the app setting a target nobody
 * agreed to.
 */
const headingFor = (direction: string, betterWhen: BetterWhen) => {
    if (direction === 'flat') return 'Holding steady';
    if (!betterWhen) return direction === 'rising' ? 'Trending up' : 'Trending down';
    return direction === betterWhen ? 'Moving the right way' : 'Moving the wrong way';
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    topTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, alignItems: 'center' },

    chartCard: {
        alignSelf: 'stretch', padding: Spacing.md,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
    },
    scrub: {
        alignItems: 'center', gap: 1,
        marginTop: Spacing.sm, paddingTop: Spacing.sm,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    scrubDay: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    scrubKind: { fontFamily: Fonts.regular, color: Palette.textMuted },
    scrubValue: { fontSize: 20, fontFamily: Fonts.bold },
    scrubUnit: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    scrubRange: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },

    chipRow: { marginTop: Spacing.xl },
    band: {
        fontSize: 26, fontFamily: Fonts.bold, textAlign: 'center',
        marginTop: Spacing.lg,
    },
    range: {
        fontSize: 17, fontFamily: Fonts.semibold, color: Palette.text,
        textAlign: 'center', marginTop: Spacing.xs,
    },
    rangeMargin: { color: Palette.textMuted },
    body: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center', marginTop: Spacing.md,
    },

    crisis: {
        flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch',
        backgroundColor: Palette.dangerSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginTop: Spacing.lg,
    },
    crisisText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Palette.danger },

    primaryCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        alignSelf: 'stretch', backgroundColor: Palette.primary,
        paddingVertical: 16, borderRadius: Radius.lg, marginTop: Spacing.xxl,
    },
    primaryCtaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    secondaryCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: 16,
    },
    secondaryCtaText: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.primary },
});
