/**
 * The tab bar, with a raised action button in the middle.
 *
 * Written rather than configured because the centre button is not a tab: it navigates
 * nowhere, has no screen behind it, and must sit proud of the bar. Expressing that through
 * `Tabs` means a dummy `Tabs.Screen` whose only job is to be intercepted — a route that
 * exists so it can be prevented from being visited.
 *
 * `TAB_ORDER` is explicit, and deliberately so. A custom bar could derive its items from
 * `state.routes`, but the order and the *split point* are both design decisions — two tabs,
 * the button, two tabs — and deriving them would let adding a sixth screen silently produce
 * a lopsided bar with the button off centre. Anything not named here (professionals, which
 * keeps its route via `href: null`) simply is not drawn.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { QuickActionsSheet } from '@/components/QuickActionsSheet';
import { openQuickAction, type QuickAction } from '@/lib/quickActions';
import { Fonts, Spacing, BodyFont, schemed } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

/** Route names in bar order. The action button goes between index 1 and 2. */
const TAB_ORDER = ['index', 'assistant', 'orders', 'results'] as const;
const SPLIT = 2;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Each tab's glyph and its own hue.
 *
 * The hues are *wayfinding*, not status: they let someone find Results by colour before
 * they have read a word. That is why they come from the categorical tints and never from
 * `success`/`warning`/`danger` — a green Results tab would read as "your results are fine",
 * which is a verdict the bar has no business giving. Assistant keeps the brand violet
 * because it is the product's signature surface, and the centre button carries the full
 * hero gradient so it stays the loudest thing on the bar.
 *
 * Colour is never the only signal of the selected tab: it also gets the filled glyph, a
 * tinted pill and a heavier label, so the state survives colour-blindness and greyscale.
 */
type TabIcon = { on: IconName; off: IconName; tint: string; surface: string };

const TAB_ICON: Record<string, TabIcon> = schemed((Palette) => ({
    index: { on: 'home', off: 'home-outline', tint: Palette.sky, surface: Palette.skySurface },
    assistant: { on: 'sparkles', off: 'sparkles-outline', tint: Palette.primary, surface: Palette.primaryTint },
    orders: { on: 'bag-handle', off: 'bag-handle-outline', tint: Palette.orange, surface: Palette.orangeSurface },
    results: { on: 'analytics', off: 'analytics-outline', tint: Palette.teal, surface: Palette.tealSurface },
}));

const FALLBACK_ICON: TabIcon = schemed((Palette) => ({
    on: 'ellipse', off: 'ellipse-outline', tint: Palette.textSecondary, surface: Palette.borderLight,
}));

/**
 * One tab. Its own component so the pill can animate per tab without the bar re-running
 * four animations on every navigation.
 */
function TabItem({ label, focused, icon, onPress }: {
    label: string;
    focused: boolean;
    icon: TabIcon;
    onPress: () => void;
}) {
    const styles = useStyles();
    const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(progress, {
            toValue: focused ? 1 : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 120,
        }).start();
    }, [focused, progress]);

    return (
        <Pressable
            style={styles.tab}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
        >
            <View style={styles.iconWrap}>
                <Animated.View
                    style={[
                        styles.pill,
                        {
                            backgroundColor: icon.surface,
                            opacity: progress,
                            transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                        },
                    ]}
                />
                <Ionicons
                    name={focused ? icon.on : icon.off}
                    size={22}
                    // Idle tabs keep their hue so the bar reads as four places, not four
                    // greys; slightly softened so the selected one still leads.
                    color={icon.tint}
                    style={!focused && styles.iconIdle}
                />
            </View>
            <Text
                style={[styles.label, focused && { fontFamily: Fonts.semibold, color: icon.tint }]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
}

/**
 * Bar height above the safe-area inset, and the sheet's caret is positioned off it.
 *
 * Tall enough to contain the action button outright. The button is drawn raised — a shadow,
 * a full-colour circle — but it does **not** overhang the bar's top edge, and that is a
 * constraint rather than a style choice: a child rendered outside its parent's bounds is not
 * touchable on Android, so an overhanging button is one whose upper half silently stops
 * responding on half the devices that run this app.
 */
export const TAB_BAR_HEIGHT = 68;

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const Palette = usePalette();
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);

    const tap = () => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    /**
     * Pick an action, then navigate.
     *
     * The push is deferred to the next frame rather than fired in the same tick as the close.
     * A `Modal` is a separate native view: navigating while it is still mounted lands the new
     * screen *behind* it, and on Android the back button then dismisses the sheet instead of
     * the screen someone just opened. One frame is enough for React to commit the close.
     */
    const select = (action: QuickAction) => {
        setSheetOpen(false);
        requestAnimationFrame(() => { openQuickAction(router, action); });
    };

    const renderTab = (name: string) => {
        const route = state.routes.find((r) => r.name === name);
        if (!route) return null;

        const { options } = descriptors[route.key];
        const focused = state.routes[state.index]?.key === route.key;
        const icon = TAB_ICON[name] ?? FALLBACK_ICON;
        const label = options.title ?? name;

        const onPress = () => {
            tap();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
            }
        };

        return <TabItem key={route.key} label={label} focused={focused} icon={icon} onPress={onPress} />;
    };

    return (
        <>
            <QuickActionsSheet
                visible={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSelect={select}
                barHeight={TAB_BAR_HEIGHT}
            />

            {/*
              In the layout flow, not absolutely positioned. The navigator measures whatever
              this component occupies and sizes the screen above it to match, so every tab
              screen keeps the bottom space it was written against. Floating the bar would
              silently push the last row of all four screens underneath it.
            */}
            <View style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
                {TAB_ORDER.slice(0, SPLIT).map(renderTab)}

                {/* The button's footprint in the row, so the four tabs stay evenly spaced around it */}
                <View style={styles.buttonSlot}>
                    <Pressable
                        style={styles.button}
                        onPress={() => { tap(); setSheetOpen((open) => !open); }}
                        accessibilityRole="button"
                        accessibilityLabel="Shortcuts"
                        accessibilityHint="Opens quick links to your trackers and tools"
                        accessibilityState={{ expanded: sheetOpen }}
                    >
                        <LinearGradient
                            colors={Palette.actionGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.buttonFill}
                        >
                            <Ionicons name={sheetOpen ? 'close' : 'add'} size={30} color={Palette.white} />
                        </LinearGradient>
                    </Pressable>
                </View>

                {TAB_ORDER.slice(SPLIT).map(renderTab)}
            </View>
        </>
    );
}

const BUTTON = 56;
const PILL_W = 52;
const PILL_H = 30;

const useStyles = makeStyles((Palette) => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.background,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: Spacing.sm },
    iconWrap: { width: PILL_W, height: PILL_H, alignItems: 'center', justifyContent: 'center' },
    pill: { ...StyleSheet.absoluteFillObject, borderRadius: PILL_H / 2 },
    iconIdle: { opacity: 0.7 },
    // textSecondary, not textMuted: #9CA3AF on white is 2.5:1, under AA for 10pt text.
    label: { ...BodyFont.medium, fontSize: 10, color: Palette.textSecondary },

    buttonSlot: {
        width: BUTTON + Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        // Lifts the circle towards the bar's top edge so it reads as raised, while keeping
        // every pixel of it inside the parent — see the note on TAB_BAR_HEIGHT.
        paddingBottom: Spacing.sm,
    },
    button: {
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        backgroundColor: Palette.primaryFill,
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    // The gradient is clipped by its own radius rather than by `overflow: hidden` on the
    // Pressable, which would clip the iOS shadow along with it.
    buttonFill: {
        flex: 1,
        borderRadius: BUTTON / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));
