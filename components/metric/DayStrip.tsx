/**
 * Pick a day out of the loaded range.
 *
 * The dashboard only ever showed today, so a phone that had just synced three months of
 * history had no way to look at any of it short of the history list — which shows workouts
 * and none of the daily figures. This is the way to any date the range covers.
 *
 * **A day with data looks different from a day without**, before it is tapped. Health data
 * is sparse by nature — a watch goes uncharged, a phone stays on the table — and a strip
 * that looked uniform would make every empty day feel like a bug in the app rather than a
 * day nothing was recorded.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing } from '@/constants/theme';
import type { ActivitySeriesPoint } from '@/lib/activity';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Anything at all was reported for this day. */
export const hasData = (p: ActivitySeriesPoint): boolean =>
    p.sessions > 0
    || Number.isFinite(p.steps as number)
    || Number.isFinite(p.activeKcal as number)
    || Number.isFinite(p.exerciseMin as number)
    || Number.isFinite(p.distanceM as number)
    || Number.isFinite(p.restingBpm as number)
    || Number.isFinite(p.avgBpm as number);

interface Props {
    series: ActivitySeriesPoint[];
    value: string;
    onChange: (day: string) => void;
}

export function DayStrip({ series, value, onChange }: Props) {
    const scroller = useRef<ScrollView>(null);

    // The newest day is the one people want, and it is at the far right.
    useEffect(() => {
        const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 0);
        return () => clearTimeout(t);
    }, [series.length]);

    return (
        <ScrollView
            ref={scroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {series.map((p) => {
                const date = new Date(`${p.day}T00:00:00`);
                const selected = p.day === value;
                const filled = hasData(p);

                return (
                    <Pressable
                        key={p.day}
                        onPress={() => onChange(p.day)}
                        style={[styles.day, selected && styles.daySelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${filled ? '' : ', no data'}`}
                    >
                        <Text style={[styles.weekday, selected && styles.onSelected]}>
                            {LETTERS[date.getDay()]}
                        </Text>
                        <Text style={[styles.date, selected && styles.onSelected, !filled && !selected && styles.muted]}>
                            {date.getDate()}
                        </Text>
                        <View style={[styles.dot, filled && styles.dotFilled, selected && styles.dotOnSelected]} />
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { gap: 6, paddingRight: Spacing.xl },
    day: {
        alignItems: 'center',
        gap: 3,
        width: 42,
        paddingVertical: Spacing.sm,
        borderRadius: 12,
        backgroundColor: Palette.surface,
    },
    daySelected: { backgroundColor: Palette.primary },
    weekday: { fontSize: 10, fontFamily: Fonts.medium, color: Palette.textSecondary },
    date: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    muted: { color: Palette.textMuted },
    onSelected: { color: Palette.white },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    dotFilled: { backgroundColor: Palette.primary },
    dotOnSelected: { backgroundColor: Palette.white },
});
