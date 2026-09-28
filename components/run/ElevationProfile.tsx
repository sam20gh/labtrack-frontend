/**
 * The climb, drawn from the same smoothed altitude the elevation-gain figure uses, so the
 * picture and the number cannot disagree. The caller passes nothing when the track carried
 * no altitude — a flat line would claim a flat route.
 */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BodyFont, Spacing } from '@/constants/theme';

interface Props {
    series: { d: number; alt: number }[];
    width: number;
    height?: number;
    stroke: string;
    label: string;
    formatDistance: (m: number) => string;
}

export default function ElevationProfile({ series, width, height = 110, stroke, label, formatDistance }: Props) {
    if (series.length < 2 || width <= 0) return null;
    const step = Math.max(1, Math.floor(series.length / 120));
    const pts = series.filter((_, i) => i % step === 0);
    const maxD = pts[pts.length - 1].d || 1;
    const alts = pts.map((p) => p.alt);
    const lo = Math.min(...alts);
    const hi = Math.max(...alts);
    // At least 20 m of vertical range, so a 3 m ripple does not fill the chart like a mountain.
    const span = Math.max(20, hi - lo);
    const pad = 6;
    const x = (d: number) => (d / maxD) * width;
    const y = (a: number) => pad + (1 - (a - lo) / span) * (height - pad * 2);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.alt).toFixed(1)}`).join(' ');

    return (
        <View accessible accessibilityLabel={`Elevation profile: lowest ${Math.round(lo)} metres, highest ${Math.round(hi)} metres`}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
                        <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
                    </LinearGradient>
                </Defs>
                <Path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#elev)" />
                <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs }}>
                <Text style={{ ...BodyFont.regular, fontSize: 11, color: stroke }}>{label}</Text>
                <Text style={{ ...BodyFont.regular, fontSize: 11, color: stroke }}>{formatDistance(maxD)}</Text>
            </View>
        </View>
    );
}
