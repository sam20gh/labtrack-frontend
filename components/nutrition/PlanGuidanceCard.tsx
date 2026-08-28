/**
 * The dietary advice from the person's health plan, shown at the top of the tracker.
 *
 * This card is the reason the feature exists. Without it the tracker is a calorie counter
 * that happens to sit inside a health app; with it, every meal is logged against something
 * their interpretation actually told them to do.
 *
 * The directive is rendered verbatim, as the interpretation worded it. Paraphrasing it into
 * something shorter is how a tracker ends up coaching advice nobody gave.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type { NutritionGuidance } from '@/types/api';

interface Props {
    guidance: NutritionGuidance[];
    /** Tapping through to the plan item that produced the advice. */
    onPressItem?: (g: NutritionGuidance) => void;
    /** Shown when the plan has no dietary advice yet. */
    emptyHint?: string;
}

const KIND_ICON: Record<string, string> = {
    pattern: 'compass-outline',
    emphasise: 'add-circle-outline',
    reduce: 'remove-circle-outline',
    other: 'information-circle-outline',
};

export function PlanGuidanceCard({ guidance, onPressItem, emptyHint }: Props) {
    if (!guidance.length) {
        return (
            <View style={[styles.card, styles.empty]}>
                <Ionicons name="clipboard-outline" size={18} color={Palette.textMuted} />
                <Text style={styles.emptyText}>
                    {emptyHint
                        ?? 'Your plan has no dietary advice yet. Meals are logged, but not scored against anything.'}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Ionicons name="sparkles-outline" size={15} color={Palette.primary} />
                <Text style={styles.headerText}>From your health plan</Text>
            </View>

            {guidance.map((g, i) => (
                <TouchableOpacity
                    key={`${g.key}-${i}`}
                    style={[styles.row, i > 0 && styles.rowDivided]}
                    onPress={onPressItem ? () => onPressItem(g) : undefined}
                    disabled={!onPressItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconWrap}>
                        <Ionicons
                            name={(KIND_ICON[g.kind] || KIND_ICON.other) as any}
                            size={16}
                            color={Palette.primary}
                        />
                    </View>
                    <View style={styles.rowBody}>
                        <Text style={styles.directive}>{g.directive}</Text>
                        {!!g.rationale && <Text style={styles.rationale}>{g.rationale}</Text>}
                        {!!g.emphasise?.length && (
                            <View style={styles.chips}>
                                {g.emphasise.slice(0, 4).map((e) => (
                                    <View key={e} style={styles.chip}>
                                        <Text style={styles.chipText}>{e}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    {onPressItem && (
                        <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        ...Shadow.card,
    },
    empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    emptyText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 18 },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    headerText: {
        fontFamily: Fonts.semibold,
        fontSize: 12,
        color: Palette.primary,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    rowDivided: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowBody: { flex: 1 },
    directive: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, lineHeight: 20 },
    rationale: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 17,
        marginTop: 2,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
    chip: {
        backgroundColor: Palette.canvas,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
    },
    chipText: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
});
