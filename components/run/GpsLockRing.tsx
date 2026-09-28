/**
 * The launch pad's GPS lock ring. **Its radius is the reported accuracy**, so it visibly
 * tightens as the fix improves — ±38 m is a wide, faint ring, ±4 m a tight bright one.
 *
 * It pulses only while it is genuinely waiting for fixes. An idle animation that looked like
 * searching would be a progress bar that lies — the rule `DeviceStage` holds for the
 * bracelet. Reduce Motion stops the pulse and keeps the ring.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
    Easing, cancelAnimation, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
    /** Metres; null before the first fix. */
    accuracyM: number | null;
    /** True once accuracy is good enough to count distance. */
    locked: boolean;
    /** Whether fixes are being asked for at all (permission granted). */
    searching: boolean;
    size?: number;
    ring: string;
    core: string;
}

/** 4 m maps to the innermost ring, 60 m or worse to the outermost. */
const radiusFor = (acc: number | null, max: number) => {
    if (acc == null) return max;
    const t = Math.min(1, Math.max(0, (acc - 4) / 56));
    return max * (0.22 + 0.78 * Math.sqrt(t));
};

export default function GpsLockRing({ accuracyM, locked, searching, size = 220, ring, core }: Props) {
    const reduce = useReducedMotion();
    const c = size / 2;
    const max = size / 2 - 6;
    const r = useSharedValue(radiusFor(accuracyM, max));
    const pulse = useSharedValue(0);

    useEffect(() => {
        r.value = withTiming(radiusFor(accuracyM, max), { duration: reduce ? 0 : 700, easing: Easing.out(Easing.cubic) });
    }, [accuracyM, max, r, reduce]);

    useEffect(() => {
        if (searching && !locked && !reduce) {
            pulse.value = 0;
            pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
        } else {
            cancelAnimation(pulse);
            pulse.value = 0;
        }
    }, [searching, locked, reduce, pulse]);

    const accuracyProps = useAnimatedProps(() => ({ r: r.value }));
    const pulseProps = useAnimatedProps(() => ({
        r: r.value + pulse.value * (max - r.value + 8),
        strokeOpacity: 0.5 * (1 - pulse.value),
    }));

    return (
        <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants">
            <Svg width={size} height={size}>
                {[0.33, 0.66, 1].map((f) => (
                    <Circle key={f} cx={c} cy={c} r={max * f} stroke={ring} strokeOpacity={0.14} strokeWidth={1} fill="none" />
                ))}
                <AnimatedCircle cx={c} cy={c} animatedProps={pulseProps} stroke={ring} strokeWidth={2} fill="none" />
                <AnimatedCircle
                    cx={c}
                    cy={c}
                    animatedProps={accuracyProps}
                    stroke={locked ? core : ring}
                    strokeOpacity={locked ? 0.95 : 0.6}
                    strokeWidth={locked ? 3 : 2}
                    fill={core}
                    fillOpacity={locked ? 0.14 : 0.06}
                />
                <Circle cx={c} cy={c} r={7} fill={core} />
                <Circle cx={c} cy={c} r={11} stroke={core} strokeOpacity={0.35} strokeWidth={2} fill="none" />
            </Svg>
        </View>
    );
}
