/**
 * Hold to finish — the kit's frame, and the confirmation.
 *
 * A ring fills under the thumb over `HOLD_MS` with a haptic at the halfway mark; letting go
 * early drains it. There is no confirm dialog afterwards, because the hold *is* the
 * confirmation and a dialog is a second target somebody out of breath has to aim at.
 *
 * Screen readers cannot hold, so the element exposes the action directly — double-tap
 * finishes — rather than asking for a gesture VoiceOver cannot perform.
 */
import React, { useRef } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const HOLD_MS = 1200;

interface Props {
    onComplete: () => void;
    size?: number;
    track: string;
    fill: string;
    icon: string;
    disabled?: boolean;
}

export default function HoldToFinish({ onComplete, size = 64, track, fill, icon, disabled }: Props) {
    const progress = useSharedValue(0);
    const halfway = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stroke = 4;
    const r = size / 2 - stroke;
    const circumference = 2 * Math.PI * r;

    const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

    const complete = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        onComplete();
    };

    const start = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        halfway.current = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined), HOLD_MS / 2);
        progress.value = withTiming(1, { duration: HOLD_MS * (1 - progress.value), easing: Easing.linear }, (finished) => {
            if (finished) runOnJS(complete)();
        });
    };

    const release = () => {
        if (halfway.current) clearTimeout(halfway.current);
        if (progress.value >= 1) return;
        cancelAnimation(progress);
        progress.value = withTiming(0, { duration: 250 });
    };

    return (
        <Pressable
            onPressIn={start}
            onPressOut={release}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Finish"
            accessibilityHint="Press and hold to finish and save"
            accessibilityActions={[{ name: 'activate', label: 'Finish and save' }]}
            onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate') complete(); }}
        >
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                    <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
                    <AnimatedCircle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={fill}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        animatedProps={ringProps}
                        fill="none"
                    />
                </Svg>
                <Ionicons name="stop" size={size * 0.34} color={icon} />
            </View>
        </Pressable>
    );
}
