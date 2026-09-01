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
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { QuickActionsSheet } from '@/components/QuickActionsSheet';
import { openQuickAction, type QuickAction } from '@/lib/quickActions';
import { Palette, Fonts, Spacing } from '@/constants/theme';

/** Route names in bar order. The action button goes between index 1 and 2. */
const TAB_ORDER = ['index', 'assistant', 'orders', 'results'] as const;
const SPLIT = 2;

const TAB_ICON: Record<string, {
    on: React.ComponentProps<typeof Ionicons>['name'];
    off: React.ComponentProps<typeof Ionicons>['name'];
}> = {
    index: { on: 'home', off: 'home-outline' },
    assistant: { on: 'sparkles', off: 'sparkles-outline' },
    orders: { on: 'bag-handle', off: 'bag-handle-outline' },
    results: { on: 'analytics', off: 'analytics-outline' },
};

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
        const icon = TAB_ICON[name] ?? { on: 'ellipse', off: 'ellipse-outline' };
        const label = options.title ?? name;

        const onPress = () => {
            tap();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
            }
        };

        return (
            <Pressable
                key={route.key}
                style={styles.tab}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
            >
                <Ionicons
                    name={focused ? icon.on : icon.off}
                    size={22}
                    color={focused ? Palette.primary : Palette.textMuted}
                />
                <Text
                    style={[styles.label, focused && styles.labelActive]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </Pressable>
        );
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
                        <Ionicons name={sheetOpen ? 'close' : 'add'} size={30} color={Palette.white} />
                    </Pressable>
                </View>

                {TAB_ORDER.slice(SPLIT).map(renderTab)}
            </View>
        </>
    );
}

const BUTTON = 56;

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.background,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: Spacing.sm },
    label: { fontFamily: Fonts.medium, fontSize: 10, color: Palette.textMuted },
    labelActive: { fontFamily: Fonts.semibold, color: Palette.primary },

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
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
});
