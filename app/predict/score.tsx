/**
 * LabTrack Score Prediction — the design's frame 3.
 *
 * The kit titles this "Turing Score" throughout; that is the design system's name, not the
 * product's, and nothing user-facing in this app uses it.
 *
 * The score gets its own screen rather than being one more row on the insight screen for the
 * reason it gets its own screen everywhere else in the app: it is the number people check,
 * and it is the only metric whose forecast is naturally read as a band (`80-90 pts`) rather
 * than as a value with an error bar.
 *
 * Like the insight screen this **refits live and writes nothing**. The design's horizon chips
 * are the point of the screen — moving between "Next 1d" and "Next 1y" is browsing, not four
 * predictions somebody made.
 *
 * The two cards under the chart are the design's spO2 / lung pair, filled with whichever
 * *other* metrics this person actually has enough history for. The kit's own pair is
 * placeholder — LabTrack measures neither — and two cards showing metrics nobody tracks
 * would be the dummy control this app keeps removing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getInsight, getPredictableMetrics, iconFor, toneColour,
    type Insight, type PredictableMetric, type Refusal,
} from '@/lib/prediction';
import { BandChart } from '@/components/predict/BandChart';
import { HorizonTabs, ConfidenceChip, BandChip, PredictionDisclaimer } from '@/components/predict/Chips';
import { NotEnoughDataIllustration } from '@/components/predict/NotEnoughDataIllustration';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

/** How many companion cards sit under the chart. Two, as the design draws. */
const COMPANIONS = 2;

export default function ScorePredictionScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [horizon, setHorizon] = useState('1w');
    const [insight, setInsight] = useState<Insight | null>(null);
    const [refusal, setRefusal] = useState<Refusal | null>(null);
    const [companions, setCompanions] = useState<{ metric: PredictableMetric; insight: Insight }[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getInsight('turing_score', horizon);
            if (result.ok) { setInsight(result.data); setRefusal(null); }
            else { setInsight(null); setRefusal(result.refusal); }
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [horizon, router]);

    useEffect(() => { load(); }, [load]);

    // The companions load on their own timeline, after the score has painted. They are two
    // more refits and there is no reason to hold the screen behind them.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { metrics } = await getPredictableMetrics();
                const others = metrics.filter((m) => m.ready && m.key !== 'turing_score').slice(0, COMPANIONS);
                const loaded = await Promise.all(others.map(async (m) => {
                    const id = m.horizons.some((h) => h.id === horizon) ? horizon : m.horizons[0].id;
                    const r = await getInsight(m.key, id);
                    return r.ok ? { metric: m, insight: r.data } : null;
                }));
                if (alive) setCompanions(loaded.filter(Boolean) as { metric: PredictableMetric; insight: Insight }[]);
            } catch { /* a missing companion card costs nothing */ }
        })();
        return () => { alive = false; };
    }, [horizon]);

    const chartWidth = width - Spacing.lg * 2 - Spacing.lg * 2;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>LabTrack Score</Text>
                <TouchableOpacity
                    onPress={() => router.push('/score')}
                    hitSlop={12}
                    accessibilityLabel="Score breakdown"
                >
                    <Ionicons name="options-outline" size={20} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
                ) : refusal ? (
                    <View style={styles.refusal}>
                        <NotEnoughDataIllustration width={250} />
                        <Text style={styles.refusalTitle}>Not enough score history yet</Text>
                        <Text style={styles.refusalBody}>{refusal.message}</Text>
                        <TouchableOpacity
                            style={styles.refusalCta}
                            onPress={() => router.push('/score')}
                            accessibilityRole="button"
                        >
                            <Text style={styles.refusalCtaText}>See your score</Text>
                        </TouchableOpacity>
                    </View>
                ) : insight ? (
                    <>
                        <View style={styles.hero}>
                            <Ionicons name="medkit" size={30} color={Palette.primary} />
                            <Text style={styles.heroValue}>{insight.display.range}</Text>
                            <Text style={styles.heroUnit}>pts</Text>
                        </View>
                        <Text style={styles.heroCaption}>
                            Predicted range for{' '}
                            {insight.horizons.find((h) => h.id === horizon)?.long ?? 'the next week'}
                        </Text>

                        <View style={styles.tabs}>
                            <HorizonTabs horizons={insight.horizons} value={horizon} onChange={setHorizon} />
                        </View>

                        <View style={styles.chartCard}>
                            <BandChart points={insight.series.projected} width={chartWidth} height={210} />
                        </View>

                        <View style={styles.metaRow}>
                            <ConfidenceChip value={insight.confidence} />
                            {insight.band ? <BandChip band={insight.band} /> : null}
                        </View>

                        {companions.length ? (
                            <View style={styles.companionRow}>
                                {companions.map(({ metric, insight: c }) => (
                                    <Pressable
                                        key={metric.key}
                                        style={styles.companion}
                                        onPress={() => router.push({
                                            pathname: '/predict/insight',
                                            params: { metric: metric.key, horizon: c.horizonId },
                                        } as never)}
                                        accessibilityRole="button"
                                    >
                                        <Ionicons
                                            name={iconFor(metric.key)}
                                            size={20}
                                            color={toneColour(c.components[0].direction, metric.betterWhen)}
                                        />
                                        <View style={styles.companionValueRow}>
                                            <Text style={styles.companionValue}>{c.display.range}</Text>
                                            <Text style={styles.companionUnit}>{metric.unit}</Text>
                                        </View>
                                        <Text style={styles.companionCaption}>
                                            {c.horizons.find((h) => h.id === c.horizonId)?.label ?? ''}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={styles.saveCta}
                            onPress={() => router.push({
                                pathname: '/predict/running',
                                params: { metric: 'turing_score', horizon },
                            } as never)}
                            accessibilityRole="button"
                        >
                            <Text style={styles.saveCtaText}>Save this prediction</Text>
                            <Ionicons name="bookmark-outline" size={17} color={Palette.white} />
                        </TouchableOpacity>

                        <PredictionDisclaimer text={insight.disclaimer} />
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { paddingVertical: 80, alignItems: 'center' },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    topTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

    hero: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
    heroValue: { fontSize: 38, fontFamily: Fonts.bold, color: Palette.text },
    heroUnit: { fontSize: 16, fontFamily: Fonts.regular, color: Palette.textSecondary },
    heroCaption: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', marginTop: Spacing.xs,
    },
    tabs: { marginTop: Spacing.xl },
    chartCard: {
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        padding: Spacing.lg, marginTop: Spacing.lg,
    },
    metaRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, marginTop: Spacing.lg, flexWrap: 'wrap',
    },

    companionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
    companion: {
        flex: 1, gap: 6, padding: Spacing.lg,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
    },
    companionValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    companionValue: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text },
    companionUnit: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },
    companionCaption: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    saveCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, paddingVertical: 15,
        borderRadius: Radius.lg, marginTop: Spacing.xxl,
    },
    saveCtaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    refusal: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
    refusalTitle: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    refusalBody: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
    },
    refusalCta: {
        marginTop: Spacing.md, backgroundColor: Palette.primary,
        paddingHorizontal: Spacing.xxl, paddingVertical: 13, borderRadius: Radius.lg,
    },
    refusalCtaText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
});
