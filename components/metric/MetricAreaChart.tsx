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

/**
 * A smooth path through the points, using **monotone** cubic interpolation.
 *
 * The design draws the series as a curve rather than a polyline, and a naive spline is the
 * wrong way to get one here: Catmull-Rom overshoots between points, so a week of
 * 0-0-8000-0 steps would bulge above 8,000 and dip below zero — inventing a step count
 * nobody took and a negative one nobody could. Fritsch–Carlson clamps the tangents so the
 * curve never leaves the range of the points it joins, which is the difference between a
 * chart that is prettier and a chart that is wrong.
 */
const smoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

    const n = pts.length;
    const h: number[] = [];
    const delta: number[] = [];
    for (let i = 0; i < n - 1; i += 1) {
        h.push(pts[i + 1].x - pts[i].x);
        delta.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
    }

    const m: number[] = new Array(n);
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
        // A local extreme gets a flat tangent, which is what stops the curve turning a peak
        // into two peaks with a dip between them.
        m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
    }

    for (let i = 0; i < n - 1; i += 1) {
        if (delta[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
        const a = m[i] / delta[i];
        const b = m[i + 1] / delta[i];
        const sq = a * a + b * b;
        if (sq > 9) {
            const tau = 3 / Math.sqrt(sq);
            m[i] = tau * a * delta[i];
            m[i + 1] = tau * b * delta[i];
        }
    }

    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i += 1) {
        const third = h[i] / 3;
        d += ` C${pts[i].x + third},${pts[i].y + m[i] * third}`
            + ` ${pts[i + 1].x - third},${pts[i + 1].y - m[i + 1] * third}`
            + ` ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
};

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

        const screen = (r: { i: number; value: number }[]) =>
            r.map((pt) => ({ x: x(pt.i), y: y(pt.value) }));

        const linePaths = runs.map((r) => smoothPath(screen(r)));

        // The fill reuses the line's own path so the two can never disagree about where the
        // curve went — closing it down to the baseline and back is all that differs.
        const areaPaths = runs
            .filter((r) => r.length > 1)
            .map((r) => {
                const baseline = PADDING.top + plotH;
                return `${smoothPath(screen(r))} L${x(r[r.length - 1].i)},${baseline}`
                    + ` L${x(r[0].i)},${baseline} Z`;
            });

        // A single reported day cannot draw a line, so mark it
        const dots = runs.filter((r) => r.length === 1).map((r) => ({ cx: x(r[0].i), cy: y(r[0].value) }));

        // A distance chart runs 0–8 km and a step chart runs 0–12,000. Rounding both to
        // whole numbers turns the first into three identical-looking gridlines.
        const label = (v: number) => (span < 10 ? String(Math.round(v * 10) / 10) : Math.round(v).toLocaleString());
        const ticks = [min, min + span / 2, min + span].map((v) => ({ v, label: label(v), y: y(v) }));

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
                            {t.label}
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
