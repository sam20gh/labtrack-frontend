/**
 * The pocket lock. While locked the controls are covered and only this slider answers, so
 * a thigh cannot pause a run. Written on `PanResponder` rather than a gesture library: the
 * app mounts no gesture root, and adding one to the whole tree for one slider is not worth
 * the risk (the same call the notification centre's swipe makes).
 */
import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Fonts, Radius } from '@/constants/theme';

interface Props {
    onUnlock: () => void;
    track: string;
    thumb: string;
    text: string;
    icon: string;
}

const THUMB = 56;

export default function SlideToUnlock({ onUnlock, track, thumb, text, icon }: Props) {
    const x = useRef(new Animated.Value(0)).current;
    const width = useRef(0);

    const responder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => {
            x.setValue(Math.max(0, Math.min(width.current - THUMB - 8, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
            const end = width.current - THUMB - 8;
            if (g.dx >= end * 0.85) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                Animated.timing(x, { toValue: end, duration: 120, useNativeDriver: true }).start(() => {
                    onUnlock();
                    x.setValue(0);
                });
            } else {
                Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
            }
        },
    }), [onUnlock, x]);

    return (
        <View
            onLayout={(e: LayoutChangeEvent) => { width.current = e.nativeEvent.layout.width; }}
            style={{ height: THUMB + 8, borderRadius: Radius.pill, backgroundColor: track, justifyContent: 'center', padding: 4 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Locked. Slide to unlock the controls."
            accessibilityActions={[{ name: 'activate', label: 'Unlock' }]}
            onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate') onUnlock(); }}
        >
            <Text style={{ position: 'absolute', alignSelf: 'center', fontFamily: Fonts.semibold, fontSize: 15, color: text, opacity: 0.8 }}>
                Slide to unlock
            </Text>
            <Animated.View
                {...responder.panHandlers}
                style={{
                    width: THUMB,
                    height: THUMB,
                    borderRadius: THUMB / 2,
                    backgroundColor: thumb,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ translateX: x }],
                }}
            >
                <Ionicons name="lock-closed" size={22} color={icon} />
            </Animated.View>
        </View>
    );
}
