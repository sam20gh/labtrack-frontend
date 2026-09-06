/**
 * The two charts that only the sleep insight screen draws — `Design/sleep.svg` frame 12.
 *
 * `WeekdayBars` is "Average Sleep Time": one bar per weekday with the mean across them as a
 * dashed line. `StageRangeRows` is "Average Range": per stage, the typical night with the
 * middle-half spread drawn behind it.
 *
 * Both refuse to draw a zero for a missing figure. A weekday nobody slept through gets no
 * bar, not a bar on the floor, and a stage nothing reported gets a row saying so — the same
 * rule `nutritionInsight` holds about a day nobody logged on, and the reason the server
 * sends nulls rather than zeros in the first place.
 *
 * `react-native-svg` is used only where a shape needs it; the bars are views, because a bar
 * chart of seven values is a flex row and a charting library would be weight for nothing —
 * the argument `MetricAreaChart` already records.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { STAGE_META, formatMinutes, type SleepStageKey } from '@/lib/sleep';

export interface WeekdayBucket {
    index: number;
    label: string;
    nights: number;
    avgMin: number | null;
}

/**
 * "Average Sleep Time".
 *
 * The y-scale starts at the shortest measured night rather than at zero, which is what the
 * design does — every adult night is somewhere between five and nine hours, so a zero-based
 * axis draws seven bars of near-identical height and says nothing. The axis labels print the
 * real hours so the compressed scale is visible rather than implied.
 */
export function WeekdayBars({
    days, averageMin, height = 150,
}: {
    days: WeekdayBucket[];
    averageMin: number | null;
    height?: number;
}) {
    const measured = days.filter((d) => Number.isFinite(d.avgMin as number));
    if (!measured.length) return null;

    const values = measured.map((d) => d.avgMin as number);
    const max = Math.max(...values, averageMin ?? 0);
    const min = Math.min(...values, averageMin ?? max);
    // A floor of an hour of headroom, so a week where every night was 7h02–7h05 does not
    // draw one full-height bar and six empty ones.
    const span = Math.max(max - min, 60);
    const base = min - span * 0.15;
    const top = max + span * 0.15;

    const heightOf = (value: number) => ((value - base) / (top - base)) * 100;

    return (
        <View>
            <View style={[styles.plot, { height }]}>
                {averageMin !== null ? (
                    <View style={[styles.avgLine, { bottom: `${heightOf(averageMin)}%` }]}>
                        <View style={styles.avgDash} />
                        <Text style={styles.avgTag}>AVG</Text>
                    </View>
                ) : null}

                <View style={styles.bars}>
                    {days.map((day) => (
                        <View key={day.index} style={styles.barColumn}>
                            <View style={styles.barTrack}>
                                {Number.isFinite(day.avgMin as number) ? (
                                    <View
                                        style={[
                                            styles.bar,
                                            { height: `${Math.max(4, heightOf(day.avgMin as number))}%` },
                                        ]}
                                    />
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Its own row rather than a reuse of `bars`: that style is `height: '100%'` of
                the fixed-height plot above, and a percentage height under an auto-height
                parent collapses the labels to nothing. */}
            <View style={styles.labels}>
                {days.map((day) => (
                    <View key={`label-${day.index}`} style={styles.labelColumn}>
                        <Text style={styles.barLabel}>{day.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.scaleNote}>
                {`Scale ${formatMinutes(Math.round(base))} – ${formatMinutes(Math.round(top))}. `}
                {`Averaged over ${measured.reduce((s, d) => s + d.nights, 0)} nights.`}
            </Text>
        </View>
    );
}

export interface StageRange {
    stage: SleepStageKey;
    nights: number;
    avgMin: number | null;
    lowMin: number | null;
    highMin: number | null;
}

/**
 * "Average Range".
 *
 * The bar is the middle half of the nights — the 25th to 75th percentile — with a marker at
 * the typical one. Min-to-max was the alternative and is worse: one disturbed night widens
 * every row until the chart says only "it varies".
 */
export function StageRangeRows({ ranges }: { ranges: StageRange[] }) {
    const measured = ranges.filter((r) => Number.isFinite(r.avgMin as number));
    if (!measured.length) return null;

    // One scale across all four rows, so "Light 3h" is visibly three times "Deep 1h".
    const ceiling = Math.max(...measured.map((r) => r.highMin ?? r.avgMin ?? 0), 60);

    return (
        <View style={styles.ranges}>
            {ranges.map((row) => {
                const meta = STAGE_META[row.stage];
                const has = Number.isFinite(row.avgMin as number);
                const low = ((row.lowMin ?? 0) / ceiling) * 100;
                const high = ((row.highMin ?? 0) / ceiling) * 100;

                return (
                    <View key={row.stage} style={styles.rangeRow}>
                        <View style={styles.rangeHead}>
                            <View style={[styles.dot, { backgroundColor: meta.tint }]} />
                            <Text style={styles.rangeLabel}>{meta.label}</Text>
                            <Text style={styles.rangeValue}>
                                {has
                                    ? `${formatMinutes(row.lowMin)} – ${formatMinutes(row.highMin)}`
                                    : 'Not reported'}
                            </Text>
                        </View>

                        {has ? (
                            <View style={styles.rangeTrack}>
                                <View
                                    style={[
                                        styles.rangeFill,
                                        {
                                            left: `${low}%`,
                                            width: `${Math.max(2, high - low)}%`,
                                            backgroundColor: meta.tint,
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.rangeMarker,
                                        { left: `${((row.avgMin as number) / ceiling) * 100}%` },
                                    ]}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
            <Text style={styles.scaleNote}>
                The bar is the middle half of your nights; the mark is a typical one.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    plot: { position: 'relative', justifyContent: 'flex-end' },
    bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
    barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barTrack: { width: '58%', height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: Radius.sm, backgroundColor: Palette.primaryPale },
    labels: { flexDirection: 'row' },
    labelColumn: { flex: 1, alignItems: 'center' },
    barLabel: { fontSize: 11, fontFamily: Fonts.medium, color: Palette.textMuted, marginTop: 4 },

    avgLine: {
        position: 'absolute', left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', zIndex: 2,
    },
    avgDash: {
        flex: 1, height: 1,
        borderTopWidth: 1, borderStyle: 'dashed', borderColor: Palette.text,
    },
    avgTag: {
        fontSize: 9, fontFamily: Fonts.bold, color: Palette.white,
        backgroundColor: Palette.text,
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
    },

    ranges: { gap: Spacing.lg },
    rangeRow: { gap: 6 },
    rangeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    dot: { width: 9, height: 9, borderRadius: 5 },
    rangeLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    rangeValue: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    rangeTrack: {
        height: 12, borderRadius: 6, marginLeft: 17,
        backgroundColor: Palette.borderLight, position: 'relative', overflow: 'hidden',
    },
    rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 6, opacity: 0.85 },
    rangeMarker: {
        position: 'absolute', top: 0, bottom: 0, width: 3,
        backgroundColor: Palette.text, borderRadius: 2,
    },

    scaleNote: {
        fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: Spacing.sm,
    },
});
