/**
 * The exercise advice from the person's health plan, shown above their targets.
 *
 * This is the component that makes the tracker legible as a tracker *of their plan* rather
 * than a generic goal app. Without it, the targets are numbers from nowhere.
 *
 * Directives are rendered **verbatim** — as the interpretation worded them. Paraphrasing
 * clinical advice on the way to the screen is how a tracker ends up coaching something the
 * plan never said, and the same rule already governs `NutritionPlan.guidance[].directive`.
 *
 * A `caution` directive is drawn differently from a volume one. "Keep to low-impact
 * exercise while that knee settles" and "build up to 150 minutes a week" are not the same
 * kind of instruction, and flattening them into one grey list loses the difference that
 * matters most.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { ActivityGuidance } from '@/lib/activity';

const KIND_STYLE: Record<
    ActivityGuidance['kind'],
    { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
    caution: { icon: 'alert-circle-outline', color: Palette.warning, bg: Palette.warningSurface },
    volume: { icon: 'trending-up-outline', color: Palette.primary, bg: Palette.primarySurface },
    intensity: { icon: 'speedometer-outline', color: Palette.indigo, bg: Palette.primarySurface },
    modality: { icon: 'barbell-outline', color: Palette.indigo, bg: Palette.primarySurface },
    other: { icon: 'information-circle-outline', color: Palette.textSecondary, bg: Palette.surface },
};

interface Props {
    guidance: ActivityGuidance[];
    /** The `explain()` sentence from the API, when the screen has room for it. */
    explanation?: string;
}

export function PlanGuidanceCard({ guidance, explanation }: Props) {
    if (!guidance.length) {
        return (
            <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={18} color={Palette.textMuted} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.emptyTitle}>No exercise advice yet</Text>
                    <Text style={styles.emptyBody}>
                        These are general guideline targets. When your results produce exercise
                        advice, your targets move with it.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.heading}>From your health plan</Text>

            {guidance.map((g, i) => {
                const style = KIND_STYLE[g.kind] || KIND_STYLE.other;
                return (
                    <View key={`${g.key}-${i}`} style={[styles.row, { backgroundColor: style.bg }]}>
                        <Ionicons name={style.icon} size={17} color={style.color} />
                        <View style={{ flex: 1, gap: 2 }}>
                            {g.label && <Text style={[styles.label, { color: style.color }]}>{g.label}</Text>}
                            {/* Verbatim. See the note at the top of this file. */}
                            <Text style={styles.directive}>{g.directive}</Text>
                            {g.rationale ? <Text style={styles.rationale}>{g.rationale}</Text> : null}
                        </View>
                    </View>
                );
            })}

            {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { gap: Spacing.sm },
    heading: {
        fontSize: 13,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginBottom: 2,
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
    },
    label: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    directive: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text, lineHeight: 20 },
    rationale: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
    explanation: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        lineHeight: 18,
        marginTop: Spacing.xs,
    },

    empty: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: Palette.surface,
    },
    emptyTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    emptyBody: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
});
