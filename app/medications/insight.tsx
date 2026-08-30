/**
 * Medication insight — how the last month actually went.
 *
 * The design's Insight frame with its "most consumed" card and weekday bar chart. One
 * change: the design leads with a count ("You logged this medication 200x"), which rewards
 * taking more of something. This leads with adherence — whether the person took what they
 * were meant to — because that is the number their results depend on and the one a clinician
 * would ask about.
 *
 * Every rate here is null-aware. A person whose doses have not come due yet sees "—", never
 * a zero, for the reason `medicationSchedule.adherence` returns null: 0% tells someone they
 * failed at something that has not happened.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getInsight, WEEKDAY_NAMES } from '@/lib/medications';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationInsight } from '@/types/api';

const RANGES = [7, 30, 90];

export default function InsightScreen() {
    const router = useRouter();
    const [days, setDays] = useState(30);
    const [data, setData] = useState<MedicationInsight | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getInsight(days));
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const peak = data
        ? Math.max(1, ...data.weekdays.map((w) => w.taken + w.late + w.missed))
        : 1;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Insight</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.rangeRow}>
                {RANGES.map((r) => (
                    <TouchableOpacity
                        key={r}
                        style={[styles.range, days === r && styles.rangeActive]}
                        onPress={() => setDays(r)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.rangeText, days === r && styles.rangeTextActive]}>
                            {r} days
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            ) : !data || data.adherence.assessed === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="bar-chart-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Nothing to show yet</Text>
                    <Text style={styles.emptyBody}>
                        Once doses start coming due and you record them, this is where the
                        pattern shows up.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Adherence leads, not a count of tablets taken. */}
                    <View style={styles.headline}>
                        <Text style={styles.headlineValue}>
                            {data.adherence.score === null ? '—' : `${data.adherence.score}%`}
                        </Text>
                        <Text style={styles.headlineLabel}>
                            of due doses taken over {data.days} days
                        </Text>
                    </View>

                    <View style={styles.statRow}>
                        <StatCard value={data.adherence.onTime} label="On time" colour={Palette.success} />
                        <StatCard value={data.adherence.late} label="Late" colour={Palette.warning} />
                        <StatCard value={data.adherence.missed} label="Missed" colour={Palette.danger} />
                    </View>

                    {/* Weekday pattern — the point is spotting a day that consistently slips */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>By day of the week</Text>
                        <View style={styles.chart}>
                            {data.weekdays.map((w, i) => {
                                const total = w.taken + w.late + w.missed;
                                return (
                                    <View key={i} style={styles.chartCol}>
                                        <View style={styles.chartStack}>
                                            {w.missed ? (
                                                <View style={[styles.bar, { height: `${(w.missed / peak) * 100}%`, backgroundColor: Palette.danger }]} />
                                            ) : null}
                                            {w.late ? (
                                                <View style={[styles.bar, { height: `${(w.late / peak) * 100}%`, backgroundColor: Palette.warning }]} />
                                            ) : null}
                                            {w.taken ? (
                                                <View style={[styles.bar, { height: `${(w.taken / peak) * 100}%`, backgroundColor: Palette.primary }]} />
                                            ) : null}
                                            {total === 0 ? <View style={styles.barEmpty} /> : null}
                                        </View>
                                        <Text style={styles.chartLabel}>{WEEKDAY_NAMES[i].slice(0, 1)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.legend}>
                            <Legend colour={Palette.primary} label="On time" />
                            <Legend colour={Palette.warning} label="Late" />
                            <Legend colour={Palette.danger} label="Missed" />
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Each medicine</Text>
                        <View style={{ gap: Spacing.md }}>
                            {data.perMedication.map((m) => (
                                <TouchableOpacity
                                    key={m.medicationId}
                                    style={styles.medRow}
                                    onPress={() => router.push(`/medications/${m.medicationId}`)}
                                    activeOpacity={0.75}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.medName}>{m.name}</Text>
                                        {m.plainName ? <Text style={styles.medPlain}>{m.plainName}</Text> : null}
                                        <View style={styles.track}>
                                            <View style={[
                                                styles.trackFill,
                                                { width: `${m.adherence.score ?? 0}%` },
                                            ]} />
                                        </View>
                                    </View>
                                    <Text style={styles.medScore}>
                                        {m.adherence.score === null ? '—' : `${m.adherence.score}%`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/*
                      Why this number is worth keeping honest. Framed as useful rather than
                      as a scolding — someone who under-reports to protect a percentage has
                      made the record worthless, which is the failure mode that matters.
                    */}
                    <Text style={styles.footer}>
                        This is only as accurate as what you record. A missed dose logged
                        honestly is far more useful than a perfect score — it is what tells
                        you and your doctor whether a treatment has really been tried.
                    </Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const StatCard = ({ value, label, colour }: { value: number; label: string; colour: string }) => (
    <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: colour }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const Legend = ({ colour, label }: { colour: string; label: string }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colour }]} />
        <Text style={styles.legendLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },

    rangeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    range: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
    },
    rangeActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    rangeText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },
    rangeTextActive: { color: Palette.white, fontFamily: Fonts.semibold },

    content: { padding: Spacing.xl, paddingTop: 0, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    headline: { alignItems: 'center', paddingVertical: Spacing.lg },
    headlineValue: { fontSize: 44, color: Palette.text, fontFamily: Fonts.bold },
    headlineLabel: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },

    statRow: { flexDirection: 'row', gap: Spacing.sm },
    statCard: {
        flex: 1, alignItems: 'center', gap: 2,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, paddingVertical: Spacing.lg,
    },
    statValue: { fontSize: 22, fontFamily: Fonts.bold },
    statLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },

    card: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg, gap: Spacing.md,
    },
    cardTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },

    chart: { flexDirection: 'row', height: 120, gap: Spacing.sm, alignItems: 'flex-end' },
    chartCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
    chartStack: { flex: 1, width: '100%', justifyContent: 'flex-end', gap: 2 },
    bar: { width: '100%', borderRadius: 3, minHeight: 3 },
    barEmpty: { width: '100%', height: 3, borderRadius: 3, backgroundColor: Palette.borderLight },
    chartLabel: { fontSize: 10, color: Palette.textSecondary, fontFamily: Fonts.regular },

    legend: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },

    medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    medName: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    medPlain: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    track: { height: 5, borderRadius: 3, backgroundColor: Palette.borderLight, marginTop: 6, overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 3, backgroundColor: Palette.primary },
    medScore: { fontSize: 14, color: Palette.text, fontFamily: Fonts.bold, width: 44, textAlign: 'right' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xxxl },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.semibold },
    emptyBody: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 19 },

    footer: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 17 },
});
