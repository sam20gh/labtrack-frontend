/**
 * Score Breakdown.
 *
 * The kit's "Turing Score" screen: a gauge, the band the person is in, a per-pillar analysis
 * with bars, and a trend chart underneath.
 *
 * The one thing here the kit does not have is the **provenance chip on every pillar**, and it
 * is the reason the screen exists in this form. The score is now built from what the trackers
 * measured rather than from the health assessment, and a person cannot judge whether to
 * believe a number without knowing which half of it is a measurement and which half is
 * something they typed once during onboarding. So each pillar says which it is, and a pillar
 * still running on an old answer offers the screen that would replace it.
 *
 * `SafeAreaView edges={['top']}` because the tab layout renders no app bar and every screen
 * owns its own top inset.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import {
    getScore, getTrend, recompute, bandMeta, SOURCE_META, PILLAR_ICON, PILLAR_ROUTE,
    type HealthScore, type ScoreTrend, type TrendRange, type Pillar,
} from '@/lib/score';
import ScoreGauge from '@/components/score/ScoreGauge';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const RANGES: { key: TrendRange; label: string }[] = [
    { key: '1w', label: '1w' },
    { key: '1m', label: '1m' },
    { key: '1y', label: '1y' },
    { key: 'all', label: 'All' },
];

/** "3s ago", "12m ago" — the kit's "Last updated" line, which says the number is live. */
const ago = (iso: string) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
};

export default function ScoreBreakdownScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [score, setScore] = useState<HealthScore | null>(null);
    const [trend, setTrend] = useState<ScoreTrend | null>(null);
    const [range, setRange] = useState<TrendRange>('1m');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (r: TrendRange) => {
        const [scoreRes, trendRes] = await Promise.allSettled([getScore(), getTrend(r)]);

        if (scoreRes.status === 'fulfilled') {
            setScore(scoreRes.value);
        } else if (scoreRes.reason instanceof ApiError && scoreRes.reason.isAuthError) {
            router.replace('/(auth)/loginscreen');
            return;
        }
        if (trendRes.status === 'fulfilled') setTrend(trendRes.value);
        setLoading(false);
    }, [router]);

    useFocusEffect(useCallback(() => { load(range); }, [load, range]));

    /**
     * Pull to refresh forces a server-side recalculation rather than re-reading the cached
     * snapshot. Someone who has just finished a run and pulled down is asking for exactly
     * that, and handing them back the same fifteen-minute-old number reads as broken.
     */
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            setScore(await recompute('manual'));
            setTrend(await getTrend(range));
        } catch (err) {
            Toast.show({
                type: 'error',
                text1: 'Could not refresh',
                text2: err instanceof ApiError ? err.message : 'Try again in a moment.',
            });
        } finally {
            setRefreshing(false);
        }
    }, [range]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const band = bandMeta(score?.band ?? null);
    const scored = (score?.pillars ?? []).filter((p) => p.value !== null);
    const missing = (score?.pillars ?? []).filter((p) => p.value === null);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Score Breakdown</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
            >
                <View style={styles.gaugeWrap}>
                    <ScoreGauge
                        value={score?.value ?? null}
                        band={score?.band ?? null}
                        bands={score?.bands ?? []}
                        size={Math.min(240, width - 120)}
                    />
                    {score && (
                        <View style={styles.updatedRow}>
                            <Ionicons name="sync-outline" size={13} color={Palette.textMuted} />
                            <Text style={styles.updatedText}>Last updated: {ago(score.computedAt)}</Text>
                        </View>
                    )}
                    <Text style={styles.headline}>{score?.headline}</Text>
                </View>

                {/*
                  * How much of the number is real.
                  *
                  * The most important sentence on the screen when it is low, and the reason
                  * this is a bar rather than a footnote: a score built mostly from onboarding
                  * answers looks identical to one built from a month of measurements, and
                  * nothing else on the page distinguishes them.
                  */}
                {score?.value !== null && score && (
                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cardTitle}>What this is based on</Text>
                            <Text style={[styles.pct, { color: score.coverage.observedWeight >= 50 ? Palette.primary : Palette.amber }]}>
                                {score.coverage.observedWeight}% measured
                            </Text>
                        </View>
                        <View style={styles.track}>
                            <View style={[styles.fill, {
                                width: `${score.coverage.observedWeight}%`,
                                backgroundColor: score.coverage.observedWeight >= 50 ? Palette.primary : Palette.amber,
                            }]} />
                        </View>
                        <Text style={styles.cardBody}>
                            {score.coverage.observed} of {score.coverage.scored} scored areas come from your
                            devices and logs. The rest come from your health assessment, which counts for
                            less and counts for less still as it ages.
                        </Text>
                        {score.coverage.observedWeight < 50 && (
                            <TouchableOpacity style={styles.inlineAction} onPress={() => router.push('/activity/sources')}>
                                <Ionicons name="watch-outline" size={15} color={Palette.primary} />
                                <Text style={styles.inlineActionText}>Connect a device</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* The kit's band accordion, flattened — three rows is not worth a disclosure. */}
                {score && score.bands.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>What the number means</Text>
                        {score.bands.map((b) => {
                            const current = b.key === score.band;
                            return (
                                <View key={b.key} style={[styles.bandRow, current && styles.bandRowActive]}>
                                    <View style={[styles.bandDot, { backgroundColor: bandMeta(b.key).color }]} />
                                    <Text style={[styles.bandRange, current && styles.bandRangeActive]}>
                                        {b.min} – {b.max}
                                    </Text>
                                    <Text style={[styles.bandLabel, current && styles.bandLabelActive]}>{b.label}</Text>
                                    {current && <Ionicons name="checkmark-circle" size={16} color={band.color} />}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Score Analysis & Profile — the kit's per-pillar bars. */}
                <Text style={styles.sectionTitle}>Score analysis</Text>
                <Text style={styles.sectionBody}>
                    Your score reflects your overall health across labs, activity, sleep, nutrition,
                    medication and mood.
                </Text>

                <View style={styles.card}>
                    {scored.map((p, i) => (
                        <PillarRow
                            key={p.key}
                            pillar={p}
                            last={i === scored.length - 1 && missing.length === 0}
                            onPress={() => {
                                const route = PILLAR_ROUTE[p.key];
                                if (route) router.push(route as never);
                            }}
                        />
                    ))}

                    {/*
                      * Pillars with no data, listed rather than hidden.
                      *
                      * A pillar that silently vanishes is one the person never learns they
                      * could fill, and the score stays lower than it needs to be for a reason
                      * nobody ever surfaced. Same call the medication checker makes when it
                      * names what it could not check instead of passing over it.
                      */}
                    {missing.map((p, i) => (
                        <PillarRow
                            key={p.key}
                            pillar={p}
                            last={i === missing.length - 1}
                            onPress={() => {
                                const route = PILLAR_ROUTE[p.key];
                                if (route) router.push(route as never);
                            }}
                        />
                    ))}
                </View>

                {/* Health Score Trend. */}
                <Text style={styles.sectionTitle}>Health score trend</Text>
                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <View>
                            <Text style={styles.trendValue}>
                                {score?.value ?? '--'}
                                <Text style={styles.trendUnit}> pts</Text>
                            </Text>
                            <Text style={styles.trendBand}>{score?.bandLabel ?? 'Not enough data'}</Text>
                        </View>
                        {trend?.change != null && (
                            <View style={styles.changeChip}>
                                <Ionicons
                                    name={trend.change >= 0 ? 'trending-up' : 'trending-down'}
                                    size={14}
                                    color={trend.change >= 0 ? Palette.success : '#FB7185'}
                                />
                                <Text style={[styles.changeText, { color: trend.change >= 0 ? '#10B981' : '#FB7185' }]}>
                                    {trend.change > 0 ? '+' : ''}{trend.change}%
                                </Text>
                            </View>
                        )}
                    </View>

                    {trend && trend.points.length > 1 ? (
                        <MetricAreaChart
                            points={trend.points.map((p) => ({ day: p.at.slice(0, 10), value: p.value }))}
                            width={width - Spacing.lg * 2 - Spacing.md * 2}
                            height={150}
                            color={Palette.primary}
                            unit="pts"
                            maxXLabels={range === '1w' ? 7 : 6}
                        />
                    ) : (
                        <Text style={styles.empty}>
                            Your trend appears once your score has been calculated on more than one day.
                        </Text>
                    )}

                    <View style={styles.rangeRow}>
                        {RANGES.map((r) => (
                            <TouchableOpacity
                                key={r.key}
                                style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
                                onPress={() => setRange(r.key)}
                            >
                                <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>
                                    {r.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {score?.change && (score.change.improved.length > 0 || score.change.declined.length > 0) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>What moved</Text>
                        {score.change.improved.map((m) => (
                            <View key={m.key} style={styles.moverRow}>
                                <Ionicons name="arrow-up" size={14} color="#10B981" />
                                <Text style={styles.moverLabel}>{m.label}</Text>
                                <Text style={[styles.moverDelta, { color: '#10B981' }]}>+{m.delta}</Text>
                            </View>
                        ))}
                        {score.change.declined.map((m) => (
                            <View key={m.key} style={styles.moverRow}>
                                <Ionicons name="arrow-down" size={14} color="#FB7185" />
                                <Text style={styles.moverLabel}>{m.label}</Text>
                                <Text style={[styles.moverDelta, { color: '#FB7185' }]}>{m.delta}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={styles.disclaimer}>{score?.disclaimer}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

/**
 * One pillar.
 *
 * The provenance chip is the point. `Measured` means a device or a log produced this;
 * `You told us` means it came from the health assessment and will be replaced the moment
 * something measures it. A pillar with no data still renders, carrying the sentence that
 * says how to fill it.
 */
const PillarRow = ({ pillar, last, onPress }: { pillar: Pillar; last: boolean; onPress: () => void }) => {
    const source = SOURCE_META[pillar.source];
    const meta = pillar.band ? bandMeta(pillar.band) : null;

    return (
        <TouchableOpacity
            style={[styles.pillarRow, !last && styles.pillarDivider]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.pillarIcon}>
                <Ionicons name={PILLAR_ICON[pillar.key] as never} size={17} color={Palette.primary} />
            </View>

            <View style={styles.flex}>
                <View style={styles.rowBetween}>
                    <Text style={styles.pillarLabel}>{pillar.label}</Text>
                    <View style={styles.pillarRight}>
                        <View style={[styles.sourceChip, { backgroundColor: `${source.color}18` }]}>
                            <Text style={[styles.sourceText, { color: source.color }]}>{source.label}</Text>
                        </View>
                        <Text style={styles.pillarValue}>{pillar.value ?? '--'}</Text>
                    </View>
                </View>

                <View style={styles.pillarTrack}>
                    <View style={[styles.pillarFill, {
                        width: `${pillar.value ?? 0}%`,
                        backgroundColor: meta?.color ?? Palette.border,
                    }]} />
                </View>

                <Text style={styles.pillarDetail}>{pillar.detail}</Text>
            </View>

            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2, gap: Spacing.md },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },

    gaugeWrap: { alignItems: 'center', paddingVertical: Spacing.md },
    updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md },
    updatedText: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    headline: {
        fontFamily: Fonts.medium,
        fontSize: 15,
        color: Palette.text,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 21,
    },

    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        gap: Spacing.sm,
        ...Shadow.card,
    },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    cardBody: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, lineHeight: 18 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pct: { fontFamily: Fonts.semibold, fontSize: 13 },

    track: { height: 6, borderRadius: 3, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },

    inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    inlineActionText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    bandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: Radius.md,
    },
    bandRowActive: { backgroundColor: Palette.borderLight },
    bandDot: { width: 8, height: 8, borderRadius: 4 },
    bandRange: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary, width: 64 },
    bandRangeActive: { color: Palette.text },
    bandLabel: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted, flex: 1 },
    bandLabelActive: { fontFamily: Fonts.semibold, color: Palette.text },

    sectionTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text, marginTop: Spacing.sm },
    sectionBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 19, marginTop: -4 },

    pillarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    pillarDivider: { borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    pillarIcon: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    pillarLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    pillarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pillarValue: { fontFamily: Fonts.bold, fontSize: 14, color: Palette.text, minWidth: 26, textAlign: 'right' },
    pillarTrack: {
        height: 5, borderRadius: 3,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden', marginTop: 6,
    },
    pillarFill: { height: '100%', borderRadius: 3 },
    pillarDetail: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary, marginTop: 5, lineHeight: 16 },
    sourceChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
    sourceText: { fontFamily: Fonts.medium, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 },

    trendValue: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.text },
    trendUnit: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.textMuted },
    trendBand: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    changeChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    changeText: { fontFamily: Fonts.semibold, fontSize: 13 },
    empty: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted,
        textAlign: 'center', paddingVertical: Spacing.lg, lineHeight: 18,
    },

    rangeRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.xs },
    rangeChip: { flex: 1, paddingVertical: 7, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Palette.borderLight },
    rangeChipActive: { backgroundColor: Palette.primary },
    rangeText: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },
    rangeTextActive: { color: Palette.white },

    moverRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    moverLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.text, flex: 1 },
    moverDelta: { fontFamily: Fonts.semibold, fontSize: 13 },

    disclaimer: {
        fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted,
        lineHeight: 16, textAlign: 'center', marginTop: Spacing.sm,
    },
});
