/**
 * The dashboard's area chart, shared by all three metric screens.
 *
 * `react-native-svg` and no charting library, for the reason `TrendChart` already gives:
 * one series and a fill is not enough requirement to justify the weight.
 *
 * **Gaps are drawn as gaps.** A day a watch was not worn has no value, and joining across
 * it draws a straight line through days that never happened — which reads as steady
 * activity through a week someone spent ill. Null points break the path instead, and the
 * caption says how many days reported.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Palette, Fonts } from '@/constants/theme';

export interface MetricPoint {
    day: string;
    value: number | null;
}

interface Props {
    points: MetricPoint[];
    width: number;
    height?: number;
    color?: string;
    fillColor?: string;
    /** Rendered on the y-axis labels, e.g. 'min' or 'kcal'. */
    unit?: string;
    /** How many x labels to show. Seven days get seven; a year gets six. */
    maxXLabels?: number;
}

const PADDING = { top: 14, right: 10, bottom: 24, left: 34 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const labelFor = (day: string, total: number): string => {
    const d = new Date(`${day}T00:00:00`);
    if (total <= 7) return WEEKDAYS[d.getDay()];
    if (total <= 31) return String(d.getDate());
    return d.toLocaleDateString(undefined, { month: 'short' });
};

export function MetricAreaChart({
    points,
    width,
    height = 180,
    color = Palette.primary,
    fillColor = Palette.primarySurface,
    unit,
    maxXLabels = 7,
}: Props) {
    const chart = useMemo(() => {
        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;
        if (plotW <= 0 || points.length === 0) return null;

        const values = points.map((p) => p.value).filter((v): v is number => Number.isFinite(v as number));
        if (values.length === 0) return null;

        const max = Math.max(...values);
        const min = Math.min(...values, 0);
        // A flat series would divide by zero and collapse to the baseline; give it headroom.
        const span = max - min || Math.max(1, max || 1);

        const x = (i: number) => PADDING.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
        const y = (v: number) => PADDING.top + plotH - ((v - min) / span) * plotH;

        // Runs of consecutive non-null points. Each becomes its own path, so a missing day
        // leaves a visible break rather than an invented straight line.
        const runs: { i: number; value: number }[][] = [];
        let run: { i: number; value: number }[] = [];
        points.forEach((p, i) => {
            if (Number.isFinite(p.value as number)) {
                run.push({ i, value: p.value as number });
            } else if (run.length) {
                runs.push(run);
                run = [];
            }
        });
        if (run.length) runs.push(run);

        const linePaths = runs.map((r) =>
            r.map((pt, k) => `${k === 0 ? 'M' : 'L'}${x(pt.i)},${y(pt.value)}`).join(' ')
        );

        const areaPaths = runs
            .filter((r) => r.length > 1)
            .map((r) => {
                const top = r.map((pt, k) => `${k === 0 ? 'M' : 'L'}${x(pt.i)},${y(pt.value)}`).join(' ');
                const baseline = PADDING.top + plotH;
                return `${top} L${x(r[r.length - 1].i)},${baseline} L${x(r[0].i)},${baseline} Z`;
            });

        // A single reported day cannot draw a line, so mark it
        const dots = runs.filter((r) => r.length === 1).map((r) => ({ cx: x(r[0].i), cy: y(r[0].value) }));

        const ticks = [min, min + span / 2, min + span].map((v) => ({ v, y: y(v) }));

        const step = Math.max(1, Math.ceil(points.length / maxXLabels));
        const xLabels = points
            .map((p, i) => ({ i, day: p.day }))
            .filter(({ i }) => i % step === 0 || i === points.length - 1)
            .map(({ i, day }) => ({ x: x(i), label: labelFor(day, points.length) }));

        return { linePaths, areaPaths, dots, ticks, xLabels, plotH, reported: values.length };
    }, [points, width, height, maxXLabels]);

    if (!chart) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={styles.emptyText}>No data for this range yet.</Text>
            </View>
        );
    }

    return (
        <View>
            <Svg width={width} height={height}>
                {chart.ticks.map((t, i) => (
                    <React.Fragment key={`t${i}`}>
                        <Line
                            x1={PADDING.left}
                            x2={width - PADDING.right}
                            y1={t.y}
                            y2={t.y}
                            stroke={Palette.borderLight}
                            strokeWidth={1}
                        />
                        <SvgText
                            x={PADDING.left - 6}
                            y={t.y + 4}
                            fontSize={10}
                            fill={Palette.textMuted}
                            textAnchor="end"
                        >
                            {Math.round(t.v)}
                        </SvgText>
                    </React.Fragment>
                ))}

                {chart.areaPaths.map((d, i) => (
                    <Path key={`a${i}`} d={d} fill={fillColor} opacity={0.75} />
                ))}
                {chart.linePaths.map((d, i) => (
                    <Path key={`l${i}`} d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
                ))}
                {chart.dots.map((d, i) => (
                    <Circle key={`d${i}`} cx={d.cx} cy={d.cy} r={3} fill={color} />
                ))}

                {chart.xLabels.map((l, i) => (
                    <SvgText
                        key={`x${i}`}
                        x={l.x}
                        y={height - 8}
                        fontSize={10}
                        fill={Palette.textMuted}
                        textAnchor="middle"
                    >
                        {l.label}
                    </SvgText>
                ))}
            </Svg>

            {chart.reported < points.length && (
                <Text style={styles.caption}>
                    {chart.reported} of {points.length} days have data
                    {unit ? ` (${unit})` : ''}. Gaps are days nothing was recorded.
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.borderLight,
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    caption: {
        marginTop: 6,
        fontSize: 11,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
    },
});
