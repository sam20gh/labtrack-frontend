/**
 * The calorie ring from the tracker dashboard.
 *
 * Built on `react-native-svg`, already a dependency, for the reason `TrendChart` gives: the
 * requirement is one arc and a label, and a charting library would add weight without
 * adding capability.
 *
 * Over-target is drawn as a second, differently coloured arc laid over the first rather than
 * as a ring that simply fills and stops. Someone 400 kcal over needs to see that they are
 * over; a ring pinned at 100% tells them they are exactly on target.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Palette, Fonts } from '@/constants/theme';

interface Props {
    consumed: number;
    target: number;
    size?: number;
    stroke?: number;
    /** Small caption under the numbers, e.g. "580 kcal left". */
    caption?: string;
}

export function CalorieRing({ consumed, target, size = 180, stroke = 14, caption }: Props) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const hasTarget = target > 0;
    const ratio = hasTarget ? consumed / target : 0;
    const filled = Math.min(1, ratio);
    const over = Math.min(1, Math.max(0, ratio - 1));

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                {/* Rotated so the arc starts at twelve o'clock rather than three */}
                <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={Palette.borderLight}
                        strokeWidth={stroke}
                        fill="none"
                    />
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={over > 0 ? Palette.primaryLight : Palette.primary}
                        strokeWidth={stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - filled)}
                        strokeLinecap="round"
                        fill="none"
                    />
                    {over > 0 && (
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke={Palette.warning}
                            strokeWidth={stroke}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - over)}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                </G>
            </Svg>

            <View style={styles.centre} pointerEvents="none">
                <Text style={styles.value}>{Math.round(consumed).toLocaleString()}</Text>
                <Text style={styles.of}>
                    {hasTarget ? `of ${Math.round(target).toLocaleString()} kcal` : 'kcal logged'}
                </Text>
                {!!caption && <Text style={styles.caption}>{caption}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    value: { fontFamily: Fonts.bold, fontSize: 38, color: Palette.text },
    of: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
    caption: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.primary, marginTop: 6 },
});
