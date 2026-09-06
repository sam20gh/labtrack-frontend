/**
 * Your Sleep Score — `Design/sleep.svg` frame 8.
 *
 * The number, the ladder it is read on, and what it was computed from.
 *
 * **The bottom band is "Needs attention", not what the kit calls it.** The design labels
 * 0–39 "Insomniac"; insomnia is a clinical diagnosis with criteria this number does not
 * test, and putting a diagnosis on a dashboard inside an app that also produces
 * clinician-reviewed interpretations is the line the symptom checker's finding score is
 * careful not to cross. The bands come from the server — `utils/sleepScore.js` owns them —
 * so this screen cannot rename them locally either.
 *
 * The weights are shown because the design's expandable band rows have to say something, and
 * "duration is 60% of this" is more use than a restatement of the band name.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import {
    getSleepScore, formatMinutes, bandTint, type SleepScoreScreen as ScoreData,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/** What each weighted component actually measures, in the words somebody would ask in. */
const COMPONENT_COPY: Record<string, { label: string; body: string }> = {
    duration: {
        label: 'How long you slept',
        body: 'Measured against your goal. Full marks from 95% of it upward — sleeping past '
            + 'your goal is not scored as better than meeting it, and not penalised either.',
    },
    efficiency: {
        label: 'How much of your time in bed was asleep',
        body: 'Only counted when your source reports time awake. A tracker that gives only a '
            + 'total is not scored down for it.',
    },
    stages: {
        label: 'Your stage balance',
        body: 'How close deep and REM sat to the usual adult proportions. Deliberately '
            + 'generous: stage detection from a wrist is an estimate.',
    },
};

export default function SleepScoreScreen() {
    const router = useRouter();

    const [data, setData] = useState<ScoreData | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await getSleepScore());
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your sleep score.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const latest = data?.latest ?? null;
    const has = Number.isFinite(latest?.score as number);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Your sleep score</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <View style={styles.hero}>
                        <Text style={styles.value}>{has ? latest?.score : '—'}</Text>
                        <Text style={styles.outOf}>Out of 100</Text>
                        {latest?.band ? (
                            <Text style={[styles.band, { color: bandTint(latest.band.key) }]}>
                                {latest.band.label}
                            </Text>
                        ) : (
                            <Text style={styles.bandMuted}>No night recorded yet</Text>
                        )}
                    </View>

                    {/* The ladder, with the current score marked on it. */}
                    {data?.bands.length ? (
                        <View style={styles.gauge}>
                            <View style={styles.gaugeTrack}>
                                {data.bands
                                    .slice()
                                    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0))
                                    .map((band) => (
                                        <View
                                            key={band.key}
                                            style={{
                                                flex: ((band.max ?? 100) - (band.min ?? 0)) + 1,
                                                height: 12,
                                                backgroundColor: bandTint(band.key),
                                                opacity: 0.85,
                                            }}
                                        />
                                    ))}
                                {has ? (
                                    <View
                                        style={[
                                            styles.gaugeMark,
                                            { left: `${Math.min(99, latest?.score as number)}%` },
                                        ]}
                                    />
                                ) : null}
                            </View>
                            <View style={styles.gaugeLabels}>
                                <Text style={styles.gaugeLabel}>0</Text>
                                <Text style={styles.gaugeLabel}>100</Text>
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.figures}>
                        <View style={styles.figure}>
                            <Text style={styles.figureValue}>{formatMinutes(latest?.asleepMin)}</Text>
                            <Text style={styles.figureLabel}>Hours of sleep</Text>
                        </View>
                        <View style={styles.figure}>
                            <Text style={styles.figureValue}>{formatMinutes(latest?.stages?.remMin)}</Text>
                            <Text style={styles.figureLabel}>REM sleep</Text>
                        </View>
                    </View>

                    {data?.explanation ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Why this number</Text>
                            <Text style={styles.cardBody}>{data.explanation}</Text>
                        </View>
                    ) : null}

                    {/* Null, never zero: nothing scored means nothing to average, not a
                        thirty-day average of nought. */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Last 30 days</Text>
                        <Text style={styles.cardBody}>
                            {data?.average30 !== null && data?.average30 !== undefined
                                ? `Averaging ${data.average30} out of 100 across ${data.nights} ${data.nights === 1 ? 'night' : 'nights'}.`
                                : 'No nights scored in the last 30 days yet.'}
                        </Text>
                    </View>

                    <Text style={styles.sectionTitle}>What your score means</Text>
                    <View style={{ gap: Spacing.sm }}>
                        {data?.bands.map((band) => (
                            <View key={band.key} style={styles.bandRow}>
                                <Text style={styles.bandRange}>{`${band.min} – ${band.max}`}</Text>
                                <View style={[styles.bandChip, { borderColor: bandTint(band.key) }]}>
                                    <Text style={[styles.bandChipLabel, { color: bandTint(band.key) }]}>
                                        {band.label}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>How it is worked out</Text>
                    <View style={{ gap: Spacing.sm }}>
                        {Object.entries(data?.weights || {}).map(([key, weight]) => {
                            const copy = COMPONENT_COPY[key];
                            if (!copy) return null;
                            const expanded = open === key;
                            return (
                                <Pressable
                                    key={key}
                                    style={styles.component}
                                    onPress={() => setOpen(expanded ? null : key)}
                                >
                                    <View style={styles.componentHead}>
                                        <Text style={styles.componentLabel}>{copy.label}</Text>
                                        <Text style={styles.componentWeight}>
                                            {`${Math.round(weight * 100)}%`}
                                        </Text>
                                        <Ionicons
                                            name={expanded ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={Palette.textMuted}
                                        />
                                    </View>
                                    {expanded ? <Text style={styles.componentBody}>{copy.body}</Text> : null}
                                </Pressable>
                            );
                        })}
                    </View>

                    <Text style={styles.footnote}>
                        This is arithmetic over how long you slept and how much of your time in bed
                        was spent asleep. It is not a diagnosis, and a run of low scores is a
                        conversation to have with a clinician rather than a verdict from an app.
                    </Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    error: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.danger },

    hero: { alignItems: 'center', gap: 2 },
    value: { fontSize: 56, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 64 },
    outOf: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    band: { fontSize: 13, fontFamily: Fonts.semibold, marginTop: 2 },
    bandMuted: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textMuted, marginTop: 2 },

    gauge: { gap: 4 },
    gaugeTrack: {
        flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden',
        backgroundColor: Palette.borderLight, position: 'relative',
    },
    gaugeMark: {
        position: 'absolute', top: -3, width: 4, height: 18,
        backgroundColor: Palette.text, borderRadius: 2,
    },
    gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    gaugeLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    figures: { flexDirection: 'row', gap: Spacing.md },
    figure: { flex: 1, alignItems: 'center', gap: 2 },
    figureValue: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    figureLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    card: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.canvas, gap: 6,
    },
    cardTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    cardBody: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 19 },

    sectionTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.sm },

    bandRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: Spacing.lg, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderLight,
        ...Shadow.card,
        backgroundColor: Palette.background,
    },
    bandRange: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    bandChip: {
        paddingHorizontal: Spacing.md, paddingVertical: 4,
        borderRadius: Radius.sm, borderWidth: 1,
    },
    bandChipLabel: { fontSize: 12, fontFamily: Fonts.semibold },

    component: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.surface, gap: Spacing.sm,
    },
    componentHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    componentLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    componentWeight: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.primary },
    componentBody: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },

    footnote: {
        fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted,
        lineHeight: 17, marginTop: Spacing.md,
    },
});
