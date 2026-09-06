/**
 * "Activity Breakdown" — `Design/activity.svg` frame 18.
 *
 * A row per activity type, each drawn as a tinted pill whose **width carries the share** and
 * a count on the right, joined by the design's dashed leader. The bar is the pill itself
 * rather than a track behind it, which is why the label sits inside: at five rows a
 * conventional bar chart with labels outside spends half the card's width on axis.
 *
 * **Counted in sessions, not minutes**, which is what the design's "31x" is and what
 * `utils/activityInsight.js` computes. Twelve yoga classes and two long rides are not
 * "mostly cycling", and a card that said so would be describing the clock rather than the
 * person.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatType, type ActivityBreakdownRow } from '@/lib/activity';

/** The design's ten types, and something reasonable for everything else. */
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

/** The narrowest a pill may be drawn, so a one-session type is still a readable label. */
const MIN_SHARE = 0.34;

interface Props {
    rows: ActivityBreakdownRow[];
    /** How many activity types were folded into the final "Other" row, if any. */
    onSeeAll?: () => void;
}

export function TypeBreakdown({ rows, onSeeAll }: Props) {
    if (!rows.length) return null;

    const top = rows[0];
    const max = Math.max(...rows.map((r) => r.count));

    return (
        <View style={styles.card}>
            {rows.map((r) => {
                const share = Math.max(MIN_SHARE, r.count / max);
                return (
                    <View key={r.type} style={styles.row}>
                        <View style={[styles.pill, { flexGrow: share, flexShrink: 1, flexBasis: 0 }]}>
                            <Ionicons name={ICONS[r.type] || 'fitness-outline'} size={16} color={Palette.primary} />
                            <Text style={styles.pillLabel} numberOfLines={1}>{formatType(r.type)}</Text>
                        </View>

                        {/*
                          The design's dashed leader, drawn as a border rather than as a
                          string of hyphens so it stretches to whatever the pill leaves.
                        */}
                        <View style={[styles.leader, { flexGrow: Math.max(0.001, 1 - share), flexShrink: 1, flexBasis: 0 }]} />

                        <Text style={styles.count}>{r.count}x</Text>
                    </View>
                );
            })}

            {/*
              One sentence, and it only ever names what the rows already show. The design's
              copy claims a month; this says the range that was actually asked for, which is
              handed down rather than assumed here.
            */}
            <Text style={styles.note}>
                Your most logged activity is {formatType(top.type).toLowerCase()}, at{' '}
                {top.count}x{top.minutes ? ` and ${Math.round(top.minutes)} minutes` : ''}.
            </Text>

            {onSeeAll && (
                <Text style={styles.link} onPress={onSeeAll} accessibilityRole="link">
                    See all activities
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Palette.primarySurface,
        borderWidth: 1,
        borderColor: Palette.primaryPale,
        borderRadius: Radius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        minWidth: 96,
    },
    pillLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary, flexShrink: 1 },
    leader: {
        height: 1,
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        borderColor: Palette.primaryPale,
        minWidth: 8,
    },
    count: { fontSize: 13.5, fontFamily: Fonts.bold, color: Palette.text, minWidth: 34, textAlign: 'right' },
    note: {
        fontSize: 12.5,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        lineHeight: 18,
        marginTop: Spacing.xs,
    },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary, marginTop: 2 },
});
