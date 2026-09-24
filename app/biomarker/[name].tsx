/**
 * One biomarker over time.
 *
 * Answers the question the product exists for: is this going up or down, and is that a
 * problem for *me*? The chart shades the person's own reference band — gene-adjusted where
 * their DNA report warrants it — so the answer is visible rather than calculated.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TrendChart from '@/components/TrendChart';
import { getBiomarkerTrend, FLAG_META, formatValue, explainFlag, medicalName } from '@/lib/biomarkers';
import type { BiomarkerTrend } from '@/types/api';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function BiomarkerTrendScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { name } = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const [trend, setTrend] = useState<BiomarkerTrend | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setTrend(await getBiomarkerTrend(String(name)));
        } catch {
            setTrend(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [name]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View></SafeAreaView>;
    }

    const series = trend?.series ?? [];
    const latest = series[series.length - 1];
    const meta = latest ? FLAG_META[latest.flag] : FLAG_META.unknown;
    const summary = trend?.summary;
    const explainer = trend?.explainer;
    // The direction that actually applies to this person's latest value, so the card leads
    // with the answer to "is this bad" rather than making them read both possibilities.
    const meaning = latest && explainer ? explainFlag({ explainer, flag: latest.flag }) : null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {medicalName({
                            explainer,
                            displayName: trend?.displayName,
                            name: trend?.name || String(name),
                        })}
                    </Text>
                    {!!explainer?.plainName && (
                        <Text style={styles.headerSub} numberOfLines={1}>{explainer.plainName}</Text>
                    )}
                </View>
                <View style={styles.backButton} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
                {!series.length ? (
                    <View style={styles.empty}>
                        <Ionicons name="analytics-outline" size={40} color={tone('#D1D5DB')} />
                        <Text style={styles.emptyTitle}>No measurements</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.hero}>
                            <View style={styles.heroLeft}>
                                <Text style={styles.heroValue}>{formatValue(latest.value)}</Text>
                                <Text style={styles.heroUnit}>{latest.unit}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroDate}>Measured {fmtDate(latest.measuredAt)}</Text>

                        {/* What this test is, in plain English. It sits above the chart because a
                            trend line for something you cannot name is not worth reading yet. */}
                        {explainer && (
                            <View style={styles.explainer}>
                                <Text style={styles.explainerTitle}>What this measures</Text>
                                <Text style={styles.explainerBody}>{explainer.whatItIs}</Text>
                                <Text style={[styles.explainerBody, styles.explainerSpaced]}>
                                    {explainer.whyItMatters}
                                </Text>

                                {meaning && (
                                    <View style={[styles.meaningBox, { backgroundColor: meta.bg }]}>
                                        <Text style={[styles.meaningTitle, { color: meta.color }]}>
                                            Your result is {meta.label.toLowerCase()}
                                        </Text>
                                        <Text style={styles.explainerBody}>{meaning}</Text>
                                    </View>
                                )}

                                <Text style={styles.explainerNote}>
                                    General information about this test, not advice about your health.
                                    Talk to a doctor about what your result means for you.
                                </Text>
                            </View>
                        )}

                        <View style={styles.chartCard}>
                            <TrendChart
                                points={series.map((s) => ({ value: s.value, measuredAt: s.measuredAt, flag: s.flag }))}
                                range={trend?.range}
                                unit={latest.unit}
                                width={width - 72}
                            />
                        </View>

                        {summary && summary.count > 1 && (
                            <View style={styles.statsRow}>
                                <View style={styles.stat}>
                                    <Text style={styles.statLabel}>Change</Text>
                                    <Text style={styles.statValue}>
                                        {summary.change > 0 ? '+' : ''}{formatValue(summary.change)}
                                    </Text>
                                    <Text style={styles.statSub}>{summary.direction}</Text>
                                </View>
                                <View style={styles.stat}>
                                    <Text style={styles.statLabel}>Range seen</Text>
                                    <Text style={styles.statValue}>
                                        {formatValue(summary.min)}–{formatValue(summary.max)}
                                    </Text>
                                    <Text style={styles.statSub}>{summary.count} readings</Text>
                                </View>
                                <View style={styles.stat}>
                                    <Text style={styles.statLabel}>Out of range</Text>
                                    <Text style={styles.statValue}>{summary.outOfRangeCount}</Text>
                                    <Text style={styles.statSub}>of {summary.count}</Text>
                                </View>
                            </View>
                        )}

                        <Text style={styles.sectionLabel}>History</Text>
                        {[...series].reverse().map((s, i) => {
                            const m = FLAG_META[s.flag];
                            return (
                                <View key={i} style={styles.historyRow}>
                                    <View style={styles.flex}>
                                        <Text style={styles.historyValue}>
                                            {formatValue(s.value)} <Text style={styles.historyUnit}>{s.unit}</Text>
                                        </Text>
                                        <Text style={styles.historyDate}>{fmtDate(s.measuredAt)}</Text>
                                    </View>
                                    <View style={[styles.smallBadge, { backgroundColor: m.bg }]}>
                                        <Text style={[styles.smallBadgeText, { color: m.color }]}>{m.label}</Text>
                                    </View>
                                </View>
                            );
                        })}

                        {latest.flag === 'unknown' && (
                            <View style={styles.notice}>
                                <Ionicons name="information-circle-outline" size={18} color={Palette.textSecondary} />
                                <Text style={styles.noticeText}>
                                    This value is stored but not assessed — we don't hold a reference range for
                                    it, or the unit wasn't recognised. It still appears in your history.
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Palette.text, textAlign: 'center' },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: Palette.text },
    hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    heroLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    heroValue: { fontSize: 40, fontWeight: '700', color: Palette.text },
    heroUnit: { fontSize: 15, color: Palette.textMuted },
    heroDate: { fontSize: 13, color: Palette.textMuted, marginTop: 4, marginBottom: 18 },
    badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    chartCard: { borderWidth: 1, borderColor: Palette.borderLight, borderRadius: 14, padding: 14 },
    headerText: { flex: 1 },
    headerSub: { fontSize: 12, color: Palette.textMuted, textAlign: 'center', marginTop: 1 },
    explainer: { backgroundColor: Palette.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
    explainerTitle: { fontSize: 13, fontWeight: '700', color: Palette.text, marginBottom: 8 },
    explainerBody: { fontSize: 13.5, lineHeight: 20, color: tone('#4B5563') },
    explainerSpaced: { marginTop: 8 },
    meaningBox: { borderRadius: 10, padding: 12, marginTop: 14 },
    meaningTitle: { fontSize: 12.5, fontWeight: '700', marginBottom: 5 },
    explainerNote: { fontSize: 11.5, lineHeight: 17, color: Palette.textMuted, marginTop: 12 },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    stat: { flex: 1, backgroundColor: Palette.surface, borderRadius: 12, padding: 12 },
    statLabel: { fontSize: 11, color: Palette.textMuted, fontWeight: '600' },
    statValue: { fontSize: 17, fontWeight: '700', color: Palette.text, marginTop: 4 },
    statSub: { fontSize: 10, color: Palette.textMuted, marginTop: 2 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: Palette.text, marginTop: 26, marginBottom: 10 },
    historyRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    historyValue: { fontSize: 15, fontWeight: '600', color: Palette.text },
    historyUnit: { fontSize: 12, color: Palette.textMuted, fontWeight: '400' },
    historyDate: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
    smallBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    smallBadgeText: { fontSize: 10, fontWeight: '700' },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: tone('#F9FAFB'), borderRadius: 12, padding: 14, marginTop: 20,
    },
    noticeText: { flex: 1, fontSize: 12, color: Palette.textSecondary, lineHeight: 18 },
}));
