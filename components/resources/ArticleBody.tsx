/**
 * The block renderer, the Go Pro banner and the rating control.
 *
 * The body arrives as typed blocks rather than HTML or Markdown, so this file is the whole
 * of the article's visual vocabulary — a heading, a paragraph, a bulleted list, a green-ticked
 * checklist, an image with a caption, a pull quote, a callout. Adding a block type means
 * adding a case here and to `BLOCK_TYPES` in the backend model, and nothing else changes.
 *
 * `react-native-markdown-display` is already a dependency and was the obvious alternative.
 * It was not used because the checklist in the design is not a Markdown construct, and half
 * a body rendered by a Markdown engine and half by hand is worse than either.
 */
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import type { Block, RatingValue } from '@/lib/resources';

export const ArticleBody = ({ blocks }: { blocks: Block[] }) => (
    <View>
        {blocks.map((block, index) => {
            const key = `${block.type}-${index}`;

            switch (block.type) {
                case 'heading':
                    return <Text key={key} style={styles.heading}>{block.text}</Text>;

                case 'paragraph':
                    return <Text key={key} style={styles.paragraph}>{block.text}</Text>;

                case 'quote':
                    return (
                        <View key={key} style={styles.quote}>
                            <Text style={styles.quoteText}>{block.text}</Text>
                        </View>
                    );

                case 'callout':
                    return (
                        <View key={key} style={styles.callout}>
                            <Ionicons name="information-circle-outline" size={18} color={Palette.info} />
                            <Text style={styles.calloutText}>{block.text}</Text>
                        </View>
                    );

                case 'list':
                    return (
                        <View key={key} style={styles.list}>
                            {block.items.map((item, i) => (
                                <View key={i} style={styles.listRow}>
                                    <View style={styles.bullet} />
                                    <Text style={styles.listText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    );

                case 'checklist':
                    return (
                        <View key={key} style={styles.list}>
                            {block.items.map((item, i) => (
                                <View key={i} style={styles.listRow}>
                                    <Ionicons name="checkmark-circle" size={20} color={Palette.success} />
                                    <Text style={styles.listText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    );

                case 'image':
                    return (
                        <View key={key} style={styles.imageBlock}>
                            <Image source={{ uri: block.url }} style={styles.image} />
                            {!!block.caption && <Text style={styles.caption}>{block.caption}</Text>}
                        </View>
                    );

                default:
                    // An unknown block type from a newer backend renders as nothing rather
                    // than crashing the screen. An article missing a paragraph is
                    // recoverable; a white screen is not.
                    return null;
            }
        })}
    </View>
);

/**
 * The paywall banner.
 *
 * It names how much is behind it. "Go Pro to unlock" with no idea whether that is two
 * paragraphs or twenty is a worse offer than the truth.
 */
export const GoProBanner = ({ hiddenBlocks, onPress }: { hiddenBlocks: number; onPress: () => void }) => (
    <TouchableOpacity style={styles.pro} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.proBody}>
            <Text style={styles.proTitle}>Go Pro to unlock the full article</Text>
            <Text style={styles.proMeta}>
                {hiddenBlocks} more section{hiddenBlocks === 1 ? '' : 's'} to read
            </Text>
            <View style={styles.proLink}>
                <Text style={styles.proLinkText}>Go Pro</Text>
                <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
            </View>
        </View>
        <Ionicons name="lock-closed" size={40} color={Palette.primaryLight} />
    </TouchableOpacity>
);

const RATINGS: { value: RatingValue; label: string; icon: string; tint: string; surface: string }[] = [
    { value: 'bad', label: 'Bad', icon: 'sad-outline', tint: Palette.danger, surface: Palette.dangerSurface },
    { value: 'neutral', label: 'Neutral', icon: 'remove-circle-outline', tint: Palette.textSecondary, surface: Palette.surface },
    { value: 'great', label: 'Great', icon: 'happy-outline', tint: Palette.primary, surface: Palette.primarySurface },
];

/**
 * "How would you rate this article?"
 *
 * Three options, not five stars — see the note on `ResourceEngagement`. The current vote is
 * shown filled so a person can tell they have already answered and can change it, rather
 * than being asked the same question every time they reopen the piece.
 */
export const RatingCard = ({ value, onRate }: {
    value: RatingValue | null;
    onRate: (rating: RatingValue) => void;
}) => (
    <View style={styles.ratingCard}>
        <Text style={styles.ratingTitle}>
            {value ? 'Thanks — you can change this any time' : 'How would you rate this article?'}
        </Text>
        <View style={styles.ratingRow}>
            {RATINGS.map((option) => {
                const selected = value === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={styles.ratingOption}
                        onPress={() => onRate(option.value)}
                        activeOpacity={0.8}
                    >
                        <View style={[
                            styles.ratingCircle,
                            { borderColor: selected ? option.tint : Palette.border },
                            selected && { backgroundColor: option.surface },
                        ]}>
                            <Ionicons
                                name={option.icon as any}
                                size={24}
                                color={selected ? option.tint : Palette.textMuted}
                            />
                        </View>
                        <Text style={[styles.ratingLabel, selected && { color: option.tint }]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
);

const styles = StyleSheet.create({
    heading: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    paragraph: { fontSize: 15, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 24, marginBottom: Spacing.md },

    quote: {
        borderLeftWidth: 3, borderLeftColor: Palette.primary,
        paddingLeft: Spacing.lg, marginVertical: Spacing.lg,
    },
    quoteText: { fontSize: 16, fontFamily: Fonts.medium, color: Palette.text, lineHeight: 24, fontStyle: 'italic' },

    callout: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        padding: Spacing.lg, marginVertical: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.infoSurface,
    },
    calloutText: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 21 },

    list: { gap: Spacing.md, marginVertical: Spacing.sm },
    listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.primary, marginTop: 8 },
    listText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 22 },

    imageBlock: { marginVertical: Spacing.lg },
    image: { width: '100%', height: 200, borderRadius: Radius.lg, backgroundColor: Palette.borderLight },
    caption: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted, marginTop: Spacing.sm, textAlign: 'center' },

    pro: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
        padding: Spacing.lg, marginTop: Spacing.xl,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.primaryLight,
        backgroundColor: Palette.primarySurface,
    },
    proBody: { flex: 1 },
    proTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 21 },
    proMeta: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
    proLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md },
    proLinkText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    ratingCard: {
        padding: Spacing.xl, marginTop: Spacing.xxl,
        borderRadius: Radius.xl, backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.borderLight,
    },
    ratingTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xxxl, marginTop: Spacing.lg },
    ratingOption: { alignItems: 'center', gap: Spacing.sm },
    ratingCircle: {
        width: 52, height: 52, borderRadius: 26, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    ratingLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
});
