/**
 * The three round shortcuts under the chart — `Design/activity.svg` frame 7.
 *
 * New Activity is a filled purple disc, the other two are outlined. That is not decoration:
 * one of these writes something and two of them navigate, and the design separates them the
 * way every other primary action in this app is separated from the rows around it.
 *
 * **Quick Jog is offered only when it means something.** It is a shortcut into the log form
 * pre-filled with the type this person actually does most, so on an account with no history
 * there is nothing to pre-fill and the slot is dropped rather than hard-coded to jogging —
 * the design's own label, and a suggestion to go for a run is the wrong thing to put in
 * front of somebody whose plan says to swim.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing } from '@/constants/theme';

export interface QuickAction {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    /** The one filled disc. At most one, and it is the action that creates something. */
    primary?: boolean;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
    if (!actions.length) return null;

    return (
        <View style={styles.row}>
            {actions.map((a) => (
                <Pressable
                    key={a.key}
                    onPress={a.onPress}
                    style={styles.item}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                >
                    {({ pressed }) => (
                        <>
                            <View style={[styles.disc, a.primary ? styles.discPrimary : styles.discPlain, pressed && styles.pressed]}>
                                <Ionicons
                                    name={a.icon}
                                    size={a.primary ? 26 : 22}
                                    color={a.primary ? Palette.white : Palette.text}
                                />
                            </View>
                            <Text style={styles.label} numberOfLines={1}>{a.label}</Text>
                        </>
                    )}
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
    item: { alignItems: 'center', gap: Spacing.sm, flex: 1 },
    disc: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discPrimary: {
        backgroundColor: Palette.primary,
        // The kit's shadow, which is what makes the filled disc read as raised rather than
        // as a purple circle sitting in the page.
        shadowColor: Palette.primary,
        shadowOpacity: 0.32,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    discPlain: {
        backgroundColor: Palette.white,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    pressed: { opacity: 0.75 },
    label: { fontSize: 12.5, fontFamily: Fonts.medium, color: Palette.text },
});
