/**
 * 3 · 2 · 1 · GO — the brand moment before recording starts (plan §2.2).
 *
 * Each beat is a heavy haptic and a shock ring; on GO the violet collapses into a circle at
 * the controls and reveals the map beneath. Tap anywhere to skip. It is a state of the live
 * screen, not a route, so there is no back gesture into a half-started run; recording begins
 * when `onDone` fires, not before, so the three seconds stood still are not in the clock.
 *
 * Reduce Motion keeps the numbers and the haptics and drops the rings and the collapse.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, Palettes } from '@/constants/theme';

const BEATS = ['3', '2', '1', 'GO'] as const;
const BEAT_MS = 900;

export default function CountdownOverlay({ onDone }: { onDone: () => void }) {
    const reduce = useReducedMotion();
    const { width, height } = useWindowDimensions();
    const [beat, setBeat] = useState(0);
    const done = useRef(false);
    const numberScale = useSharedValue(1.4);
    const numberOpacity = useSharedValue(0);
    const ring = useSharedValue(0);
    const collapse = useSharedValue(1);
    // Brand moment: the hero violet, fixed in both schemes (Dark mode rule 3).
    const hero = Palettes.light.heroGradient;

    const finish = () => {
        if (done.current) return;
        done.current = true;
        onDone();
    };

    useEffect(() => {
        if (beat >= BEATS.length) return;
        const isGo = beat === BEATS.length - 1;
        Haptics.impactAsync(isGo ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        if (isGo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

        numberScale.value = reduce ? 1 : 1.4;
        numberOpacity.value = 0;
        numberScale.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.back(1.6)) });
        numberOpacity.value = withSequence(withTiming(1, { duration: 160 }), withTiming(1, { duration: BEAT_MS - 360 }), withTiming(isGo ? 1 : 0, { duration: 200 }));
        if (!reduce) {
            ring.value = 0;
            ring.value = withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) });
        }

        if (isGo) {
            const t = setTimeout(() => {
                if (reduce) { finish(); return; }
                collapse.value = withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) }, (ok) => {
                    if (ok) runOnJS(finish)();
                });
            }, 420);
            return () => clearTimeout(t);
        }
        const t = setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beat]);

    // A circle big enough to cover the screen from the controls' position, shrinking into it.
    const diameter = Math.hypot(width, height) * 2.1;
    const veil = useAnimatedStyle(() => ({ transform: [{ scale: collapse.value }] }));
    const numberStyle = useAnimatedStyle(() => ({ opacity: numberOpacity.value, transform: [{ scale: numberScale.value }] }));
    const ringStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 0.4 + ring.value * 1.8 }] }));

    return (
        <Pressable
            style={StyleSheet.absoluteFill}
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Countdown. Tap to start now."
        >
            <Animated.View
                pointerEvents="none"
                style={[
                    {
                        position: 'absolute',
                        width: diameter,
                        height: diameter,
                        borderRadius: diameter / 2,
                        left: width / 2 - diameter / 2,
                        top: height - 120 - diameter / 2,
                        overflow: 'hidden',
                    },
                    veil,
                ]}
            >
                <LinearGradient colors={hero} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={styles.centre} pointerEvents="none">
                <Animated.View style={[styles.ring, { borderColor: Palettes.light.white }, ringStyle]} />
                <Animated.Text
                    allowFontScaling={false}
                    style={[styles.number, { color: Palettes.light.white }, beat === BEATS.length - 1 && styles.go, numberStyle]}
                >
                    {BEATS[Math.min(beat, BEATS.length - 1)]}
                </Animated.Text>
                <Text style={[styles.skip, { color: Palettes.light.white }]}>Tap to skip</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 3 },
    number: { fontFamily: Fonts.bold, fontSize: 200, lineHeight: 220 },
    go: { fontSize: 140, lineHeight: 160, letterSpacing: 4 },
    skip: { position: 'absolute', bottom: 64, fontFamily: Fonts.semibold, fontSize: 14, opacity: 0.7 },
});
