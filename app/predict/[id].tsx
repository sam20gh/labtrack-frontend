/**
 * Prediction Details — the design's frames 9 and 10, one screen with a collapsible hero.
 *
 * ```
 * purple hero        AI-Generated Prediction · the headline · collapse chevron
 * Health Metric      the risks the pattern is associated with, with chance / risk / prevent
 * Summary            the prose, then the contribution strip and one row per component
 * Key Factors        chips
 * Turing AI          suggestions
 * Recommended        clinicians
 * Outcome            what actually happened, once the target date has passed
 * ```
 *
 * Four things worth knowing:
 *
 * 1. **"Chance" is the forecast's own confidence, not a probability of illness.** The kit
 *    prints "Chance 95%" beside "Possible Prediabetes", which reads as a 95% chance of
 *    having prediabetes. It is not: `mergeNarrative` overwrites whatever the model returns
 *    with the interval's confidence, and the label here says what it measures.
 * 2. **The contribution strip is the interval, drawn.** The kit's three empty rectangles
 *    above the component list are unexplained; here they are where the predicted value sits
 *    inside its own low–high band, which is the one thing that strip could usefully be.
 * 3. **The hero collapses rather than scrolling away**, because the headline is the answer
 *    and someone reading the components still wants it in view. The chevron is the design's.
 * 4. **The outcome block only appears once there is a measurement to compare against.** An
 *    unresolved prediction says when it will be checked; it never renders as a miss.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '@/lib/api';
import {
    getPrediction, getPredictableMetrics, getOverview,
    toneColour, confidencePct, formatDate, relativeDay,
    iconFor, METRIC_ROUTE,
    type Prediction, type BetterWhen, type Overview,
} from '@/lib/prediction';
import { ForecastChart } from '@/components/predict/ForecastChart';
import {
    ConfidenceChip, ChangeBadge, BandChip, GeneratedPill, PredictionDisclaimer,
} from '@/components/predict/Chips';
import { Avatar } from '@/components/Avatar';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const RISK_TONE = {
    high: { colour: Palette.danger, bg: Palette.dangerSurface },
    moderate: { colour: Palette.warning, bg: Palette.warningSurface },
    low: { colour: Palette.successDeep, bg: Palette.successSurface },
} as const;

export default function PredictionDetailsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [betterWhen, setBetterWhen] = useState<BetterWhen>(null);
    const [professionals, setProfessionals] = useState<Overview['professionals']>([]);
    const [loading, setLoading] = useState(true);
    const [heroOpen, setHeroOpen] = useState(true);

    const load = useCallback(async () => {
        try {
            const [{ prediction: row }, catalogue, overview] = await Promise.all([
                getPrediction(id),
                getPredictableMetrics().catch(() => ({ metrics: [] })),
                getOverview().catch(() => null),
            ]);
            setPrediction(row);
            setBetterWhen(catalogue.metrics.find((m) => m.key === row.metric)?.betterWhen ?? null);
            setProfessionals(overview?.professionals ?? []);
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

    const { narrative, components, band, resolution } = prediction;
    const primary = components[0];
    const tone = toneColour(primary.direction, betterWhen);
    const chartWidth = width - Spacing.lg * 2 - Spacing.lg * 2;

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
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
                            <Text style={styles.heroTitle}>Prediction Details</Text>
                            <TouchableOpacity
                                onPress={() => router.push({
                                    pathname: '/predict/insight',
                                    params: { metric: prediction.metric, horizon: prediction.horizonId },
                                } as never)}
                                hitSlop={12}
                                accessibilityLabel="Open the insight chart"
                            >
                                <Ionicons name="stats-chart-outline" size={20} color={Palette.white} />
                            </TouchableOpacity>
                        </View>

                        {heroOpen && (
                            <>
                                <GeneratedPill degraded={narrative.degraded} />
                                <Text style={styles.headline}>{narrative.headline}</Text>
                                <Text style={styles.heroMeta}>
                                    {confidencePct(prediction.confidence)} confidence ·{' '}
                                    projected from {primary.basis.points} readings ·{' '}
                                    for {relativeDay(prediction.targetDate)}
                                </Text>
                            </>
                        )}

                        <Pressable
                            onPress={() => setHeroOpen((v) => !v)}
                            style={styles.heroToggle}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel={heroOpen ? 'Collapse the headline' : 'Expand the headline'}
                        >
                            <Ionicons
                                name={heroOpen ? 'chevron-down' : 'chevron-up'}
                                size={22}
                                color="rgba(255,255,255,0.85)"
                            />
                        </Pressable>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {/* ── Outcome, once there is one ───────────────────────────── */}
                    {resolution?.resolvedAt ? (
                        <View style={[
                            styles.outcome,
                            { backgroundColor: resolution.withinInterval ? Palette.successSurface : Palette.warningSurface },
                        ]}>
                            <Ionicons
                                name={resolution.withinInterval ? 'checkmark-circle' : 'alert-circle'}
                                size={20}
                                color={resolution.withinInterval ? Palette.successDeep : Palette.warning}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.outcomeTitle}>
                                    {resolution.withinInterval
                                        ? 'This one landed inside its range'
                                        : 'This one fell outside its range'}
                                </Text>
                                <Text style={styles.outcomeBody}>
                                    You measured {resolution.actual}{prediction.unit ? ` ${prediction.unit}` : ''}
                                    {' '}against a predicted {prediction.display?.range}
                                    {resolution.absErrorPct !== null ? ` — ${resolution.absErrorPct}% out.` : '.'}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {/* ── Risks ────────────────────────────────────────────────── */}
                    {narrative.risks.length ? (
                        <>
                            <Text style={styles.section}>Health Metric Prediction</Text>
                            {narrative.risks.map((risk) => {
                                const rt = RISK_TONE[risk.risk];
                                return (
                                    <View key={risk.label} style={styles.riskCard}>
                                        <View style={styles.riskHead}>
                                            <View style={[styles.riskIcon, { backgroundColor: rt.bg }]}>
                                                <Ionicons name="warning" size={16} color={rt.colour} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.riskLabel}>{risk.label}</Text>
                                                <Text style={styles.riskDetail}>{risk.detail}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.riskStats}>
                                            <View style={styles.riskStat}>
                                                {/* Not "chance of having this". The forecast's own
                                                    confidence, labelled as such. */}
                                                <Text style={styles.riskStatLabel}>Forecast confidence</Text>
                                                <Text style={styles.riskStatValue}>
                                                    {risk.chance !== null ? confidencePct(risk.chance) : '—'}
                                                </Text>
                                            </View>
                                            <View style={styles.riskStat}>
                                                <Text style={styles.riskStatLabel}>Signal</Text>
                                                <Text style={[styles.riskStatValue, { color: rt.colour }]}>
                                                    {risk.risk[0].toUpperCase()}{risk.risk.slice(1)}
                                                </Text>
                                            </View>
                                            <View style={styles.riskStat}>
                                                <Text style={styles.riskStatLabel}>Preventable</Text>
                                                <Text style={styles.riskStatValue}>
                                                    {risk.preventable ? 'Yes' : 'Unclear'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                            <Text style={styles.riskFooter}>
                                These are patterns associated with this trajectory. They are not a diagnosis
                                and nothing here has been reviewed by a clinician.
                            </Text>
                        </>
                    ) : null}

                    {/* ── Summary and components ───────────────────────────────── */}
                    <Text style={styles.section}>Summary</Text>
                    <Text style={styles.summary}>{narrative.summary}</Text>

                    <View style={styles.componentCard}>
                        {/* The contribution strip: where the point estimate sits inside its own
                            predicted range, per component. */}
                        <View style={styles.strip}>
                            {components.map((c) => {
                                const span = c.high - c.low || 1;
                                const at = Math.min(1, Math.max(0, (c.point - c.low) / span));
                                return (
                                    <View key={c.key} style={styles.stripCell}>
                                        <View style={styles.stripTrack}>
                                            <View style={[styles.stripFill, { width: `${at * 100}%`, backgroundColor: tone }]} />
                                        </View>
                                        <Text style={styles.stripLabel}>{c.label}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {components.map((c, i) => {
                            const note = narrative.componentNotes.find((n) => n.component === c.key)?.note;
                            return (
                                <View key={c.key} style={[styles.componentRow, i > 0 && styles.componentRowDivided]}>
                                    <View style={styles.componentHead}>
                                        <View style={styles.componentName}>
                                            <View style={[styles.dot, { backgroundColor: toneColour(c.direction, betterWhen) }]} />
                                            <Text style={styles.componentLabel}>{c.label}</Text>
                                        </View>
                                        <Text style={styles.componentValue}>
                                            {c.point}{prediction.unit ? prediction.unit : ''}
                                        </Text>
                                    </View>

                                    <View style={styles.componentFoot}>
                                        <Text style={styles.componentNote}>
                                            {note ?? `Predicted between ${c.low} and ${c.high}.`}
                                        </Text>
                                        <ChangeBadge
                                            changePct={c.changePct}
                                            direction={c.direction}
                                            betterWhen={betterWhen}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* The chart. Placed under the numbers rather than above them: the design's
                        details screen leads with the answer, and a chart at the top would make
                        this a second copy of the insight screen. */}
                    <View style={styles.chartCard}>
                        <View style={styles.chartHead}>
                            <Text style={styles.chartTitle}>Measured, then projected</Text>
                            <ConfidenceChip value={prediction.confidence} compact />
                        </View>
                        <ForecastChart
                            history={prediction.series.history}
                            projected={prediction.series.projected}
                            width={chartWidth}
                            height={200}
                            tone={tone}
                            showSecondary={components.length > 1}
                            unit={prediction.unit ?? undefined}
                        />
                    </View>

                    {/* ── Key factors ──────────────────────────────────────────── */}
                    {narrative.keyFactors.length ? (
                        <>
                            <Text style={styles.section}>Key Factors</Text>
                            <View style={styles.chips}>
                                {narrative.keyFactors.map((k) => (
                                    <View key={k} style={styles.chip}>
                                        <Text style={styles.chipText}>{k}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {/* ── Suggestions ──────────────────────────────────────────── */}
                    {narrative.suggestions.length ? (
                        <>
                            <Text style={styles.section}>What you can do</Text>
                            <View style={styles.suggestions}>
                                {narrative.suggestions.map((s) => (
                                    <View key={s} style={styles.suggestion}>
                                        <Ionicons name="checkmark-circle" size={18} color={Palette.successDeep} />
                                        <Text style={styles.suggestionText}>{s}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {/* ── Provenance ───────────────────────────────────────────── */}
                    <View style={styles.provenance}>
                        <Text style={styles.provenanceTitle}>What this rests on</Text>
                        <ProvenanceRow label="Readings used" value={String(primary.basis.points)} />
                        <ProvenanceRow label="History span" value={`${Math.round(primary.basis.spanDays)} days`} />
                        <ProvenanceRow
                            label="Most recent reading"
                            value={`${primary.basis.lastValue}${prediction.unit ? ` ${prediction.unit}` : ''}, `
                                + `${Math.round(primary.basis.staleDays)} days ago`}
                        />
                        <ProvenanceRow label="Run on" value={formatDate(prediction.generatedAt)} />
                        <ProvenanceRow
                            label="Written by"
                            value={narrative.degraded ? 'The forecast alone (no model available)' : narrative.model ?? '—'}
                        />
                        {band ? <View style={{ marginTop: Spacing.sm }}><BandChip band={band} /></View> : null}
                    </View>

                    <TouchableOpacity
                        style={styles.trackerCta}
                        onPress={() => router.push((METRIC_ROUTE[prediction.metric] ?? '/metrics') as never)}
                        accessibilityRole="button"
                    >
                        <Ionicons name={iconFor(prediction.metric)} size={18} color={Palette.primary} />
                        <Text style={styles.trackerCtaText}>Open the {prediction.metricLabel.toLowerCase()} tracker</Text>
                        <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                    </TouchableOpacity>

                    {/* ── Professionals ────────────────────────────────────────── */}
                    {professionals.length ? (
                        <>
                            <Text style={styles.section}>Recommended Professionals</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                                {professionals.map((p) => (
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
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </>
                    ) : null}

                    <PredictionDisclaimer text={prediction.disclaimer} tone="card" />
                </View>
            </ScrollView>
        </View>
    );
}

const ProvenanceRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.provRow}>
        <Text style={styles.provLabel}>{label}</Text>
        <Text style={styles.provValue}>{value}</Text>
    </View>
);

const initialsOf = (name: string) =>
    name.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '').join('') || name[0]?.toUpperCase() || '?';

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: Spacing.xxxl },

    hero: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    heroTop: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    },
    heroTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
    headline: {
        fontSize: 25, lineHeight: 34, fontFamily: Fonts.bold,
        color: Palette.white, marginTop: Spacing.lg,
    },
    heroMeta: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: 'rgba(255,255,255,0.85)', marginTop: Spacing.md,
    },
    heroToggle: { alignItems: 'center', paddingVertical: Spacing.md },

    body: { padding: Spacing.lg },

    outcome: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    },
    outcomeTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text },
    outcomeBody: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: 2,
    },

    section: {
        fontSize: 16, fontFamily: Fonts.bold, color: Palette.text,
        marginTop: Spacing.xl, marginBottom: Spacing.md,
    },

    riskCard: {
        backgroundColor: Palette.surfaceWarm, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginBottom: Spacing.md,
    },
    riskHead: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    riskIcon: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    riskLabel: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    riskDetail: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular,
        color: Palette.textOnWarm, marginTop: 2,
    },
    riskStats: {
        flexDirection: 'row', gap: Spacing.lg,
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    riskStat: { flex: 1, gap: 2 },
    riskStatLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textOnWarm },
    riskStatValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    riskFooter: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: Palette.textMuted, marginTop: -Spacing.xs,
    },

    summary: { fontSize: 14, lineHeight: 22, fontFamily: Fonts.regular, color: Palette.textSecondary },

    componentCard: {
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginTop: Spacing.md,
    },
    strip: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    stripCell: { flex: 1, gap: 5 },
    stripTrack: {
        height: 46, borderRadius: Radius.sm, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.border, overflow: 'hidden', justifyContent: 'flex-end',
    },
    stripFill: { height: '100%', opacity: 0.25 },
    stripLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    componentRow: { gap: 4 },
    componentRowDivided: {
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    componentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    componentName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    componentLabel: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    componentValue: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    componentFoot: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: Spacing.md,
    },
    componentNote: {
        flex: 1, fontSize: 13, lineHeight: 19,
        fontFamily: Fonts.regular, color: Palette.textSecondary,
    },

    chartCard: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginTop: Spacing.lg,
    },
    chartHead: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: Spacing.md,
    },
    chartTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.md, paddingVertical: 8,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },

    suggestions: {
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        padding: Spacing.lg, gap: Spacing.md,
    },
    suggestion: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    suggestionText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: Fonts.regular, color: Palette.text },

    provenance: {
        marginTop: Spacing.xl, backgroundColor: Palette.canvas,
        borderRadius: Radius.lg, padding: Spacing.lg,
    },
    provenanceTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text, marginBottom: Spacing.sm },
    provRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        gap: Spacing.md, paddingVertical: 5,
    },
    provLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    provValue: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, color: Palette.text, textAlign: 'right' },

    trackerCta: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginTop: Spacing.lg, padding: Spacing.lg,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.primaryPale,
        backgroundColor: Palette.primarySurface,
    },
    trackerCtaText: { flex: 1, fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    rail: { gap: Spacing.md, paddingRight: Spacing.lg },
    pro: {
        width: 140, alignItems: 'center', gap: 4, padding: Spacing.md,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
    },
    proName: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 6 },
    proSpec: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
