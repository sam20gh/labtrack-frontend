/**
 * Fades its children in when they mount, with a short rise.
 *
 * For content that arrives after the first paint — a screen swapping its skeleton for the
 * real thing, a card whose request resolved late. Without it the swap is a cut: one frame
 * placeholders, the next frame a full page, which reads as the screen jumping rather than
 * as data arriving.
 *
 * Three rules it keeps:
 *
 * 1. **Mount only.** It animates once, when it first appears. A child that re-renders with
 *    fresh data (a pull-to-refresh, a refocus) does not fade again — a page that blinked
 *    every time it refreshed would be worse than one that never faded at all.
 * 2. **Native driver, opacity and transform only**, the same constraint
 *    `components/nutrition/Skeleton.tsx` takes: nothing here costs a layout pass.
 * 3. **Reduce Motion drops the rise, not the fade.** A cross-fade is not motion in the sense
 *    the setting means; a sliding page is.
 *
 * **Put any negative margin on this wrapper, never on the child.** A child pulled outside its
 * parent's bounds is not touchable on Android — the rule `AppTabBar` records — so the home
 * score card's overlap onto the header lives on the `FadeIn` that wraps it.
 */
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

// Read once and kept current, so the first render already knows. Asking per mount would
// resolve after the animation had started.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
    .then((value) => { reduceMotion = value; })
    .catch(() => { /* unknown: animate */ });
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => { reduceMotion = value; });

interface Props {
    children: React.ReactNode;
    /** Milliseconds. Short on purpose: this is an arrival, not an entrance. */
    duration?: number;
    delay?: number;
    /** How far below its resting place it starts, in points. */
    rise?: number;
    style?: StyleProp<ViewStyle>;
}

export function FadeIn({ children, duration = 260, delay = 0, rise = 8, style }: Props) {
    const progress = useRef(new Animated.Value(0)).current;
    const lift = useRef(!reduceMotion).current;

    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [progress, duration, delay]);

    const transform = lift
        ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }]
        : [];

    return (
        <Animated.View style={[style, { opacity: progress, transform }]}>
            {children}
        </Animated.View>
    );
}
