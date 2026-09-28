/**
 * The Predyqt mark and wordmark, for the corner of anything that may be screen-recorded or
 * shared — the replay and the moments taken from it. White on the dark map, deliberately
 * small: a signature, not an advert.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import BrandMark from '@/components/BrandMark';
import { Fonts, Palettes } from '@/constants/theme';
import { withAlpha } from '@/lib/run/afterglow';

export default function BrandTag({ size = 14, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
    const white = Palettes.light.white;
    return (
        <View
            style={[styles.tag, { backgroundColor: withAlpha(Palettes.dark.canvas, 0.35) }, style]}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Predyqt"
        >
            <BrandMark size={size} color={white} />
            <Text style={[styles.word, { color: white, fontSize: size * 0.86, letterSpacing: size * 0.2 }]}>PREDYQT</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    word: { fontFamily: Fonts.bold },
});
