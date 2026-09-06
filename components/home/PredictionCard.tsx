/**
 * The home screen's "Looking ahead" card.
 *
 * Earned, like every other section on that screen: it is drawn only when this person actually
 * has a prediction, and `HomeScreen` pushes a `SetupItem` row instead when they do not. A card
 * saying "try our predictor" would take exactly as much of the screen as one showing a real
 * forecast, which is the trade the home screen's header comment refuses.
 *
 * It shows the **range**, never the point estimate. The whole feature's honesty rests on the
 * interval being what is claimed, and the one surface where a bare number would be most
 * tempting — a 120pt-tall card on a home screen — is the one where it would do most damage.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import {
    iconFor, tintFor, tintSurface, relativeDay, confidencePct, outcomeOf,
    type Prediction, type Accuracy,
} from '@/lib/prediction';

interface Props {
    predictions: Prediction[];
    accuracy: Accuracy | null;
    onOpen: (id: string) => void;
    onSeeAll: () => void;
}

export function PredictionCard({ predictions, accuracy, onOpen, onSeeAll }: Props) {
    if (!predictions.length) return null;

    // Two at most. A home card is a pointer, and a list of every forecast somebody has ever
    // run belongs on the hub that already draws it.
    const shown = predictions.slice(0, 2);

    return (
        <View style={styles.card}>
            {shown.map((p, i) => {
                const outcome = outcomeOf(p.resolution);
                return (
                    <Pressable
                        key={p.id}
                        style={[styles.row, i > 0 && styles.rowDivided]}
                        onPress={() => onOpen(p.id)}
                        accessibilityRole="button"
                        accessibilityLabel={
                            `${p.metricLabel}: predicted ${p.display?.range} ${p.unit ?? ''} `
                            + `${relativeDay(p.targetDate)}`
                        }
                    >
                        <View style={[styles.icon, { backgroundColor: tintSurface(p.metric) }]}>
                            <Ionicons name={iconFor(p.metric)} size={18} color={tintFor(p.metric)} />
                        </View>

                        <View style={styles.main}>
                            <Text style={styles.label}>{p.metricLabel}</Text>
                            <Text style={styles.value}>
                                {p.display?.range}
                                {p.unit ? <Text style={styles.unit}> {p.unit}</Text> : null}
                            </Text>
                            <Text style={styles.meta}>
                                {outcome
                                    ? outcome.label
                                    : `${relativeDay(p.targetDate)} · ${confidencePct(p.confidence)} confidence`}
                            </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                    </Pressable>
                );
            })}

            {/* The scorecard, on the home screen rather than only in the feature. It is the
                one line that tells somebody whether to believe the two above it. */}
            {accuracy ? (
                <Pressable style={styles.accuracy} onPress={onSeeAll} accessibilityRole="button">
                    <Ionicons name="checkmark-done-outline" size={15} color={Palette.successDeep} />
                    <Text style={styles.accuracyText}>
                        {accuracy.withinIntervalPct}% of your last {accuracy.resolved} predictions
                        landed inside their range
                    </Text>
                </Pressable>
            ) : (
                <Text style={styles.footnote}>
                    Projected from your own readings. We check each one against what you actually
                    measure.
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowDivided: {
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    icon: {
        width: 38, height: 38, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
    },
    main: { flex: 1, gap: 1 },
    label: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    value: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    unit: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    meta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    accuracy: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    accuracyText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: Fonts.medium, color: Palette.text },
    footnote: {
        fontSize: 12, lineHeight: 17, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
});
