/**
 * The design's week grid of up / down / level arrows.
 *
 * Two things it is careful about, both inherited from the server's `buildCalendar`:
 *
 * 1. **Every day is compared against today, not against the day before it.** A steady trend
 *    compared day-on-day is a wall of identical arrows that says nothing the chart above it
 *    does not already say; compared against where the person is now it answers the question
 *    the grid is actually asked.
 * 2. **The colour is the tone, never the direction.** A falling blood pressure is green and a
 *    falling step count is not, and a metric with no better direction — weight, calories — is
 *    drawn neutral throughout, because colouring it would make the app take a view on
 *    somebody's body. `tone` carries that decision from the server so the two halves cannot
 *    disagree.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Radius } from '@/constants/theme';
import type { CalendarDay } from '@/lib/prediction';

interface Props {
    days: CalendarDay[];
    /** Whether the legend names a better direction at all. */
    betterWhen: 'rising' | 'falling' | null;
}

const HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const TONE = {
    good: { colour: Palette.successDeep, bg: Palette.successSurface },
    bad: { colour: Palette.danger, bg: Palette.dangerSurface },
    neutral: { colour: Palette.textMuted, bg: Palette.borderLight },
} as const;

const GLYPH = { up: 'arrow-up', down: 'arrow-down', level: 'remove' } as const;

/** Monday-first weeks, with the leading days of the first week left blank. */
const toWeeks = (days: CalendarDay[]) => {
    if (!days.length) return [];

    const rows: { label: string; cells: (CalendarDay | null)[] }[] = [];
    let cells: (CalendarDay | null)[] = [];

    const weekdayIndex = (iso: string) => (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;

    for (let i = 0; i < weekdayIndex(days[0].day); i += 1) cells.push(null);

    for (const day of days) {
        cells.push(day);
        if (cells.length === 7) {
            rows.push({ label: labelFor(cells), cells });
            cells = [];
        }
    }
    if (cells.length) {
        while (cells.length < 7) cells.push(null);
        rows.push({ label: labelFor(cells), cells });
    }
    return rows;
};

const labelFor = (cells: (CalendarDay | null)[]) => {
    const first = cells.find(Boolean);
    if (!first) return '';
    const d = new Date(`${first.day}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function DirectionCalendar({ days, betterWhen }: Props) {
    const weeks = useMemo(() => toWeeks(days), [days]);

    if (!weeks.length) return null;

    return (
        <View>
            <View style={styles.headRow}>
                <View style={styles.rowLabel} />
                {HEADS.map((h, i) => (
                    <Text key={i} style={styles.head}>{h}</Text>
                ))}
            </View>

            {weeks.map((week, wi) => (
                <View key={wi} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{week.label}</Text>
                    {week.cells.map((cell, ci) => {
                        if (!cell) return <View key={ci} style={styles.cell} />;
                        const tone = TONE[cell.tone];
                        return (
                            <View key={ci} style={styles.cell}>
                                <View
                                    style={[styles.pill, { backgroundColor: tone.bg }]}
                                    accessibilityLabel={
                                        `${cell.day}: projected ${cell.value}, `
                                        + `${cell.direction === 'level' ? 'about the same as today' : `${cell.direction} on today`}`
                                    }
                                >
                                    <Ionicons name={GLYPH[cell.direction]} size={13} color={tone.colour} />
                                </View>
                            </View>
                        );
                    })}
                </View>
            ))}

            <View style={styles.legend}>
                {betterWhen ? (
                    <>
                        <Legend colour={Palette.successDeep} label={betterWhen === 'rising' ? 'Improving' : 'Below normal'} />
                        <Legend colour={Palette.textMuted} label="About the same" />
                        <Legend colour={Palette.danger} label={betterWhen === 'rising' ? 'Declining' : 'Elevated'} />
                    </>
                ) : (
                    <>
                        <Legend colour={Palette.textMuted} label="About the same as today" />
                        <Legend colour={Palette.textMuted} label="Higher or lower — not better or worse" />
                    </>
                )}
            </View>
        </View>
    );
}

const Legend = ({ colour, label }: { colour: string; label: string }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colour }]} />
        <Text style={styles.legendLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    rowLabel: {
        width: 56, fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary,
    },
    head: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    cell: { flex: 1, alignItems: 'center' },
    pill: {
        width: 30, height: 26, borderRadius: Radius.sm,
        alignItems: 'center', justifyContent: 'center',
    },
    legend: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 14,
        marginTop: 10, justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 6, height: 6, borderRadius: 3 },
    legendLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
