/**
 * The week strip under the dashboard header — `Design/sleep.svg` frames 6 and 7.
 *
 * Seven letters with a ring under each: how much of that night's goal was met. The design
 * fills the ring for a night that was slept and leaves it hollow for one that was not, and
 * marks today's letter in purple.
 *
 * **A hollow ring means "nothing recorded", not "no sleep".** They are different facts and
 * the strip has to keep them apart, because a row of empty rings on the week somebody was
 * away from their watch would read as a week of insomnia. A day with a night but no goal to
 * measure it against draws a solid dot rather than a ring — the same call
 * `ActivityCalendar` makes for a day with no target.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Palette, Fonts } from '@/constants/theme';
import { nightHasData, type SleepSeriesPoint } from '@/lib/sleep';

const SIZE = 34;
const STROKE = 3;

/** `M T W T F S S` from the day string, in the viewer's own locale. */
const letterFor = (day: string): string => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1)
        .toLocaleDateString(undefined, { weekday: 'narrow' });
};

interface Props {
    series: SleepSeriesPoint[];
    today: string;
    selected?: string;
    onSelect?: (day: string) => void;
}

export function WeekStrip({ series, today, selected, onSelect }: Props) {
    // The last seven, so a longer range still draws a week here rather than a squashed month.
    const week = series.slice(-7);

    return (
        <View style={styles.strip}>
            {week.map((point) => {
                const isToday = point.day === today;
                const isSelected = (selected || today) === point.day;
                const has = nightHasData(point);
                const progress = point.goalProgress;
                const radius = (SIZE - STROKE) / 2;
                const circumference = 2 * Math.PI * radius;

                return (
                    <Pressable
                        key={point.day}
                        style={styles.column}
                        onPress={onSelect ? () => onSelect(point.day) : undefined}
                        disabled={!onSelect}
                        accessibilityRole={onSelect ? 'button' : undefined}
                        accessibilityLabel={`${letterFor(point.day)} ${has ? 'slept' : 'nothing recorded'}`}
                    >
                        <Text style={[
                            styles.letter,
                            isToday && styles.letterToday,
                            isSelected && styles.letterSelected,
                        ]}>
                            {letterFor(point.day)}
                        </Text>

                        <View style={styles.ring}>
                            <Svg width={SIZE} height={SIZE}>
                                <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                                    <Circle
                                        cx={SIZE / 2} cy={SIZE / 2} r={radius}
                                        stroke={isSelected ? Palette.primary : Palette.borderSlate}
                                        strokeWidth={STROKE}
                                        fill="none"
                                    />
                                    {has && Number.isFinite(progress as number) ? (
                                        <Circle
                                            cx={SIZE / 2} cy={SIZE / 2} r={radius}
                                            stroke={Palette.primary}
                                            strokeWidth={STROKE}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={circumference * (1 - (progress as number))}
                                            strokeLinecap="round"
                                            fill="none"
                                        />
                                    ) : null}
                                </G>
                            </Svg>
                            {/* A night with no goal behind it: solid, because there is nothing
                                to draw a proportion of, and hollow would say nothing happened. */}
                            {has && !Number.isFinite(progress as number) ? (
                                <View style={styles.solid} />
                            ) : null}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
    column: { alignItems: 'center', gap: 6, flex: 1 },
    letter: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textMuted },
    letterToday: { color: Palette.primary },
    letterSelected: { fontFamily: Fonts.bold, color: Palette.primary },
    ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    solid: {
        position: 'absolute', width: 12, height: 12, borderRadius: 6,
        backgroundColor: Palette.primaryPale,
    },
});

export default WeekStrip;
