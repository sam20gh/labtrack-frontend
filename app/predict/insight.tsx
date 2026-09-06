/**
 * Prediction Insight — the design's frames 11, 12 and 13, which are one screen with a chart
 * view and a calendar view.
 *
 * **Nothing here is written down.** It refits live for whatever metric and horizon the person
 * has selected, because this screen has a switcher and they expect an answer for a
 * combination nobody has run yet. Writing one would fill "Past Predictions" with rows nobody
 * asked for — a chart somebody scrolled is not a claim they made.
 *
 * The metric switcher at the bottom is the design's "Blood Pressure ⌄" pill; the round purple
 * button beside it saves the current view as a real prediction, which is the one action on
 * this screen that does write.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
    ActivityIndicator, useWindowDimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getInsight, getPredictableMetrics, iconFor, tintFor, tintSurface, toneColour, relativeDay,
    type Insight, type PredictableMetric, type MetricKey, type Refusal,
} from '@/lib/prediction';
import { ForecastChart, type ScrubPoint } from '@/components/predict/ForecastChart';
import { DirectionCalendar } from '@/components/predict/DirectionCalendar';
import { HorizonTabs, ConfidenceChip, BandChip, PredictionDisclaimer } from '@/components/predict/Chips';
import { NotEnoughDataIllustration } from '@/components/predict/NotEnoughDataIllustration';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

type View_ = 'chart' | 'calendar';

export default function PredictionInsightScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const params = useLocalSearchParams<{ metric?: string; horizon?: string }>();

    const [metric, setMetric] = useState<MetricKey>((params.metric as MetricKey) || 'blood_pressure');
    const [horizon, setHorizon] = useState(params.horizon || '1w');
    const [view, setView] = useState<View_>('chart');

    const [catalogue, setCatalogue] = useState<PredictableMetric[]>([]);
    const [insight, setInsight] = useState<Insight | null>(null);
    const [refusal, setRefusal] = useState<Refusal | null>(null);
    const [loading, setLoading] = useState(true);
    const [picking, setPicking] = useState(false);
    const [minObservations, setMinObservations] = useState(3);
    const [scrub, setScrub] = useState<ScrubPoint | null>(null);

    useEffect(() => {
        getPredictableMetrics()
            .then(({ metrics, minObservations: min }) => {
                setCatalogue(metrics);
                setMinObservations(min);
                // Land on something that actually has data rather than on an empty state, if
                // the caller did not name a metric.
                if (!params.metric) {
                    const first = metrics.find((m) => m.ready);
                    if (first) { setMetric(first.key); setHorizon(first.horizons[0].id); }
                }
            })
            .catch(() => { });
    }, [params.metric]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getInsight(metric, horizon);
            if (result.ok) { setInsight(result.data); setRefusal(null); }
            else { setInsight(null); setRefusal(result.refusal); }
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [metric, horizon, router]);

    useEffect(() => { load(); }, [load]);

    const current = catalogue.find((m) => m.key === metric);
    const betterWhen = current?.betterWhen ?? null;
    const chartWidth = width - Spacing.lg * 2;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>Prediction Insight</Text>
                <TouchableOpacity
                    onPress={() => setView((v) => (v === 'chart' ? 'calendar' : 'chart'))}
                    hitSlop={12}
                    accessibilityLabel={view === 'chart' ? 'Show the day grid' : 'Show the chart'}
                >
                    <Ionicons
                        name={view === 'chart' ? 'grid-outline' : 'analytics-outline'}
                        size={20}
                        color={Palette.text}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
                ) : refusal ? (
                    <View style={styles.refusal}>
                        <NotEnoughDataIllustration width={250} />
                        <Text style={styles.refusalTitle}>
                            Not enough {current?.label.toLowerCase() ?? 'data'} yet
                        </Text>
                        <Text style={styles.refusalBody}>{refusal.message}</Text>
                    </View>
                ) : insight ? (
                    <>
                        <View style={styles.headline}>
                            <Ionicons
                                name={iconFor(metric)}
                                size={26}
                                color={toneColour(insight.components[0].direction, betterWhen)}
                            />
                            <Text style={styles.headlineValue}>{insight.display.value}</Text>
                            <Text style={styles.headlineUnit}>{insight.metric.unit}</Text>
                        </View>

                        <Text style={styles.blurb}>{insight.headline}</Text>

                        <View style={styles.horizonRow}>
                            <HorizonTabs horizons={insight.horizons} value={horizon} onChange={setHorizon} />
                        </View>

                        {view === 'chart' ? (
                            <>
                                <ForecastChart
                                    history={insight.series.history}
                                    projected={insight.series.projected}
                                    width={chartWidth}
                                    height={240}
                                    tone={toneColour(insight.components[0].direction, betterWhen)}
                                    showSecondary={insight.components.length > 1}
                                    annotations={{
                                        left: {
                                            title: 'Today',
                                            value: `${insight.components.map((c) => c.currentValue ?? '—').join('/')}`,
                                        },
                                        right: {
                                            title: insight.horizons.find((h) => h.id === horizon)?.label ?? '',
                                            value: insight.display.value,
                                        },
                                    }}
                                    scrubbable
                                    onScrub={setScrub}
                                />

                                {/* The caption is replaced by the reading while the handle is
                                    off today: two lines of explanation under a number somebody
                                    is actively reading is the explanation winning. */}
                                {scrub ? (
                                    <Text style={styles.caption}>
                                        {new Date(`${scrub.day}T00:00:00`).toLocaleDateString(undefined, {
                                            weekday: 'long', day: 'numeric', month: 'short',
                                        })}:{' '}
                                        <Text style={styles.captionStrong}>
                                            {scrub.secondary !== null
                                                ? `${Math.round(scrub.value)}/${Math.round(scrub.secondary)}`
                                                : scrub.value}
                                            {insight.metric.unit ? ` ${insight.metric.unit}` : ''}
                                        </Text>
                                        {scrub.projected && scrub.low !== null && scrub.high !== null
                                            ? `, predicted range ${scrub.low}–${scrub.high}.`
                                            : ', measured.'}
                                    </Text>
                                ) : (
                                    <Text style={styles.caption}>
                                        The shaded band is the predicted range, {insight.display.range}
                                        {insight.metric.unit ? ` ${insight.metric.unit}` : ''}. Grey is what you
                                        have actually measured.
                                    </Text>
                                )}
                            </>
                        ) : (
                            <View style={styles.calendarCard}>
                                <DirectionCalendar days={insight.calendar} betterWhen={betterWhen} />
                            </View>
                        )}

                        <View style={styles.metaRow}>
                            <ConfidenceChip value={insight.confidence} />
                            {insight.band ? <BandChip band={insight.band} /> : null}
                        </View>

                        {insight.band?.crisis ? (
                            <View style={styles.crisis}>
                                <Ionicons name="warning" size={18} color={Palette.danger} />
                                <Text style={styles.crisisText}>
                                    A reading in this range needs medical attention. Seek care when you
                                    measure one — do not wait for this date.
                                </Text>
                            </View>
                        ) : null}

                        {insight.safetyNote ? (
                            <Text style={styles.safety}>{insight.safetyNote}</Text>
                        ) : null}

                        <View style={styles.basisCard}>
                            <Text style={styles.basisTitle}>What this rests on</Text>
                            <Text style={styles.basisBody}>
                                {insight.components[0].basis.points} readings over{' '}
                                {Math.round(insight.components[0].basis.spanDays)} days, the most recent{' '}
                                {Math.round(insight.components[0].basis.staleDays)} days ago. Projected to{' '}
                                {relativeDay(new Date(Date.now() + insight.horizonDays * 86400000).toISOString())}.
                            </Text>
                        </View>

                        <PredictionDisclaimer text={insight.disclaimer} />
                    </>
                ) : null}
            </ScrollView>

            {/* The design's metric pill + save button. */}
            <View style={styles.dock}>
                <Pressable
                    style={styles.picker}
                    onPress={() => setPicking(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Change metric"
                >
                    <Ionicons name={iconFor(metric)} size={16} color={tintFor(metric)} />
                    <Text style={styles.pickerText}>{current?.label ?? 'Metric'}</Text>
                    <Ionicons name="chevron-down" size={16} color={Palette.textMuted} />
                </Pressable>

                <TouchableOpacity
                    style={[styles.save, !insight && styles.saveDisabled]}
                    disabled={!insight}
                    onPress={() => router.push({
                        pathname: '/predict/running',
                        params: { metric, horizon },
                    } as never)}
                    accessibilityRole="button"
                    accessibilityLabel="Save this as a prediction"
                >
                    <Ionicons name="add" size={26} color={Palette.white} />
                </TouchableOpacity>
            </View>

            <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
                <Pressable style={styles.sheetBackdrop} onPress={() => setPicking(false)}>
                    <Pressable style={styles.sheet}>
                        <Text style={styles.sheetTitle}>Choose a metric</Text>
                        {catalogue.map((m) => (
                            <Pressable
                                key={m.key}
                                style={[styles.sheetRow, m.key === metric && styles.sheetRowActive]}
                                onPress={() => {
                                    setPicking(false);
                                    if (!m.ready) return;
                                    setMetric(m.key);
                                    setHorizon(m.horizons[0].id);
                                }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: m.key === metric, disabled: !m.ready }}
                            >
                                <View style={[styles.sheetIcon, { backgroundColor: tintSurface(m.key) }, !m.ready && styles.sheetIconDim]}>
                                    <Ionicons name={iconFor(m.key)} size={16} color={tintFor(m.key)} />
                                </View>
                                <Text style={[styles.sheetLabel, !m.ready && styles.sheetLabelDim]}>{m.label}</Text>
                                <Text style={styles.sheetMeta}>
                                    {m.ready ? m.reach : `${m.observations}/${minObservations} readings`}
                                </Text>
                            </Pressable>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { paddingVertical: 80, alignItems: 'center' },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    topTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    content: { padding: Spacing.lg, paddingBottom: 110 },

    headline: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    headlineValue: { fontSize: 34, fontFamily: Fonts.bold, color: Palette.text },
    headlineUnit: { fontSize: 15, fontFamily: Fonts.regular, color: Palette.textSecondary },
    blurb: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: Spacing.sm,
    },
    horizonRow: { marginTop: Spacing.lg, marginBottom: Spacing.lg },

    caption: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: Palette.textMuted, marginTop: Spacing.sm,
    },
    captionStrong: { fontFamily: Fonts.bold, color: Palette.text },
    calendarCard: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },

    metaRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, marginTop: Spacing.lg, flexWrap: 'wrap',
    },

    crisis: {
        flexDirection: 'row', gap: Spacing.sm,
        backgroundColor: Palette.dangerSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginTop: Spacing.lg,
    },
    crisisText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Palette.danger },
    safety: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: Spacing.md,
    },

    basisCard: {
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        padding: Spacing.lg, marginTop: Spacing.lg, gap: 4,
    },
    basisTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.text },
    basisBody: { fontSize: 12, lineHeight: 19, fontFamily: Fonts.regular, color: Palette.textSecondary },

    refusal: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
    refusalTitle: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    refusalBody: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
    },

    dock: {
        position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xl,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    picker: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
        paddingHorizontal: Spacing.md, paddingVertical: 11, borderRadius: Radius.lg,
        ...Shadow.card,
    },
    pickerText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    save: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center', ...Shadow.card,
    },
    saveDisabled: { opacity: 0.4 },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: Palette.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: 2,
    },
    sheetTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginBottom: Spacing.md },
    sheetRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: 13, paddingHorizontal: Spacing.md, borderRadius: Radius.md,
    },
    sheetRowActive: { backgroundColor: Palette.primarySurface },
    sheetIcon: {
        width: 30, height: 30, borderRadius: Radius.sm,
        alignItems: 'center', justifyContent: 'center',
    },
    sheetIconDim: { opacity: 0.45 },
    sheetLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    sheetLabelDim: { color: Palette.textMuted },
    sheetMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
});
