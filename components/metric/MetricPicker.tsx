/**
 * Which metric the dashboard chart is plotting.
 *
 * The chart drew active minutes and only active minutes, while the same response carried
 * steps, distance, calories, floors and the day's heart rate — so the one number a person
 * checks first was the one number they could not see. This is the switch.
 *
 * **Only metrics with data are offered.** A chip for a figure the phone has never recorded
 * is a control that leads to an empty chart, which is the "microphone that appears live and
 * fails on tap" the assistant's composer already refuses to draw. `availableMetrics` filters
 * against the series before any of this renders.
 */
import React from 'react';
import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { ActivityMetricKey, ActivitySeriesPoint } from '@/lib/activity';

export interface ChartMetric {
    key: ActivityMetricKey;
    label: string;
    /** Drawn on the y-axis. */
    unit: string;
    color: string;
    fill: string;
    /** Stored unit → plotted unit, where they differ. Metres are not what a chart shows. */
    scale?: (v: number) => number;
}

export const CHART_METRICS: ChartMetric[] = [
    { key: 'exerciseMin', label: 'Active minutes', unit: 'min', color: Palette.primary, fill: Palette.primarySurface },
    { key: 'steps', label: 'Steps', unit: '', color: Palette.indigo, fill: Palette.primarySurface },
    { key: 'activeKcal', label: 'Calories', unit: 'kcal', color: Palette.amber, fill: '#FEF3C7' },
    {
        key: 'distanceM',
        label: 'Distance',
        unit: 'km',
        color: Palette.success,
        fill: Palette.successBand,
        scale: (m) => Math.round((m / 1000) * 100) / 100,
    },
    { key: 'restingBpm', label: 'Resting HR', unit: 'bpm', color: Palette.danger, fill: Palette.dangerSurface },
    { key: 'avgBpm', label: 'Average HR', unit: 'bpm', color: Palette.danger, fill: Palette.dangerSurface },
    { key: 'floors', label: 'Floors', unit: '', color: Palette.info, fill: Palette.infoSurface },
    { key: 'hrvMs', label: 'HRV', unit: 'ms', color: Palette.info, fill: Palette.infoSurface },
];

/**
 * The metrics this series can actually draw.
 *
 * Active minutes stay in the list whatever happens: it is the metric the person's own
 * logged activities feed, so it is the one thing that is theirs even with nothing connected,
 * and an empty dashboard with no chips at all reads as a broken screen.
 */
export const availableMetrics = (series: ActivitySeriesPoint[]): ChartMetric[] =>
    CHART_METRICS.filter((m) =>
        m.key === 'exerciseMin' || series.some((p) => Number.isFinite(p[m.key] as number))
    );

interface Props {
    metrics: ChartMetric[];
    value: ActivityMetricKey;
    onChange: (key: ActivityMetricKey) => void;
}

export function MetricPicker({ metrics, value, onChange }: Props) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {metrics.map((m) => {
                const active = m.key === value;
                return (
                    <Pressable
                        key={m.key}
                        onPress={() => onChange(m.key)}
                        style={[styles.chip, active && { backgroundColor: m.color, borderColor: m.color }]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Chart ${m.label}`}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>{m.label}</Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { gap: Spacing.sm, paddingRight: Spacing.xl },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: 7,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    label: { fontSize: 12.5, fontFamily: Fonts.medium, color: Palette.textSecondary },
    labelActive: { fontFamily: Fonts.semibold, color: Palette.white },
});
