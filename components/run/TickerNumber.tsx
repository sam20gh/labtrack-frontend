/**
 * A number that ticks without wobbling, in the display face.
 *
 * Chakra Petch has no tabular figures — a "1" is 358 units wide and a "0" 628 (see `Fonts`
 * in `constants/theme.ts`) — so `fontVariant: ['tabular-nums']` does nothing in it, and a
 * running clock set in it shuffles sideways every second as 1s become 8s. Each character here
 * sits in a cell of fixed width: digits get the widest digit's advance, separators their own
 * narrower one. The face stays, the jitter goes.
 *
 * The whole string is one accessibility element, read as written.
 */
import React from 'react';
import { View, Text, type TextStyle, type StyleProp } from 'react-native';
import { Fonts } from '@/constants/theme';

/** Advance widths as a fraction of the font size, from the face's metrics. */
const DIGIT_EM = 0.64;
const NARROW_EM: Record<string, number> = { ':': 0.3, '.': 0.3, ',': 0.3, ' ': 0.3, '-': 0.42, '−': 0.42, '+': 0.56 };

interface Props {
    value: string;
    size: number;
    color: string;
    weight?: keyof typeof Fonts;
    style?: StyleProp<TextStyle>;
    accessibilityLabel?: string;
}

export default function TickerNumber({ value, size, color, weight = 'bold', style, accessibilityLabel }: Props) {
    return (
        <View
            style={{ flexDirection: 'row', alignItems: 'baseline' }}
            accessible
            accessibilityRole="text"
            accessibilityLabel={accessibilityLabel ?? value}
        >
            {Array.from(value).map((ch, i) => {
                const em = /\d/.test(ch) ? DIGIT_EM : (NARROW_EM[ch] ?? 0.6);
                return (
                    <Text
                        // Position is the identity: the third character is always the third cell.
                        key={i}
                        allowFontScaling={false}
                        style={[
                            { width: size * em, textAlign: 'center', fontSize: size, lineHeight: size * 1.1, fontFamily: Fonts[weight], color },
                            style,
                        ]}
                    >
                        {ch}
                    </Text>
                );
            })}
        </View>
    );
}
