/**
 * The two repeated rows on the prediction screens: a metric's current forecast (expandable,
 * as in the design's "Health Metric Prediction" list) and a past prediction with its
 * sparkline.
 *
 * Both are here rather than inline in the hub because the hub, the past list and the details
 * screen all draw them, and three copies of a card is how they start disagreeing about which
 * number is the point estimate and which is the range.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Radius, Spacing, Shadow } from '@/constants/theme';
import {
    iconFor, toneColour, formatDate, relativeDay, outcomeOf, confidencePct,
    type Prediction, type PredictionSummary, type BetterWhen,
} from '@/lib/prediction';
import { Sparkline } from './Sparkline';
import { ChangeBadge, BandChip } from './Chips';

/* ------------------------------------------------------------------ *
 * A metric's current forecast
 * ------------------------------------------------------------------ */

/**
 * The design's collapsible metric row.
 *
 * The headline prints the **interval**, not the point — "70/130 ±10", "82.4 (80.1–84.7)".
 * The design's own mockup does the same thing with its "±10" in a lighter weight, and it is
 * the difference between a claim the arithmetic supports and one it does not.
 */
export function MetricPredictionCard({
    prediction, betterWhen, onOpen,
}: {
    prediction: Prediction;
    betterWhen: BetterWhen;
    onOpen: () => void;
}) {
    const [open, setOpen] = useState(false);
    const primary = prediction.components[0];
    const colour = toneColour(primary.direction, betterWhen);

    return (
        <View style={styles.card}>
            <Pressable
                onPress={() => setOpen((v) => !v)}
                style={styles.cardHead}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${prediction.metricLabel}, predicted ${prediction.display?.value} ${prediction.unit ?? ''}`}
            >
                <View style={styles.cardHeadMain}>
                    <Text style={styles.cardLabel}>{prediction.metricLabel}</Text>

                    <View style={styles.valueRow}>
                        <Ionicons name={iconFor(prediction.metric)} size={20} color={colour} />
                        <Text style={styles.value}>{prediction.display?.value}</Text>
                        <Text style={styles.margin}>{prediction.display?.margin}</Text>
                        {prediction.unit ? <Text style={styles.unit}>{prediction.unit}</Text> : null}
                    </View>
                </View>

                <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Palette.textMuted}
                />
            </Pressable>

            <View style={styles.statRow}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Current</Text>
                    <Text style={styles.statValue}>
                        {primary.currentValue ?? '—'}{prediction.unit ? prediction.unit : ''}
                    </Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Change</Text>
                    <ChangeBadge
                        changePct={primary.changePct}
                        direction={primary.direction}
                        betterWhen={betterWhen}
                    />
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Confidence</Text>
                    <Text style={styles.statValue}>{confidencePct(prediction.confidence)}</Text>
                </View>
            </View>

            {open && (
                <View style={styles.expanded}>
                    <Text style={styles.rangeLine}>
                        Predicted range {prediction.display?.range}
                        {prediction.unit ? ` ${prediction.unit}` : ''} by {relativeDay(prediction.targetDate)}.
                    </Text>

                    {/* The provenance. It is what separates a forecast from a guess, and the
                        person is entitled to see what it was built on. */}
                    <Text style={styles.basisLine}>
                        Projected from {primary.basis.points} readings over{' '}
                        {Math.round(primary.basis.spanDays)} days
                        {primary.basis.staleDays >= 3
                            ? `; the most recent is ${Math.round(primary.basis.staleDays)} days old.`
                            : '.'}
                    </Text>

                    {prediction.band ? <BandChip band={prediction.band} /> : null}

                    {prediction.narrative.componentNotes.map((n) => (
                        <Text key={n.component} style={styles.note}>• {n.note}</Text>
                    ))}

                    <Pressable onPress={onOpen} style={styles.openRow} accessibilityRole="button">
                        <Text style={styles.openText}>See full prediction</Text>
                        <Ionicons name="arrow-forward" size={15} color={Palette.primary} />
                    </Pressable>
                </View>
            )}
        </View>
    );
}

/* ------------------------------------------------------------------ *
 * A past prediction
 * ------------------------------------------------------------------ */

/**
 * A row in "Past Predictions".
 *
 * It carries the outcome where one exists. That is the part the design's mockup does not
 * have, and it is the reason the interval is stored: a list of things the app once claimed,
 * with no record of whether any of them happened, is marketing rather than a feature. An
 * unresolved row says "checking on <date>" — never "pending" dressed up as a result.
 */
export function PastPredictionRow({
    item, betterWhen, onOpen,
}: {
    item: PredictionSummary;
    betterWhen: BetterWhen;
    onOpen: () => void;
}) {
    const colour = toneColour(item.direction, betterWhen);
    const outcome = outcomeOf(item.resolution);

    return (
        <Pressable
            onPress={onOpen}
            style={styles.pastRow}
            accessibilityRole="button"
            accessibilityLabel={`${item.metricLabel} prediction from ${formatDate(item.generatedAt)}`}
        >
            <View style={styles.pastMain}>
                <Text style={styles.pastDate}>{formatDate(item.generatedAt)}</Text>
                <Text style={styles.pastLabel}>{item.metricLabel}</Text>
                <Text style={styles.pastValue}>
                    {item.display?.range}{item.unit ? ` ${item.unit}` : ''}
                </Text>

                {outcome ? (
                    <View style={styles.outcome}>
                        <View style={[styles.outcomeDot, { backgroundColor: outcome.colour }]} />
                        <Text style={[styles.outcomeText, { color: outcome.colour }]}>
                            {outcome.label}
                            {item.resolution?.actual !== null && item.resolution?.actual !== undefined
                                ? ` — measured ${item.resolution.actual}`
                                : ''}
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.pending}>Checking {relativeDay(item.targetDate)}</Text>
                )}
            </View>

            <Sparkline values={item.spark} colour={colour} id={`sp-${item.id}`} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    cardHeadMain: { flex: 1 },
    cardLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
    value: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    margin: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.textMuted },
    unit: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },

    statRow: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.lg },
    stat: { flex: 1, gap: 4 },
    statLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    statValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },

    expanded: {
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, gap: 8,
    },
    rangeLine: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Palette.text },
    basisLine: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },
    note: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular, color: Palette.textSecondary },
    openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    openText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    pastRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md,
        ...Shadow.card,
    },
    pastMain: { flex: 1, gap: 2 },
    pastDate: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    pastLabel: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    pastValue: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    outcome: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    outcomeDot: { width: 6, height: 6, borderRadius: 3 },
    outcomeText: { fontSize: 12, fontFamily: Fonts.semibold },
    pending: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted, marginTop: 4 },
});
