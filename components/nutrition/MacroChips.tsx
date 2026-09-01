/**
 * The three-macro row the kit draws under every meal: a circled initial, a gram figure,
 * and a short bar.
 *
 * The bar is the reason this is a component rather than three `<Text>`s. It only has a
 * meaning when there is a target to divide by, so when the plan has none the track is
 * omitted entirely rather than drawn empty — an empty bar under "50g protein" reads as
 * having achieved none of something, which is the `alignment: 'unassessed'` mistake in
 * miniature.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { MACRO_META } from '@/lib/nutrition';

interface Props {
    values: { protein?: number; carbs?: number; fat?: number };
    /** Per-macro daily targets. Omit and no bars are drawn. */
    targets?: { protein?: number; carbs?: number; fat?: number } | null;
    compact?: boolean;
}

export function MacroChips({ values, targets, compact }: Props) {
    return (
        <View style={styles.row}>
            {MACRO_META.map((m) => {
                const value = Math.round(values[m.key] || 0);
                const target = targets?.[m.key];
                return (
                    <View key={m.key} style={styles.item}>
                        <View style={styles.head}>
                            <View style={[styles.initial, { borderColor: m.color }]}>
                                <Text style={[styles.initialText, { color: m.color }]}>{m.initial}</Text>
                            </View>
                            <Text style={[styles.value, compact && styles.valueCompact]}>{value}g</Text>
                        </View>

                        {target ? (
                            <View style={styles.track}>
                                <View
                                    style={[
                                        styles.fill,
                                        { width: `${Math.min(100, (value / target) * 100)}%`, backgroundColor: m.color },
                                    ]}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.md },
    item: { flex: 1 },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    initial: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialText: { fontFamily: Fonts.bold, fontSize: 9, lineHeight: 12 },
    value: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
    valueCompact: { fontSize: 11 },
    track: {
        height: 4,
        borderRadius: Radius.pill,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden',
        marginTop: Spacing.xs,
    },
    fill: { height: '100%', borderRadius: Radius.pill },
});
