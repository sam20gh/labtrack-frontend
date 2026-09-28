/**
 * A run's shape as a small line drawing — the history row's thumbnail (plan §1).
 *
 * Not a map: a map per row would be tile fetches, billed map loads and scroll jank for a
 * picture 60 points wide. The line alone is what makes one run recognisable from another,
 * and it costs nothing. It wears the type's own tint — identity, not magnitude — so it sits
 * with the row's icon rather than competing with it.
 *
 * On a list the whole route is drawn, trim and all: this is the person's own history on
 * their own phone. Only what leaves the phone is trimmed (see `lib/run/replay.ts`).
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { routePath } from '@/lib/run/replay';

interface Props {
    coordinates: number[][];
    tint: string;
    width?: number;
    height?: number;
}

export default function RouteGlyph({ coordinates, tint, width = 64, height = 44 }: Props) {
    const d = useMemo(() => routePath(coordinates, width, height, 5), [coordinates, width, height]);
    if (!d) return null;
    const end = d.split(' ').pop()!.slice(1).split(',').map(Number);
    return (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Svg width={width} height={height}>
                <Path d={d} stroke={tint} strokeOpacity={0.25} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={d} stroke={tint} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={end[0]} cy={end[1]} r={2.5} fill={tint} />
            </Svg>
        </View>
    );
}
