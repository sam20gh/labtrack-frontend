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
    /**
     * Which ground the ring is drawn on.
     *
     * `light` is the default — a white card, where the arc is purple and the numbers are
     * near-black. `light` on the dashboard's purple hero would put `Palette.primary` on
     * `Palette.primary` and vanish, so `dark` inverts it: a white arc on a translucent
     * white track, with white numerals. Two colour sets rather than two components,
     * because the geometry and the over-target rule are the part worth not duplicating.
     */
    tone?: 'light' | 'dark';
}

export function CalorieRing({ consumed, target, size = 180, stroke = 14, caption, tone = 'light' }: Props) {
    const onDark = tone === 'dark';
    const colors = {
        track: onDark ? 'rgba(255,255,255,0.28)' : Palette.borderLight,
        // Over target, the first arc steps back so the second reads as the overshoot.
        arc: onDark ? Palette.white : Palette.primary,
        arcUnderOver: onDark ? 'rgba(255,255,255,0.55)' : Palette.primaryLight,
        over: onDark ? '#FDE68A' : Palette.warning,
        value: onDark ? Palette.white : Palette.text,
        of: onDark ? 'rgba(255,255,255,0.82)' : Palette.textSecondary,
        caption: onDark ? Palette.white : Palette.primary,
    };
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
                        stroke={colors.track}
                        strokeWidth={stroke}
                        fill="none"
                    />
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={over > 0 ? colors.arcUnderOver : colors.arc}
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
                            stroke={colors.over}
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
                <Text style={[styles.value, { color: colors.value }]}>
                    {Math.round(consumed).toLocaleString()}
                </Text>
                <Text style={[styles.of, { color: colors.of }]}>
                    {hasTarget ? `of ${Math.round(target).toLocaleString()} kcal` : 'kcal logged'}
                </Text>
                {!!caption && <Text style={[styles.caption, { color: colors.caption }]}>{caption}</Text>}
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
