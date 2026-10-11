/**
 * The dashboard's area chart, shared by the metric, sleep, activity, score and hydration
 * screens.
 *
 * `react-native-svg` and no charting library, for the reason `TrendChart` already gives:
 * one series and a fill is not enough requirement to justify the weight.
 *
 * **Gaps are drawn as gaps.** A day a watch was not worn has no value, and joining across
 * it draws a straight line through days that never happened — which reads as steady
 * activity through a week someone spent ill. Null points break the path instead, and the
 * caption says how many days reported.
 *
 * **It can be read with a finger.** Touch and drag across it and a crosshair snaps to each
 * day, with a callout naming the day and what it measured — the day's range where the rollup
 * keeps one, both numbers of a blood pressure. The rules are in `lib/chartScrub.ts` and the
 * gesture in `hooks/useChartScrub.ts`; nothing here re-derives a scale for the touch, so the
 * crosshair can never sit off the line it reads.
 *
 * **The floor is zero only for things that count up.** Steps, minutes, kilocalories and
 * millilitres start at zero, because the height of the area *is* the amount. A blood oxygen
 * of 95–99% on a zero floor is a flat line at the top of the card, and no amount of scrubbing
 * makes a flat line say anything, so levels — oxygen, heart rate, temperature, weight, blood
 * pressure — pass `baseline="auto"` and the axis fits the readings. Their fill fades out
 * toward the floor rather than standing on it, so the area does not claim a magnitude the
 * axis no longer shows.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { useChartScrub, useScrubHint } from '@/hooks/useChartScrub';
import { ChartCallout, ScrubMarker, ScrubHint } from '@/components/charts/ChartCallout';
import {
    SPARSE_SNAP_ABOVE, formatChartNumber, formatChartValue, scrubDayLabel,
} from '@/lib/chartScrub';

export interface MetricPoint {
    day: string;
    value: number | null;
    /** A second line on the same axis — diastolic under systolic. */
    secondary?: number | null;
    /** The day's lowest and highest reading, where the rollup keeps them. Readout only. */
    min?: number | null;
    max?: number | null;
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
    /** `zero` for amounts, `auto` for levels. See the header. */
    baseline?: 'zero' | 'auto';
    /** How the readout prints a value. Defaults to `formatChartValue` with `unit`. */
    formatValue?: (value: number) => string;
    /** The readout's third line for a day, replacing the default (the day's range). */
    detailFor?: (point: MetricPoint) => string | null;
    /** Names for the two lines, drawn as a legend when there is a second series. */
    seriesLabels?: { primary: string; secondary: string };
    /** What a screen reader calls the chart, e.g. "Blood oxygen, last 30 days". */
    accessibilityLabel?: string;
    /** Off for a chart that is only glanced at. */
    interactive?: boolean;
}

const PADDING = { top: 14, right: 10, bottom: 24, left: 34 };

const finite = (v: unknown): v is number => Number.isFinite(v as number);

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

/** Runs of consecutive finite values. Each becomes its own path, so a gap stays a gap. */
const runsOf = (values: (number | null | undefined)[]) => {
    const runs: { i: number; value: number }[][] = [];
    let run: { i: number; value: number }[] = [];
    values.forEach((v, i) => {
        if (finite(v)) {
            run.push({ i, value: v });
        } else if (run.length) {
            runs.push(run);
            run = [];
        }
    });
    if (run.length) runs.push(run);
    return runs;
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
    color: colorProp,
    fillColor: fillColorProp,
    unit,
    maxXLabels = 7,
    baseline = 'zero',
    formatValue,
    detailFor,
    seriesLabels,
    accessibilityLabel,
    interactive = true,
}: Props) {
    const Palette = usePalette();
    // Resolved here rather than as parameter defaults: a default runs before the hook, and
    // would read the light palette whatever the person chose.
    const color = colorProp ?? Palette.primary;
    const fillColor = fillColorProp ?? Palette.primarySurface;
    const styles = useStyles();
    const showHint = useScrubHint();

    const chart = useMemo(() => {
        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;
        if (plotW <= 0 || points.length === 0) return null;

        const primary = points.map((p) => p.value).filter(finite);
        if (primary.length === 0) return null;
        const secondary = points.map((p) => p.secondary).filter(finite);
        const all = [...primary, ...secondary];

        const rawMax = Math.max(...all);
        const rawMin = Math.min(...all);
        let min: number;
        let max: number;
        if (baseline === 'auto') {
            // A tenth of headroom each way so the line never runs along the frame, and a floor
            // on the pad so a week of identical readings still draws a line mid-card.
            const pad = Math.max((rawMax - rawMin) * 0.15, Math.abs(rawMax) * 0.01, 0.5);
            min = rawMin - pad;
            max = rawMax + pad;
        } else {
            min = Math.min(rawMin, 0);
            max = rawMax;
        }
        // A flat series would divide by zero and collapse to the baseline; give it headroom.
        const span = max - min || Math.max(1, max || 1);

        const x = (i: number) => PADDING.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
        const y = (v: number) => PADDING.top + plotH - ((v - min) / span) * plotH;
        const floor = PADDING.top + plotH;

        const screen = (r: { i: number; value: number }[]) => r.map((pt) => ({ x: x(pt.i), y: y(pt.value) }));

        const runs = runsOf(points.map((p) => p.value));
        const linePaths = runs.map((r) => smoothPath(screen(r)));
        // The fill reuses the line's own path so the two can never disagree about where the
        // curve went — closing it down to the floor and back is all that differs.
        const areaPaths = runs
            .filter((r) => r.length > 1)
            .map((r) => `${smoothPath(screen(r))} L${x(r[r.length - 1].i)},${floor} L${x(r[0].i)},${floor} Z`);
        // A single reported day cannot draw a line, so mark it
        const dots = runs.filter((r) => r.length === 1).map((r) => ({ cx: x(r[0].i), cy: y(r[0].value) }));

        const secondaryRuns = runsOf(points.map((p) => p.secondary));
        const secondaryPaths = secondaryRuns.map((r) => smoothPath(screen(r)));
        const secondaryDots = secondaryRuns.filter((r) => r.length === 1).map((r) => ({ cx: x(r[0].i), cy: y(r[0].value) }));

        // A distance chart runs 0–8 km and a step chart runs 0–12,000. Rounding both to
        // whole numbers turns the first into three identical-looking gridlines.
        const label = (v: number) => (span < 10 ? String(Math.round(v * 10) / 10) : Math.round(v).toLocaleString());
        const ticks = [min, min + span / 2, min + span].map((v) => ({ v, label: label(v), y: y(v) }));

        const step = Math.max(1, Math.ceil(points.length / maxXLabels));
        const xLabels = points
            .map((p, i) => ({ i, day: p.day }))
            .filter(({ i }) => i % step === 0 || i === points.length - 1)
            .map(({ i, day }) => ({ x: x(i), label: labelFor(day, points.length) }));

        // Every slot in screen space, for the scrub. Computed here, beside the paths, so the
        // crosshair and the curve share one `x` and one `y` and cannot drift apart.
        const xs = points.map((_, i) => x(i));
        const ys = points.map((p) => (finite(p.value) ? y(p.value) : null));
        const ys2 = points.map((p) => (finite(p.secondary) ? y(p.secondary) : null));

        return {
            linePaths, areaPaths, dots, secondaryPaths, secondaryDots,
            ticks, xLabels, plotH, floor, xs, ys, ys2,
            reported: primary.length, hasSecondary: secondary.length > 0,
        };
    }, [points, width, height, maxXLabels, baseline]);

    const fmt = formatValue ?? ((v: number) => formatChartValue(v, unit));
    const valueText = (p: MetricPoint): string | null => {
        if (!finite(p.value)) return null;
        // Two numbers on one axis are written the way a cuff prints them.
        if (finite(p.secondary)) {
            return `${formatChartNumber(p.value)}/${formatChartNumber(p.secondary)}${unit ? ` ${unit}` : ''}`;
        }
        return fmt(p.value);
    };
    const detailText = (p: MetricPoint): string | null => {
        if (!finite(p.value)) return null;
        if (detailFor) return detailFor(p);
        if (finite(p.min) && finite(p.max) && p.min !== p.max) return `Range ${fmt(p.min)} – ${fmt(p.max)}`;
        return null;
    };

    const scrub = useChartScrub({
        xs: chart?.xs ?? [],
        // Rule 2 of `lib/chartScrub.ts`: every day on a short range, only measured days on a
        // long one.
        selectable: points.length > SPARSE_SNAP_ABOVE ? (i) => finite(points[i]?.value) : undefined,
        // The window, not the array: every caller builds `points` inline, so its identity
        // changes on every render and would clear the selection under the finger.
        resetKey: `${points.length}:${points[0]?.day}:${points[points.length - 1]?.day}`,
        enabled: interactive && Boolean(chart),
        label: accessibilityLabel ?? 'Chart',
        describe: (i) => {
            const p = points[i];
            if (!p) return '';
            const detail = detailText(p);
            return `${scrubDayLabel(p.day)}: ${valueText(p) ?? 'no reading'}${detail ? `, ${detail}` : ''}`;
        },
    });

    if (!chart) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={styles.emptyText}>No data for this range yet.</Text>
            </View>
        );
    }

    const active = scrub.index !== null && scrub.index < points.length ? scrub.index : null;
    const activePoint = active !== null ? points[active] : null;
    const activeY = active !== null ? chart.ys[active] : null;
    const activeY2 = active !== null ? chart.ys2[active] : null;

    return (
        <View>
            <View {...scrub.containerProps}>
                <Svg width={width} height={height}>
                    <Defs>
                        <LinearGradient id="macFade" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={color} stopOpacity={0.26} />
                            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                        </LinearGradient>
                    </Defs>

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
                        baseline === 'auto'
                            ? <Path key={`a${i}`} d={d} fill="url(#macFade)" />
                            : <Path key={`a${i}`} d={d} fill={fillColor} opacity={0.75} />
                    ))}
                    {chart.secondaryPaths.map((d, i) => (
                        <Path
                            key={`s${i}`} d={d} stroke={color} strokeWidth={1.5}
                            fill="none" strokeLinejoin="round" opacity={0.55}
                        />
                    ))}
                    {chart.secondaryDots.map((d, i) => (
                        <Circle key={`sd${i}`} cx={d.cx} cy={d.cy} r={2.5} fill={color} opacity={0.55} />
                    ))}
                    {chart.linePaths.map((d, i) => (
                        <Path key={`l${i}`} d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
                    ))}
                    {chart.dots.map((d, i) => (
                        <Circle key={`d${i}`} cx={d.cx} cy={d.cy} r={3} fill={color} />
                    ))}

                    {active !== null && (
                        <ScrubMarker
                            x={chart.xs[active]}
                            top={PADDING.top - 4}
                            bottom={chart.floor}
                            points={[
                                ...(activeY2 !== null ? [{ y: activeY2, color, size: 'secondary' as const }] : []),
                                ...(activeY !== null ? [{ y: activeY, color }] : []),
                            ]}
                        />
                    )}

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

                {activePoint && active !== null && (
                    <ChartCallout
                        x={chart.xs[active]}
                        pointY={activeY2 !== null && activeY !== null ? Math.min(activeY, activeY2) : activeY}
                        chartWidth={width}
                        title={scrubDayLabel(activePoint.day)}
                        value={valueText(activePoint) ?? 'No reading'}
                        detail={valueText(activePoint) ? detailText(activePoint) : 'Nothing was recorded'}
                        color={valueText(activePoint) ? color : undefined}
                    />
                )}
            </View>

            {chart.hasSecondary && seriesLabels && (
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{seriesLabels.primary}</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendLine, styles.legendLineThin, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{seriesLabels.secondary}</Text>
                    </View>
                </View>
            )}

            {chart.reported < points.length && (
                <Text style={styles.caption}>
                    {chart.reported} of {points.length} days have data
                    {unit ? ` (${unit})` : ''}. Gaps are days nothing was recorded.
                </Text>
            )}

            {interactive && showHint && active === null ? <ScrubHint /> : null}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.borderLight,
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 13,
        ...BodyFont.regular,
        color: Palette.textSecondary,
    },
    caption: {
        marginTop: 6,
        fontSize: 11,
        ...BodyFont.regular,
        color: Palette.textMuted,
    },
    legend: { flexDirection: 'row', gap: 16, marginTop: 4, marginLeft: PADDING.left },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendLine: { width: 14, height: 2.5, borderRadius: 2 },
    legendLineThin: { height: 1.5, opacity: 0.55 },
    legendText: { fontSize: 11, ...BodyFont.medium, color: Palette.textSecondary },
}));
