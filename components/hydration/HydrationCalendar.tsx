/**
 * The month grid from `Design/hydration.svg` frame 3 — a date, and under it a mark saying
 * how that day went.
 *
 * Three marks, not two, and the third is the whole point. The design draws a green tick for
 * a day that met its goal, a red cross for one that fell short, and a **plain empty ring**
 * for a day with nothing on it. Collapsing the last two into one cross is the obvious
 * simplification and it is wrong: a day nobody logged is a day this app measured nothing on,
 * and marking it as failure turns "I forgot to open the app on holiday" into a fortnight of
 * dehydration on somebody's health record. That is the distinction `levelFor` makes on the
 * server by returning null rather than `minimal`, and `dayStatus` carries it here.
 *
 * A future date is dimmed and inert for the same reason `ActivityCalendar` dims one: drawing
 * the rest of the month like a missed Tuesday invents three weeks of failure every time
 * somebody opens this on the 5th.
 *
 * Each day is judged against **its own** target, which is why the series carries one per row.
 * The target moves with body mass and recorded activity, so grading a month against today's
 * figure would restage every day in it whenever somebody weighed themselves.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { dayStatus, type DayStatus } from '@/lib/hydration';
import type { SeriesPoint } from '@/lib/metrics';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');

export const shiftMonth = (month: string, delta: number): string => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

const monthTitle = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });
};

function Mark({ status }: { status: DayStatus }) {
    if (status === 'met') {
        return (
            <View style={[styles.mark, styles.markMet]}>
                <Ionicons name="checkmark" size={13} color={Palette.white} />
            </View>
        );
    }
    if (status === 'short') {
        return (
            <View style={[styles.mark, styles.markShort]}>
                <Ionicons name="close" size={13} color={Palette.white} />
            </View>
        );
    }
    // Nothing logged, or a day still to come. Same empty ring, because neither is a verdict.
    return <View style={[styles.mark, styles.markEmpty, status === 'future' && styles.markFuture]} />;
}

interface Props {
    month: string;
    series: SeriesPoint[];
    /** Local today, so tomorrow is never drawn as a miss. */
    today: string;
    onChangeMonth: (month: string) => void;
    onSelect?: (day: string) => void;
}

export function HydrationCalendar({ month, series, today, onChangeMonth, onSelect }: Props) {
    const byDay = useMemo(() => new Map(series.map((p) => [p.day, p])), [series]);

    const [year, mon] = month.split('-').map(Number);
    const offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
    const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();

    const cells: (string | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length }, (_, i) => `${month}-${pad(i + 1)}`),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const atCurrentMonth = month >= today.slice(0, 7);

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Pressable
                    onPress={() => onChangeMonth(shiftMonth(month, -1))}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                >
                    <Ionicons name="chevron-back" size={18} color={Palette.textSecondary} />
                </Pressable>
                <Text style={styles.title}>{monthTitle(month)}</Text>
                <Pressable
                    onPress={() => !atCurrentMonth && onChangeMonth(shiftMonth(month, 1))}
                    disabled={atCurrentMonth}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    accessibilityState={{ disabled: atCurrentMonth }}
                >
                    <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={atCurrentMonth ? Palette.border : Palette.textSecondary}
                    />
                </Pressable>
            </View>

            <View style={styles.week}>
                {WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
            </View>

            <View style={styles.grid}>
                {cells.map((day, i) => {
                    if (!day) return <View key={`blank${i}`} style={styles.cell} />;

                    const point = byDay.get(day);
                    // A day outside the fetched window is "nothing known", which draws the
                    // same as "nothing logged" — an empty ring claims nothing either way.
                    const status = point ? dayStatus(point, today) : (day > today ? 'future' : 'none');
                    const isToday = day === today;

                    return (
                        <Pressable
                            key={day}
                            style={styles.cell}
                            disabled={status === 'future' || !onSelect}
                            onPress={() => onSelect?.(day)}
                            accessibilityRole={onSelect ? 'button' : undefined}
                            accessibilityLabel={`${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}: ${LABELS[status]}`}
                        >
                            <View style={[styles.inner, isToday && styles.innerToday]}>
                                <Text style={[styles.date, status === 'future' && styles.dateFuture]}>
                                    {Number(day.slice(-2))}
                                </Text>
                                <Mark status={status} />
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const LABELS: Record<DayStatus, string> = {
    met: 'target met',
    short: 'under target',
    none: 'nothing logged',
    future: 'still to come',
};

const MARK = 22;

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },

    week: { flexDirection: 'row' },
    weekday: {
        flex: 1, textAlign: 'center',
        fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xs },
    cell: { width: `${100 / 7}%`, alignItems: 'center' },
    inner: {
        alignItems: 'center', gap: 5,
        paddingVertical: 5, paddingHorizontal: 4,
        borderRadius: Radius.md,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    // The design boxes today rather than filling it, so the day's own mark still reads.
    innerToday: { borderColor: Palette.primary },

    date: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.text },
    dateFuture: { color: Palette.textMuted },

    mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
    markMet: { backgroundColor: '#22C55E' },
    markShort: { backgroundColor: '#EF4444' },
    markEmpty: { borderWidth: 1.5, borderColor: Palette.textSecondary },
    markFuture: { borderColor: Palette.border },
});
