/**
 * One turn in the conversation.
 *
 * The kit draws the person's own messages as a filled purple bubble hugging the right edge
 * and the assistant's as a light card on the left. The asymmetry is doing work: the
 * assistant's side has to hold a card that needs the full column width, so it is not a
 * bubble so much as a block, while the person's messages are short and read better hugged.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import AssistantWidgetCard from './AssistantWidget';
import { messageTime, type AssistantMessage } from '@/lib/assistant';

type Props = {
    message: AssistantMessage;
    /** Tapping a follow-up chip sends it as the next message. */
    onSuggestion?: (text: string) => void;
};

export default function MessageBubble({ message, onSuggestion }: Props) {
    const mine = message.role === 'user';

    if (mine) {
        const attachment = message.attachment;
        return (
            <View style={styles.mineWrap}>
                {/*
                  The photograph sits above the bubble rather than inside it. Inside, it
                  would have to be clipped to the bubble's asymmetric corners and constrained
                  to the bubble's width, and a picture someone sent so it could be looked at
                  is the one thing on this screen that should not be made smaller.

                  `url` is null when the server could not keep a copy. The line below is
                  shown instead — the message reads as incomplete without some acknowledgement
                  that a picture was part of it.
                */}
                {attachment?.kind === 'image' ? (
                    attachment.url ? (
                        <Image
                            source={{ uri: attachment.url }}
                            style={styles.mineImage}
                            accessibilityLabel="The photo you sent"
                        />
                    ) : (
                        <View style={styles.missingImage}>
                            <Ionicons name="image-outline" size={14} color={Palette.textMuted} />
                            <Text style={styles.missingImageText}>Photo sent — no longer stored</Text>
                        </View>
                    )
                ) : null}

                <View style={styles.mineBubble}>
                    <Text style={styles.mineText}>{message.text}</Text>
                </View>

                <View style={styles.mineMeta}>
                    {/*
                      Spoken questions are marked. A transcription can mishear a drug name,
                      and someone rereading an answer that does not match what they meant
                      needs to be able to see that these were not the words they typed.
                    */}
                    {attachment?.kind === 'voice' ? (
                        <Ionicons name="mic" size={11} color={Palette.textMuted} />
                    ) : null}
                    <Text style={styles.mineTime}>{messageTime(message.createdAt)}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.theirsWrap}>
            <View style={styles.theirsHeader}>
                <View style={styles.avatar}>
                    <Ionicons name="sparkles" size={13} color={Palette.white} />
                </View>
                <Text style={styles.theirsName}>LabTrack AI</Text>
                <Text style={styles.theirsTime}>{messageTime(message.createdAt)}</Text>
            </View>

            <View style={styles.theirsBubble}>
                <Text style={styles.theirsText}>{message.text}</Text>
            </View>

            {message.widget ? <AssistantWidgetCard widget={message.widget} /> : null}

            {/*
              The escalation banner sits below the card, not above the text. Placing it first
              would make every cautious reply open with a red block, which trains people to
              scroll past it — the thing it must not do.
            */}
            {message.escalate ? (
                <View style={styles.escalate}>
                    <Ionicons name="alert-circle" size={16} color={Palette.danger} />
                    <Text style={styles.escalateText}>
                        This is worth raising with a clinician rather than leaving to the app.
                    </Text>
                </View>
            ) : null}

            {message.suggestions?.length ? (
                <View style={styles.chips}>
                    {message.suggestions.map((s) => (
                        <TouchableOpacity
                            key={s}
                            style={styles.chip}
                            onPress={() => onSuggestion?.(s)}
                            disabled={!onSuggestion}
                        >
                            <Text style={styles.chipText}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    mineWrap: { alignItems: 'flex-end', marginBottom: Spacing.lg, gap: 4 },
    mineImage: {
        width: '72%',
        aspectRatio: 1.6,
        borderRadius: Radius.xl,
        backgroundColor: Palette.borderLight,
    },
    missingImage: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 6, paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill, backgroundColor: Palette.borderLight,
    },
    missingImageText: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
    mineMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
    mineBubble: {
        maxWidth: '82%',
        backgroundColor: Palette.primary,
        borderRadius: Radius.xl,
        borderBottomRightRadius: Radius.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    mineText: { fontSize: 14, lineHeight: 20, color: Palette.white, fontFamily: Fonts.regular },
    mineTime: { fontSize: 10, color: Palette.textMuted, fontFamily: Fonts.regular },

    theirsWrap: { alignItems: 'stretch', marginBottom: Spacing.lg },
    theirsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    avatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    theirsName: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },
    theirsTime: { fontSize: 10, fontFamily: Fonts.regular, color: Palette.textMuted },
    theirsBubble: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl,
        borderTopLeftRadius: Radius.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    theirsText: { fontSize: 14, lineHeight: 21, color: Palette.text, fontFamily: Fonts.regular },

    escalate: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Palette.dangerSurface,
    },
    escalateText: { flex: 1, fontSize: 12, lineHeight: 17, color: Palette.danger, fontFamily: Fonts.medium },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    chip: {
        borderWidth: 1,
        borderColor: Palette.primaryLight,
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.pill,
        paddingVertical: 7,
        paddingHorizontal: Spacing.md,
    },
    chipText: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.primaryDark },
});
