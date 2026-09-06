/**
 * "Achievement Unlocked!" — the design's frame 4.
 *
 * Confetti behind, the badge on a white card, what was earned, and one button. Three things
 * about it are deliberate:
 *
 * 1. **It fires once, and the server decides when.** An unlock can be worked out while the
 *    app is closed — a watch sync, a dose recorded from a notification — so "have they seen
 *    this" is a flag on the row rather than something the screen can infer. The queue is a
 *    list, because a week away can earn several, and they are shown one at a time in the
 *    order they were earned.
 * 2. **Dismissing is not the only way out.** The card is tappable and opens the badge. A
 *    celebration that can only be acknowledged wastes the one moment somebody is actually
 *    interested in what they just earned.
 * 3. **It never interrupts.** The parent screen mounts it after its own first paint, so a
 *    modal never appears over a spinner, and it is a `Modal` rather than a router push so
 *    back-navigation cannot land on it.
 */
import React from 'react';
import {
    Modal, View, Text, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeMedal } from './BadgeMedal';
import { Confetti } from './Confetti';
import type { Unlock } from '@/lib/achievements';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

interface Props {
    unlock: Unlock | null;
    /** How many are still queued behind this one, so the button can say so. */
    remaining?: number;
    onDismiss: () => void;
    onOpen?: (key: string) => void;
}

export function UnlockModal({ unlock, remaining = 0, onDismiss, onOpen }: Props) {
    const { width } = useWindowDimensions();
    if (!unlock) return null;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                {/* Behind the card and pinned to the top, as the export draws it. */}
                <View style={styles.confetti} pointerEvents="none">
                    <Confetti width={width} height={width} />
                </View>

                <Pressable
                    style={styles.card}
                    onPress={onOpen ? () => onOpen(unlock.key) : undefined}
                    accessibilityRole={onOpen ? 'button' : undefined}
                    accessibilityLabel={`${unlock.name} unlocked. ${unlock.how}`}
                >
                    <BadgeMedal
                        shape={unlock.shape}
                        glyph={unlock.glyph}
                        tone={unlock.tone}
                        size={112}
                        label={unlock.name}
                    />

                    <Text style={styles.title}>Achievement Unlocked!</Text>
                    <Text style={styles.body}>
                        You&apos;ve unlocked &ldquo;{unlock.name}&rdquo;
                        {unlock.level > 1 ? `, level ${unlock.level},` : ''} by {lowerFirst(unlock.how)}.
                    </Text>

                    <Pressable
                        style={styles.cta}
                        onPress={onDismiss}
                        accessibilityRole="button"
                    >
                        <Text style={styles.ctaText}>
                            {remaining > 0 ? `Great — ${remaining} more` : 'Great, thanks!'}
                        </Text>
                    </Pressable>
                </Pressable>

                <Pressable
                    style={styles.close}
                    onPress={onDismiss}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                >
                    <Ionicons name="close" size={22} color={Palette.white} />
                </Pressable>
            </View>
        </Modal>
    );
}

/** "Record 1,000 steps" → "recording 1,000 steps" reads badly; lowercasing the verb is enough. */
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(31, 41, 55, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    confetti: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
    card: {
        width: '100%',
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.md,
        ...Shadow.card,
    },
    title: {
        fontSize: 22,
        fontFamily: Fonts.bold,
        color: Palette.text,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    body: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 21,
    },
    cta: {
        alignSelf: 'stretch',
        backgroundColor: Palette.primary,
        borderRadius: Radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    ctaText: { color: Palette.white, fontSize: 15, fontFamily: Fonts.semibold },
    close: {
        marginTop: Spacing.xxl,
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: Palette.text,
        alignItems: 'center', justifyContent: 'center',
    },
});
