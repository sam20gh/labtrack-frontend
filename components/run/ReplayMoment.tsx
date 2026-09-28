/**
 * One moment of the replay as a picture — "Share this moment".
 *
 * The map is Mapbox's own snapshot of the replay at the paused frame (3D tilt, Ember trail
 * drawn up to that point); the rider's dot, the numbers and the branding are drawn over it
 * here, at the same positions they had on screen. Captured by `react-native-view-shot`, so
 * the two rules from the poster hold: **the Share button lives outside this component**, and
 * **the root is `collapsable={false}`** or Android captures a blank bitmap.
 *
 * A moment near the start or the finish is not offered at all (the replay screen checks), for
 * the reason the poster trims its ends: a map of where a ride began is a home address.
 */
import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BodyFont, Fonts, Palettes, Spacing } from '@/constants/theme';
import { EMBER_DARK, withAlpha } from '@/lib/run/afterglow';
import TickerNumber from './TickerNumber';
import BrandTag from './BrandTag';

interface Props {
    uri: string;
    width: number;
    height: number;
    /** Where the dot sat on screen, as fractions of the screen. */
    dot: { x: number; y: number };
    title: string;
    distance: { value: string; unit: string };
    clock: string;
    date: string;
}

const W = Palettes.light.white;
const INK = Palettes.dark.canvas;

const ReplayMoment = forwardRef<View, Props>(({ uri, width, height, dot, title, distance, clock, date }, ref) => (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: INK }}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
            colors={[withAlpha(INK, 0.75), withAlpha(INK, 0)]}
            style={[styles.shade, { height: height * 0.3 }]}
        />
        <LinearGradient
            colors={[withAlpha(INK, 0), withAlpha(INK, 0.8)]}
            style={[styles.shade, { bottom: 0, top: undefined, height: height * 0.22 }]}
        />
        <View style={[styles.dotWrap, { left: dot.x * width - 18, top: dot.y * height - 18 }]}>
            <View style={[styles.dotGlow, { backgroundColor: withAlpha(EMBER_DARK[3], 0.3) }]} />
            <View style={[styles.dotCore, { backgroundColor: EMBER_DARK[3], borderColor: W }]} />
        </View>
        <View style={styles.top}>
            <View style={{ gap: 2 }}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.row}>
                    <TickerNumber value={distance.value} size={38} color={W} />
                    <Text style={styles.unit}>{distance.unit}</Text>
                </View>
                <Text style={styles.clock}>{clock}</Text>
            </View>
            <BrandTag size={12} />
        </View>
        <Text style={styles.date}>{date}</Text>
    </View>
));
ReplayMoment.displayName = 'ReplayMoment';
export default ReplayMoment;

const styles = StyleSheet.create({
    shade: { position: 'absolute', left: 0, right: 0, top: 0 },
    top: { position: 'absolute', top: Spacing.lg, left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontFamily: Fonts.bold, fontSize: 13, letterSpacing: 2, color: W, opacity: 0.85 },
    row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    unit: { fontFamily: Fonts.semibold, fontSize: 16, color: W, opacity: 0.85 },
    clock: { ...BodyFont.semibold, fontSize: 14, color: W, opacity: 0.85, fontVariant: ['tabular-nums'] },
    date: { position: 'absolute', left: Spacing.lg, bottom: Spacing.lg, ...BodyFont.regular, fontSize: 12, color: W, opacity: 0.8 },
    dotWrap: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    dotGlow: { position: 'absolute', width: 36, height: 36, borderRadius: 18 },
    dotCore: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
