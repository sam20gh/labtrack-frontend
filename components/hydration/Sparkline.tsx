/**
 * The thumb-sized trace on the design's Highlight card.
 *
 * Deliberately not `MetricAreaChart`: that draws axes, labels and a caption because it is the
 * screen's chart, and 110×44 of it would be four ticks and no line. This has no axes and no
 * numbers on purpose — the figure it belongs to is printed next to it at 26pt, and a
 * sparkline is the *shape* of that figure, not a second reading of it.
 *
 * **Gaps break the line.** Joining across a day nobody logged draws a smooth rise through a
 * week that never happened, which is the same objection `MetricAreaChart` records at full
 * size and matters more here, where there is no caption to qualify it.
 */
import React, { useId } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
    values: (number | null)[];
    width?: number;
    height?: number;
    color?: string;
}

export function Sparkline({ values, width = 108, height = 44, color = '#16A34A' }: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
    if (present.length < 2) return <Svg width={width} height={height} />;

    const min = Math.min(...present);
    const max = Math.max(...present);
    const span = max - min || 1;
    const pad = 3;

    const at = (i: number, v: number) => ({
        x: (i / Math.max(1, values.length - 1)) * width,
        y: pad + (1 - (v - min) / span) * (height - pad * 2),
    });

    // One `M` per run of consecutive present values; a null starts a new run.
    const strokes: string[] = [];
    const areas: string[] = [];
    let run: { x: number; y: number }[] = [];
    const flush = () => {
        if (run.length >= 2) {
            const line = run.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            strokes.push(line);
            areas.push(`${line} L${run[run.length - 1].x.toFixed(1)},${height} L${run[0].x.toFixed(1)},${height} Z`);
        }
        run = [];
    };
    values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) flush();
        else run.push(at(i, v as number));
    });
    flush();

    return (
        <Svg width={width} height={height}>
            <Defs>
                <LinearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity="0.22" />
                    <Stop offset="1" stopColor={color} stopOpacity="0" />
                </LinearGradient>
            </Defs>
            {areas.map((d, i) => <Path key={`a${i}`} d={d} fill={`url(#sp${uid})`} />)}
            {strokes.map((d, i) => (
                <Path key={`s${i}`} d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
        </Svg>
    );
}
