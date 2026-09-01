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
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable,
    ActivityIndicator, RefreshControl, useWindowDimensions, LayoutAnimation,
    Platform, UIManager,
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
import {
    getLatestInterpretation, type LatestInterpretation,
} from '@/lib/interpretation';
import ScoreGauge from '@/components/score/ScoreGauge';
import ScoreRadar from '@/components/home/ScoreRadar';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

/**
 * The six the radar plots, in axis order from twelve o'clock.
 *
 * Six rather than the nine that are scored, for the reason the home hero recorded before
 * the radar moved here: a nine-sided polygon at this size is a blob. These are the six the
 * trackers feed, so every dent is one the person can act on today; the list below the
 * radar carries all nine.
 */
const RADAR_PILLARS = ['biomarkers', 'activity', 'sleep', 'nutrition', 'medication', 'vitals'] as const;

const RANGES: { key: TrendRange; label: string }[] = [
    { key: '1w', label: '1w' },
    { key: '1m', label: '1m' },
    { key: '1y', label: '1y' },
    { key: 'all', label: 'All' },
];

// The band accordion animates its disclosure. On Android this opt-in is still required
// even under the New Architecture, and without it the row snaps open with no transition.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    const [analysis, setAnalysis] = useState<LatestInterpretation | null>(null);
    const [range, setRange] = useState<TrendRange>('1m');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [explainerOpen, setExplainerOpen] = useState(false);
    /** Which band row is disclosed. The one the person is in, until they touch another. */
    const [openBand, setOpenBand] = useState<string | null>(null);

    const load = useCallback(async (r: TrendRange) => {
        const [scoreRes, trendRes, analysisRes] = await Promise.allSettled([
            getScore(),
            getTrend(r),
            // A read, not a generate — the recommendations rail below draws the advice the
            // interpretation already wrote. Nothing model-backed is awaited before paint.
            getLatestInterpretation(),
        ]);

        if (scoreRes.status === 'fulfilled') {
            setScore(scoreRes.value);
            // The kit opens the band you are in. Only on first load, so a reader who has
            // opened another row does not have it closed under them on a refocus.
            setOpenBand((prev) => prev ?? scoreRes.value.band);
        } else if (scoreRes.reason instanceof ApiError && scoreRes.reason.isAuthError) {
            router.replace('/(auth)/loginscreen');
            return;
        }
        if (trendRes.status === 'fulfilled') setTrend(trendRes.value);
        if (analysisRes.status === 'fulfilled') setAnalysis(analysisRes.value);
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

    const scored = (score?.pillars ?? []).filter((p) => p.value !== null);
    const missing = (score?.pillars ?? []).filter((p) => p.value === null);

    // Only axes that actually hold a number: a polygon with a spike collapsed to the centre
    // reads as a score of zero rather than as an unmeasured pillar.
    const radarPillars = RADAR_PILLARS
        .map((key) => scored.find((p) => p.key === key))
        .filter((p): p is Pillar => Boolean(p));

    /** The advice the interpretation wrote. Four is a rail; twenty is a list nobody swipes. */
    const lifestyle = (analysis?.interpretation?.lifestyle_recommendations ?? []).slice(0, 4);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>LabTrack Score</Text>
                <TouchableOpacity onPress={() => setExplainerOpen(true)} hitSlop={12} accessibilityLabel="What is the LabTrack score?">
                    <Ionicons name="help-circle-outline" size={24} color={Palette.text} />
                </TouchableOpacity>
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
                        size={Math.min(260, width - 100)}
                        caption="LabTrack Score"
                        onInfo={() => setExplainerOpen(true)}
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

                {/*
                  * The shape of the score — frame 1 of `Design/score.svg`.
                  *
                  * The kit's version overlays three named series (Wellness / Sleep /
                  * Endurance) on one polygon. The engine produces a single set of pillar
                  * values, so this draws one; three would mean inventing two groupings and
                  * the numbers to fill them. Six axes for the reason `RADAR_PILLARS` gives.
                  */}
                {radarPillars.length >= 3 && (
                    <View style={[styles.card, styles.radarCard]}>
                        {/*
                          * The radar's own defaults are white-on-translucent — it was built
                          * for the home hero's purple gradient. On a white card those are
                          * invisible, so the light palette is passed explicitly.
                          *
                          * The width is `size + 88`: the component reserves a 44pt gutter
                          * each side for the axis labels. Sizing off the card's inner width
                          * rather than the screen's keeps "Medication" from being clipped.
                          */}
                        <ScoreRadar
                            pillars={radarPillars}
                            size={Math.max(150, Math.min(220, width - 150))}
                            stroke={Palette.borderSlate}
                            labelColor={Palette.textSecondary}
                            fill={Palette.primary}
                        />
                        <Text style={styles.cardBody}>
                            Each axis is a pillar the trackers feed. A dent is an area to work on — the
                            list below names all of them, with where each number came from.
                        </Text>
                    </View>
                )}

                {/*
                  * The kit's band accordion.
                  *
                  * A disclosure rather than three flat rows, because each band now carries a
                  * paragraph and three paragraphs stacked is a wall nobody reads. The row the
                  * person is in opens by default — that is the one sentence they came for —
                  * and `description` is absent on snapshots written before the server
                  * carried it, in which case the row simply does not open.
                  */}
                {score && score.bands.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>What the number means</Text>
                        {score.bands.map((b) => (
                            <BandRow
                                key={b.key}
                                band={b}
                                current={b.key === score.band}
                                open={openBand === b.key}
                                onToggle={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setOpenBand((prev) => (prev === b.key ? null : b.key));
                                }}
                            />
                        ))}
                    </View>
                )}

                {/* Score Analysis & Profile — the kit's per-pillar bars. */}
                <Text style={styles.sectionTitle}>Score analysis &amp; profile</Text>
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

                {/*
                  * The kit's "AI Recommendations" rail.
                  *
                  * Its cards are photographic, with a "+3 score / 2 tasks / 30m" meta line.
                  * Nothing here models a task, a duration, or the points an action is worth,
                  * and a card promising "+3 score" the engine never awards would be the
                  * first number on this screen that means nothing. So these are the
                  * lifestyle recommendations the interpretation actually wrote, with the
                  * area as the chip — real advice, already on the plan, no invented metrics.
                  */}
                {lifestyle.length > 0 && (
                    <>
                        <View style={styles.sectionRow}>
                            <View style={styles.sectionHeading}>
                                <Ionicons name="sparkles" size={17} color={Palette.primary} />
                                <Text style={styles.sectionTitle}>AI recommendations</Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push('/myplans')} hitSlop={8}>
                                <Text style={styles.seeAll}>See All</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.rail}
                            style={styles.railBleed}
                        >
                            {lifestyle.map((rec) => (
                                <TouchableOpacity
                                    key={`${rec.area}-${rec.recommendation}`}
                                    style={[styles.recCard, { width: Math.min(268, width * 0.72) }]}
                                    onPress={() => router.push('/myplans')}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.recChip}>
                                        <Text style={styles.recChipText}>{rec.area}</Text>
                                    </View>
                                    <Text style={styles.recTitle}>{rec.recommendation}</Text>
                                    {!!rec.rationale && (
                                        <Text style={styles.recBody} numberOfLines={3}>{rec.rationale}</Text>
                                    )}
                                    <View style={styles.recFoot}>
                                        <Ionicons name="calendar-outline" size={14} color={Palette.primary} />
                                        <Text style={styles.recFootText}>On your plan</Text>
                                        <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                )}

                <Text style={styles.disclaimer}>{score?.disclaimer}</Text>
            </ScrollView>

            <ScoreExplainer visible={explainerOpen} onClose={() => setExplainerOpen(false)} />
        </SafeAreaView>
    );
}

/**
 * One band in the accordion.
 *
 * The chevron is drawn only when there is something to disclose. A row whose `description`
 * the server did not send is inert and says so by having no affordance, rather than
 * opening onto nothing.
 */
const BandRow = ({ band, current, open, onToggle }: {
    band: { key: string; label: string; min: number; max: number; description?: string };
    current: boolean;
    open: boolean;
    onToggle: () => void;
}) => {
    const meta = bandMeta(band.key as never);
    const expandable = Boolean(band.description);
    const disclosed = expandable && open;

    return (
        <View style={[styles.bandBlock, current && styles.bandBlockActive]}>
            <TouchableOpacity
                style={styles.bandRow}
                onPress={onToggle}
                disabled={!expandable}
                activeOpacity={0.7}
                accessibilityRole={expandable ? 'button' : undefined}
            >
                <View style={[styles.bandDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.bandRange, current && styles.bandRangeActive]}>
                    {band.min} - {band.max}
                </Text>
                <Text style={[styles.bandLabel, current && styles.bandLabelActive]}>{band.label}</Text>
                {current && <Ionicons name="checkmark-circle" size={16} color={meta.color} />}
                {expandable && (
                    <Ionicons
                        name={disclosed ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={Palette.textMuted}
                    />
                )}
            </TouchableOpacity>

            {disclosed && <Text style={styles.bandBody}>{band.description}</Text>}
        </View>
    );
};

/**
 * "What is the LabTrack score?" — frame 2 of `Design/score.svg`.
 *
 * The kit fronts this with an illustrated AI brain. There is no such asset in the repo and
 * a stock one would be the only decorative image in the app, so the sheet leads with the
 * mark and spends its space on the three things a person actually needs to know: what the
 * number is over, what moves it, and what it is not.
 */
const ScoreExplainer = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
            <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetMark}>
                    <Ionicons name="sparkles" size={26} color={Palette.primary} />
                </View>

                <Text style={styles.sheetTitle}>What is the LabTrack score?</Text>
                <Text style={styles.sheetBody}>
                    One number over everything LabTrack holds for you — your labs, activity, sleep,
                    nutrition, medication and vitals — weighted by how much each one says about your
                    health.
                </Text>

                <View style={styles.sheetPoints}>
                    <SheetPoint
                        icon="pulse-outline"
                        title="Measured beats reported"
                        body="Anything your devices and logs record replaces what you told us at onboarding — it does not average with it."
                    />
                    <SheetPoint
                        icon="remove-circle-outline"
                        title="Blank is not zero"
                        body="A pillar with no data scores nothing and drops out, rather than counting against you."
                    />
                    <SheetPoint
                        icon="medkit-outline"
                        title="Not a diagnosis"
                        body="It summarises your records. Anything that worries you is a conversation with a clinician."
                    />
                </View>

                <TouchableOpacity style={styles.sheetButton} onPress={onClose}>
                    <Text style={styles.sheetButtonText}>Great, thanks!</Text>
                </TouchableOpacity>
            </Pressable>
        </Pressable>
    </Modal>
);

const SheetPoint = ({ icon, title, body }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string;
}) => (
    <View style={styles.sheetPoint}>
        <View style={styles.sheetPointIcon}>
            <Ionicons name={icon} size={16} color={Palette.primary} />
        </View>
        <View style={styles.flex}>
            <Text style={styles.sheetPointTitle}>{title}</Text>
            <Text style={styles.sheetPointBody}>{body}</Text>
        </View>
    </View>
);

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
                    {/* The kit's dot-plus-word status. It replaces nothing — the numeral and
                        the provenance chip both stay, on the line below, because a word on
                        its own cannot say whether it was measured or merely reported. */}
                    <View style={styles.pillarRight}>
                        <View style={[styles.statusDot, { backgroundColor: meta?.color ?? Palette.border }]} />
                        <Text style={[styles.statusText, { color: meta?.color ?? Palette.textMuted }]}>
                            {meta?.label ?? 'No data'}
                        </Text>
                    </View>
                </View>

                <View style={styles.pillarTrack}>
                    <View style={[styles.pillarFill, {
                        width: `${pillar.value ?? 0}%`,
                        backgroundColor: meta?.color ?? Palette.border,
                    }]} />
                </View>

                <View style={styles.pillarFoot}>
                    <View style={[styles.sourceChip, { backgroundColor: `${source.color}18` }]}>
                        <Text style={[styles.sourceText, { color: source.color }]}>{source.label}</Text>
                    </View>
                    <Text style={styles.pillarDetail}>{pillar.detail}</Text>
                    <Text style={styles.pillarValue}>{pillar.value ?? '--'}</Text>
                </View>
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

    bandBlock: { borderRadius: Radius.md, overflow: 'hidden' },
    bandBlockActive: { backgroundColor: Palette.borderLight },
    bandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    bandBody: {
        fontFamily: Fonts.regular,
        fontSize: 12.5,
        lineHeight: 19,
        color: Palette.textSecondary,
        paddingHorizontal: 8,
        paddingBottom: 10,
    },
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
    pillarValue: { fontFamily: Fonts.bold, fontSize: 13, color: Palette.text, minWidth: 24, textAlign: 'right' },
    pillarTrack: {
        height: 5, borderRadius: 3,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden', marginTop: 6,
    },
    pillarFill: { height: '100%', borderRadius: 3 },
    pillarFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    pillarDetail: { flex: 1, fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary, lineHeight: 16 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontFamily: Fonts.semibold, fontSize: 12.5 },
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

    radarCard: { alignItems: 'center', paddingVertical: Spacing.lg },

    sectionRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    seeAll: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    // The rail cancels the ScrollView's own padding so cards bleed to the screen edge and
    // the last one does not look clipped short of it.
    railBleed: { marginHorizontal: -Spacing.lg },
    rail: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
    recCard: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        gap: 8,
        ...Shadow.card,
    },
    recChip: {
        alignSelf: 'flex-start', backgroundColor: Palette.primarySurface,
        borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3,
    },
    recChipText: {
        fontFamily: Fonts.semibold, fontSize: 11, color: Palette.primaryDark,
        textTransform: 'capitalize',
    },
    recTitle: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 21, color: Palette.text },
    recBody: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18, color: Palette.textSecondary },
    recFoot: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: 8,
    },
    recFootText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: Palette.primary },

    // Explainer sheet
    backdrop: {
        flex: 1, backgroundColor: 'rgba(15,23,42,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
    },
    sheet: {
        width: '100%', backgroundColor: Palette.background,
        borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md,
    },
    sheetMark: {
        width: 54, height: 54, borderRadius: Radius.lg, alignSelf: 'center',
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    sheetTitle: {
        fontFamily: Fonts.bold, fontSize: 20, color: Palette.text, textAlign: 'center',
    },
    sheetBody: {
        fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21,
        color: Palette.textSecondary, textAlign: 'center',
    },
    sheetPoints: { gap: Spacing.md, marginTop: Spacing.xs },
    sheetPoint: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    sheetPointIcon: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    sheetPointTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    sheetPointBody: {
        fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 18,
        color: Palette.textSecondary, marginTop: 2,
    },
    sheetButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
    },
    sheetButtonText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
});
