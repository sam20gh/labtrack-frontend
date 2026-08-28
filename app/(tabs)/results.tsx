/**
 * Results — biomarker grid.
 *
 * Replaces the list of raw test-result cards. A person does not think in reports; they
 * think "how is my iron doing". Out-of-range values sort to the top, each row carries its
 * movement since the previous measurement, and tapping opens the trend.
 *
 * Uploaded reports remain reachable underneath, since the documents themselves still
 * matter for provenance.
 *
 * Two things earn the pixels a plain list would not spend, and both come from data this
 * endpoint already returns — no extra requests:
 *
 *  - **A gauge on every row.** `appliedRange` plus `previous` is exactly the turing kit's
 *    old/new track. A ferritin of 26 means nothing; 26 sitting just under the left edge of
 *    a person's own band, having moved inward from 19, means something at a glance.
 *  - **A movement chart.** The one question a list cannot answer is "am I getting better".
 *    Percent change is the only unit under which ferritin and HbA1c can share an axis, and
 *    the axis is direction-of-good, not up-and-down: rising is improvement when you were
 *    low and the opposite when you were high.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, UIManager,
    TouchableOpacity, RefreshControl, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { getLatestBiomarkers, FLAG_META, byClinicalPriority, describeMovement, formatValue } from '@/lib/biomarkers';
import { listGenotypeFiles } from '@/lib/genotype';
import type { BiomarkerSummary, TestResult } from '@/types/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GUTTER = Spacing.xl;
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const isOutOfRange = (b: BiomarkerSummary) => !['normal', 'unknown'].includes(b.flag);

/** Unit-free, so two analytes can share one axis. Null when there is nothing to compare. */
const percentChange = (b: BiomarkerSummary) =>
    b.previous && b.previous.value !== 0
        ? ((b.value - b.previous.value) / Math.abs(b.previous.value)) * 100
        : null;

// ─────────────────────────────────────────────────────────────────────────────
// Range gauge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where a value sits inside the person's own reference band, as a fraction of the track.
 *
 * The band deliberately does *not* fill the track: the margins either side are what let an
 * out-of-range value be drawn outside it rather than pinned to an edge, so "just over" and
 * "far over" look different. Distance outside is measured in band-widths and saturates at
 * one, because past that point the exact multiple stops being the useful information.
 */
function gauge(value: number, min?: number, max?: number) {
    const clamp = (n: number) => Math.max(0.03, Math.min(0.97, n));
    const hasMin = typeof min === 'number';
    const hasMax = typeof max === 'number';

    if (hasMin && hasMax && max! > min!) {
        const w = max! - min!;
        const [s, e] = [0.18, 0.82];
        // Below the floor, the band's own width is the wrong yardstick: ferritin's range is
        // 30–400, so a catastrophic 5 is only 7% of a band-width under the minimum and would
        // draw a hair to the left of "fine". Below, the distance that can exist is bounded by
        // the floor itself, so the smaller of the two is what the excursion is measured in.
        const below = min! > 0 ? Math.min(w, min!) : w;
        if (value < min!) return { start: s, end: e, at: clamp(s * (1 - Math.min(1, (min! - value) / below))) };
        if (value > max!) return { start: s, end: e, at: clamp(e + (1 - e) * Math.min(1, (value - max!) / w)) };
        return { start: s, end: e, at: clamp(s + (e - s) * ((value - min!) / w)) };
    }
    // One-sided analytes: an upper limit with an implied floor of zero, or the reverse.
    if (hasMax && max! > 0) {
        const [s, e] = [0.06, 0.72];
        if (value > max!) return { start: s, end: e, at: clamp(e + (1 - e) * Math.min(1, (value - max!) / max!)) };
        return { start: s, end: e, at: clamp(s + (e - s) * (value / max!)) };
    }
    if (hasMin && min! > 0) {
        const [s, e] = [0.28, 0.94];
        // Headroom runs to three times the floor before it saturates. At one times, every
        // comfortably-sufficient value collapsed onto the same pixel.
        if (value < min!) return { start: s, end: e, at: clamp(s * (1 - Math.min(1, (min! - value) / min!))) };
        return { start: s, end: e, at: clamp(s + (e - s) * Math.min(1, (value - min!) / (min! * 2))) };
    }
    return null;
}

/** Explicit return type: `left`/`right` want RN's `${number}%`, not a bare string. */
const pct = (n: number): `${number}%` => `${Number((n * 100).toFixed(2))}%`;

function RangeGauge({ b }: { b: BiomarkerSummary }) {
    const g = gauge(b.value, b.appliedRange?.min, b.appliedRange?.max);
    if (!g) return null;

    const prev = b.previous ? gauge(b.previous.value, b.appliedRange?.min, b.appliedRange?.max) : null;
    const meta = FLAG_META[b.flag];

    return (
        <View style={styles.gaugeWrap}>
            <View style={styles.gaugeTrack}>
                <View
                    style={[styles.gaugeBand, { left: pct(g.start), right: pct(1 - g.end) }]}
                />
                {/* The previous reading, as a hollow ghost. It is context, not the answer,
                    so it must never out-weigh the current marker. */}
                {prev && (
                    <View style={[styles.gaugeGhost, { left: pct(prev.at) }]} />
                )}
                <View style={[styles.gaugeDot, { left: pct(g.at), backgroundColor: meta.color }]} />
            </View>
            <View style={styles.gaugeScale}>
                <Text style={styles.gaugeBound}>
                    {typeof b.appliedRange?.min === 'number' ? formatValue(b.appliedRange.min) : ''}
                </Text>
                <Text style={styles.gaugeBandLabel}>
                    your range{b.appliedRange?.geneAdjusted ? ' · gene-adjusted' : ''}
                </Text>
                <Text style={styles.gaugeBound}>
                    {typeof b.appliedRange?.max === 'number' ? formatValue(b.appliedRange.max) : ''}
                </Text>
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diverging bars, centred on the last reading. Right is toward the person's range, left is
 * away from it — never up and down, which would mean opposite things on two rows of the
 * same chart.
 *
 * Markers whose movement has no clinical direction are counted below rather than drawn,
 * because a bar on this axis is a claim about better or worse and there is none to make.
 */
function MovementChart({
    items, steady, onPick,
}: {
    items: { b: BiomarkerSummary; change: number; tone: 'good' | 'bad' }[];
    steady: number;
    onPick: (b: BiomarkerSummary) => void;
}) {
    const peak = Math.max(...items.map((i) => Math.abs(i.change)), 1);

    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Since your last test</Text>
            <Text style={styles.chartBlurb}>
                Bars to the right moved toward your range. Length is the size of the change,
                as a percentage.
            </Text>

            <View style={styles.chartRows}>
                {items.map(({ b, change, tone }) => {
                    const good = tone === 'good';
                    // A hairline bar reads as no data rather than as a small change.
                    const w: `${number}%` = `${Math.max(7, (Math.abs(change) / peak) * 100)}%`;
                    const color = good ? Palette.success : Palette.warning;
                    return (
                        <TouchableOpacity
                            key={b._id}
                            style={styles.chartRow}
                            onPress={() => onPick(b)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={
                                `${b.displayName || b.name}, ${Math.abs(change).toFixed(0)} percent `
                                + `${good ? 'toward' : 'away from'} your range`
                            }
                        >
                            <Text style={styles.chartName} numberOfLines={1}>
                                {b.displayName || b.name}
                            </Text>
                            <View style={styles.chartAxis}>
                                <View style={styles.chartHalfLeft}>
                                    {!good && <View style={[styles.chartBar, styles.chartBarLeft, { width: w, backgroundColor: color }]} />}
                                </View>
                                <View style={styles.chartCentre} />
                                <View style={styles.chartHalfRight}>
                                    {good && <View style={[styles.chartBar, styles.chartBarRight, { width: w, backgroundColor: color }]} />}
                                </View>
                            </View>
                            <Text style={[styles.chartValue, { color }]}>
                                {change > 0 ? '+' : '−'}{Math.abs(change).toFixed(0)}%
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Palette.warning }]} />
                    <Text style={styles.legendText}>away from range</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Palette.success }]} />
                    <Text style={styles.legendText}>toward range</Text>
                </View>
            </View>

            {steady > 0 && (
                <Text style={styles.chartFoot}>
                    {steady} other{steady === 1 ? '' : 's'} changed without moving in or out of your range.
                </Text>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'attention' | 'normal';

export default function ResultsScreen() {
    const router = useRouter();
    const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
    const [reports, setReports] = useState<TestResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showReports, setShowReports] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [dna, setDna] = useState<{ _id: string; labName?: string; assayType: string }[]>([]);

    const load = useCallback(async () => {
        try {
            // /test-results is scoped by user_id and rejects anything but the caller's own
            const userId = await getUserId();
            const [{ biomarkers: bs }, reportData, dnaData] = await Promise.all([
                getLatestBiomarkers(),
                userId
                    ? api.get<TestResult[]>(`/test-results?user_id=${userId}`).catch(() => [])
                    : Promise.resolve([] as TestResult[]),
                listGenotypeFiles().catch(() => []),
            ]);
            setBiomarkers(bs || []);
            setReports(Array.isArray(reportData) ? reportData : []);
            setDna(Array.isArray(dnaData) ? dnaData : []);
        } catch (error) {
            if (error instanceof ApiError && !error.isAuthError) {
                Toast.show({ type: 'error', text1: 'Error', text2: error.message });
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const sorted = useMemo(() => [...biomarkers].sort(byClinicalPriority), [biomarkers]);
    const outOfRange = sorted.filter(isOutOfRange);
    const inRange = sorted.filter((b) => b.flag === 'normal');
    const unknown = sorted.filter((b) => b.flag === 'unknown');

    /** Only markers whose movement carries a direction of good are plotted. */
    const movement = useMemo(() => {
        const scored = biomarkers
            .map((b) => {
                const m = describeMovement(b);
                const change = percentChange(b);
                return m && change !== null ? { b, change, tone: m.tone } : null;
            })
            .filter((x): x is { b: BiomarkerSummary; change: number; tone: 'good' | 'bad' | 'neutral' } => x !== null);

        const plotted = scored
            .filter((x): x is { b: BiomarkerSummary; change: number; tone: 'good' | 'bad' } => x.tone !== 'neutral')
            .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
            .slice(0, 6);

        return { plotted, steady: scored.length - plotted.length };
    }, [biomarkers]);

    const latestAt = useMemo(
        () => biomarkers.reduce<string | undefined>(
            (acc, b) => (!acc || b.measuredAt > acc ? b.measuredAt : acc), undefined,
        ),
        [biomarkers],
    );

    const visible = filter === 'attention' ? outOfRange
        : filter === 'normal' ? inRange
            : sorted;

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const tabs: { key: Filter; label: string; n: number }[] = [
        { key: 'all', label: 'All', n: sorted.length },
        { key: 'attention', label: 'Needs attention', n: outOfRange.length },
        { key: 'normal', label: 'In range', n: inRange.length },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <Text style={styles.pageTitle}>Your results</Text>

                {biomarkers.length > 0 && (
                    <LinearGradient
                        colors={Palette.heroGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <View style={styles.heroBadge}>
                            <Ionicons name="flask-outline" size={13} color={Palette.white} />
                            <Text style={styles.heroBadgeText}>
                                Last updated {fmtDate(latestAt)}
                            </Text>
                        </View>

                        <View style={styles.heroFigureRow}>
                            <Text style={styles.heroFigure}>
                                {outOfRange.length || biomarkers.length}
                            </Text>
                            <Text style={styles.heroFigureLabel}>
                                {outOfRange.length
                                    ? `marker${outOfRange.length === 1 ? '' : 's'}\noutside your range`
                                    : `marker${biomarkers.length === 1 ? '' : 's'}\nall inside your range`}
                            </Text>
                        </View>

                        <Text style={styles.heroHeadline}>
                            {outOfRange.length
                                ? 'These are at the top of the list. Tap any marker to see how it has moved.'
                                : 'Nothing here needs your attention today.'}
                        </Text>

                        <View style={styles.heroRule} />

                        <View style={styles.heroStats}>
                            <HeroStat value={outOfRange.length} label="out of range" />
                            <HeroStat value={inRange.length} label="in range" />
                            <HeroStat value={reports.length} label="reports" last />
                        </View>
                    </LinearGradient>
                )}

                {dna.map((d) => (
                    <TouchableOpacity
                        key={d._id}
                        style={styles.dnaCard}
                        onPress={() => router.push(`/dna/${d._id}`)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                    >
                        <View style={styles.dnaIcon}>
                            <Ionicons name="git-branch-outline" size={18} color={Palette.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dnaTitle}>Your DNA results</Text>
                            <Text style={styles.dnaBody}>
                                {d.labName || 'Genetic test'} · some of the ranges below are personalised to it
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Palette.primary} />
                    </TouchableOpacity>
                ))}

                {!biomarkers.length && (
                    <View style={styles.empty}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="analytics-outline" size={34} color={Palette.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No results yet</Text>
                        <Text style={styles.emptyBody}>
                            Scan a lab report or enter values manually, and we&apos;ll track them over time
                            against your personal range.
                        </Text>
                    </View>
                )}

                {movement.plotted.length > 0 && (
                    <MovementChart
                        items={movement.plotted}
                        steady={movement.steady}
                        onPick={(b) => router.push({ pathname: '/biomarker/[name]', params: { name: b.name } })}
                    />
                )}

                {sorted.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabs}
                    >
                        {tabs.filter((t) => t.n > 0 || t.key === 'all').map((t) => (
                            <TouchableOpacity
                                key={t.key}
                                style={[styles.tab, filter === t.key && styles.tabOn]}
                                onPress={() => { ease(); setFilter(t.key); }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: filter === t.key }}
                            >
                                <Text style={[styles.tabText, filter === t.key && styles.tabTextOn]}>
                                    {t.label} {t.n}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {visible.length > 0 && (
                    <View style={styles.card}>
                        {visible.map((b, i) => {
                            const meta = FLAG_META[b.flag];
                            const move = describeMovement(b);
                            return (
                                <TouchableOpacity
                                    key={b._id}
                                    style={[styles.row, i > 0 && styles.rowDivider]}
                                    onPress={() => router.push({ pathname: '/biomarker/[name]', params: { name: b.name } })}
                                    activeOpacity={0.6}
                                    accessibilityRole="button"
                                >
                                    {/* A rail rather than a border: scanning the left edge finds the
                                        out-of-range markers without reading a single label. */}
                                    <View style={[styles.rowRail, { backgroundColor: isOutOfRange(b) ? meta.color : Palette.border }]} />

                                    <View style={styles.rowMain}>
                                        <View style={styles.rowHead}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {b.displayName || b.name}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.valueRow}>
                                            <Text style={styles.value}>{formatValue(b.value)}</Text>
                                            <Text style={styles.unit}>{b.unit}</Text>
                                            {move && (
                                                <Text style={[
                                                    styles.movement,
                                                    move.tone === 'good' && styles.movementGood,
                                                    move.tone === 'bad' && styles.movementBad,
                                                ]}>
                                                    {move.text}
                                                </Text>
                                            )}
                                        </View>

                                        <RangeGauge b={b} />

                                        {b.measurementCount > 1 && (
                                            <Text style={styles.count}>
                                                {b.measurementCount} measurements · tap for the trend
                                            </Text>
                                        )}
                                    </View>

                                    <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} style={styles.rowChevron} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {unknown.length > 0 && filter === 'all' && (
                    <Text style={styles.unknownNote}>
                        {unknown.length} value{unknown.length === 1 ? ' has' : 's have'} no reference range on
                        file, so {unknown.length === 1 ? 'it is' : 'they are'} shown without a verdict.
                    </Text>
                )}

                {reports.length > 0 && (
                    <View style={styles.reportsSection}>
                        <TouchableOpacity
                            style={styles.reportsHeader}
                            onPress={() => { ease(); setShowReports(!showReports); }}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: showReports }}
                        >
                            <Text style={styles.reportsTitle}>Uploaded reports ({reports.length})</Text>
                            <Ionicons name={showReports ? 'chevron-up' : 'chevron-down'} size={18} color={Palette.textMuted} />
                        </TouchableOpacity>
                        {showReports && (
                            <View style={styles.card}>
                                {reports.map((r, i) => (
                                    <View key={r._id} style={[styles.reportRow, i > 0 && styles.rowDivider]}>
                                        <View style={styles.flex}>
                                            <Text style={styles.reportLab}>{r.patient?.lab_name}</Text>
                                            <Text style={styles.reportMeta}>
                                                {r.patient?.test_type} · {fmtDate(r.patient?.date_of_test)}
                                                {r.biomarkerCount ? ` · ${r.biomarkerCount} values` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/add-result')}
                    accessibilityRole="button"
                >
                    <Ionicons name="add" size={20} color={Palette.white} />
                    <Text style={styles.addButtonText}>Add a result</Text>
                </TouchableOpacity>
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const HeroStat = ({ value, label, last }: { value: number; label: string; last?: boolean }) => (
    <View style={[styles.heroStat, !last && styles.heroStatDivider]}>
        <Text style={styles.heroStatValue}>{value}</Text>
        <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.surface },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: Spacing.xxxl + Spacing.sm },
    pageTitle: {
        fontFamily: Fonts.bold, fontSize: 26, color: Palette.text,
        marginHorizontal: GUTTER, marginTop: Spacing.sm, marginBottom: Spacing.lg,
    },

    // Hero
    hero: {
        marginHorizontal: GUTTER, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.card,
    },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
    },
    heroBadgeText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.white, letterSpacing: 0.3 },
    heroFigureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
    heroFigure: { fontFamily: Fonts.bold, fontSize: 46, lineHeight: 50, color: Palette.white },
    heroFigureLabel: {
        flex: 1, fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.92)',
    },
    heroHeadline: {
        fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20,
        color: 'rgba(255,255,255,0.82)', marginTop: Spacing.md,
    },
    heroRule: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: Spacing.lg },
    heroStats: { flexDirection: 'row' },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatDivider: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' },
    heroStatValue: { fontFamily: Fonts.bold, fontSize: 20, color: Palette.white },
    heroStatLabel: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

    // DNA
    dnaCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg,
        padding: Spacing.lg, marginHorizontal: GUTTER, marginTop: Spacing.lg,
    },
    dnaIcon: {
        width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    dnaTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    dnaBody: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 },

    // Empty
    empty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: GUTTER, gap: Spacing.md },
    emptyIcon: {
        width: 64, height: 64, borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    emptyBody: {
        fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 21,
    },

    // Movement chart
    chartCard: {
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        padding: Spacing.lg, ...Shadow.card,
    },
    chartTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    chartBlurb: {
        fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19,
        color: Palette.textSecondary, marginTop: 3,
    },
    chartRows: { marginTop: Spacing.lg, gap: Spacing.sm },
    chartRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    chartName: { width: 78, fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },
    chartAxis: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 18 },
    chartHalfLeft: { flex: 1, alignItems: 'flex-end' },
    chartHalfRight: { flex: 1, alignItems: 'flex-start' },
    chartCentre: { width: 1, height: 18, backgroundColor: Palette.border },
    chartBar: { height: 10 },
    chartBarLeft: { borderTopLeftRadius: Radius.pill, borderBottomLeftRadius: Radius.pill },
    chartBarRight: { borderTopRightRadius: Radius.pill, borderBottomRightRadius: Radius.pill },
    chartValue: { width: 46, textAlign: 'right', fontFamily: Fonts.semibold, fontSize: 12 },
    chartLegend: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: Radius.pill },
    legendText: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    chartFoot: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted,
        lineHeight: 18, marginTop: Spacing.sm,
    },

    // Tabs
    tabs: { paddingHorizontal: GUTTER, gap: Spacing.sm, marginTop: Spacing.xxl, paddingBottom: 2 },
    tab: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, backgroundColor: Palette.borderLight,
    },
    tabOn: { backgroundColor: Palette.text },
    tabText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.textSecondary },
    tabTextOn: { color: Palette.white },

    // Marker rows
    card: {
        marginHorizontal: GUTTER, marginTop: Spacing.lg, backgroundColor: Palette.background,
        borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.lg },
    rowDivider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    rowRail: {
        width: 3, borderRadius: Radius.pill, alignSelf: 'stretch',
        marginRight: Spacing.md, minHeight: 40,
    },
    rowMain: { flex: 1 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowChevron: { marginLeft: Spacing.sm, marginTop: 3 },
    name: { flex: 1, fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 },
    value: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.text },
    unit: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    movement: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.textMuted, marginLeft: 4 },
    movementGood: { color: Palette.success },
    movementBad: { color: Palette.warning },
    count: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.sm },
    badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
    badgeText: { fontFamily: Fonts.semibold, fontSize: 11 },

    // Gauge
    gaugeWrap: { marginTop: Spacing.md },
    gaugeTrack: {
        height: 8, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, justifyContent: 'center',
    },
    gaugeBand: { position: 'absolute', top: 0, bottom: 0, borderRadius: Radius.pill, backgroundColor: Palette.successBand },
    gaugeDot: {
        position: 'absolute', width: 12, height: 12, borderRadius: Radius.pill,
        marginLeft: -6, borderWidth: 2, borderColor: Palette.white,
    },
    gaugeGhost: {
        position: 'absolute', width: 10, height: 10, borderRadius: Radius.pill,
        marginLeft: -5, borderWidth: 2, borderColor: Palette.textMuted, backgroundColor: Palette.white,
    },
    gaugeScale: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    gaugeBound: { width: 40, fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },
    gaugeBandLabel: {
        flex: 1, textAlign: 'center', fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted,
    },
    unknownNote: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, lineHeight: 18,
        marginHorizontal: GUTTER, marginTop: Spacing.md,
    },

    // Reports
    reportsSection: { marginTop: Spacing.xxl },
    reportsHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: GUTTER, paddingVertical: Spacing.md,
    },
    reportsTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.textSecondary },
    reportRow: { flexDirection: 'row', padding: Spacing.lg },
    reportLab: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.text },
    reportMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: 2 },

    addButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, paddingVertical: Spacing.lg,
        borderRadius: Radius.lg, marginHorizontal: GUTTER, marginTop: Spacing.xxl,
    },
    addButtonText: { color: Palette.white, fontFamily: Fonts.semibold, fontSize: 16 },
});
