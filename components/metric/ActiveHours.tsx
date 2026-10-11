/**
 * "Most active time" — `Design/activity.svg` frame 18.
 *
 * Twenty-four bars over a dotted rail, the busiest two-hour window named underneath. The
 * design draws the rail as dots rather than an axis line so an hour with nothing in it is
 * visibly *an hour*, not a gap in a chart.
 *
 * Two things this card refuses to do, both decided in `utils/activityInsight.js`:
 *
 * 1. **It will not name a window from one or two sessions.** `peak` comes back null and the
 *    card says how many it has instead. An hour named from a single run is advice that
 *    changes every week, which is how a person learns to stop reading a card.
 * 2. **It says nothing about whether that hour is a good one.** There is no chronobiology
 *    engine behind this; it reports when somebody trained, and the copy stops there.
 *
 * Touch an hour, or drag along the rail, to read how long was spent training in it.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartCallout } from '@/components/charts/ChartCallout';
import type { ActiveHoursInsight } from '@/lib/activity';

/** "9 AM", "12 PM" — the clock the design's caption is written in. */
const hourLabel = (h: number): string => {
    const hour = ((h % 24) + 24) % 24;
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

const RAIL = [0, 6, 12, 18];
const CHART_HEIGHT = 58;
const BAR_MAX = 54;
const SLOT_GAP = 2;

export function ActiveHours({ data }: { data: ActiveHoursInsight }) {
    const styles = useStyles();
    const max = Math.max(...data.hours, 1);
    const total = data.hours.reduce((sum, m) => sum + m, 0);
    const barHeight = (minutes: number) => Math.max(4, (minutes / max) * BAR_MAX);

    const scrub = useChartScrub({
        columns: { count: data.hours.length, gap: SLOT_GAP },
        resetKey: data.hours.join(','),
        enabled: total > 0,
        label: 'Training time by hour of day',
        describe: (h) => `${hourLabel(h)}: ${data.hours[h] ? `${Math.round(data.hours[h])} minutes` : 'no training'}`,
    });
    const picked = scrub.index;
    const pickedMinutes = picked !== null ? data.hours[picked] ?? 0 : 0;

    return (
        <View style={styles.card}>
            <View style={styles.chart} {...scrub.containerProps}>
                {data.hours.map((minutes, hour) => {
                    const inPeak = data.peak
                        // A window can wrap past midnight, so this is a modular test rather
                        // than `hour >= from && hour < to`.
                        ? ((hour - data.peak.from + 24) % 24) < ((data.peak.to - data.peak.from + 24) % 24 || 24)
                        : false;

                    return (
                        <View key={hour} style={styles.slot}>
                            {minutes > 0 ? (
                                <View
                                    style={[
                                        styles.bar,
                                        // Floored so a ten-minute walk is a mark rather than a
                                        // hairline nobody can see.
                                        { height: barHeight(minutes) },
                                        inPeak ? styles.barPeak : styles.barPlain,
                                        scrub.index === hour && styles.barActive,
                                    ]}
                                />
                            ) : (
                                <View style={styles.dot} />
                            )}
                        </View>
                    );
                })}

                {picked !== null && scrub.xs[picked] !== undefined ? (
                    <ChartCallout
                        x={scrub.xs[picked]}
                        pointY={pickedMinutes > 0 ? CHART_HEIGHT - barHeight(pickedMinutes) : null}
                        chartWidth={scrub.width}
                        title={`${hourLabel(picked)} – ${hourLabel(picked + 1)}`}
                        value={pickedMinutes > 0 ? `${Math.round(pickedMinutes)} min` : 'No training'}
                        detail={pickedMinutes > 0 && total > 0
                            ? `${Math.round((pickedMinutes / total) * 100)}% of your training time`
                            : null}
                    />
                ) : null}
            </View>

            <View style={styles.axis}>
                {RAIL.map((h) => (
                    <Text key={h} style={styles.axisLabel}>{hourLabel(h)}</Text>
                ))}
            </View>

            {data.peak ? (
                <>
                    <Text style={styles.headline}>
                        {hourLabel(data.peak.from)} – {hourLabel(data.peak.to)}
                    </Text>
                    <Text style={styles.copy}>
                        You were most active between {hourLabel(data.peak.from)} and{' '}
                        {hourLabel(data.peak.to)} — {Math.round(data.peak.share * 100)}% of the
                        time you trained in this period.
                    </Text>
                </>
            ) : (
                <Text style={styles.copy}>
                    {data.sessions === 0
                        ? 'No workouts in this period, so there is no pattern to read yet.'
                        : `Only ${data.sessions} ${data.sessions === 1 ? 'workout' : 'workouts'} here — a few more and this will show when you usually train.`}
                </Text>
            )}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: 4,
    },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: SLOT_GAP },
    slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: 5, borderRadius: 3 },
    barPeak: { backgroundColor: Palette.primaryFill },
    barPlain: { backgroundColor: Palette.primaryPale },
    barActive: { backgroundColor: Palette.primary, width: 7 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Palette.border },
    axis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    axisLabel: { fontSize: 10, ...BodyFont.regular, color: Palette.textMuted },
    headline: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    copy: { fontSize: 12.5, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 18 },
}));
