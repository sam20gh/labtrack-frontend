/**
 * The composer at the bottom of the conversation.
 *
 * The kit models this as a component with `Is Active` and `Is Expanded` states — a resting
 * pill that grows as the message does. `multiline` with a capped height reproduces that:
 * short messages sit on one line, long ones grow to about four and then scroll internally
 * rather than eating the transcript.
 *
 * The kit's pill carries three controls besides the field: a microphone at the leading
 * edge, an attach control at the trailing edge, and the send button. Each is here only when
 * the caller passes the handler for it and the server says the input is actually available
 * — `capabilities` on the conversation. A microphone drawn unconditionally would be a
 * button that fails on tap for every deployment without a transcription key, which is most
 * of them.
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
    Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import type { ImageUpload } from '@/lib/assistant';

type Props = {
    onSend: (text: string, image: ImageUpload | null) => void;
    /** A reply is in flight — the send button becomes a spinner and input is refused. */
    busy?: boolean;
    placeholder?: string;
    /** Opens Voice Mode. Omitted means no microphone is drawn at all. */
    onVoice?: () => void;
    /**
     * Why the microphone cannot be used. Non-null draws it greyed and says this on tap,
     * which is the only honest way to show a control the server cannot back.
     */
    voiceDisabledReason?: string | null;
    /** Whether the model can read a photograph. False hides the attach control. */
    allowImages?: boolean;
};

/** A picked asset in the shape `FormData` and the preview both want. */
const toUpload = (asset: ImagePicker.ImagePickerAsset): ImageUpload => ({
    uri: asset.uri,
    name: asset.fileName || 'photo.jpg',
    // HEIC is rejected server-side and `expo-image-picker` transcodes on the way out, so a
    // missing mimeType is a JPEG in practice rather than a guess worth surfacing.
    mimeType: asset.mimeType || 'image/jpeg',
});

export default function InputDock({
    onSend,
    busy,
    placeholder = 'Ask about your health…',
    onVoice,
    voiceDisabledReason = null,
    allowImages = false,
}: Props) {
    const [text, setText] = useState('');
    const [image, setImage] = useState<ImageUpload | null>(null);

    const trimmed = text.trim();
    // A photograph is a question on its own — the server fills in the words. Requiring text
    // alongside it would make "what is this" the only thing anyone ever types.
    const canSend = (trimmed.length > 0 || image !== null) && !busy;

    const submit = () => {
        if (!canSend) return;
        // Cleared before the await in the parent, so the field is empty the instant the
        // message appears in the transcript rather than a round-trip later.
        setText('');
        setImage(null);
        onSend(trimmed, image);
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access to show the assistant a photo.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!result.canceled) setImage(toUpload(result.assets[0]));
    };

    const pickPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!result.canceled) setImage(toUpload(result.assets[0]));
    };

    const chooseImage = () => {
        Alert.alert('Add a photo', 'The assistant will look at it alongside your question.', [
            { text: 'Take a photo', onPress: takePhoto },
            { text: 'Choose from library', onPress: pickPhoto },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const pressVoice = () => {
        if (voiceDisabledReason) {
            Alert.alert('Voice input unavailable', voiceDisabledReason);
            return;
        }
        onVoice?.();
    };

    return (
        <View style={styles.dock}>
            {/*
              The preview sits above the field rather than inside it. Inside, a thumbnail
              competes with the caret for the same row and pushes the text into a column too
              narrow to read — and this is the one control that has to make it obvious what
              is about to be sent.
            */}
            {image ? (
                <View style={styles.preview}>
                    <Image source={{ uri: image.uri }} style={styles.previewThumb} />
                    <Text style={styles.previewText} numberOfLines={2}>
                        Photo attached. Add a question, or send it on its own.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setImage(null)}
                        hitSlop={10}
                        accessibilityLabel="Remove photo"
                    >
                        <Ionicons name="close-circle" size={20} color={Palette.textMuted} />
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.row}>
                {onVoice ? (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={pressVoice}
                        disabled={busy}
                        accessibilityLabel="Speak your question"
                        accessibilityState={{ disabled: Boolean(voiceDisabledReason) }}
                    >
                        <Ionicons
                            name="mic-outline"
                            size={21}
                            color={voiceDisabledReason ? Palette.textMuted : Palette.primary}
                        />
                    </TouchableOpacity>
                ) : null}

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

                {allowImages ? (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={chooseImage}
                        disabled={busy}
                        accessibilityLabel="Add a photo"
                    >
                        <Ionicons name="image-outline" size={21} color={Palette.primary} />
                    </TouchableOpacity>
                ) : null}

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
        </View>
    );
}

const styles = StyleSheet.create({
    dock: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        backgroundColor: Palette.background,
        gap: Spacing.sm,
    },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },

    preview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: Palette.primarySurface,
    },
    previewThumb: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Palette.border },
    previewText: { flex: 1, fontSize: 12, lineHeight: 16, fontFamily: Fonts.medium, color: Palette.primaryDark },

    // 44pt square, unpadded: the kit draws these as bare glyphs against the pill, and the
    // touch target has to stay at the platform minimum regardless of the icon's size.
    iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },

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
