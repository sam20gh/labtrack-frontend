/**
 * "Predict Your Health With The Power Of AI" — the design's frame 4, the metric picker.
 *
 * **Every metric appears, including the ones that cannot be predicted yet.** A metric that
 * vanished for want of data would leave somebody with no way to discover that logging it
 * unlocks anything, which is the same argument the home screen's "Get more from LabTrack"
 * rows make. A metric that is not ready is drawn dimmed with the sentence saying what is
 * missing, and tapping it opens that sentence as the design's modal rather than doing
 * nothing.
 *
 * The kit's per-row line is "Up to 5 year prediction / Deviation: 0.022%" on every row, which
 * is placeholder text. Both figures here are real and per-metric: the reach is how far this
 * person's own history can actually support, and the deviation is that series' residual
 * scatter as a share of the reading.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity,
    ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getPredictableMetrics, iconFor, tintFor, tintSurface, METRIC_ROUTE,
    type PredictableMetric, type Refusal,
} from '@/lib/prediction';
import { NotEnoughDataIllustration } from '@/components/predict/NotEnoughDataIllustration';
import { HorizonTabs } from '@/components/predict/Chips';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function SelectMetricScreen() {
    const router = useRouter();

    const [metrics, setMetrics] = useState<PredictableMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [horizon, setHorizon] = useState<Record<string, string>>({});
    const [blocked, setBlocked] = useState<{ label: string; refusal: Refusal; route: string } | null>(null);
    /** The server's threshold, not a copy of it. `MIN_OBSERVATIONS` lives in one place. */
    const [minObservations, setMinObservations] = useState(3);

    const load = useCallback(async () => {
        try {
            const { metrics: rows, minObservations: min } = await getPredictableMetrics();
            setMetrics(rows);
            setMinObservations(min);
            // Default each ready metric to its middle horizon — the design's own default is
            // "Next 1w", and the shortest is rarely what somebody came here to ask.
            setHorizon(Object.fromEntries(
                rows.filter((m) => m.ready)
                    .map((m) => [m.key, m.horizons[Math.min(1, m.horizons.length - 1)].id]),
            ));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const run = (metric: PredictableMetric) => {
        if (!metric.ready) {
            setBlocked({
                label: metric.label,
                refusal: metric.refusal!,
                route: METRIC_ROUTE[metric.key] ?? '/metrics',
            });
            return;
        }
        router.push({
            pathname: '/predict/running',
            params: { metric: metric.key, horizon: horizon[metric.key] ?? metric.horizons[0].id },
        } as never);
    };

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
                <Text style={styles.title}>Predict Your Health{'\n'}With The Power Of AI</Text>
                <Text style={styles.subtitle}>
                    Pick a metric. We project your own readings forward and show the range they
                    are heading for.
                </Text>

                {metrics.map((m) => {
                    const open = expanded === m.key;
                    return (
                        <View key={m.key} style={[styles.row, !m.ready && styles.rowDim]}>
                            <Pressable
                                style={styles.rowHead}
                                onPress={() => (m.ready ? setExpanded(open ? null : m.key) : run(m))}
                                accessibilityRole="button"
                                accessibilityLabel={`${m.label}. ${m.reach}`}
                            >
                                {/* The metric's own colour, matching its card on the metrics
                                    dashboard. A list of eight identical grey glyphs is a list
                                    nobody can scan; the tint is what makes a row findable
                                    before its label has been read. Dimmed, not greyed, when
                                    the metric is not ready — it is the same metric. */}
                                <View
                                    style={[
                                        styles.icon,
                                        { backgroundColor: tintSurface(m.key) },
                                        !m.ready && styles.iconDim,
                                    ]}
                                >
                                    <Ionicons
                                        name={iconFor(m.key)}
                                        size={20}
                                        color={tintFor(m.key)}
                                    />
                                </View>

                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowLabel, !m.ready && styles.dimText]}>{m.label}</Text>
                                    <Text style={styles.rowReach}>{m.reach}</Text>

                                    <View style={styles.metaRow}>
                                        <Ionicons name="stats-chart" size={12} color={Palette.textMuted} />
                                        <Text style={styles.meta}>
                                            {m.deviationPct !== null
                                                ? `Deviation: ${m.deviationPct}%`
                                                : `${m.observations} of ${minObservations} readings`}
                                        </Text>
                                    </View>
                                </View>

                                <Ionicons
                                    name={m.ready ? (open ? 'chevron-up' : 'chevron-forward') : 'lock-closed-outline'}
                                    size={18}
                                    color={Palette.textMuted}
                                />
                            </Pressable>

                            {open && m.ready && (
                                <View style={styles.rowBody}>
                                    <HorizonTabs
                                        horizons={m.horizons}
                                        value={horizon[m.key] ?? m.horizons[0].id}
                                        onChange={(id) => setHorizon((h) => ({ ...h, [m.key]: id }))}
                                    />
                                    <Text style={styles.rowNote}>
                                        Built from {m.observations} readings. We will not project further
                                        than your history can support.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.rowCta}
                                        onPress={() => run(m)}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.rowCtaText}>Predict {m.label}</Text>
                                        <Ionicons name="arrow-forward" size={16} color={Palette.white} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* The design's "We don't enough data" modal, carrying the server's own sentence. */}
            <Modal visible={Boolean(blocked)} transparent animationType="fade" onRequestClose={() => setBlocked(null)}>
                <View style={styles.backdrop}>
                    <View style={styles.modal}>
                        <NotEnoughDataIllustration width={250} />
                        <Text style={styles.modalTitle}>
                            We don't have enough data for {blocked?.label.toLowerCase()}
                        </Text>
                        <Text style={styles.modalBody}>{blocked?.refusal.message}</Text>

                        <TouchableOpacity
                            style={styles.modalCta}
                            onPress={() => {
                                const route = blocked?.route;
                                setBlocked(null);
                                if (route) router.push(route as never);
                            }}
                            accessibilityRole="button"
                        >
                            <Text style={styles.modalCtaText}>Log a reading</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setBlocked(null)} accessibilityRole="button">
                            <Text style={styles.modalDismiss}>Great, thanks!</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.close}
                        onPress={() => setBlocked(null)}
                        accessibilityLabel="Close"
                    >
                        <Ionicons name="close" size={22} color={Palette.white} />
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

    title: {
        fontSize: 24, lineHeight: 32, fontFamily: Fonts.bold,
        color: Palette.text, textAlign: 'center', marginTop: Spacing.md,
    },
    subtitle: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
        marginTop: Spacing.sm, marginBottom: Spacing.xl,
    },

    row: {
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderLight, marginBottom: Spacing.md,
    },
    rowDim: { backgroundColor: Palette.background },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    icon: {
        width: 40, height: 40, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white,
    },
    /** Half opacity rather than a grey fill: an unavailable metric is still that metric. */
    iconDim: { opacity: 0.45 },
    rowMain: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    dimText: { color: Palette.textSecondary },
    rowReach: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    meta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },

    rowBody: {
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
        gap: Spacing.md, borderTopWidth: 1, borderTopColor: Palette.borderLight,
        paddingTop: Spacing.md,
    },
    rowNote: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },
    rowCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: Palette.primary, paddingVertical: 13, borderRadius: Radius.lg,
    },
    rowCtaText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },

    backdrop: {
        flex: 1, backgroundColor: 'rgba(17,17,17,0.55)',
        alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
    },
    modal: {
        width: '100%', backgroundColor: Palette.white, borderRadius: 16,
        padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
    },
    modalTitle: {
        fontSize: 19, lineHeight: 26, fontFamily: Fonts.bold,
        color: Palette.text, textAlign: 'center', marginTop: Spacing.md,
    },
    modalBody: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
    },
    modalCta: {
        alignSelf: 'stretch', backgroundColor: Palette.primary,
        paddingVertical: 15, borderRadius: Radius.lg,
        alignItems: 'center', marginTop: Spacing.md,
    },
    modalCtaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    modalDismiss: {
        fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary,
        paddingVertical: Spacing.md,
    },
    close: {
        position: 'absolute', bottom: 48,
        width: 52, height: 52, borderRadius: 26, backgroundColor: '#111827',
        alignItems: 'center', justifyContent: 'center',
    },
});
