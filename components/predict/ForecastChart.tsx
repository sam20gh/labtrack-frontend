/**
 * The split chart the design uses everywhere a forecast is shown: measured history on the
 * left, projection on the right, a divider between them at today.
 *
 * `react-native-svg` and no charting library, for the reason `MetricAreaChart` already gives:
 * two series and a fill is not enough requirement to justify the weight.
 *
 * Four things about it are load-bearing:
 *
 * 1. **The past and the future are drawn differently, and that is the whole chart.** History
 *    is grey; the projection carries the metric's tone. A single continuous coloured line
 *    would make an extrapolation look like a measurement, which is the one thing this screen
 *    must not do.
 * 2. **The projection is a band, not a line.** `low`/`high` are shaded and the point estimate
 *    is drawn inside them. The design's mockup shows a single line, but the arithmetic
 *    produces an interval and drawing only its centre would throw away the honest half.
 * 3. **The handle scrubs a readout; it does not move the split.** The kit puts a round handle
 *    with a ⟷ glyph on the divider, which reads as a control, so it is one — drag it and it
 *    rides the curve, reporting the value and the interval for whichever day it is over.
 *    What it must NOT do is move the boundary between measured and projected: that boundary
 *    is today, dragging it would redraw real readings as forecast (or the reverse), and the
 *    "CURRENT / NEXT" labels either side would start lying. So the today line stays put and
 *    the handle detaches from it, with a dashed guide showing where it has got to.
 * 4. **Gaps in the history are gaps.** Same rule `MetricAreaChart` holds: a day nobody
 *    measured is not joined across, because a straight line through a week someone spent ill
 *    reads as steady data.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, type GestureResponderEvent } from 'react-native';
import Svg, {
    Path, Line, Circle, Rect, G, Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { Palette, Fonts } from '@/constants/theme';
import type { SeriesPoint } from '@/lib/prediction';

interface Props {
    history: SeriesPoint[];
    projected: SeriesPoint[];
    width: number;
    height?: number;
    /** The projection's colour. History is always grey. */
    tone?: string;
    /** Draw the second component (diastolic) as a paler pair of lines. */
    showSecondary?: boolean;
    /** "CURRENT" / "NEXT 1 WEEK" strips along the top, as in the result screens. */
    bandLabels?: { left: string; right: string };
    /** The "Today • 60/120" and "Next 1 week • 80/135" annotations from the insight screen. */
    annotations?: { left: { title: string; value: string }; right: { title: string; value: string } };
    /** Y-axis ticks and a light grid. Off for the compact result card. */
    axis?: boolean;
    unit?: string;
    /**
     * Let the handle be dragged along the series. Off by default: on a card the person only
     * glances at, a control that responds to touch and reports nothing is worse than a marker.
     */
    scrubbable?: boolean;
    /** Fires as the handle moves, and once on release. `null` when it is back on today. */
    onScrub?: (point: ScrubPoint | null) => void;
}

/** What the handle is currently over. The screen renders this; the chart only positions it. */
export interface ScrubPoint {
    day: string;
    value: number;
    low: number | null;
    high: number | null;
    secondary: number | null;
    /** True once the handle is past today — i.e. reading a projection rather than a reading. */
    projected: boolean;
}

const PADDING = { top: 30, right: 8, bottom: 22, left: 34 };

/** Monotone cubic, lifted from `MetricAreaChart` for the same reason it exists there:
 *  Catmull-Rom overshoots, and a curve that leaves the range of its own points invents a
 *  reading nobody took. */
const smooth = (pts: { x: number; y: number }[]): string => {
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

export function ForecastChart({
    history, projected, width, height = 200,
    tone = Palette.primary, showSecondary = false,
    bandLabels, annotations, axis = true, unit,
    scrubbable = false, onScrub,
}: Props) {
    /** Index into `chart.nodes`, or null when the handle is resting on today. */
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);
    const chart = useMemo(() => {
        // Only as much history as the projection is long, plus a little, so the split lands
        // near the middle rather than pinning today against the right-hand edge on someone
        // with a year of readings.
        const tail = Math.max(7, Math.min(history.length, Math.round(projected.length * 1.6)));
        const past = history.slice(-tail);
        const all = [...past, ...projected];
        if (!all.length) return null;

        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;
        if (plotW <= 0 || plotH <= 0) return null;

        const numbers: number[] = [];
        for (const p of all) {
            for (const v of [p.value, p.low, p.high, p.secondary, p.secondaryLow, p.secondaryHigh]) {
                if (Number.isFinite(v as number)) numbers.push(v as number);
            }
        }
        if (!numbers.length) return null;

        const rawMax = Math.max(...numbers);
        const rawMin = Math.min(...numbers);
        // A tenth of headroom each way so the band never touches the frame, and a floor so a
        // series that never moves does not collapse onto the baseline.
        const pad = Math.max((rawMax - rawMin) * 0.12, Math.abs(rawMax) * 0.02, 0.5);
        const max = rawMax + pad;
        const min = rawMin - pad;
        const span = max - min || 1;

        const x = (i: number) => PADDING.left + (all.length === 1 ? plotW / 2 : (i / (all.length - 1)) * plotW);
        const y = (v: number) => PADDING.top + plotH - ((v - min) / span) * plotH;

        // History, broken at gaps. `MetricAreaChart`'s rule.
        const runs: { i: number; v: number }[][] = [];
        let run: { i: number; v: number }[] = [];
        past.forEach((p, i) => {
            if (Number.isFinite(p.value)) run.push({ i, v: p.value });
            else if (run.length) { runs.push(run); run = []; }
        });
        if (run.length) runs.push(run);

        const historyPaths = runs.map((r) => smooth(r.map((p) => ({ x: x(p.i), y: y(p.v) }))));
        const historyAreas = runs.filter((r) => r.length > 1).map((r) => {
            const base = PADDING.top + plotH;
            return `${smooth(r.map((p) => ({ x: x(p.i), y: y(p.v) })))}`
                + ` L${x(r[r.length - 1].i)},${base} L${x(r[0].i)},${base} Z`;
        });

        // The projection joins onto the last measured point so the two halves meet rather
        // than floating apart with a gap at today.
        const lastPast = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null;
        const joinIndex = lastPast ? lastPast.i : past.length - 1;
        const joinValue = lastPast ? lastPast.v : null;

        const future = projected.map((p, k) => ({ ...p, i: past.length + k }));
        const withJoin = joinValue === null
            ? future
            : [{ day: 'today', value: joinValue, low: joinValue, high: joinValue, i: joinIndex }, ...future];

        const projectionPath = smooth(withJoin.map((p) => ({ x: x(p.i), y: y(p.value) })));

        // The interval, as a closed band: the highs left-to-right, the lows back again.
        const upper = withJoin.map((p) => ({ x: x(p.i), y: y(p.high ?? p.value) }));
        const lower = withJoin.map((p) => ({ x: x(p.i), y: y(p.low ?? p.value) })).reverse();
        const intervalPath = upper.length > 1
            ? `${smooth(upper)} L${lower[0].x},${lower[0].y} ${smooth(lower).replace(/^M[^ ]+ /, '')} Z`
            : '';

        // Index BEFORE filtering. Mapping the filtered array's own index onto `x` compresses
        // the second series into the left of the chart the moment a single day is missing,
        // which draws diastolic under a systolic it never sat under.
        const secondaryPast = past
            .map((p, i) => ({ i, v: p.secondary }))
            .filter((p): p is { i: number; v: number } => Number.isFinite(p.v as number));
        const secondaryFutureRaw = future
            .filter((p) => Number.isFinite(p.secondary as number))
            .map((p) => ({ i: p.i, v: p.secondary as number }));

        // Joined at today, like the primary. Two halves that stop and restart either side of
        // the divider read as a break in the data rather than as the same series continuing.
        const secondaryJoin = secondaryPast.length ? secondaryPast[secondaryPast.length - 1] : null;

        const secondaryHistory = showSecondary && secondaryPast.length > 1
            ? smooth(secondaryPast.map((p) => ({ x: x(p.i), y: y(p.v) })))
            : '';
        const secondaryFuture = showSecondary && secondaryFutureRaw.length
            ? smooth([...(secondaryJoin ? [secondaryJoin] : []), ...secondaryFutureRaw]
                .map((p) => ({ x: x(p.i), y: y(p.v) })))
            : '';

        const splitX = x(joinIndex);
        const label = (v: number) => (span < 12 ? String(Math.round(v * 10) / 10) : String(Math.round(v)));
        const ticks = [min + pad, min + span / 2, max - pad].map((v) => ({ label: label(v), y: y(v) }));

        // Six x labels at most; more than that and they collide at 320pt wide. The final
        // label is always kept — it is the date being predicted — so the one before it is
        // dropped when the two would overlap, which happens whenever `step` does not divide
        // the series evenly.
        const step = Math.max(1, Math.ceil(all.length / 6));
        const lastKept = all.length - 1 - ((all.length - 1) % step);
        // In pixels, not in indices: whether two labels collide depends on how wide the
        // chart is, and `step` says nothing about that. 44pt clears a "13/9" at 10pt.
        const crowded = x(all.length - 1) - x(lastKept) < 44;
        const xLabels = all
            .map((p, i) => ({ i, day: p.day }))
            .filter(({ i }) => (i % step === 0 && !(crowded && i === lastKept)) || i === all.length - 1)
            .map(({ i, day }) => {
                const d = new Date(`${day}T00:00:00`);
                return {
                    x: x(i),
                    // The end labels anchor to their own edge. Centred, half of "13/9" hangs
                    // off the right of the chart and is clipped by the SVG viewport.
                    anchor: i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle',
                    label: Number.isNaN(d.getTime())
                        ? ''
                        : all.length <= 14 ? WEEKDAYS[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`,
                };
            });

        /**
         * Every plottable point in screen space, so the handle can be positioned without the
         * gesture code re-deriving the scales. A second copy of `x`/`y` outside this memo is
         * how a scrubber ends up half a pixel — and eventually a whole day — off the line.
         *
         * Points with no value are excluded rather than carried as nulls: the handle must not
         * be draggable onto a day nobody measured, which would report a number that does not
         * exist.
         */
        const nodes = all
            .map((p, i) => ({ i, p }))
            .filter(({ p }) => Number.isFinite(p.value))
            .map(({ i, p }) => ({
                i,
                x: x(i),
                y: y(p.value),
                day: p.day,
                value: p.value,
                low: Number.isFinite(p.low as number) ? (p.low as number) : null,
                high: Number.isFinite(p.high as number) ? (p.high as number) : null,
                secondary: Number.isFinite(p.secondary as number) ? (p.secondary as number) : null,
                projected: i > joinIndex,
            }));

        return {
            historyPaths, historyAreas, projectionPath, intervalPath,
            secondaryHistory, secondaryFuture,
            splitX, ticks, xLabels, plotH, plotW, nodes,
            endX: x(all.length - 1), endY: y(projected[projected.length - 1]?.value ?? 0),
            joinX: splitX, joinY: joinValue === null ? null : y(joinValue),
            joinNode: nodes.find((n) => n.i === joinIndex) ?? null,
        };
    }, [history, projected, width, height, showSecondary]);

    /**
     * Map a touch's x to the nearest plotted point.
     *
     * Nearest rather than a bucket division, because the points are not evenly spaced once a
     * gap is dropped, and bucketing would let the handle sit between two days and report
     * whichever the arithmetic rounded to.
     */
    const nearest = useCallback((pageX: number, originX: number) => {
        const nodes = chart?.nodes ?? [];
        if (!nodes.length) return null;
        const local = pageX - originX;
        let best = 0;
        for (let k = 1; k < nodes.length; k += 1) {
            if (Math.abs(nodes[k].x - local) < Math.abs(nodes[best].x - local)) best = k;
        }
        return best;
    }, [chart]);

    /**
     * The View's left edge in page coordinates.
     *
     * A pan gesture reports `pageX`, and the nodes are in chart-local coordinates, so one of
     * the two has to be translated. Measured on layout and re-measured on every grant, because
     * this chart sits inside a ScrollView: scrolling changes the view's page position without
     * ever firing a layout event, and a stale origin puts the handle a finger's width off.
     */
    const originX = useRef(0);
    const container = useRef<View>(null);
    const measure = useCallback(() => {
        container.current?.measureInWindow((px) => { originX.current = px; });
    }, []);

    const handleAt = useCallback((event: GestureResponderEvent) => {
        const k = nearest(event.nativeEvent.pageX, originX.current);
        if (k === null) return;
        setScrubIndex(k);
        const node = chart?.nodes[k];
        // `joinNode` is today. Resting there is reported as "not scrubbing" rather than as a
        // reading, so a screen can show its default copy instead of a redundant "today" row.
        onScrub?.(node && node.i !== chart?.joinNode?.i
            ? {
                day: node.day, value: node.value, low: node.low, high: node.high,
                secondary: node.secondary, projected: node.projected,
            }
            : null);
    }, [chart, nearest, onScrub]);

    const pan = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => scrubbable,
        // Horizontal only. This chart lives inside a vertical ScrollView on every screen that
        // draws it, and claiming a vertical drag would make the page impossible to scroll.
        onMoveShouldSetPanResponder: (_e, g) => scrubbable && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: (e) => { measure(); handleAt(e); },
        onPanResponderMove: handleAt,
        // Deliberately no snap-back on release: the reading is the point of the gesture, and
        // one that vanishes the moment you lift your finger cannot be read.
        onPanResponderTerminationRequest: () => false,
    }), [scrubbable, handleAt, measure]);

    if (!chart) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={styles.emptyText}>Not enough recorded data to chart yet.</Text>
            </View>
        );
    }

    // Clamped: the series can shrink under a scrub when the horizon changes.
    const active = scrubbable && scrubIndex !== null
        ? chart.nodes[Math.min(scrubIndex, chart.nodes.length - 1)]
        : chart.joinNode;
    const scrubbed = Boolean(active && chart.joinNode && active.i !== chart.joinNode.i);

    const top = PADDING.top;
    const bottom = PADDING.top + chart.plotH;

    return (
        <View ref={container} onLayout={measure} {...(scrubbable ? pan.panHandlers : {})}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="fcTone" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={tone} stopOpacity={0.28} />
                        <Stop offset="1" stopColor={tone} stopOpacity={0.02} />
                    </LinearGradient>
                    <LinearGradient id="fcPast" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={Palette.textMuted} stopOpacity={0.22} />
                        <Stop offset="1" stopColor={Palette.textMuted} stopOpacity={0.02} />
                    </LinearGradient>
                </Defs>

                {axis && chart.ticks.map((t, i) => (
                    <G key={`t${i}`}>
                        <Line
                            x1={PADDING.left} x2={width - PADDING.right} y1={t.y} y2={t.y}
                            stroke={Palette.borderLight} strokeWidth={1}
                        />
                        <SvgText
                            x={PADDING.left - 6} y={t.y + 4} fontSize={10}
                            fill={Palette.textMuted} textAnchor="end"
                        >
                            {t.label}
                        </SvgText>
                    </G>
                ))}

                {/* The kit's dashed cell grid, drawn only on the compact result card where
                    there are no axis labels to carry the eye instead. */}
                {!axis && (
                    <G>
                        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                            <Line
                                key={`h${f}`}
                                x1={PADDING.left} x2={width - PADDING.right}
                                y1={top + chart.plotH * f} y2={top + chart.plotH * f}
                                stroke={Palette.borderLight} strokeWidth={1} strokeDasharray="3 3"
                            />
                        ))}
                        <Rect
                            x={PADDING.left} y={top} width={chart.plotW} height={chart.plotH}
                            fill="none" stroke={Palette.border} strokeWidth={1} strokeDasharray="3 3"
                        />
                    </G>
                )}

                {/* Past */}
                {chart.historyAreas.map((d, i) => <Path key={`ha${i}`} d={d} fill="url(#fcPast)" />)}
                {chart.historyPaths.map((d, i) => (
                    <Path key={`hp${i}`} d={d} stroke={Palette.textMuted} strokeWidth={1.8} fill="none" />
                ))}
                {showSecondary && chart.secondaryHistory ? (
                    // `border` at #E5E7EB disappears against the history's own fill — a second
                    // series drawn in it is a series nobody can see. This is the kit's next
                    // step down the slate ramp, which is what a quiet line is meant to be.
                    <Path d={chart.secondaryHistory} stroke={Palette.borderStrong} strokeWidth={1.5} fill="none" />
                ) : null}

                {/* Future — the band first, so the point estimate reads on top of it */}
                {chart.intervalPath ? <Path d={chart.intervalPath} fill="url(#fcTone)" /> : null}
                <Path d={chart.projectionPath} stroke={tone} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
                {showSecondary && chart.secondaryFuture ? (
                    <Path
                        d={chart.secondaryFuture} stroke={tone} strokeWidth={1.6}
                        strokeDasharray="4 3" fill="none" opacity={0.7}
                    />
                ) : null}

                {/*
                  Today. It stays exactly where it is while the handle is dragged: the
                  boundary between measured and projected is a fact about the calendar, and
                  the CURRENT / NEXT labels either side of it would start lying if it moved.
                */}
                <Line
                    x1={chart.splitX} x2={chart.splitX} y1={top - 6} y2={bottom}
                    stroke={Palette.text} strokeWidth={1.5}
                    opacity={scrubbed ? 0.35 : 1}
                />

                {/* The scrub guide, drawn only once the handle has left today. */}
                {scrubbed && active ? (
                    <Line
                        x1={active.x} x2={active.x} y1={top - 6} y2={bottom}
                        stroke={Palette.text} strokeWidth={1} strokeDasharray="3 3"
                    />
                ) : null}

                {bandLabels && (
                    <G>
                        <SvgText
                            x={PADDING.left + 6} y={top - 12} fontSize={9}
                            fill={Palette.textMuted} letterSpacing={0.8}
                        >
                            {bandLabels.left.toUpperCase()}
                        </SvgText>
                        <SvgText
                            x={width - PADDING.right - 6} y={top - 12} fontSize={9}
                            fill={tone} letterSpacing={0.8} textAnchor="end"
                        >
                            {bandLabels.right.toUpperCase()}
                        </SvgText>
                    </G>
                )}

                {annotations && (
                    <G>
                        <SvgText x={PADDING.left + 4} y={top - 14} fontSize={10} fill={Palette.textSecondary}>
                            {annotations.left.title}
                        </SvgText>
                        <Circle cx={PADDING.left + 8} cy={top - 2} r={2.5} fill={Palette.text} />
                        <SvgText x={PADDING.left + 15} y={top + 1} fontSize={11} fill={Palette.text}>
                            {annotations.left.value}
                        </SvgText>

                        <SvgText
                            x={width - PADDING.right - 4} y={top - 14} fontSize={10}
                            fill={Palette.textSecondary} textAnchor="end"
                        >
                            {annotations.right.title}
                        </SvgText>
                        <SvgText
                            x={width - PADDING.right - 4} y={top + 1} fontSize={11}
                            fill={tone} textAnchor="end"
                        >
                            {annotations.right.value}
                        </SvgText>
                    </G>
                )}

                {/*
                  The kit's round handle, riding the curve. It sits on today until dragged,
                  and takes the projection's tone once it is over a projected day so the
                  reading it reports cannot be mistaken for a measurement.
                */}
                {active && (
                    <G>
                        <Circle
                            cx={active.x} cy={active.y} r={13}
                            fill={scrubbed && active.projected ? tone : Palette.text}
                        />
                        <Path
                            d={`M${active.x - 5},${active.y} l3.5,-3.5 M${active.x - 5},${active.y} l3.5,3.5`
                                + ` M${active.x + 5},${active.y} l-3.5,-3.5 M${active.x + 5},${active.y} l-3.5,3.5`
                                + ` M${active.x - 5},${active.y} L${active.x + 5},${active.y}`}
                            stroke={Palette.white} strokeWidth={1.4} strokeLinecap="round" fill="none"
                        />
                    </G>
                )}

                <Circle cx={chart.endX} cy={chart.endY} r={3.5} fill={tone} />

                {axis && chart.xLabels.map((l, i) => (
                    <SvgText
                        key={`x${i}`} x={l.x} y={height - 6} fontSize={10}
                        fill={Palette.textMuted} textAnchor={l.anchor as 'start' | 'middle' | 'end'}
                    >
                        {l.label}
                    </SvgText>
                ))}
            </Svg>

            {unit ? <Text style={styles.unit}>Values in {unit}. The shaded band is the predicted range.</Text> : null}

            {/*
              The affordance. A round handle that happens to be draggable is one most people
              never discover, and the hint disappears the moment it has been used.
            */}
            {scrubbable ? (
                <Text
                    style={styles.hint}
                    onPress={scrubbed ? () => { setScrubIndex(null); onScrub?.(null); } : undefined}
                    suppressHighlighting
                >
                    {scrubbed ? 'Tap to return to today' : 'Drag the handle to read any day'}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    empty: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.borderLight, borderRadius: 12,
    },
    emptyText: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    unit: { marginTop: 6, fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
    hint: {
        marginTop: 6, fontSize: 11, fontFamily: Fonts.medium,
        color: Palette.textMuted, textAlign: 'center',
    },
});
