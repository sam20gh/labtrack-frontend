/**
 * A labelled text field in the kit's auth style: 48pt tall, white, a 1pt `borderStrong`
 * outline, a leading glyph, and an optional trailing control.
 *
 * The focus treatment is a **padded halo**, not a shadow. The kit draws a focused field as
 * a purple outline inside a wider `#DECEFB` ring; RN has no outline-offset and Android
 * ignores `shadowRadius`, so the ring is a real 3pt-padded wrapper that only gets a colour
 * when focused. Because the padding is always there, the field does not shift on focus —
 * which is what a shadow-based ring would have done on iOS and nothing at all on Android.
 */
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radius } from '@/constants/theme';

interface Props extends Omit<TextInputProps, 'style'> {
    label: string;
    /** The leading glyph. The kit gives every auth field one; there is no unmarked field. */
    icon: React.ComponentProps<typeof Ionicons>['name'];
    /** Rendered inside the field on the trailing edge — the reveal toggle, or a tick. */
    accessory?: React.ReactNode;
    /** Draws the field in the error tone regardless of focus. */
    invalid?: boolean;
    /**
     * Drops the group's bottom margin, for a field that something else hangs off — the
     * strength meter, which the kit draws hard against the underside of the password box.
     */
    attached?: boolean;
}

export default function AuthField({ label, icon, accessory, invalid, attached, onFocus, onBlur, ...input }: Props) {
    const [focused, setFocused] = useState(false);
    const accent = invalid ? Palette.danger : Palette.primary;

    return (
        <View style={[styles.group, attached && styles.attached]}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.ring, (focused || invalid) && { backgroundColor: invalid ? Palette.dangerSurface : RING }]}>
                <View
                    style={[
                        styles.field,
                        (focused || invalid) && { borderColor: accent },
                    ]}
                >
                    <Ionicons
                        name={icon}
                        size={20}
                        color={focused || invalid ? accent : Palette.textSecondary}
                    />
                    <TextInput
                        placeholderTextColor={Palette.textMuted}
                        {...input}
                        onFocus={(e) => {
                            setFocused(true);
                            onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setFocused(false);
                            onBlur?.(e);
                        }}
                        style={styles.input}
                    />
                    {accessory}
                </View>
            </View>
        </View>
    );
}

/** The kit's focus halo, measured off the export. Not a palette token — it exists here only. */
const RING = '#DECEFB';

const styles = StyleSheet.create({
    group: {
        // 23 and 11 rather than 20 and 8: the focus ring's `margin: -3` lets the halo grow
        // outside the field's box (which is what the kit draws), and that -3 eats into the
        // gaps on both sides. These add it back so the resting rhythm is the measured 8/20.
        marginBottom: 23,
    },
    attached: {
        marginBottom: 0,
    },
    label: {
        fontSize: 14,
        fontFamily: Fonts.semibold,
        color: Palette.text,
        marginBottom: 11,
    },
    ring: {
        borderRadius: Radius.sm + 3,
        padding: 3,
        margin: -3,
        backgroundColor: 'transparent',
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        paddingHorizontal: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: Palette.borderStrong,
        borderRadius: Radius.sm,
        backgroundColor: Palette.background,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        fontFamily: Fonts.regular,
        color: Palette.text,
        padding: 0,
    },
});
