/**
 * The kit's empty-section card — `Design/activity.svg` frame 6.
 *
 * Copy on the left, one purple action under it, and an illustration that bleeds off the
 * card's right edge. Frame 6 draws three of these ("Let's log your first activity", "Set
 * New Goal", "You have no recommendation") and they replace what used to be a grey icon
 * and a sentence: an empty section is the first thing a new person sees on this screen,
 * and it should look like an invitation rather than like a missing feature.
 *
 * The art is clipped by the card, as the export clips it — the figure is cropped on
 * purpose, and letting it overflow would push it into the next section.
 *
 * The action is optional. An empty state with nothing to do about it (a failed fetch that
 * is retried elsewhere, a past day) keeps the picture and drops the link, rather than
 * offering a button that goes nowhere useful.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';

interface Props {
    /** Optional bold line above the body. Frame 6 has none; the sections' titles do that. */
    title?: string;
    body: string;
    /** The one thing to do about it. `icon` defaults to the kit's plus. */
    action?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
    /** The illustration, already sized. Positioned against the card's right edge. */
    art: React.ReactNode;
    /**
     * Where the art sits against the card's right edge — `top` *or* `bottom`, negative to
     * bleed past it the way the export does. Defaults to sitting on the bottom edge.
     */
    artOffset?: { right?: number; top?: number; bottom?: number };
    /** The share of the card's width the copy may use before the art. Default 58%. */
    copyWidth?: ViewStyle['width'];
    minHeight?: number;
}

export function ArtCard({
    title, body, action, art, artOffset = { bottom: 0 }, copyWidth = '58%', minHeight = 116,
}: Props) {
    return (
        <View style={[styles.card, { minHeight }]}>
            <View
                style={[styles.art, artOffset]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
            >
                {art}
            </View>

            <View style={[styles.copy, { width: copyWidth }]}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                <Text style={styles.body}>{body}</Text>
                {action && (
                    <Pressable
                        onPress={action.onPress}
                        hitSlop={8}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                    >
                        <Text style={styles.actionText}>{action.label}</Text>
                        <Ionicons name={action.icon ?? 'add'} size={17} color={Palette.primaryLight} />
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    art: { position: 'absolute', right: 0 },
    copy: { padding: Spacing.lg, gap: 6 },
    title: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    body: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-start' },
    actionText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    pressed: { opacity: 0.6 },
});
