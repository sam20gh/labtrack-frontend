/**
 * The three round shortcuts under the chart — `Design/activity.svg` frame 7.
 *
 * New Activity is a filled purple disc, the other two are outlined. That is not decoration:
 * one of these writes something and two of them navigate, and the design separates them the
 * way every other primary action in this app is separated from the rows around it.
 *
 * The kit's middle "Quick Jog" disc is gone from this row: the live GPS tracker has its own
 * card above the chart (`components/activity/RecordCard.tsx`) and the floating Record button,
 * because an outlined disc labelled after somebody's most-logged type was the reason people
 * never found it. See `app/activity/index.tsx`.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

export interface QuickAction {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    /** The one filled disc. At most one, and it is the action that creates something. */
    primary?: boolean;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
    const Palette = usePalette();
    const styles = useStyles();
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

const useStyles = makeStyles((Palette) => ({
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
        backgroundColor: Palette.primaryFill,
        // The kit's shadow, which is what makes the filled disc read as raised rather than
        // as a purple circle sitting in the page.
        shadowColor: Palette.primary,
        shadowOpacity: 0.32,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    discPlain: {
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    pressed: { opacity: 0.75 },
    label: { fontSize: 12.5, ...BodyFont.medium, color: Palette.text },
}));
