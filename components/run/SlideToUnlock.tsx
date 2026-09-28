/**
 * The pocket lock. While locked the controls are covered and only this answers, so a thigh
 * cannot pause a run — but **a lock must never trap the person who set it.** The first
 * version did, on a real ride: it needed 85% of the travel, a slide to two-thirds sprang
 * back, a gesture the system claimed mid-drag was never released, and there was no other way
 * out, so the only escape was restarting the app. Now:
 *
 * - **The whole track takes the gesture**, not just the thumb, so it starts wherever the
 *   finger lands and a slightly-off first touch still works.
 * - **It refuses to hand the gesture over mid-drag** (`onPanResponderTerminationRequest`),
 *   and if the system takes it anyway, that is treated as a release rather than ignored.
 * - **Past halfway unlocks, and so does a quick flick** past a quarter.
 * - **Holding anywhere on it for a second also unlocks** — for a sweaty thumb, a glove, or a
 *   slide that will not go. A pocket does not hold still on one spot for a second.
 *
 * Written on `PanResponder` rather than a gesture library: the app mounts no gesture root,
 * and adding one to the whole tree for one control is not worth the risk.
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
const PAD = 4;
export const UNLOCK_SHARE = 0.5;
export const FLICK_SHARE = 0.25;
export const FLICK_VELOCITY = 0.6;
export const HOLD_TO_UNLOCK_MS = 1000;
/** Movement beyond this cancels the hold: the finger is sliding, not holding. */
const HOLD_SLOP = 10;

/** Whether a release at `dx` with velocity `vx` unlocks a track whose travel is `end`. Pure. */
export const shouldUnlock = (dx: number, vx: number, end: number): boolean =>
    end > 0 && (dx >= end * UNLOCK_SHARE || (vx >= FLICK_VELOCITY && dx >= end * FLICK_SHARE));

export default function SlideToUnlock({ onUnlock, track, thumb, text, icon }: Props) {
    const x = useRef(new Animated.Value(0)).current;
    const width = useRef(0);
    const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
    const done = useRef(false);

    const responder = useMemo(() => {
        const end = () => Math.max(0, width.current - THUMB - PAD * 2);

        const unlock = () => {
            if (done.current) return;
            done.current = true;
            if (hold.current) clearTimeout(hold.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            Animated.timing(x, { toValue: end(), duration: 120, useNativeDriver: true }).start(() => {
                onUnlock();
                x.setValue(0);
                done.current = false;
            });
        };

        const settle = (dx: number, vx: number) => {
            if (hold.current) clearTimeout(hold.current);
            if (done.current) return;
            if (shouldUnlock(dx, vx, end())) unlock();
            else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        };

        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            // Never hand the gesture to a parent or the system half-way through.
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                Haptics.selectionAsync().catch(() => undefined);
                hold.current = setTimeout(unlock, HOLD_TO_UNLOCK_MS);
            },
            onPanResponderMove: (_, g) => {
                if (hold.current && Math.abs(g.dx) > HOLD_SLOP) {
                    clearTimeout(hold.current);
                    hold.current = null;
                }
                x.setValue(Math.max(0, Math.min(end(), g.dx)));
            },
            onPanResponderRelease: (_, g) => settle(g.dx, g.vx),
            // Taken anyway (an incoming call, a system gesture): judge it where it ended.
            onPanResponderTerminate: (_, g) => settle(g.dx, g.vx),
        });
    }, [onUnlock, x]);

    return (
        <View
            {...responder.panHandlers}
            onLayout={(e: LayoutChangeEvent) => { width.current = e.nativeEvent.layout.width; }}
            style={{ height: THUMB + PAD * 2, borderRadius: Radius.pill, backgroundColor: track, justifyContent: 'center', padding: PAD }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Locked. Slide or hold to unlock the controls."
            accessibilityActions={[{ name: 'activate', label: 'Unlock' }]}
            onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate') onUnlock(); }}
        >
            <Text pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', fontFamily: Fonts.semibold, fontSize: 15, color: text, opacity: 0.8 }}>
                Slide or hold to unlock
            </Text>
            <Animated.View
                pointerEvents="none"
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
