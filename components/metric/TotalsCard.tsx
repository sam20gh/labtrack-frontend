/**
 * The range's totals — `Design/activity.svg` frame 18's top card.
 *
 * One large count on the left, a 2×2 of supporting figures on the right, and a rail of
 * per-type chips underneath. It is the card that answers "what did I actually do", which
 * the score above it does not: a score is a judgement against a plan and this is a tally.
 *
 * **A figure nothing reported is dropped, not zeroed.** The kit fills all four slots with
 * placeholders — "80 mph" for a jog among them — and a grid of zeros for somebody whose
 * watch reports steps but not distance is the same lie in a different font. Fewer than two
 * real figures and the grid is dropped entirely rather than drawn as one number and three
 * dashes.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatType, type ActivityBreakdownRow } from '@/lib/activity';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    walking: 'walk-outline',
    jogging: 'walk-outline',
    running: 'walk-outline',
    hiking: 'trail-sign-outline',
    biking: 'bicycle-outline',
    swimming: 'water-outline',
    yoga: 'body-outline',
    meditation: 'leaf-outline',
    rowing: 'boat-outline',
    weightlifting: 'barbell-outline',
    soccer: 'football-outline',
    other: 'ellipsis-horizontal',
};

export interface TotalsFigure {
    key: string;
    value: string;
    label: string;
}

interface Props {
    /** The headline count, and what it counts. */
    count: number;
    countLabel: string;
    figures: TotalsFigure[];
    /** Per-type chips, in the order `utils/activityInsight.js` ranked them. */
    types?: ActivityBreakdownRow[];
}

export function TotalsCard({ count, countLabel, figures, types = [] }: Props) {
    return (
        <View style={styles.card}>
            <View style={styles.top}>
                <View style={styles.countBlock}>
                    <Text style={styles.count} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {count}
                    </Text>
                    <Text style={styles.countLabel}>{countLabel}</Text>
                </View>

                {figures.length >= 2 && (
                    <View style={styles.grid}>
                        {figures.slice(0, 4).map((f) => (
                            <View key={f.key} style={styles.cell}>
                                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                                    {f.value}
                                </Text>
                                <Text style={styles.label} numberOfLines={1}>{f.label}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {types.length > 0 && (
                <View style={styles.chips}>
                    {types.map((t) => (
                        <View key={t.type} style={styles.chip}>
                            <Ionicons name={ICONS[t.type] || 'fitness-outline'} size={14} color={Palette.text} />
                            <Text style={styles.chipText} numberOfLines={1}>
                                {formatType(t.type)} {t.count}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.white,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    countBlock: { width: 96 },
    count: { fontSize: 62, lineHeight: 68, fontFamily: Fonts.bold, color: Palette.text },
    countLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
    cell: { width: '50%', gap: 2, paddingRight: Spacing.sm },
    value: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text },
    label: { fontSize: 11.5, fontFamily: Fonts.regular, color: Palette.textSecondary },

    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        paddingTop: Spacing.lg,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
    },
    chipText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },
});
