/**
 * The popover behind the tab bar's centre button.
 *
 * A popover anchored to the button rather than a bottom sheet, because the button is what it
 * belongs to: the caret points at the thing that opened it, so there is never a question of
 * what dismisses it or where it came from. A sheet sliding over the bar would cover the
 * button and read as a separate destination.
 *
 * It draws the same nine shortcuts the home grid does, from `lib/quickActions.ts`. Two lists
 * would drift the first time a tracker was added.
 *
 * Dismissal: the backdrop, the hardware back button, and picking an action. There is no
 * close control in the card — the caret and the dimmed page behind already say this is a
 * layer over the app rather than a screen, and a nine-item grid with a tenth cell for "close"
 * is a cell that does nothing but undo opening it.
 */
import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, Animated, Easing, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { QUICK_ACTIONS, type QuickAction } from '@/lib/quickActions';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (action: QuickAction) => void;
    /** Height of the bar the caret has to sit above, so the two never overlap. */
    barHeight: number;
}

export function QuickActionsSheet({ visible, onClose, onSelect, barHeight }: Props) {
    const insets = useSafeAreaInsets();
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: visible ? 1 : 0,
            duration: visible ? 180 : 120,
            easing: visible ? Easing.out(Easing.back(1.3)) : Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start();
    }, [visible, anim]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close shortcuts" />

            {/*
              `pointerEvents="box-none"` so the area either side of the card still reaches the
              backdrop underneath. Without it the whole bottom of the screen becomes an
              invisible dead zone that swallows the tap meant to dismiss.
            */}
            <View
                pointerEvents="box-none"
                style={[styles.anchor, { paddingBottom: barHeight + insets.bottom + Spacing.sm }]}
            >
                <Animated.View
                    style={[
                        styles.popover,
                        {
                            opacity: anim,
                            // Grows out of the button rather than fading in place
                            transform: [
                                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                            ],
                        },
                    ]}
                >
                    <View style={styles.grid}>
                        {QUICK_ACTIONS.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.action}
                                onPress={() => onSelect(action)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                            >
                                <View style={styles.actionIcon}>
                                    <Ionicons name={action.icon} size={22} color={Palette.text} />
                                </View>
                                <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/*
                      The caret. Two stacked triangles rather than a rotated square: a rotated
                      square carries the card's border on two of its edges and shows them as a
                      seam across the tip. The lower one is the fill, inset by the border width.
                    */}
                    <View style={styles.caretWrap} pointerEvents="none">
                        <View style={styles.caretBorder} />
                        <View style={styles.caretFill} />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

/** Half the caret's width. Kept here so the two triangles cannot drift apart. */
const CARET = 11;

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
    anchor: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.lg },

    popover: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl * 1.6,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.sm,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 12,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xl },
    // Fixed fraction, not `flex` — flex children do not wrap onto even columns, the same
    // note the home grid carries.
    action: { width: '33.333%', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
    actionIcon: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    actionLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.text },

    caretWrap: { position: 'absolute', bottom: -CARET, left: 0, right: 0, alignItems: 'center' },
    caretBorder: {
        width: 0, height: 0, backgroundColor: 'transparent',
        borderLeftWidth: CARET, borderRightWidth: CARET, borderTopWidth: CARET,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: Palette.borderSlate,
    },
    caretFill: {
        position: 'absolute', top: 0,
        width: 0, height: 0, backgroundColor: 'transparent',
        borderLeftWidth: CARET, borderRightWidth: CARET, borderTopWidth: CARET,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: Palette.background,
    },
});
