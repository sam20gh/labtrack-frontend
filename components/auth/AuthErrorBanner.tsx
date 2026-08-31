/**
 * The kit's auth error: a bordered rose panel at the very top of the screen, above the
 * mark, with a dismiss control.
 *
 * It sits above the logo rather than beside the field on purpose — "incorrect email or
 * password" is not a fact about either field, and anchoring it to one of them says which
 * half was wrong. It is dismissible because the person may want the screen back after
 * reading it, and it clears itself on the next keystroke.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radius } from '@/constants/theme';

interface Props {
    message: string;
    onDismiss: () => void;
}

export default function AuthErrorBanner({ message, onDismiss }: Props) {
    return (
        <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Ionicons name="warning-outline" size={20} color={Palette.danger} />
            <Text style={styles.text}>ERROR: {message}</Text>
            <TouchableOpacity
                onPress={onDismiss}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss error"
            >
                <Ionicons name="close" size={20} color={Palette.text} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: Palette.danger,
        borderRadius: Radius.sm,
        backgroundColor: Palette.dangerSurface,
    },
    text: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
});
