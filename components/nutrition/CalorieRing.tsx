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

    /**
     * Type scaled to the ring, not fixed to it.
     *
     * These were the literals 38 / 13 / 12, which fit the tracker dashboard's ring and
     * nothing else — on the home card's 132 a four-digit calorie count ran out past the
     * stroke. The ratios are anchored to **168**, the size `app/nutrition/index.tsx`
     * actually passes, so that hero renders exactly as before and every smaller instance
     * shrinks with its ring. The two small lines get a floor: a 9pt legend stops being
     * readable well before it stops fitting.
     */
    const type = {
        value: Math.round(size * (38 / 168)),
        of: Math.max(11, Math.round(size * (13 / 168))),
        caption: Math.max(10, Math.round(size * (12 / 168))),
    };

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

            {/* Inset by exactly the stroke, so the label block is bounded by the ring's
                inner diameter — the widest chord available to text sitting on the centre
                line. Without it a long number draws straight across the arc. */}
            <View
                style={[styles.centre, { paddingHorizontal: stroke }]}
                pointerEvents="none"
            >
                <Text
                    style={[styles.value, { color: colors.value, fontSize: type.value }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >
                    {Math.round(consumed).toLocaleString()}
                </Text>
                <Text
                    style={[styles.of, { color: colors.of, fontSize: type.of }]}
                    numberOfLines={1}
                >
                    {hasTarget ? `of ${Math.round(target).toLocaleString()} kcal` : 'kcal logged'}
                </Text>
                {!!caption && (
                    <Text
                        style={[styles.caption, { color: colors.caption, fontSize: type.caption }]}
                        numberOfLines={1}
                    >
                        {caption}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // fontSize on the three below is overridden per-instance from `type` — the values
    // here are the 180pt defaults, kept so the styles read at a glance.
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    value: { fontFamily: Fonts.bold, fontSize: 38, color: Palette.text },
    of: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
    caption: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.primary, marginTop: 6 },
});
