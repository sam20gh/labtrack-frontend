/**
 * The hypnogram — the banded chart of which stage somebody was in through the night.
 *
 * `Design/sleep.svg` frames 7 (Sleep Insight), 10 (Chart Summary) and 28. Drawn from
 * `SleepSession.segments`, which is the reason those are stored rather than only the totals.
 *
 * **A gap is drawn as a gap.** Health Connect and HealthKit both report nights with holes in
 * them — a watch taken off at 3am, a phone that lost the session — and filling those with
 * the neighbouring stage would invent an hour of somebody's sleep. Segments are placed at
 * their real offsets on a time axis, so a hole is empty space with the axis still running
 * under it.
 *
 * **A source with no segments gets no chart.** Some trackers report four stage totals and
 * nothing about their order. There is no honest way to draw those as a night — any
 * arrangement would be a picture of a sleep pattern nobody recorded — so the component
 * returns null and the screen falls back to the breakdown rows, which are the same data
 * without the claim about sequence.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { STAGE_META, STAGE_ORDER, type SleepSegment, type SleepStageKey } from '@/lib/sleep';

interface Props {
    segments: SleepSegment[];
    height?: number;
    /** Hourly ticks under the chart. Off on a card, on in the night detail. */
    showAxis?: boolean;
}

/** Rows top to bottom, deepest at the bottom — the order a hypnogram is conventionally read. */
const ROWS: SleepStageKey[] = ['awake', 'rem', 'light', 'deep'];

/** `11p`, `2a` — the axis labels the design prints, which are hours and not times. */
const hourLabel = (date: Date): string => {
    const h = date.getHours();
    const suffix = h >= 12 ? 'p' : 'a';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${suffix}`;
};

export function Hypnogram({ segments, height = 132, showAxis = true }: Props) {
    const drawable = useMemo(
        () => (segments || []).filter((s) => STAGE_ORDER.includes(s.stage as SleepStageKey)),
        [segments]
    );

    const bounds = useMemo(() => {
        if (!drawable.length) return null;
        const start = Math.min(...drawable.map((s) => new Date(s.startedAt).getTime()));
        const end = Math.max(...drawable.map((s) => new Date(s.endedAt).getTime()));
        return end > start ? { start, end, span: end - start } : null;
    }, [drawable]);

    // Nothing to draw and nothing honest to draw instead. See the note above.
    if (!bounds) return null;

    const rowHeight = height / ROWS.length;

    /** Whole hours inside the night, for the axis. Capped so a long night stays readable. */
    const ticks: Date[] = [];
    const first = new Date(bounds.start);
    first.setMinutes(0, 0, 0);
    first.setHours(first.getHours() + 1);
    const step = bounds.span > 10 * 3_600_000 ? 2 : 1;
    for (let t = first.getTime(); t < bounds.end; t += step * 3_600_000) ticks.push(new Date(t));

    return (
        <View>
            <View style={[styles.plot, { height }]}>
                {ROWS.map((stage, index) => (
                    <View
                        key={`row-${stage}`}
                        style={[styles.rowLine, { top: index * rowHeight + rowHeight / 2 }]}
                    />
                ))}

                {drawable.map((segment, index) => {
                    const row = ROWS.indexOf(segment.stage as SleepStageKey);
                    const left = ((new Date(segment.startedAt).getTime() - bounds.start) / bounds.span) * 100;
                    const width = ((new Date(segment.endedAt).getTime() - new Date(segment.startedAt).getTime()) / bounds.span) * 100;

                    return (
                        <View
                            key={`${segment.startedAt}-${index}`}
                            style={{
                                position: 'absolute',
                                left: `${left}%`,
                                // A three-minute waking is a real event and must not vanish
                                // into a sub-pixel; floored at a width that is still visible.
                                width: `${Math.max(width, 0.8)}%`,
                                top: row * rowHeight + rowHeight / 2 - 5,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: STAGE_META[segment.stage as SleepStageKey].tint,
                            }}
                        />
                    );
                })}
            </View>

            {showAxis ? (
                <View style={styles.axis}>
                    {ticks.map((tick) => (
                        <Text
                            key={tick.toISOString()}
                            style={[
                                styles.tick,
                                { left: `${((tick.getTime() - bounds.start) / bounds.span) * 100}%` },
                            ]}
                        >
                            {hourLabel(tick)}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

/** The colour key. Its own component because the chart and the totals card both need it. */
export function StageLegend({ stages }: { stages?: SleepStageKey[] }) {
    return (
        <View style={styles.legend}>
            {(stages || STAGE_ORDER).map((stage) => (
                <View key={stage} style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: STAGE_META[stage].tint }]} />
                    <Text style={styles.legendLabel}>{STAGE_META[stage].label}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    plot: {
        position: 'relative',
        backgroundColor: Palette.background,
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    rowLine: {
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundColor: Palette.borderLight,
    },
    axis: { height: 18, marginTop: Spacing.xs, position: 'relative' },
    tick: {
        position: 'absolute', fontSize: 10, fontFamily: Fonts.regular,
        color: Palette.textMuted, transform: [{ translateX: -8 }],
    },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
});

export default Hypnogram;
