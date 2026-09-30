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
import { Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { MonthGrid } from '@/components/ui/MonthGrid';
import type { CalendarDay } from '@/lib/activity';

const CELL = 38;
const RING = 32;
const STROKE = 2;

function DayRing({ progress, selected }: { progress: number | null; selected: boolean }) {
    const Palette = usePalette();
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

/**
 * The month frame — header, weekdays, blanks — is `MonthGrid`'s. What is drawn here is the
 * day: its ring, its selection, and the dot for a day with data but no target.
 */
export function ActivityCalendar({
    month, days, value, today, loading, onChangeMonth, onSelect,
}: Props) {
    const styles = useStyles();
    const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

    return (
        <MonthGrid
            month={month}
            onChangeMonth={onChangeMonth}
            // A month entirely in the future has nothing to walk forward into.
            maxMonth={today.slice(0, 7)}
            cellHeight={CELL + 8}
            loading={loading}
            renderDay={(day) => {
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
            }}
        />
    );
}

const useStyles = makeStyles((Palette) => ({
    cell: { alignItems: 'center', justifyContent: 'center', gap: 2 },
    ringBox: {
        width: RING,
        height: RING,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RING / 2,
    },
    ringBoxSelected: { backgroundColor: Palette.primaryFill },
    date: { fontSize: 12.5, ...BodyFont.medium, color: Palette.text },
    dateSelected: { fontFamily: Fonts.semibold, color: Palette.white },
    quiet: { color: Palette.textSecondary },
    future: { color: Palette.border },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    dotOn: { backgroundColor: Palette.primaryFill },
}));
