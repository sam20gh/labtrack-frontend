/**
 * The score gauge.
 *
 * The kit draws the score as a thick three-quarter arc labelled LOW / MEDIUM / HIGH with a
 * knob at the current position and the numeral in the middle. This is that, in
 * `react-native-svg` — one arc, one knob, no charting dependency, the same call
 * `MetricAreaChart` and `TrendChart` already make.
 *
 * Two details that are not decoration:
 *
 * **The track is banded, not a gradient.** The bands are the score's own thresholds, so the
 * colour under the knob is the band the person is actually in. A smooth gradient would put
 * an amber knob on a healthy score and vice versa, and the number would be arguing with the
 * dial next to it.
 *
 * **A null score draws an empty track and no knob.** Not a knob at zero: there is a real
 * difference between "we scored you 0" and "we do not have enough to score you", and a
 * needle pinned to the floor states the first while meaning the second.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Fonts, Palette } from '@/constants/theme';
import type { ScoreBand } from '@/lib/score';

interface Props {
    value: number | null;
    band: ScoreBand | null;
    size?: number;
    /** Band thresholds from the server, so the dial cannot drift from the engine. */
    bands: { key: ScoreBand; label: string; min: number; max: number }[];
}

/** Total sweep, and where it starts. 270° opening downwards, as the kit draws it. */
const SWEEP = 270;
const START = 135;

const BAND_COLOR: Record<ScoreBand, string> = {
    attention: '#FB7185',
    suboptimal: '#FBBF24',
    healthy: '#7C3AED',
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/** An SVG arc between two angles on one radius. */
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
    const a = polar(cx, cy, r, from);
    const b = polar(cx, cy, r, to);
    const large = to - from <= 180 ? 0 : 1;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

const angleFor = (score: number) => START + (Math.min(100, Math.max(0, score)) / 100) * SWEEP;

export default function ScoreGauge({ value, band, size = 220, bands }: Props) {
    const cx = size / 2;
    const cy = size / 2;
    const stroke = Math.round(size * 0.075);
    const r = size / 2 - stroke;

    const knob = value === null ? null : polar(cx, cy, r, angleFor(value));
    const active = band ? BAND_COLOR[band] : '#CBD5E1';

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                {/* The empty track, drawn under everything so a gap in the bands still reads. */}
                <Path
                    d={arc(cx, cy, r, START, START + SWEEP)}
                    stroke="#EEF0F5"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                />

                {/*
                  * The bands, each drawn across its own share of the sweep. Rendered even
                  * when the score is null: the dial is also a legend, and showing someone
                  * the scale they will be placed on is useful before they are on it.
                  */}
                {bands.map((b) => (
                    <Path
                        key={b.key}
                        d={arc(cx, cy, r, angleFor(b.min), angleFor(Math.min(b.max, 100)))}
                        stroke={BAND_COLOR[b.key]}
                        strokeWidth={stroke}
                        strokeLinecap="butt"
                        fill="none"
                        opacity={value === null ? 0.18 : band === b.key ? 1 : 0.22}
                    />
                ))}

                {knob && (
                    <G>
                        <Circle cx={knob.x} cy={knob.y} r={stroke * 0.72} fill="#FFFFFF" />
                        <Circle
                            cx={knob.x}
                            cy={knob.y}
                            r={stroke * 0.72}
                            fill="none"
                            stroke={active}
                            strokeWidth={3}
                        />
                    </G>
                )}
            </Svg>

            <View style={[styles.centre, { width: size, height: size }]}>
                <Text style={styles.value}>{value ?? '--'}</Text>
                <Text style={styles.outOf}>{value === null ? 'Not enough data' : 'out of 100'}</Text>
            </View>

            {/* The kit's LOW / HIGH end labels, which tell you which way the dial runs. */}
            <Text style={[styles.end, { left: 0, top: size * 0.74 }]}>LOW</Text>
            <Text style={[styles.end, { right: 0, top: size * 0.74 }]}>HIGH</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    centre: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontFamily: Fonts.bold,
        fontSize: 52,
        color: Palette.text,
    },
    outOf: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textMuted,
        marginTop: 2,
    },
    end: {
        position: 'absolute',
        fontFamily: Fonts.medium,
        fontSize: 9,
        letterSpacing: 0.8,
        color: Palette.textMuted,
    },
});
