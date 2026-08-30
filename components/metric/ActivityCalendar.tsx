/**
 * The month grid — `Design/activity.svg` frames 7 and 20.
 *
 * Every date carries a ring showing how much of that day's share of the weekly target was
 * done, which is the design's own idea and a good one: a month of arcs shows the shape of
 * someone's habit at a glance in a way a list of numbers does not.
 *
 * Three rules, all of them the same rule the rest of the tracker follows:
 *
 * 1. **No target means no ring.** `progress` is null when nobody set one, and those days get
 *    a dot for "something was recorded" instead. An empty ring on a plan that does not exist
 *    tells a person they failed at something nobody asked of them.
 * 2. **A future date is not an empty day.** Days after today are dimmed and unselectable —
 *    drawing them the same as a missed Tuesday invents a fortnight of failure every month.
 * 3. **Over target pins at a full circle.** The server clamps it; a ring cannot draw 140%,
 *    and the honest place for that number is the goal card.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { CalendarDay } from '@/lib/activity';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CELL = 38;
const RING = 32;
const STROKE = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM` shifted by whole months, without tripping over month lengths. */
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

function DayRing({ progress, selected }: { progress: number | null; selected: boolean }) {
    const r = (RING - STROKE) / 2;
    const c = 2 * Math.PI * r;
    const filled = Math.max(0, Math.min(1, progress ?? 0));

    return (
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <G rotation={-90} origin={`${RING / 2}, ${RING / 2}`}>
                <Circle
                    cx={RING / 2} cy={RING / 2} r={r}
                    stroke={selected ? 'transparent' : Palette.border}
                    strokeWidth={STROKE}
                    fill="none"
                />
                {filled > 0 && (
                    <Circle
                        cx={RING / 2} cy={RING / 2} r={r}
                        stroke={selected ? Palette.white : Palette.primary}
                        strokeWidth={STROKE}
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - filled)}
                        strokeLinecap="round"
                        fill="none"
                    />
                )}
            </G>
        </Svg>
    );
}

interface Props {
    month: string;
    days: CalendarDay[];
    /** The `YYYY-MM-DD` currently being looked at. */
    value: string;
    /** Local today, so future dates can be dimmed rather than drawn as missed. */
    today: string;
    loading?: boolean;
    onChangeMonth: (month: string) => void;
    onSelect: (day: string) => void;
}

export function ActivityCalendar({
    month, days, value, today, loading, onChangeMonth, onSelect,
}: Props) {
    const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

    // Leading blanks so the first of the month lands under its weekday.
    const [year, mon] = month.split('-').map(Number);
    const offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
    const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();

    const cells: (string | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length }, (_, i) => `${month}-${pad(i + 1)}`),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    // A month entirely in the future has nothing to walk forward into.
    const atCurrentMonth = month >= today.slice(0, 7);

    return (
        <View style={styles.card}>
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
                {WEEKDAYS.map((w, i) => (
                    <Text key={`${w}${i}`} style={styles.weekday}>{w}</Text>
                ))}
            </View>

            <View style={[styles.grid, loading && styles.gridLoading]}>
                {cells.map((day, i) => {
                    if (!day) return <View key={`blank${i}`} style={styles.cell} />;

                    const row = byDay.get(day);
                    const future = day > today;
                    const selected = day === value;
                    // "Something happened" is broader than "a workout happened" — a day of
                    // 9,000 steps and no session is not an empty day.
                    const measured = Boolean(row && (row.sessions > 0
                        || Number.isFinite(row.exerciseMin as number)
                        || Number.isFinite(row.steps as number)
                        || Number.isFinite(row.activeKcal as number)));

                    return (
                        <Pressable
                            key={day}
                            onPress={() => !future && onSelect(day)}
                            disabled={future}
                            style={styles.cell}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: future }}
                            accessibilityLabel={`${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${measured ? '' : ', no data'}`}
                        >
                            <View style={[styles.ringBox, selected && styles.ringBoxSelected]}>
                                {(measured || selected) && (
                                    <DayRing progress={row?.progress ?? null} selected={selected} />
                                )}
                                <Text
                                    style={[
                                        styles.date,
                                        future && styles.future,
                                        !measured && !future && !selected && styles.quiet,
                                        selected && styles.dateSelected,
                                    ]}
                                >
                                    {Number(day.slice(-2))}
                                </Text>
                            </View>
                            {/*
                              The marker for a day that has data but no ring to draw — either
                              no target is set, or the day recorded steps and no exercise.
                            */}
                            <View style={[
                                styles.dot,
                                measured && row?.progress === null && !selected && styles.dotOn,
                            ]} />
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    title: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },

    week: { flexDirection: 'row', marginBottom: Spacing.sm },
    weekday: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        fontFamily: Fonts.medium,
        color: Palette.textMuted,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    gridLoading: { opacity: 0.45 },
    cell: {
        width: `${100 / 7}%`,
        height: CELL + 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    ringBox: {
        width: RING,
        height: RING,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RING / 2,
    },
    ringBoxSelected: { backgroundColor: Palette.primary },
    date: { fontSize: 12.5, fontFamily: Fonts.medium, color: Palette.text },
    dateSelected: { fontFamily: Fonts.semibold, color: Palette.white },
    quiet: { color: Palette.textSecondary },
    future: { color: Palette.border },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    dotOn: { backgroundColor: Palette.primary },
});
