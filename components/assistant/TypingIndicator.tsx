/**
 * The three-dot "thinking" bubble.
 *
 * Worth the animation rather than a spinner: replies here are model-generated and can take
 * several seconds, and a bubble that occupies the place the answer will appear reads as
 * progress in the conversation, where a spinner reads as the screen being stuck.
 *
 * Driven by `useNativeDriver` on opacity so the whole loop runs off the JS thread — this
 * animates while the app is awaiting a network response, which is exactly when the JS
 * thread is least reliable.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { Palette, Spacing, Radius } from '@/constants/theme';

const Dot = ({ delay }: { delay: number }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                Animated.delay(600 - delay),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [delay, opacity]);

    return <Animated.View style={[styles.dot, { opacity }]} />;
};

export default function TypingIndicator() {
    return (
        <View style={styles.bubble} accessibilityLabel="LabTrack AI is typing">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
        </View>
    );
}

const styles = StyleSheet.create({
    bubble: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl,
        borderTopLeftRadius: Radius.sm,
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.primary },
});
