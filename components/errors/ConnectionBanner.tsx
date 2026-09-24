/**
 * "You are not connected", said once, at the top, for the whole app.
 *
 * `Design/errors.svg` frame 2 draws a full "No Internet" screen with a **Please Reconnect**
 * pill above the title, and that screen is right when a person opened something and it did
 * not load. It is wrong for the much commoner case: they are already looking at data that
 * loaded a minute ago, and the *next* call failed. Replacing a screenful of their own
 * results with an illustration because a background refresh missed is losing information to
 * report the loss of information.
 *
 * So the pill leaves the screen and becomes the app's one persistent connection status, and
 * `ErrorState` keeps the full screen for a surface that has nothing else to show.
 *
 * Four things to know:
 *
 * 1. **It reports reachability, not the radio.** See `isReachable` in `lib/api.ts`. The
 *    copy says "Can't reach Predyqt" rather than "You're offline" for that reason — one is
 *    something we observed, the other is a guess about somebody's phone.
 * 2. **It clears itself.** Any successful call anywhere in the app flips the signal back,
 *    so the banner disappears on the next thing that works rather than needing its own
 *    retry. Retry is offered anyway, because waiting for an unrelated screen to poll is not
 *    a recovery a person can perform.
 * 3. **It sits under the status bar and above everything else**, absolutely positioned, so
 *    no screen has to make room for it and nothing shifts when it appears — the argument
 *    `AppTabBar` makes in reverse, and it holds here because this element is transient and
 *    the tab bar is not.
 * 4. **It announces itself once.** `accessibilityLiveRegion="polite"` and an
 *    `AccessibilityInfo` announcement on the transition, so a screen reader says it without
 *    interrupting, and does not repeat it on every re-render.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius, Shadow, Spacing, BodyFont } from '@/constants/theme';
import { isReachable, onReachabilityChange } from '@/lib/api';

type Props = {
    /**
     * What to run when somebody taps Retry. The banner has no idea what the current screen
     * was loading, so by default it only re-checks; a host that knows can pass its loader.
     */
    onRetry?: () => void;
};

const ConnectionBanner = ({ onRetry }: Props) => {
    const insets = useSafeAreaInsets();
    const [offline, setOffline] = useState(!isReachable());
    const slide = useRef(new Animated.Value(offline ? 1 : 0)).current;

    useEffect(() => onReachabilityChange((reachable) => setOffline(!reachable)), []);

    useEffect(() => {
        Animated.timing(slide, {
            toValue: offline ? 1 : 0,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
        if (offline) AccessibilityInfo.announceForAccessibility("Can't reach Predyqt. You may be offline.");
    }, [offline, slide]);

    // Kept mounted while animating out, then removed — an absolutely positioned view that
    // stays mounted at opacity 0 still swallows touches on the header underneath it.
    const [mounted, setMounted] = useState(offline);
    useEffect(() => {
        if (offline) { setMounted(true); return; }
        const timer = setTimeout(() => setMounted(false), 240);
        return () => clearTimeout(timer);
    }, [offline]);

    if (!mounted) return null;

    return (
        <Animated.View
            pointerEvents="box-none"
            accessibilityLiveRegion="polite"
            style={[
                styles.wrap,
                { top: insets.top + Spacing.sm },
                {
                    opacity: slide,
                    transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
                },
            ]}
        >
            <Pressable
                style={styles.pill}
                onPress={onRetry}
                disabled={!onRetry}
                // With no retry to offer it is a label, not a control, and a disabled
                // Pressable still sits over whatever header is beneath it.
                pointerEvents={onRetry ? 'auto' : 'none'}
                accessibilityRole={onRetry ? 'button' : 'alert'}
                accessibilityLabel={
                    onRetry ? "Can't reach Predyqt. Tap to retry." : "Can't reach Predyqt. You may be offline."
                }
            >
                <Ionicons name="wifi-outline" size={14} color={Palette.alert} />
                <Text style={styles.label}>Can&apos;t reach Predyqt</Text>
                {onRetry ? <Text style={styles.retry}>Retry</Text> : null}
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 32,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.alertBorder,
        backgroundColor: Palette.alertSurface,
        ...Shadow.card,
    },
    label: { fontSize: 12, ...BodyFont.medium, color: Palette.alert },
    retry: { fontSize: 12, fontFamily: Fonts.bold, color: Palette.alert, textDecorationLine: 'underline' },
});

export default ConnectionBanner;
