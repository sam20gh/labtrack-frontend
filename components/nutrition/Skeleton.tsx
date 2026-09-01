/**
 * Placeholder blocks shown while a screen's own data is still in flight.
 *
 * A skeleton is only honest when it has the shape of what is coming. A generic grey
 * rectangle where a chart will land tells someone the screen is broken; a chart-shaped one
 * tells them it is loading. So these are used to compose the actual layout of each screen
 * rather than being dropped in as a single blob — see `nutrition/[id].tsx`.
 *
 * The pulse uses React Native's own `Animated` on the native driver, matching
 * `assistant/immersive.tsx`. Opacity only: animating a width or a gradient here would cost
 * a layout pass a loading screen has no business spending.
 *
 * The animation is shared by every block on screen through one context value, so twelve
 * placeholders drive one timer rather than twelve of them.
 */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { Palette, Radius, Spacing } from '@/constants/theme';

const PulseContext = createContext<Animated.AnimatedInterpolation<number> | null>(null);

/** Wraps a screen's placeholders so they all breathe on one timer. */
export function SkeletonGroup({ children }: { children: React.ReactNode }) {
    const value = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(value, {
                    toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
                Animated.timing(value, {
                    toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [value]);

    const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
    return <PulseContext.Provider value={opacity}>{children}</PulseContext.Provider>;
}

interface BlockProps {
    width?: number | `${number}%`;
    height?: number;
    radius?: number;
    style?: ViewStyle;
}

/** One placeholder. Outside a `SkeletonGroup` it renders static rather than throwing. */
export function SkeletonBlock({ width = '100%', height = 14, radius = Radius.sm, style }: BlockProps) {
    const opacity = useContext(PulseContext);
    const shape = [styles.block, { width, height, borderRadius: radius }, style];

    return opacity
        ? <Animated.View style={[...shape, { opacity }]} />
        : <View style={shape} />;
}

/** A card-shaped placeholder, so a skeleton keeps the page's real vertical rhythm. */
export function SkeletonCard({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    block: { backgroundColor: Palette.borderLight },
    card: {
        backgroundColor: Palette.canvas,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
});
