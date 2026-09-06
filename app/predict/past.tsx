/**
 * Past Predictions — the design's frame 15.
 *
 * The design's rows show what was claimed. These also show whether it happened, because the
 * interval is stored and `resolveDue` fills the outcome in once the target date arrives with
 * a reading to check against. A list of things the app once said, with no record of whether
 * any of them came true, is marketing rather than a feature.
 *
 * Grouped by metric behind a filter rather than by date, because "how have my blood-pressure
 * predictions gone" is the question people actually bring here.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    listPredictions, getPredictableMetrics,
    type Prediction, type PredictableMetric, type MetricKey,
} from '@/lib/prediction';
import { PastPredictionRow } from '@/components/predict/PredictionCards';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function PastPredictionsScreen() {
    const router = useRouter();

    const [rows, setRows] = useState<Prediction[]>([]);
    const [catalogue, setCatalogue] = useState<PredictableMetric[]>([]);
    const [filter, setFilter] = useState<MetricKey | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [{ predictions }, cat] = await Promise.all([
                listPredictions(undefined, 50),
                getPredictableMetrics().catch(() => ({ metrics: [] as PredictableMetric[] })),
            ]);
            setRows(predictions);
            setCatalogue(cat.metrics);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Only metrics that actually appear, so the filter never offers an empty result. */
    const present = useMemo(
        () => [...new Set(rows.map((r) => r.metric))],
        [rows],
    );

    const visible = filter === 'all' ? rows : rows.filter((r) => r.metric === filter);

    const betterWhenOf = (metric: MetricKey) =>
        catalogue.find((m) => m.key === metric)?.betterWhen ?? null;

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

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <Text style={styles.title}>Past Predictions</Text>
                <Text style={styles.subtitle}>Everything we have projected, and how it turned out.</Text>

                {present.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                        <Filter label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                        {present.map((key) => (
                            <Filter
                                key={key}
                                label={rows.find((r) => r.metric === key)!.metricLabel}
                                active={filter === key}
                                onPress={() => setFilter(key)}
                            />
                        ))}
                    </ScrollView>
                )}

                {visible.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="time-outline" size={28} color={Palette.textMuted} />
                        <Text style={styles.emptyText}>Nothing predicted yet.</Text>
                        <TouchableOpacity
                            style={styles.emptyCta}
                            onPress={() => router.push('/predict/select')}
                            accessibilityRole="button"
                        >
                            <Text style={styles.emptyCtaText}>Run your first prediction</Text>
                        </TouchableOpacity>
                    </View>
                ) : visible.map((p) => (
                    <PastPredictionRow
                        key={p.id}
                        item={{
                            id: p.id,
                            metric: p.metric,
                            metricLabel: p.metricLabel,
                            unit: p.unit,
                            generatedAt: p.generatedAt,
                            targetDate: p.targetDate,
                            horizonLabel: p.horizonLabel,
                            display: p.display,
                            direction: p.components[0]?.direction ?? 'flat',
                            changePct: p.components[0]?.changePct ?? null,
                            band: p.band,
                            confidence: p.confidence,
                            resolution: p.resolution,
                            spark: p.series.projected.map((s) => s.value),
                        }}
                        betterWhen={betterWhenOf(p.metric)}
                        onOpen={() => router.push(`/predict/${p.id}`)}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const Filter = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
        style={[styles.filter, active && styles.filterActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        marginTop: Spacing.xs, marginBottom: Spacing.lg,
    },
    filters: { gap: Spacing.sm, paddingBottom: Spacing.lg },
    filter: {
        paddingHorizontal: Spacing.lg, paddingVertical: 8,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
    },
    filterActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    filterText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    filterTextActive: { color: Palette.white, fontFamily: Fonts.semibold },
    empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary },
    emptyCta: {
        backgroundColor: Palette.primary, paddingHorizontal: Spacing.xl,
        paddingVertical: 12, borderRadius: Radius.lg,
    },
    emptyCtaText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
});
