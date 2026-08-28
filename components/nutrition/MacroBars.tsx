/**
 * Protein / carbohydrate / fat against target.
 *
 * These bars are where the health plan becomes visible. A calorie target is the same number
 * whatever the dietary advice says; "cut refined carbohydrates" only shows up as a
 * carbohydrate target that has moved down and a fat target that has moved up. Without this
 * row the guidance is decoration.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

interface Macro {
    key: 'protein' | 'carbs' | 'fat';
    label: string;
    consumed: number;
    target?: number;
    color: string;
}

interface Props {
    totals: { protein: number; carbs: number; fat: number };
    targets?: { protein?: number; carbs?: number; fat?: number };
}

export function MacroBars({ totals, targets }: Props) {
    const macros: Macro[] = [
        { key: 'protein', label: 'protein', consumed: totals.protein, target: targets?.protein, color: Palette.primary },
        { key: 'carbs', label: 'carbs', consumed: totals.carbs, target: targets?.carbs, color: Palette.indigo },
        { key: 'fat', label: 'fat', consumed: totals.fat, target: targets?.fat, color: Palette.primaryLight },
    ];

    return (
        <View style={styles.row}>
            {macros.map((m) => {
                const ratio = m.target && m.target > 0 ? Math.min(1, m.consumed / m.target) : 0;
                return (
                    <View key={m.key} style={styles.macro}>
                        <View style={styles.track}>
                            <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: m.color }]} />
                        </View>
                        <Text style={styles.value}>
                            {Math.round(m.consumed)}
                            <Text style={styles.target}>{m.target ? ` / ${m.target}g` : 'g'}</Text>
                        </Text>
                        <Text style={styles.label}>{m.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.md },
    macro: { flex: 1 },
    track: {
        height: 6,
        borderRadius: Radius.pill,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden',
        marginBottom: Spacing.sm,
    },
    fill: { height: '100%', borderRadius: Radius.pill },
    value: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    target: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    label: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
});
