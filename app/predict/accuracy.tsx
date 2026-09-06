/**
 * The prediction scorecard.
 *
 * There is no frame for this in the kit, and it is the screen the feature most needs. A
 * predictor that never reports how often it was right is unfalsifiable, and this app has
 * spent a lot of effort elsewhere — `alignment: 'unassessed'`, `adherence: null`,
 * `reviewMetrics` returning null rather than zero — refusing to imply a number it has not
 * earned. The same rule applied to the feature itself means publishing the miss rate.
 *
 * Everything here is null until a prediction has reached its target date *and* there is a
 * measured value on or after it. An unresolved prediction is unresolved, never a miss.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import { getAccuracy, iconFor, type Accuracy } from '@/lib/prediction';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

type Row = { label: string; total: number } & Partial<Accuracy>;

export default function PredictionAccuracyScreen() {
    const router = useRouter();

    const [overall, setOverall] = useState<Accuracy | null>(null);
    const [byMetric, setByMetric] = useState<Record<string, Row>>({});
    const [total, setTotal] = useState(0);
    const [note, setNote] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await getAccuracy();
            setOverall(data.overall);
            setByMetric(data.byMetric);
            setTotal(data.total);
            setNote(data.note);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>How accurate are we?</Text>
                <Text style={styles.subtitle}>
                    Every prediction is checked against what you actually measured on the day it was
                    about. Nothing here is an estimate.
                </Text>

                <View style={styles.headline}>
                    {overall ? (
                        <>
                            <Text style={styles.headlineValue}>{overall.withinIntervalPct}%</Text>
                            <Text style={styles.headlineLabel}>
                                landed inside the range we gave, across {overall.resolved} checked
                                {overall.resolved === 1 ? ' prediction' : ' predictions'}
                            </Text>
                            {overall.medianErrorPct !== null ? (
                                <Text style={styles.headlineSub}>
                                    Typical miss: {overall.medianErrorPct}% away from the value we predicted.
                                </Text>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <Text style={styles.headlineMuted}>—</Text>
                            <Text style={styles.headlineLabel}>{note}</Text>
                        </>
                    )}
                </View>

                {Object.keys(byMetric).length ? (
                    <>
                        <Text style={styles.section}>By metric</Text>
                        {Object.entries(byMetric).map(([key, row]) => (
                            <View key={key} style={styles.row}>
                                <Ionicons name={iconFor(key)} size={18} color={Palette.textSecondary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowLabel}>{row.label}</Text>
                                    <Text style={styles.rowMeta}>
                                        {row.total} run{row.total === 1 ? '' : 's'} ·{' '}
                                        {row.resolved ? `${row.resolved} checked` : 'none checked yet'}
                                    </Text>
                                </View>
                                {/* Null, never zero. "Nothing checked" is not "never right". */}
                                <Text style={styles.rowValue}>
                                    {row.withinIntervalPct !== null && row.withinIntervalPct !== undefined
                                        ? `${row.withinIntervalPct}%`
                                        : '—'}
                                </Text>
                            </View>
                        ))}
                    </>
                ) : null}

                <View style={styles.explainer}>
                    <Text style={styles.explainerTitle}>What "inside the range" means</Text>
                    <Text style={styles.explainerBody}>
                        Every prediction is an interval, not a number. A prediction counts as landing
                        when your next measured reading on or after the target date falls between the
                        low and high figures we published. A narrower range is a stronger claim and is
                        easier to miss, so a high score with wide ranges is not the same as a high
                        score with tight ones.
                    </Text>
                </View>

                <Text style={styles.footer}>
                    {total} prediction{total === 1 ? '' : 's'} run in total.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: Spacing.xs,
    },
    headline: {
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg,
        padding: Spacing.xl, marginTop: Spacing.lg, gap: 4,
    },
    headlineValue: { fontSize: 40, fontFamily: Fonts.bold, color: Palette.text },
    headlineMuted: { fontSize: 40, fontFamily: Fonts.bold, color: Palette.textMuted },
    headlineLabel: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.medium, color: Palette.text },
    headlineSub: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: Spacing.xs,
    },
    section: {
        fontSize: 16, fontFamily: Fonts.bold, color: Palette.text,
        marginTop: Spacing.xl, marginBottom: Spacing.md,
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        padding: Spacing.lg, marginBottom: Spacing.sm,
    },
    rowLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    rowMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    rowValue: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    explainer: {
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        padding: Spacing.lg, marginTop: Spacing.lg, gap: 4,
    },
    explainerTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.text },
    explainerBody: { fontSize: 12, lineHeight: 19, fontFamily: Fonts.regular, color: Palette.textSecondary },
    footer: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted,
        textAlign: 'center', marginTop: Spacing.xl,
    },
});
