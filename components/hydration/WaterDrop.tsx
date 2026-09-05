/**
 * The faceted droplet, and the row of them under the Daily Goal card.
 *
 * Ported from `Design/hydration.svg`: the filled and outline variants are the export's own
 * two paths, translated to the origin and nothing else. The design's droplet is not a
 * teardrop — it is a chamfered pentagon, and an Ionicons `water` in its place is visibly a
 * different mark next to the same shape used at 32pt beside the hero number.
 *
 * The row is **derived from the target**, not fixed at eight. `DROP_ML` is what one drop is
 * worth and `drops()` divides the person's own target by it, because this app derives that
 * target from body mass and recorded activity — it is rarely the design's round 2,000, and a
 * fixed eight drops under a caption saying "1 drop ≈ 250ml" would be arithmetic nobody can
 * make add up.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { DROP_ML } from '@/lib/hydration';

/** The export's droplet, 20.67 × 25.66. */
const BOX = { w: 20.667, h: 25.659 };

const SOLID = 'M20.419 10.666L20.667 11.325V19.325L20.374 20.032L15.04 25.366L14.333 '
    + '25.659H6.333L5.626 25.366L0.293 20.032L0 19.325V11.325L0.247 10.666L9.581 0H11.086L20.419 10.666Z';

const HOLLOW = `${SOLID.slice(0, -1)}ZM2.004 11.7V18.911L6.744 23.659H13.924L18.664 `
    + '18.911V11.7L10.334 2.177L2.004 11.7Z';

export const WATER_BLUE = '#3B82F6';

export function WaterDrop({ size = 18, filled = true, color = WATER_BLUE }: {
    size?: number; filled?: boolean; color?: string;
}) {
    const height = (size * BOX.h) / BOX.w;
    return (
        <Svg width={size} height={height} viewBox={`0 0 ${BOX.w} ${BOX.h}`}>
            <Path d={filled ? SOLID : HOLLOW} fill={color} fillRule="evenodd" clipRule="evenodd" />
        </Svg>
    );
}

/**
 * The Daily Goal drop row.
 *
 * The caption is the design's, with the app's own constant substituted into it, so the row
 * and the sentence under it can never disagree.
 */
export function DropRow({ filled, total, caption = true }: {
    filled: number; total: number; caption?: boolean;
}) {
    return (
        <View style={styles.wrap}>
            <View
                style={styles.row}
                accessibilityLabel={`${filled} of ${total} drops, each about ${DROP_ML} millilitres`}
            >
                {Array.from({ length: total }, (_, i) => (
                    <WaterDrop key={i} filled={i < filled} size={17} />
                ))}
            </View>
            {caption && (
                <Text style={styles.caption}>
                    1 drop <Text style={styles.approx}>≈</Text> {DROP_ML}ml
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
    caption: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted },
    approx: { color: WATER_BLUE },
});
