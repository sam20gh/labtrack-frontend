/**
 * One metric's history.
 *
 * Weight and blood pressure share this screen: a chart, a summary, and the individual entries
 * with a delete. They differ enough in the middle to branch, and not enough to justify two
 * screens that would drift apart on the chrome.
 *
 * **Hydration used to be the third, and is not any more.** `Design/hydration.svg` is five
 * screens — a glass at today's level, a month of ticks, a vessel breakdown, a level ladder,
 * and a per-entry detail — none of which has a counterpart on the other two, and all of which
 * would have been a `kind === 'water'` branch longer than the file it lived in. It lives at
 * `app/metrics/water/` now; `/metrics/water` is a static route and wins over this one without
 * either having to know about the other.
 *
 * The blood-pressure branch carries the one thing the kit's version does not: **the worst
 * reading in the window is shown next to the average**, because an average is precisely the
 * operation that hides a single alarming reading, and this is the screen someone would look at
 * to find one.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import {
    getHistory, deleteLog,
    type MetricHistory, type MetricLog, type LoggableKind,
} from '@/lib/metrics';
import { useUnits, unitLabel, displayWeight, type UnitPrefs } from '@/lib/units';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const META: Record<string, { title: string; unit: string; tint: string; logRoute: string }> = {
    weight: { title: 'Weight', unit: 'kg', tint: '#F59E0B', logRoute: '/metrics/log/weight' },
    'blood-pressure': { title: 'Blood Pressure', unit: 'mmHg', tint: '#7C3AED', logRoute: '/metrics/log/blood-pressure' },
};

const RANGES = [
    { key: 7, label: '1w' },
    { key: 30, label: '1m' },
    { key: 90, label: '3m' },
    { key: 365, label: '1y' },
];

export default function MetricDetailScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { kind } = useLocalSearchParams<{ kind: string }>();
    const meta = META[kind ?? ''] ?? null;
    const units = useUnits();

    /**
     * The unit this screen draws in, and the function that gets a stored value there.
     *
     * Blood pressure has no alternative unit (see `lib/units.ts`), so it falls through to
     * the identity — which is also what any metric added later does until someone teaches
     * `lib/units.ts` about it.
     */
    const shownUnit = kind === 'weight' ? unitLabel('weight', units) : meta?.unit ?? '';
    const toShown = (value: number) => (kind === 'weight' ? displayWeight(value, units) : value);

    const [history, setHistory] = useState<MetricHistory | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (d: number) => {
        if (!meta) { setLoading(false); return; }
        try {
            setHistory(await getHistory(kind as LoggableKind, d));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [kind, meta, router]);

    useFocusEffect(useCallback(() => { load(days); }, [load, days]));

    const remove = useCallback((log: MetricLog) => {
        Alert.alert('Remove this entry?', 'It will be deleted from your record.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteLog(log._id);
                        await load(days);
                        Toast.show({ type: 'success', text1: 'Entry removed' });
                    } catch {
                        Toast.show({ type: 'error', text1: 'Could not remove that entry' });
                    }
                },
            },
        ]);
    }, [days, load]);

    if (!meta) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><Text style={styles.muted}>Unknown metric.</Text></View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const chartWidth = width - Spacing.lg * 2 - Spacing.md * 2;
    const summary = history?.summary;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{meta.title}</Text>
                <TouchableOpacity onPress={() => router.push(meta.logRoute as never)} hitSlop={12}>
                    <Ionicons name="add-circle" size={26} color={meta.tint} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(days); setRefreshing(false); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                {/* Blood pressure leads with the mean AND the worst. */}
                {kind === 'blood-pressure' && summary && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Over {days} days</Text>
                        <Text style={styles.big}>
                            {summary.mean.systolic}/{summary.mean.diastolic}
                            <Text style={styles.bigUnit}> mmHg average</Text>
                        </Text>
                        <View style={[styles.pill, { backgroundColor: `${summary.mean.category.colour}22` }]}>
                            <View style={[styles.dot, { backgroundColor: summary.mean.category.colour }]} />
                            <Text style={[styles.pillText, { color: summary.mean.category.colour }]}>
                                {summary.mean.category.label}
                            </Text>
                        </View>

                        {summary.meanPulse && (
                            <Text style={styles.hint}>Average pulse {summary.meanPulse} bpm.</Text>
                        )}

                        {/*
                          * The worst reading, whenever it was worse than the average. This is
                          * the line that stops a fortnight with one crisis reading in it from
                          * reading as an unremarkable fortnight.
                          */}
                        {summary.worst && summary.worst.category.key !== summary.mean.category.key && (
                            <View style={[styles.worstBox, summary.hadCrisis && styles.worstBoxUrgent]}>
                                <Ionicons
                                    name={summary.hadCrisis ? 'warning' : 'alert-circle-outline'}
                                    size={16}
                                    color={summary.hadCrisis ? '#FFFFFF' : summary.worst.category.colour}
                                />
                                <Text style={[styles.worstText, summary.hadCrisis && styles.worstTextUrgent]}>
                                    Your highest reading was {summary.worst.systolic}/{summary.worst.diastolic} —
                                    {' '}{summary.worst.category.label.toLowerCase()}. An average can hide a reading like that.
                                </Text>
                            </View>
                        )}

                        <Text style={styles.hint}>{summary.note}</Text>
                    </View>
                )}

                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>Trend</Text>
                        <View style={styles.rangeRow}>
                            {RANGES.map((r) => (
                                <TouchableOpacity
                                    key={r.key}
                                    style={[styles.rangeChip, days === r.key && { backgroundColor: meta.tint }]}
                                    onPress={() => setDays(r.key)}
                                >
                                    <Text style={[styles.rangeText, days === r.key && styles.rangeTextActive]}>{r.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {history && history.series.some((p) => p.value !== null) ? (
                        <MetricAreaChart
                            points={history.series.map((p) => ({
                                day: p.day,
                                value: p.value === null ? null : toShown(p.value),
                            }))}
                            width={chartWidth}
                            height={160}
                            color={meta.tint}
                            unit={shownUnit}
                            maxXLabels={days <= 7 ? 7 : 6}
                        />
                    ) : (
                        <Text style={styles.empty}>Nothing logged in this period yet.</Text>
                    )}
                </View>

                <Text style={styles.sectionTitle}>All entries</Text>
                {history?.logs.length ? (
                    <View style={styles.card}>
                        {history.logs.map((log, i) => (
                            <LogRow
                                key={log._id}
                                log={log}
                                kind={kind as string}
                                last={i === history.logs.length - 1}
                                units={units}
                                onDelete={() => remove(log)}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.empty}>No entries yet. Tap + to add one.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const LogRow = ({ log, kind, last, units, onDelete }: {
    log: MetricLog; kind: string; last: boolean; units: UnitPrefs; onDelete: () => void;
}) => {
    const when = new Date(log.measuredAt);
    // Converted for display only — `log.weightKg` and `log.ml` are what the record holds.
    const value = kind === 'weight'
        ? `${displayWeight(log.weightKg as number, units)} ${unitLabel('weight', units)}`
        : `${log.systolic}/${log.diastolic} mmHg`;

    return (
        <View style={[styles.logRow, !last && styles.logDivider]}>
            <View style={styles.flex}>
                <Text style={styles.logValue}>{value}</Text>
                <Text style={styles.logWhen}>
                    {when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {' · '}
                    {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {log.pulse ? ` · ${log.pulse} bpm` : ''}
                </Text>
            </View>

            {/*
              * The category the reading was given when it was taken — read from the stored
              * key, never reclassified. A guideline revision must not silently restage a
              * reading someone was already shown. See `MetricLog.category`.
              */}
            {log.category && (
                <View style={[styles.pill, { backgroundColor: `${log.category.colour}22` }]}>
                    <Text style={[styles.pillText, { color: log.category.colour }]}>{log.category.label}</Text>
                </View>
            )}

            <TouchableOpacity onPress={onDelete} hitSlop={10} accessibilityLabel="Remove entry">
                <Ionicons name="trash-outline" size={17} color={Palette.textMuted} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    muted: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textMuted },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, paddingBottom: Spacing.xl * 2, gap: Spacing.md },

    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    big: { fontFamily: Fonts.bold, fontSize: 30, color: Palette.text },
    bigUnit: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.textMuted },
    hint: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, lineHeight: 16 },

    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
    pillText: { fontFamily: Fonts.semibold, fontSize: 11 },
    dot: { width: 7, height: 7, borderRadius: 4 },

    worstBox: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: Palette.borderLight, borderRadius: Radius.md, padding: Spacing.sm,
    },
    worstBoxUrgent: { backgroundColor: '#DC2626' },
    worstText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: Palette.text, lineHeight: 17 },
    worstTextUrgent: { color: '#FFFFFF' },

    rangeRow: { flexDirection: 'row', gap: 5 },
    rangeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: Palette.borderLight },
    rangeText: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textSecondary },
    rangeTextActive: { color: '#FFFFFF' },

    sectionTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text, marginTop: Spacing.xs },
    empty: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

    logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    logDivider: { borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    logValue: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    logWhen: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: 2 },
});
