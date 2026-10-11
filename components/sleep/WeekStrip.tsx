/**
 * The week strip under the sleep dashboard's header — a day picker for the last seven nights.
 *
 * Started as `Design/sleep.svg` frames 6 and 7: seven letters with a small ring under each.
 * As drawn it could not be used. It was never given a handler, so every column was a disabled
 * button; the letters alone repeat (two Ts, two Ss), so nobody could tell which Tuesday; and a
 * 34pt ring with nothing in it said "something" without saying what.
 *
 * What it is now:
 *
 * 1. **A control.** Tapping a day selects that night, and the dial, the figures and the stages
 *    below all follow (`app/sleep/index.tsx`). The selected day carries the state colour
 *    (`primary` on `primarySurface`), the one place purple belongs on this strip.
 * 2. **Dated.** The day of the month sits inside the ring, so the column names one night.
 * 3. **The ring is the night's share of the goal, in the sleep colour** — the dial's colour
 *    (`readoutTint('sleep')`), so the strip and the dial above read as one thing.
 * 4. **A dashed ring means "nothing recorded", not "no sleep".** A row of empty rings on the
 *    week somebody was away from their watch must not read as a week of insomnia. A night with
 *    no goal to measure against draws a full faint ring rather than a proportion of nothing.
 * 5. **Today is a dot under the ring**, so it is still findable when another day is selected.
 *
 * Each column is ≥44pt wide on the narrowest phone (seven across 320pt less the gutters).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { nightHasData, type SleepSeriesPoint } from '@/lib/sleep';
import { readoutTint } from '@/lib/readout';

const SIZE = 36;
const STROKE = 3.5;

const dateOf = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
};

/** `M T W T F S S`, in the viewer's own locale. */
const letterFor = (day: string) => dateOf(day).toLocaleDateString(undefined, { weekday: 'narrow' });

/** "Thursday 8 October", for the screen reader. */
const spokenDay = (day: string) =>
    dateOf(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

interface Props {
    series: SleepSeriesPoint[];
    today: string;
    selected: string;
    onSelect: (day: string) => void;
}

export function WeekStrip({ series, today, selected, onSelect }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const tint = readoutTint('sleep', Palette);
    // The last seven, so a longer range on the chart below still draws a week here.
    const week = series.slice(-7);
    const radius = (SIZE - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <View style={styles.strip} accessibilityRole="tablist">
            {week.map((point) => {
                const isToday = point.day === today;
                const isSelected = point.day === selected;
                const has = nightHasData(point);
                const progress = Number.isFinite(point.goalProgress as number)
                    ? Math.max(0, Math.min(1, point.goalProgress as number))
                    : null;

                const spoken = `${spokenDay(point.day)}${isToday ? ', today' : ''}: ${
                    !has ? 'nothing recorded'
                        : Number.isFinite(point.score as number) ? `sleep score ${point.score}`
                            : 'night recorded'}${progress !== null ? `, ${Math.round(progress * 100)}% of goal` : ''}`;

                return (
                    <Pressable
                        key={point.day}
                        style={[styles.column, isSelected && styles.columnSelected]}
                        onPress={() => {
                            if (isSelected) return;
                            Haptics.selectionAsync().catch(() => undefined);
                            onSelect(point.day);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={spoken}
                    >
                        <Text style={[styles.letter, isSelected && styles.letterSelected]}>
                            {letterFor(point.day)}
                        </Text>

                        <View style={styles.ring}>
                            <Svg width={SIZE} height={SIZE}>
                                <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                                    <Circle
                                        cx={SIZE / 2} cy={SIZE / 2} r={radius}
                                        stroke={has ? tint : Palette.borderSlate}
                                        strokeOpacity={has ? 0.2 : 1}
                                        strokeWidth={STROKE}
                                        strokeDasharray={has ? undefined : '2.5 3.5'}
                                        fill="none"
                                    />
                                    {has ? (
                                        <Circle
                                            cx={SIZE / 2} cy={SIZE / 2} r={radius}
                                            stroke={tint}
                                            strokeOpacity={progress === null ? 0.45 : 1}
                                            strokeWidth={STROKE}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={circumference * (1 - (progress ?? 1))}
                                            strokeLinecap="round"
                                            fill="none"
                                        />
                                    ) : null}
                                </G>
                            </Svg>
                            <Text style={[styles.date, !has && styles.dateEmpty, isSelected && styles.dateSelected]}>
                                {dateOf(point.day).getDate()}
                            </Text>
                        </View>

                        <View style={[styles.todayDot, isToday && { backgroundColor: Palette.primary }]} />
                    </Pressable>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
    column: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        paddingBottom: 6,
        borderRadius: 16,
    },
    columnSelected: { backgroundColor: Palette.primarySurface },
    letter: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    letterSelected: { fontFamily: Fonts.bold, color: Palette.primary },
    ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    date: {
        position: 'absolute',
        fontSize: 13,
        fontFamily: Fonts.semibold,
        color: Palette.text,
        fontVariant: ['tabular-nums'],
    },
    dateEmpty: { color: Palette.textMuted },
    dateSelected: { color: Palette.primary },
    todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'transparent' },
}));

export default WeekStrip;
