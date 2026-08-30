/**
 * One dose on the daily timeline.
 *
 * The three actions from the design's dose sheet are inline rather than behind a tap: this
 * is a screen someone opens with a tablet already in their hand, and burying "Taken" one
 * level down is how a log stops being kept.
 *
 * A dose that is already taken or skipped shows what happened and offers an undo — not the
 * same three buttons again. Tapping "Taken" twice must never count two tablets out of the
 * packet, and the surest way to prevent that is not to offer it.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatTime, WITH_FOOD_LABEL } from '@/lib/medications';
import { PillGlyph } from './PillGlyph';
import type { MedicationDose } from '@/types/api';

interface Props {
    dose: MedicationDose;
    busy?: boolean;
    onTake: () => void;
    onSkip: () => void;
    onUndo: () => void;
    onPress?: () => void;
}

export function DoseRow({ dose, busy, onTake, onSkip, onUndo, onPress }: Props) {
    const med = dose.medication;
    const isTaken = dose.status === 'taken';
    const isSkipped = dose.status === 'skipped';
    const settled = isTaken || isSkipped;

    // Overdue only matters while something can still be done about it
    const overdue = !settled && new Date(dose.scheduledFor) < new Date();

    return (
        <View style={[styles.card, settled && styles.cardSettled]}>
            <TouchableOpacity style={styles.top} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
                <PillGlyph shape={med?.shape} colour={med?.colour} size={42} />

                <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>
                        {dose.medicationName}
                        {med?.strength ? <Text style={styles.strength}> {med.strength}</Text> : null}
                    </Text>
                    {med?.plainName ? <Text style={styles.plain} numberOfLines={1}>{med.plainName}</Text> : null}

                    <View style={styles.metaRow}>
                        <Ionicons
                            name={overdue ? 'alarm-outline' : 'time-outline'}
                            size={12}
                            color={overdue ? Palette.warning : Palette.textSecondary}
                        />
                        <Text style={[styles.meta, overdue && styles.metaOverdue]}>
                            {formatTime(dose.time)}
                        </Text>
                        {med?.dose ? <Text style={styles.meta}>· {med.dose}</Text> : null}
                        {med?.withFood && med.withFood !== 'any' ? (
                            <Text style={styles.meta}>· {WITH_FOOD_LABEL[med.withFood]}</Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>

            {settled ? (
                <View style={styles.settledRow}>
                    <Ionicons
                        name={isTaken ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={isTaken ? Palette.success : Palette.textMuted}
                    />
                    <Text style={[styles.settledText, isTaken && { color: Palette.success }]}>
                        {isTaken
                            ? dose.punctuality === 'late' ? 'Taken, a bit late' : 'Taken'
                            : 'Skipped'}
                    </Text>
                    <View style={styles.spacer} />
                    <TouchableOpacity onPress={onUndo} disabled={busy} hitSlop={8}>
                        <Text style={styles.undo}>Undo</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.button, styles.skip]}
                        onPress={onSkip}
                        disabled={busy}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.take]}
                        onPress={onTake}
                        disabled={busy}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark" size={16} color={Palette.white} />
                        <Text style={styles.takeText}>Taken</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    cardSettled: { backgroundColor: Palette.surface, borderColor: Palette.borderLight },
    top: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
    body: { flex: 1, gap: 2 },
    name: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    strength: { fontFamily: Fonts.regular, color: Palette.textSecondary },
    plain: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
    meta: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    metaOverdue: { color: Palette.warning, fontFamily: Fonts.semibold },

    actions: { flexDirection: 'row', gap: Spacing.sm },
    button: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: Radius.md,
    },
    skip: { backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border },
    skipText: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium },
    take: { backgroundColor: Palette.primary },
    takeText: { fontSize: 13, color: Palette.white, fontFamily: Fonts.semibold },

    settledRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settledText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },
    spacer: { flex: 1 },
    undo: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.semibold },
});
