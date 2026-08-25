/**
 * The composer at the bottom of the conversation.
 *
 * The kit models this as a component with `Is Active` and `Is Expanded` states — a resting
 * pill that grows as the message does. `multiline` with a capped height reproduces that:
 * short messages sit on one line, long ones grow to about four and then scroll internally
 * rather than eating the transcript.
 */
import React, { useState } from 'react';
import {
    View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

type Props = {
    onSend: (text: string) => void;
    /** A reply is in flight — the send button becomes a spinner and input is refused. */
    busy?: boolean;
    placeholder?: string;
};

export default function InputDock({ onSend, busy, placeholder = 'Ask about your health…' }: Props) {
    const [text, setText] = useState('');
    const trimmed = text.trim();
    const canSend = trimmed.length > 0 && !busy;

    const submit = () => {
        if (!canSend) return;
        // Cleared before the await in the parent, so the field is empty the instant the
        // message appears in the transcript rather than a round-trip later.
        setText('');
        onSend(trimmed);
    };

    return (
        <View style={styles.dock}>
            <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={placeholder}
                placeholderTextColor={Palette.textMuted}
                multiline
                maxLength={2000}
                editable={!busy}
                // Send on the keyboard's return key, but keep multiline: `blurOnSubmit`
                // false stops the keyboard collapsing after each message.
                blurOnSubmit={false}
                onSubmitEditing={submit}
                returnKeyType="send"
            />
            <TouchableOpacity
                style={[styles.send, !canSend && styles.sendDisabled]}
                onPress={submit}
                disabled={!canSend}
                accessibilityLabel="Send message"
            >
                {busy
                    ? <ActivityIndicator size="small" color={Palette.white} />
                    : <Ionicons name="arrow-up" size={19} color={Palette.white} />}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    dock: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        backgroundColor: Palette.background,
    },
    input: {
        flex: 1,
        minHeight: 44,
        // Roughly four lines. Past that the composer scrolls rather than pushing the
        // conversation off the screen.
        maxHeight: 120,
        borderRadius: Radius.xl,
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.border,
        paddingHorizontal: Spacing.lg,
        // Android centres single-line text with vertical padding; iOS needs paddingTop or
        // the first line sits against the top edge.
        paddingTop: Platform.OS === 'ios' ? 13 : 10,
        paddingBottom: Platform.OS === 'ios' ? 13 : 10,
        fontSize: 14,
        lineHeight: 19,
        fontFamily: Fonts.regular,
        color: Palette.text,
    },
    send: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendDisabled: { backgroundColor: Palette.textMuted },
});
