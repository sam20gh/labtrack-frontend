/**
 * Hexagonal score radar.
 *
 * The turing kit draws the health score as a six-axis polygon with the axis labels sitting
 * outside the rings (Calorie / Steps / BMI / Sleep / BPM / Hydration). LabTrack's axes are
 * the six score pillars instead, because those are the dimensions this product actually
 * measures.
 *
 * Built on `react-native-svg` for the same reason `TrendChart` is: one shape, six points,
 * no need for a charting dependency.
 */
import React from 'react';
import Svg, { Polygon, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import type { Pillar } from '@/lib/healthScore';
import { Fonts } from '@/constants/theme';

interface Props {
    pillars: Pillar[];
    /** Diameter budget for the chart itself; the SVG is wider to fit the outer labels. */
    size: number;
    /** Ring, spoke and label colour — the hero sits on purple, cards sit on white. */
    stroke?: string;
    labelColor?: string;
    fill?: string;
}

/** Horizontal room reserved either side of the chart for the axis labels. */
const LABEL_GUTTER = 44;

/** Start at 12 o'clock so the first axis reads as the top of the shape. */
const angleFor = (i: number, count: number) => (Math.PI * 2 * i) / count - Math.PI / 2;

const pointsFor = (radii: number[], cx: number, cy: number) =>
    radii
        .map((r, i) => {
            const a = angleFor(i, radii.length);
            return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
        })
        .join(' ');

export default function ScoreRadar({
    pillars,
    size,
    stroke = 'rgba(255,255,255,0.28)',
    labelColor = 'rgba(255,255,255,0.72)',
    fill = '#FFFFFF',
}: Props) {
    // Axis labels sit outside the outer hexagon, so the SVG is wider than the chart to
    // give the left and right labels somewhere to go without being clipped.
    const width = size + LABEL_GUTTER * 2;
    const cx = width / 2;
    const cy = size / 2;
    const radius = size / 2 - 14;
    const n = pillars.length;

    // A pillar with no data plots at the centre rather than being dropped: the dent in the
    // shape is the message — that axis is unmeasured.
    const radii = pillars.map((p) => ((p.value ?? 0) / 100) * radius);

    return (
        <Svg width={width} height={size}>
            {/* Reference rings at 33 / 66 / 100 % */}
            {[0.33, 0.66, 1].map((f) => (
                <Polygon
                    key={f}
                    points={pointsFor(pillars.map(() => radius * f), cx, cy)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1}
                />
            ))}

            {/* Spokes */}
            {pillars.map((p, i) => {
                const a = angleFor(i, n);
                return (
                    <Line
                        key={p.key}
                        x1={cx}
                        y1={cy}
                        x2={cx + Math.cos(a) * radius}
                        y2={cy + Math.sin(a) * radius}
                        stroke={stroke}
                        strokeWidth={1}
                    />
                );
            })}

            {/* The score shape itself */}
            <Polygon
                points={pointsFor(radii, cx, cy)}
                fill={fill}
                fillOpacity={0.22}
                stroke={fill}
                strokeWidth={2}
                strokeLinejoin="round"
            />

            {pillars.map((p, i) => {
                const a = angleFor(i, n);
                const px = cx + Math.cos(a) * radii[i];
                const py = cy + Math.sin(a) * radii[i];
                const lx = cx + Math.cos(a) * (radius + 12);
                const ly = cy + Math.sin(a) * (radius + 12);
                // Labels flip alignment either side of the vertical axis so they never
                // overhang the chart box.
                const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';

                return (
                    <G key={p.key}>
                        {p.value != null && <Circle cx={px} cy={py} r={3.5} fill={fill} />}
                        <SvgText
                            x={lx}
                            y={ly + 4}
                            fontSize={11}
                            fontFamily={Fonts.semibold}
                            fill={p.value == null ? stroke : labelColor}
                            textAnchor={anchor}
                        >
                            {p.label}
                        </SvgText>
                    </G>
                );
            })}
        </Svg>
    );
}
