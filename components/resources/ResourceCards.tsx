/**
 * The card vocabulary the whole resource library is drawn from.
 *
 * Five variants, because the design uses five and they are not interchangeable: a short is a
 * 9:16 tile whose title sits under it, an article is a 16:9 hero with a byline above the
 * title, a workshop is a row with the thumbnail on the right, a course is a row with the
 * thumbnail on the left and a duration badge on it, and the featured rail is a full-bleed
 * image with the label inside it.
 *
 * They live in one file on purpose. Every variant draws the same byline, the same
 * views/likes/comments row and the same category chip, and those three had already been
 * written twice by the time this file existed. A card that rounds "2.5k" differently from the
 * card beside it reads as a bug in the number rather than in the component.
 */
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import {
    formatCount, formatDuration, lengthLabel, formatPrice,
    type ResourceCard as Card,
} from '@/lib/resources';

const PLACEHOLDER = Palette.borderLight;

/** views · likes · comments — the row every card in the kit carries. */
export const StatRow = ({ stats, tint = Palette.textSecondary, compact = false }: {
    stats: Card['stats'];
    tint?: string;
    compact?: boolean;
}) => (
    <View style={styles.statRow}>
        <Ionicons name="eye-outline" size={compact ? 13 : 15} color={tint} />
        <Text style={[styles.statText, { color: tint }]}>{formatCount(stats.views)}</Text>

        <Ionicons name={stats.liked ? 'heart' : 'heart-outline'} size={compact ? 13 : 15}
            color={stats.liked ? Palette.primary : tint} style={styles.statGap} />
        <Text style={[styles.statText, { color: tint }]}>{formatCount(stats.likes)}</Text>

        <Ionicons name="chatbox-outline" size={compact ? 13 : 15} color={tint} style={styles.statGap} />
        <Text style={[styles.statText, { color: tint }]}>{formatCount(stats.comments)}</Text>
    </View>
);

/** Category or tag chip. Drawn over an image with `floating`, on a surface without. */
export const Chip = ({ label, floating = false }: { label: string; floating?: boolean }) => (
    <View style={[styles.chip, floating && styles.chipFloating]}>
        <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    </View>
);

/** The Pro padlock. Small and consistent — a person should learn it once. */
export const ProBadge = () => (
    <View style={styles.proBadge}>
        <Ionicons name="lock-closed" size={10} color={Palette.white} />
        <Text style={styles.proBadgeText}>PRO</Text>
    </View>
);

const Byline = ({ card }: { card: Card }) => {
    if (!card.author) return null;
    return (
        <View style={styles.byline}>
            {card.author.avatar
                ? <Image source={{ uri: card.author.avatar }} style={styles.bylineAvatar} />
                : <View style={[styles.bylineAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{card.author.name.charAt(0)}</Text>
                </View>}
            <Text style={styles.bylineName} numberOfLines={1}>{card.author.name}</Text>
            {!!lengthLabel(card) && (
                <>
                    <Text style={styles.bylineDot}>·</Text>
                    <Text style={styles.bylineMeta}>{lengthLabel(card)}</Text>
                </>
            )}
        </View>
    );
};

const Thumb = ({ uri, style }: { uri: string | null; style: any }) => (
    uri
        ? <Image source={{ uri }} style={style} />
        : <View style={[style, { backgroundColor: PLACEHOLDER }]} />
);

// ── variants ────────────────────────────────────────────────────────────────

/** The Featured Resources rail: full-bleed image, label inside, title over a scrim. */
export const FeaturedCard = ({ card, onPress }: { card: Card; onPress: () => void }) => {
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(280, width * 0.72);

    return (
        <TouchableOpacity style={[styles.featured, { width: cardWidth }]} onPress={onPress} activeOpacity={0.85}>
            <Thumb uri={card.thumbnail} style={[styles.featuredImage, { width: cardWidth }]} />
            <View style={styles.featuredTopRow}>
                {!!card.category && <Chip label={card.category.name} floating />}
                {card.isPro && <ProBadge />}
            </View>
            <View style={styles.featuredBody}>
                <Text style={styles.featuredTitle} numberOfLines={2}>{card.title}</Text>
                <StatRow stats={card.stats} compact />
            </View>
        </TouchableOpacity>
    );
};

/** The Articles rail and the All Articles list: 16:9 hero, byline, title, stats. */
export const ArticleCard = ({ card, onPress, width }: {
    card: Card; onPress: () => void; width?: number;
}) => (
    <TouchableOpacity
        style={[styles.article, width ? { width } : styles.fullWidth]}
        onPress={onPress}
        activeOpacity={0.85}
    >
        <View>
            <Thumb uri={card.thumbnail} style={styles.articleImage} />
            <View style={styles.floatingTopRow}>
                {!!card.category && <Chip label={card.category.name} floating />}
                {card.isPro && <ProBadge />}
            </View>
        </View>
        <View style={styles.articleBody}>
            <Byline card={card} />
            <Text style={styles.articleTitle} numberOfLines={2}>{card.title}</Text>
            <StatRow stats={card.stats} />
        </View>
    </TouchableOpacity>
);

/** The Shorts rail: 9:16 tile with a duration badge, title and author underneath. */
export const ShortCard = ({ card, onPress, width = 132 }: {
    card: Card; onPress: () => void; width?: number;
}) => (
    <TouchableOpacity style={{ width }} onPress={onPress} activeOpacity={0.85}>
        <View>
            <Thumb uri={card.thumbnail} style={[styles.shortImage, { width, height: width * 1.45 }]} />
            <View style={styles.playPip}>
                <Ionicons name="play" size={16} color={Palette.white} />
            </View>
            <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{formatDuration(card.durationSeconds)}</Text>
            </View>
            {card.isPro && <View style={styles.shortProBadge}><ProBadge /></View>}
        </View>
        <Text style={styles.shortTitle} numberOfLines={2}>{card.title}</Text>
        {!!card.author && <Text style={styles.shortAuthor} numberOfLines={1}>{card.author.name}</Text>}
        <StatRow stats={card.stats} compact />
    </TouchableOpacity>
);

/** The Courses list: thumbnail left with its runtime on it, title and subtitle right. */
export const CourseRow = ({ card, onPress }: { card: Card; onPress: () => void }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
        <View>
            <Thumb uri={card.thumbnail} style={styles.rowThumbLeft} />
            <View style={[styles.durationBadge, styles.durationBadgeCorner]}>
                <Text style={styles.durationText}>{formatDuration(card.durationSeconds)}</Text>
            </View>
        </View>
        <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={2}>{card.title}</Text>
            {!!card.subtitle && <Text style={styles.rowSubtitle} numberOfLines={2}>{card.subtitle}</Text>}
            {card.sessionCount > 0 && (
                <Text style={styles.rowMeta}>{card.sessionCount} session{card.sessionCount === 1 ? '' : 's'}</Text>
            )}
            <StatRow stats={card.stats} compact />
        </View>
        {card.isPro && <ProBadge />}
    </TouchableOpacity>
);

/** The Workshops list: byline above the title, thumbnail on the right, price if any. */
export const WorkshopRow = ({ card, onPress }: { card: Card; onPress: () => void }) => (
    <TouchableOpacity style={styles.workshop} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.rowBody}>
            <Byline card={card} />
            <Text style={styles.rowTitle} numberOfLines={2}>{card.title}</Text>
            <StatRow stats={card.stats} compact />
        </View>
        <View>
            <Thumb uri={card.thumbnail} style={styles.rowThumbRight} />
            {card.workshop?.priceCents != null && (
                <Text style={styles.price}>
                    {formatPrice(card.workshop.priceCents, card.workshop.currency)}
                </Text>
            )}
        </View>
    </TouchableOpacity>
);

/**
 * The search-result and mixed-list row.
 *
 * Search returns all five types ranked together, so this one row has to represent any of
 * them. It leans on the type icon rather than on a layout that implies a kind.
 */
export const ResultRow = ({ card, onPress }: { card: Card; onPress: () => void }) => (
    <TouchableOpacity style={styles.workshop} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.rowBody}>
            <Byline card={card} />
            <Text style={styles.rowTitle} numberOfLines={2}>{card.title}</Text>
            <StatRow stats={card.stats} compact />
        </View>
        <View>
            <Thumb uri={card.thumbnail} style={styles.rowThumbRight} />
            {(card.type === 'short' || card.type === 'course' || card.type === 'audio') && (
                <View style={styles.rowPlayPip}>
                    <Ionicons name="play" size={12} color={Palette.white} />
                </View>
            )}
        </View>
    </TouchableOpacity>
);

/**
 * One card, drawn as whatever it is.
 *
 * Screens that render a mixed list — search, "You might also like", an author's back
 * catalogue — use this rather than switching on `type` themselves.
 */
export const AutoCard = ({ card, onPress, variant }: {
    card: Card;
    onPress: () => void;
    variant?: 'rail' | 'row';
}) => {
    if (variant === 'row') return <ResultRow card={card} onPress={onPress} />;
    if (card.type === 'short') return <ShortCard card={card} onPress={onPress} />;
    if (card.type === 'course') return <CourseRow card={card} onPress={onPress} />;
    if (card.type === 'workshop') return <WorkshopRow card={card} onPress={onPress} />;
    return <ArticleCard card={card} onPress={onPress} width={variant === 'rail' ? 260 : undefined} />;
};

const styles = StyleSheet.create({
    fullWidth: { width: '100%' },

    statRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
    statText: { fontSize: 12, fontFamily: Fonts.medium, marginLeft: 4 },
    statGap: { marginLeft: Spacing.md },

    chip: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
        backgroundColor: Palette.primarySurface,
    },
    chipFloating: { backgroundColor: Palette.white, ...Shadow.card },
    chipText: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.text },

    proBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: Radius.sm, backgroundColor: Palette.primary,
    },
    proBadgeText: { fontSize: 9, fontFamily: Fonts.bold, color: Palette.white, letterSpacing: 0.5 },

    byline: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    bylineAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
    avatarFallback: { backgroundColor: Palette.primarySurface, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 10, fontFamily: Fonts.bold, color: Palette.primary },
    bylineName: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary, flexShrink: 1 },
    bylineDot: { fontSize: 12, color: Palette.textMuted, marginHorizontal: 5 },
    bylineMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },

    // Featured
    featured: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Palette.background, ...Shadow.card },
    featuredImage: { height: 170 },
    featuredTopRow: {
        position: 'absolute', top: Spacing.md, left: Spacing.md, right: Spacing.md,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    featuredBody: { padding: Spacing.md },
    featuredTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 20 },

    // Article
    article: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Palette.background, ...Shadow.card },
    articleImage: { width: '100%', height: 180 },
    floatingTopRow: {
        position: 'absolute', top: Spacing.md, left: Spacing.md, right: Spacing.md,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    articleBody: { padding: Spacing.md },
    articleTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 22 },

    // Short
    shortImage: { borderRadius: Radius.lg },
    playPip: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
    },
    shortProBadge: { position: 'absolute', top: Spacing.sm, left: Spacing.sm },
    durationBadge: {
        position: 'absolute', bottom: Spacing.sm, left: Spacing.sm,
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: Radius.sm, backgroundColor: 'rgba(255,255,255,0.92)',
    },
    durationBadgeCorner: { bottom: 6, left: 6 },
    durationText: { fontSize: 10, fontFamily: Fonts.semibold, color: Palette.text },
    shortTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.sm, lineHeight: 17 },
    shortAuthor: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    // Rows
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.md, borderRadius: Radius.xl,
        backgroundColor: Palette.background, ...Shadow.card,
    },
    workshop: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
        padding: Spacing.md, borderRadius: Radius.xl,
        backgroundColor: Palette.background, ...Shadow.card,
    },
    rowBody: { flex: 1 },
    rowThumbLeft: { width: 92, height: 68, borderRadius: Radius.md },
    rowThumbRight: { width: 68, height: 68, borderRadius: Radius.md },
    rowPlayPip: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
    },
    rowTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 20 },
    rowSubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
    rowMeta: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.primary, marginTop: 4 },
    price: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.primary, marginTop: 6, textAlign: 'center' },
});
