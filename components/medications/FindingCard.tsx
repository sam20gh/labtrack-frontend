/**
 * One interaction finding.
 *
 * Two things this card does that a generic alert row would not:
 *
 *   - **It states its provenance.** A `rule` finding came from a deterministic table and
 *     will say the same thing tomorrow; a `model` finding was written by Claude on top of
 *     it. Someone deciding whether to ring their pharmacy is entitled to know which kind of
 *     statement they are reading, and the distinction is drawn quietly rather than as a
 *     disclaimer that swamps the finding.
 *   - **It always ends on an action.** Severity without a next step is just alarm. The
 *     `action` line is mandatory in the schema for that reason, and it is rendered in every
 *     state of this card.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { SEVERITY_META, KIND_LABEL } from '@/lib/medications';
import type { InteractionFinding } from '@/types/api';

export function FindingCard({ finding }: { finding: InteractionFinding }) {
    const meta = SEVERITY_META[finding.severity];

    return (
        <View style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <View style={styles.header}>
                <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                <Text style={[styles.severity, { color: meta.color }]}>{meta.label}</Text>
                <View style={styles.spacer} />
                <Text style={styles.kind}>{KIND_LABEL[finding.kind] || finding.kind}</Text>
            </View>

            <Text style={styles.pair}>
                {finding.between[0]}
                <Text style={styles.plus}>  +  </Text>
                {finding.between[1]}
            </Text>

            <Text style={styles.effect}>{finding.effect}</Text>

            <View style={[styles.actionBox, { borderColor: meta.border }]}>
                <Ionicons name="arrow-forward-circle-outline" size={15} color={meta.color} />
                <Text style={styles.action}>{finding.action}</Text>
            </View>

            {/*
              Provenance. Deliberately the smallest text on the card: it matters, but a
              finding is not less true for having come from a model, and leading with the
              caveat would teach people to discount the whole screen.
            */}
            <Text style={styles.source}>
                {finding.source === 'rule'
                    ? 'From our interaction rules'
                    : 'Added by AI review — worth confirming'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    severity: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
    spacer: { flex: 1 },
    kind: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    pair: { fontSize: 16, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    plus: { color: Palette.textMuted, fontFamily: Fonts.regular },
    effect: { fontSize: 14, color: Palette.text, fontFamily: Fonts.regular, lineHeight: 21 },
    actionBox: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'flex-start',
        backgroundColor: Palette.white,
        borderRadius: Radius.md,
        borderWidth: 1,
        padding: Spacing.md,
        marginTop: Spacing.xs,
    },
    action: { flex: 1, fontSize: 13, color: Palette.text, fontFamily: Fonts.medium, lineHeight: 19 },
    source: { fontSize: 10, color: Palette.textMuted, fontFamily: Fonts.regular, marginTop: 2 },
});
