/**
 * The Predyqt score prediction's min / average / max chart.
 *
 * The design draws three stacked series with the space between them filled — the app's only
 * chart of a *range* rather than of a value, and it exists because a score prediction is an
 * interval and the score screen has room to show it as one.
 *
 * The three series here are not three metrics: they are `low`, `value` and `high` off one
 * forecast. Labelling them Min / Average / Max, as the kit does, is what makes that readable
 * to somebody who has never met a prediction interval.
 *
 * Touch and drag reads one day of the projection: all three figures at once, because the
 * point of the chart is the spread, and a readout of the average alone would throw it away.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Fonts, BodyFont, schemed, activePalette } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartCallout, ScrubMarker } from '@/components/charts/ChartCallout';
import { scrubDayLabel } from '@/lib/chartScrub';
import type { SeriesPoint } from '@/lib/prediction';

interface Props {
    points: SeriesPoint[];
    width: number;
    height?: number;
}

const PADDING = { top: 10, right: 8, bottom: 34, left: 30 };

const rangeOf = (p: SeriesPoint) =>
    `${Math.round(p.low ?? p.value)} to ${Math.round(p.high ?? p.value)}`;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SERIES = schemed((Palette) => ([
    { key: 'low' as const, label: 'Min', colour: Palette.text },
    { key: 'value' as const, label: 'Average', colour: Palette.primary },
    { key: 'high' as const, label: 'Max', colour: Palette.alert },
]));

export function BandChart({ points, width, height = 190 }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
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

        // Every day in screen space, for the scrub — the same `x` and `y` the lines use.
        const xs = points.map((_, i) => x(i));
        const ys = points.map((p) => ({
            low: y((p.low ?? p.value) as number),
            value: y(p.value),
            high: y((p.high ?? p.value) as number),
        }));

        return { line, fill, ticks, labels, xs, ys, plotH };
    }, [points, width, height]);

    const scrub = useChartScrub({
        xs: chart?.xs ?? [],
        resetKey: `${points.length}:${points[0]?.day}:${points[points.length - 1]?.day}`,
        enabled: Boolean(chart),
        label: 'Predicted score, minimum, average and maximum',
        describe: (i) => {
            const p = points[i];
            return p ? `${scrubDayLabel(p.day)}: average ${Math.round(p.value)}, range ${rangeOf(p)}` : '';
        },
    });

    if (!chart) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={styles.emptyText}>Not enough score history to project yet.</Text>
            </View>
        );
    }

    const active = scrub.index !== null && scrub.index < points.length ? scrub.index : null;

    return (
        <View>
            <View {...scrub.containerProps}>
                <Svg width={width} height={height}>
                    <Defs>
                        <LinearGradient id="bcHigh" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={activePalette().alert} stopOpacity={0.30} />
                            <Stop offset="1" stopColor={activePalette().alert} stopOpacity={0.04} />
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

                    {active !== null && (
                        <ScrubMarker
                            x={chart.xs[active]}
                            top={PADDING.top}
                            bottom={PADDING.top + chart.plotH}
                            points={[
                                { y: chart.ys[active].high, color: SERIES[2].colour, size: 'secondary' as const },
                                { y: chart.ys[active].low, color: SERIES[0].colour, size: 'secondary' as const },
                                { y: chart.ys[active].value, color: SERIES[1].colour },
                            ]}
                        />
                    )}

                    {chart.labels.map((l, i) => (
                        <SvgText
                            key={`x${i}`} x={l.x} y={height - 16} fontSize={10}
                            fill={Palette.textMuted} textAnchor={l.anchor as 'start' | 'middle' | 'end'}
                        >
                            {l.label}
                        </SvgText>
                    ))}
                </Svg>

                {active !== null && (
                    <ChartCallout
                        x={chart.xs[active]}
                        pointY={chart.ys[active].high}
                        chartWidth={width}
                        title={scrubDayLabel(points[active].day)}
                        value={`Average ${Math.round(points[active].value)}`}
                        detail={`Min ${Math.round(points[active].low ?? points[active].value)} · Max ${Math.round(points[active].high ?? points[active].value)}`}
                        color={SERIES[1].colour}
                    />
                )}
            </View>

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

const useStyles = makeStyles((Palette) => ({
    empty: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.borderLight, borderRadius: 12,
    },
    emptyText: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },
}));
