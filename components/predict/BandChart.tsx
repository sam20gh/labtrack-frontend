/**
 * The LabTrack score prediction's min / average / max chart.
 *
 * The design draws three stacked series with the space between them filled — the app's only
 * chart of a *range* rather than of a value, and it exists because a score prediction is an
 * interval and the score screen has room to show it as one.
 *
 * The three series here are not three metrics: they are `low`, `value` and `high` off one
 * forecast. Labelling them Min / Average / Max, as the kit does, is what makes that readable
 * to somebody who has never met a prediction interval.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Palette, Fonts } from '@/constants/theme';
import type { SeriesPoint } from '@/lib/prediction';

interface Props {
    points: SeriesPoint[];
    width: number;
    height?: number;
}

const PADDING = { top: 10, right: 8, bottom: 34, left: 30 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SERIES = [
    { key: 'low' as const, label: 'Min', colour: Palette.text },
    { key: 'value' as const, label: 'Average', colour: Palette.primary },
    { key: 'high' as const, label: 'Max', colour: '#F43F5E' },
];

export function BandChart({ points, width, height = 190 }: Props) {
    const chart = useMemo(() => {
        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;
        if (plotW <= 0 || points.length < 2) return null;

        const all = points.flatMap((p) => [p.low, p.value, p.high]).filter((v): v is number => Number.isFinite(v as number));
        if (!all.length) return null;

        const rawMax = Math.max(...all);
        const rawMin = Math.min(...all);
        const pad = Math.max((rawMax - rawMin) * 0.15, 2);
        const max = rawMax + pad;
        const min = Math.max(0, rawMin - pad);
        const span = max - min || 1;

        const x = (i: number) => PADDING.left + (i / (points.length - 1)) * plotW;
        const y = (v: number) => PADDING.top + plotH - ((v - min) / span) * plotH;

        const line = (key: 'low' | 'value' | 'high') =>
            points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y((p[key] ?? p.value) as number)}`).join(' ');

        // Two fills: max→avg and avg→min. Filling the whole envelope in one colour would lose
        // the average, which is the line people actually read.
        const fill = (a: 'high' | 'value', b: 'value' | 'low') =>
            `${points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y((p[a] ?? p.value) as number)}`).join(' ')} `
            + `${points.slice().reverse().map((p, i) => `L${x(points.length - 1 - i)},${y((p[b] ?? p.value) as number)}`).join(' ')} Z`;

        const ticks = [min, min + span / 2, max].map((v) => ({ label: String(Math.round(v)), y: y(v) }));

        const step = Math.max(1, Math.ceil(points.length / 7));
        const labels = points
            .map((p, i) => ({ i, day: p.day }))
            .filter(({ i }) => i % step === 0 || i === points.length - 1)
            .map(({ i, day }) => {
                const d = new Date(`${day}T00:00:00`);
                return {
                    x: x(i),
                    // The end labels anchor to their own edge, or half of "Sun" hangs off the
                    // right of the chart and is clipped by the viewport.
                    anchor: i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
                    label: Number.isNaN(d.getTime())
                        ? ''
                        : points.length <= 8 ? WEEKDAYS[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`,
                };
            });

        return { line, fill, ticks, labels };
    }, [points, width, height]);

    if (!chart) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={styles.emptyText}>Not enough score history to project yet.</Text>
            </View>
        );
    }

    return (
        <View>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="bcHigh" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#F43F5E" stopOpacity={0.30} />
                        <Stop offset="1" stopColor="#F43F5E" stopOpacity={0.04} />
                    </LinearGradient>
                    <LinearGradient id="bcLow" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={Palette.primary} stopOpacity={0.30} />
                        <Stop offset="1" stopColor={Palette.primary} stopOpacity={0.06} />
                    </LinearGradient>
                </Defs>

                {chart.ticks.map((t, i) => (
                    <G key={`t${i}`}>
                        <Line
                            x1={PADDING.left} x2={width - PADDING.right} y1={t.y} y2={t.y}
                            stroke={Palette.borderLight} strokeWidth={1}
                        />
                        <SvgText
                            x={PADDING.left - 5} y={t.y + 4} fontSize={10}
                            fill={Palette.textMuted} textAnchor="end"
                        >
                            {t.label}
                        </SvgText>
                    </G>
                ))}

                <Path d={chart.fill('high', 'value')} fill="url(#bcHigh)" />
                <Path d={chart.fill('value', 'low')} fill="url(#bcLow)" />

                {SERIES.map((s) => (
                    <Path key={s.key} d={chart.line(s.key)} stroke={s.colour} strokeWidth={1.8} fill="none" />
                ))}

                {chart.labels.map((l, i) => (
                    <SvgText
                        key={`x${i}`} x={l.x} y={height - 16} fontSize={10}
                        fill={Palette.textMuted} textAnchor={l.anchor as 'start' | 'middle' | 'end'}
                    >
                        {l.label}
                    </SvgText>
                ))}
            </Svg>

            <View style={styles.legend}>
                {SERIES.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: s.colour }]} />
                        <Text style={styles.legendLabel}>{s.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    empty: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.borderLight, borderRadius: 12,
    },
    emptyText: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },
});
