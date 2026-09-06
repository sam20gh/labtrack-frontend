/**
 * "vs last period" — `Design/activity.svg` frame 18's Monthly Average card.
 *
 * A daily-average bar per day with the mean drawn through it as a dashed AVG line, the
 * headline figure, and the change against the window immediately before this one.
 *
 * Three things this card will not do:
 *
 * 1. **A day nothing reported draws no bar.** Not a zero-height one either — the slot is
 *    empty, which is the difference between a rest day and a day the watch was on charge.
 * 2. **It never prints a percentage the data cannot support.** `deltaPct` is null when the
 *    previous window reported nothing, and this draws "no comparison yet" rather than a
 *    triumphant +100% for having installed the app.
 * 3. **The arrow is not a verdict.** More calories burned is drawn green because this is an
 *    activity tracker and that is the direction the person is working in; it says nothing
 *    about whether it was good for them, which is the plan's job and not this card's.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { PeriodComparison } from '@/lib/activity';

interface Props {
    comparison: PeriodComparison;
    /** The per-day values behind the headline. Nulls are days nothing reported. */
    values: (number | null)[];
    /** "week", "month" — the window this is measured over, in the person's own words. */
    periodLabel: string;
    unit?: string;
}

/**
 * The most bars this chart will draw.
 *
 * A year of days is 365 slots, each a `<View>`, on a screen that also holds a calendar grid
 * and a session list — and 365 bars across 340pt is a smear, not a chart. The tail is what
 * the card is about ("this period against the last"), so a long range is drawn as its most
 * recent month and the caption still reports the average over the whole of it.
 */
const MAX_BARS = 31;

export function PeriodCompare({ comparison, values, periodLabel, unit = 'kcal' }: Props) {
    if (!comparison?.current) return null;

    const shown = values.length > MAX_BARS ? values.slice(-MAX_BARS) : values;
    const reported = shown.filter((v): v is number => Number.isFinite(v as number));
    if (!reported.length) return null;

    const max = Math.max(...reported);
    const mean = comparison.current.value;
    // The dashed AVG line sits at the mean's share of the tallest bar.
    const meanShare = max > 0 ? Math.min(1, mean / max) : 0;

    const up = (comparison.deltaPct ?? 0) > 0;

    return (
        <View style={styles.card}>
            <View style={styles.chart}>
                <View style={[styles.avgLine, { bottom: meanShare * 76 }]}>
                    <View style={styles.avgDash} />
                    <View style={styles.avgTag}><Text style={styles.avgTagText}>AVG</Text></View>
                </View>

                {shown.map((v, i) => (
                    <View key={i} style={styles.slot}>
                        {Number.isFinite(v as number) && (
                            <View
                                style={[
                                    styles.bar,
                                    { height: Math.max(3, ((v as number) / max) * 76) },
                                    (v as number) >= mean ? styles.barOver : styles.barUnder,
                                ]}
                            />
                        )}
                    </View>
                ))}
            </View>

            <Text style={styles.value}>
                {Math.round(mean).toLocaleString()}
                <Text style={styles.unit}>{unit}</Text>
            </Text>

            {comparison.deltaPct === null ? (
                <Text style={styles.copy}>
                    Averaged over {comparison.current.days}{' '}
                    {comparison.current.days === 1 ? 'day' : 'days'} with data. There is no
                    previous {periodLabel} to compare against yet.
                </Text>
            ) : (
                <>
                    <View style={styles.deltaRow}>
                        <Ionicons
                            name={up ? 'trending-up' : 'trending-down'}
                            size={16}
                            color={up ? Palette.successDeep : Palette.textSecondary}
                        />
                        <Text style={[styles.delta, up ? styles.deltaUp : styles.deltaDown]}>
                            {up ? '+' : ''}{comparison.deltaPct}%
                        </Text>
                        <Text style={styles.deltaLabel}>vs last {periodLabel}</Text>
                    </View>
                    <Text style={styles.copy}>
                        You averaged {up ? '+' : ''}{Math.round(comparison.delta ?? 0)} {unit} a day
                        compared with the previous {periodLabel}, across{' '}
                        {comparison.current.days} {comparison.current.days === 1 ? 'day' : 'days'} with data.
                    </Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: 4,
    },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2, marginBottom: Spacing.md },
    slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: '72%', maxWidth: 14, borderRadius: 3 },
    barOver: { backgroundColor: Palette.primary },
    barUnder: { backgroundColor: Palette.primaryPale },

    avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    avgDash: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.text },
    avgTag: {
        backgroundColor: Palette.text,
        borderRadius: Radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    avgTagText: { fontSize: 9.5, fontFamily: Fonts.bold, color: Palette.white, letterSpacing: 0.5 },

    value: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    unit: { fontSize: 17, fontFamily: Fonts.semibold, color: Palette.text },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    delta: { fontSize: 14, fontFamily: Fonts.bold },
    deltaUp: { color: Palette.successDeep },
    deltaDown: { color: Palette.textSecondary },
    deltaLabel: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },
    copy: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
});
