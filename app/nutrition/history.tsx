/**
 * Nutrition over the last two weeks.
 *
 * Two bars per day rather than one: calories against target, and how many of that day's
 * meals moved towards the plan. Calories alone cannot show whether the dietary advice is
 * being followed — someone can hit 2,000 kcal every day on exactly the food their plan
 * asked them to cut.
 *
 * Days with nothing logged are drawn as gaps, not zeros. A blank day and a zero-calorie day
 * are not the same claim, and a chart that conflates them makes an honest gap look like
 * starvation.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getHistory } from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionHistoryEntry } from '@/types/api';

const DAYS = 14;

const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

export default function NutritionHistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<NutritionHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await getHistory(DAYS);
            setHistory(data.history || []);
        } catch (error) {
            Alert.alert('Could not load', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Scale to the largest of the target and the biggest day, so an over-target day is not
    // clipped flat against the top of its own chart
    const peak = Math.max(
        1,
        ...history.map((h) => Math.max(h.totals.calories, ('calories' in h.targets ? h.targets.calories : 0) || 0))
    );

    const assessedDays = history.filter((h) => h.adherence.assessed > 0);
    const onPlan = assessedDays.reduce((n, h) => n + h.adherence.aligned + h.adherence.partial, 0);
    const assessed = assessedDays.reduce((n, h) => n + h.adherence.assessed, 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Your nutrition</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            ) : history.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="analytics-outline" size={30} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Not enough data to show nutrition insight</Text>
                    <Text style={styles.emptyBody}>Log your first meal to see your history.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {assessed > 0 && (
                        <View style={styles.summary}>
                            <Text style={styles.summaryValue}>
                                {onPlan}
                                <Text style={styles.summaryOf}> of {assessed}</Text>
                            </Text>
                            <Text style={styles.summaryLabel}>
                                meals in the last {DAYS} days moved you towards your plan
                            </Text>
                        </View>
                    )}

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Daily intake</Text>
                        <View style={styles.chart}>
                            {history.map((entry) => {
                                const target = 'calories' in entry.targets ? entry.targets.calories : 0;
                                const height = Math.max(3, (entry.totals.calories / peak) * 120);
                                const targetY = target ? (target / peak) * 120 : null;
                                const over = target > 0 && entry.totals.calories > target;

                                return (
                                    <View key={entry.day} style={styles.column}>
                                        <View style={styles.barArea}>
                                            {targetY !== null && (
                                                <View style={[styles.targetLine, { bottom: targetY }]} />
                                            )}
                                            <View
                                                style={[
                                                    styles.bar,
                                                    {
                                                        height,
                                                        backgroundColor: over ? Palette.warning : Palette.primary,
                                                    },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.columnLabel} numberOfLines={1}>
                                            {dayLabel(entry.day)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.legend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.swatch, { backgroundColor: Palette.primary }]} />
                                <Text style={styles.legendText}>Within target</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.swatch, { backgroundColor: Palette.warning }]} />
                                <Text style={styles.legendText}>Over</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={styles.legendDash} />
                                <Text style={styles.legendText}>Your target</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Day by day</Text>
                        {history.slice().reverse().map((entry) => (
                            <View key={entry.day} style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowDay}>{dayLabel(entry.day)}</Text>
                                    <Text style={styles.rowMeta}>
                                        {entry.mealCount} {entry.mealCount === 1 ? 'meal' : 'meals'}
                                        {entry.adherence.assessed > 0
                                            ? ` · ${entry.adherence.aligned + entry.adherence.partial} towards your plan`
                                            : ''}
                                    </Text>
                                </View>
                                <Text style={styles.rowValue}>
                                    {Math.round(entry.totals.calories).toLocaleString()}
                                    <Text style={styles.rowUnit}> kcal</Text>
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xxxl },

    empty: { alignItems: 'center', gap: Spacing.sm, marginTop: 100, paddingHorizontal: Spacing.xxl },
    emptyTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text, textAlign: 'center' },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary },

    summary: { backgroundColor: Palette.primarySurface, borderRadius: Radius.lg, padding: Spacing.lg },
    summaryValue: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.primaryDark },
    summaryOf: { fontFamily: Fonts.regular, fontSize: 15, color: Palette.primaryDark },
    summaryLabel: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.text, marginTop: 2 },

    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
    },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text, marginBottom: Spacing.lg },

    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    column: { flex: 1, alignItems: 'center' },
    barArea: { height: 120, width: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 3, minHeight: 3 },
    targetLine: {
        position: 'absolute',
        left: -2,
        right: -2,
        height: 1,
        backgroundColor: Palette.textMuted,
        opacity: 0.6,
    },
    columnLabel: {
        fontFamily: Fonts.regular,
        fontSize: 9,
        color: Palette.textMuted,
        marginTop: Spacing.sm,
    },

    legend: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    swatch: { width: 10, height: 10, borderRadius: 2 },
    legendDash: { width: 12, height: 1, backgroundColor: Palette.textMuted },
    legendText: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    rowDay: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    rowMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    rowValue: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    rowUnit: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
});
