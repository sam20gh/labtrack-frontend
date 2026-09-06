/**
 * The tiny chart on a past-prediction row.
 *
 * It plots the **projected** path only, which is what the design's rows show and what those
 * rows are about — a row in "Past Predictions" is a record of a claim, and drawing the
 * measurement beside it at 90×40pt would be two lines nobody can tell apart.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Palette } from '@/constants/theme';

interface Props {
    values: number[];
    width?: number;
    height?: number;
    colour?: string;
    id?: string;
}

export function Sparkline({
    values, width = 110, height = 44, colour = Palette.successDeep, id = 'sp',
}: Props) {
    if (values.length < 2) return <View style={{ width, height }} />;

    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;

    const x = (i: number) => (i / (values.length - 1)) * width;
    const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);

    const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;

    return (
        <Svg width={width} height={height}>
            <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colour} stopOpacity={0.26} />
                    <Stop offset="1" stopColor={colour} stopOpacity={0.02} />
                </LinearGradient>
            </Defs>
            <Path d={area} fill={`url(#${id})`} />
            <Path d={line} stroke={colour} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
        </Svg>
    );
}
