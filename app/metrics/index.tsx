/**
 * Health Metrics.
 *
 * The kit's list screen: one card per metric with today's value, a one-line status and a week
 * sparkline. Six metrics, from two different places — weight, blood pressure and hydration are
 * entered by hand; heart rate, sleep and steps come from a health store.
 *
 * The distinction is drawn in the UI rather than hidden. A card carrying `loggable` gets a "+"
 * that opens its form; the others get a "Connect" affordance when they have nothing, because
 * offering someone a form for a number their phone measures is how you end up with a typed
 * step count competing with a measured one.
 *
 * A metric with nothing recorded is still listed. This screen is also how someone learns a
 * metric exists, and a card that appears only after you have used it cannot be the thing that
 * prompts you to.
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
import Svg, { Polyline, Circle } from 'react-native-svg';

import { ApiError } from '@/lib/api';
import {
    getOverview, METRIC_ICON, METRIC_TINT, METRIC_ROUTE, LOG_ROUTE,
    type MetricCard, type MetricsOverview,
} from '@/lib/metrics';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

export default function HealthMetricsScreen() {
    const router = useRouter();
    const [data, setData] = useState<MetricsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await getOverview(7));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
            >
                <Text style={styles.title}>Health Metrics</Text>
                <Text style={styles.subtitle}>Check your health metrics here</Text>

                <TouchableOpacity style={styles.insightBanner} onPress={() => router.push('/metrics/insight')}>
                    <View style={styles.flex}>
                        <Text style={styles.insightTitle}>See your health metric insights</Text>
                        <View style={styles.insightLink}>
                            <Text style={styles.insightLinkText}>Learn more</Text>
                            <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                        </View>
                    </View>
                    <Ionicons name="analytics-outline" size={34} color={Palette.primary} />
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>Overview</Text>

                {data?.metrics.map((m) => (
                    <MetricRow
                        key={m.key}
                        metric={m}
                        onOpen={() => router.push(METRIC_ROUTE[m.key] as never)}
                        onLog={() => {
                            const route = LOG_ROUTE[m.key];
                            if (route) router.push(route as never);
                        }}
                    />
                ))}

                {/*
                  * The kit's privacy line, kept because it is true and because it is the
                  * reassurance people look for on the screen that lists their vitals.
                  */}
                <View style={styles.privacy}>
                    <Ionicons name="lock-closed" size={14} color={Palette.textMuted} />
                    <Text style={styles.privacyText}>
                        Your health metrics are yours. We never sell or share this data.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const MetricRow = ({ metric, onOpen, onLog }: { metric: MetricCard; onOpen: () => void; onLog: () => void }) => {
    const { width } = useWindowDimensions();
    const tint = METRIC_TINT[metric.key];
    const sparkWidth = Math.min(120, Math.max(70, width - 260));
    const hasValue = metric.value !== null;

    return (
        <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.8}>
            <View style={styles.cardTop}>
                <View style={styles.cardLabelRow}>
                    <Ionicons name={METRIC_ICON[metric.key] as never} size={16} color={tint} />
                    <Text style={styles.cardLabel}>{metric.label}</Text>
                    {/*
                      * A crisis-range reading anywhere in the window is surfaced here, not
                      * only on the blood-pressure screen. Someone does not have to have
                      * opened that screen for it to be worth telling them.
                      */}
                    {metric.urgent && (
                        <View style={styles.urgentChip}>
                            <Ionicons name="warning" size={10} color="#FFFFFF" />
                            <Text style={styles.urgentText}>Check</Text>
                        </View>
                    )}
                </View>
                <View style={styles.cardTopRight}>
                    <Text style={styles.cardWhen}>{metric.at ? whenLabel(metric.at) : ''}</Text>
                    <Ionicons name="chevron-forward" size={15} color={Palette.textMuted} />
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.flex}>
                    {hasValue ? (
                        <Text style={styles.cardValue}>
                            {metric.value}
                            <Text style={styles.cardUnit}> {metric.unit}</Text>
                            {metric.target != null && (
                                <Text style={styles.cardTarget}> / {metric.target}</Text>
                            )}
                        </Text>
                    ) : metric.fallback ? (
                        // The onboarding figure, shown but never passed off as a measurement.
                        <View>
                            <Text style={styles.cardValueMuted}>
                                {metric.fallback.value}
                                <Text style={styles.cardUnit}> {metric.unit}</Text>
                            </Text>
                            <Text style={styles.fallbackNote}>From your health assessment</Text>
                        </View>
                    ) : (
                        <Text style={styles.cardValueMuted}>--</Text>
                    )}

                    <Text style={[styles.cardStatus, metric.statusColour ? { color: metric.statusColour } : null]}>
                        {metric.status}
                    </Text>
                </View>

                <Sparkline points={metric.series.map((p) => p.value)} colour={tint} width={sparkWidth} />

                {metric.loggable && (
                    <TouchableOpacity style={[styles.logButton, { backgroundColor: tint }]} onPress={onLog} hitSlop={8}>
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};

/**
 * A week in ~120pt.
 *
 * **Gaps stay gaps.** A day nothing was recorded breaks the line rather than being joined
 * across, for the reason `MetricAreaChart` already documents at length: a straight line
 * through days that never happened reads as steady progress through a week someone spent
 * ill. With one point or none there is nothing honest to draw, so nothing is drawn.
 */
const Sparkline = ({ points, colour, width, height = 34 }: {
    points: (number | null)[]; colour: string; width: number; height?: number;
}) => {
    const values = points.filter((v): v is number => v !== null);
    if (values.length < 2) return <View style={{ width, height }} />;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = width / Math.max(1, points.length - 1);

    // Each unbroken run becomes its own polyline, so a null genuinely interrupts the line.
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    points.forEach((v, i) => {
        if (v === null) { if (run.length) runs.push(run); run = []; return; }
        run.push({ x: i * step, y: height - ((v - min) / span) * (height - 6) - 3 });
    });
    if (run.length) runs.push(run);

    const last = runs[runs.length - 1]?.slice(-1)[0];

    return (
        <Svg width={width} height={height}>
            {runs.filter((r) => r.length > 1).map((r, i) => (
                <Polyline
                    key={i}
                    points={r.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {last && <Circle cx={last.x} cy={last.y} r={3} fill={colour} />}
        </Svg>
    );
};

const whenLabel = (day: string) => {
    const t = new Date(`${day}T00:00:00`).getTime();
    const days = Math.round((Date.now() - t) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    content: { padding: Spacing.lg, paddingTop: 0, paddingBottom: Spacing.xl * 2, gap: Spacing.sm },

    title: { fontFamily: Fonts.bold, fontSize: 28, color: Palette.text },
    subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary, marginBottom: Spacing.sm },

    insightBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: '#F5F3FF',
        borderRadius: Radius.lg, padding: Spacing.md,
        borderWidth: 1, borderColor: '#DDD6FE',
    },
    insightTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, marginBottom: 4 },
    insightLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    insightLinkText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    sectionLabel: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text, marginTop: Spacing.sm },

    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    cardLabel: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    cardWhen: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
    urgentChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill,
    },
    urgentText: { fontFamily: Fonts.semibold, fontSize: 9, color: '#FFFFFF' },

    cardBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardValue: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.text },
    cardValueMuted: { fontFamily: Fonts.bold, fontSize: 24, color: Palette.textMuted },
    cardUnit: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textMuted },
    cardTarget: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted },
    cardStatus: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
    fallbackNote: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },

    logButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

    privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
    privacyText: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, textAlign: 'center', flexShrink: 1 },
});
