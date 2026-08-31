/**
 * Resource Details — Article Details and Workshop Details, from the kit's frames 16 and 17.
 *
 * One screen for both. They share the hero, the floating title card, the byline, the block
 * body, the like/save actions and the "You might also like" rail; a workshop adds its
 * schedule, location, attendees, who-should-attend list, key topics and its checkout footer.
 * Splitting them would duplicate everything above the fold to add one section below it.
 *
 * Three things worth knowing:
 *
 *   - **The view is recorded once per open**, in an effect keyed on the slug. Putting it in
 *     the fetch would count a pull-to-refresh as a read.
 *   - **Like and save are optimistic and reconciled from the response.** The server is the
 *     source of truth for the counter, so a failed request rolls the local state back rather
 *     than leaving a filled heart nobody recorded.
 *   - **Checkout is not wired here.** A paid workshop routes to the existing order flow;
 *     inventing a second payment path beside `/api/payments` is how two of them drift.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, useWindowDimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getResource, recordView, toggleLike, toggleSave, rateResource, joinWorkshop,
    routeFor, formatCount, formatDate, formatPrice, formatSchedule, lengthLabel, MODE_LABEL,
    type RatingValue, type ResourceCard, type ResourceDetail,
} from '@/lib/resources';
import { ArticleBody, GoProBanner, RatingCard } from '@/components/resources/ArticleBody';
import { AutoCard, Chip, ProBadge } from '@/components/resources/ResourceCards';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

export default function ResourceDetailScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const { width } = useWindowDimensions();

    const [resource, setResource] = useState<ResourceDetail | null>(null);
    const [related, setRelated] = useState<ResourceCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!slug) return;
        try {
            const data = await getResource(String(slug));
            setResource(data.resource);
            setRelated(data.related);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load this resource');
        } finally {
            setLoading(false);
        }
    }, [slug, router]);

    useEffect(() => { load(); }, [load]);

    // Once per open, not once per fetch — a refresh is not a second read.
    useEffect(() => {
        if (!slug) return;
        recordView(String(slug)).catch(() => { /* a lost view must never cost the screen */ });
    }, [slug]);

    const onToggleLike = async () => {
        if (!resource) return;
        const next = !resource.stats.liked;
        setResource((r) => r && ({
            ...r,
            stats: { ...r.stats, liked: next, likes: Math.max(0, r.stats.likes + (next ? 1 : -1)) },
        }));
        try {
            const result = await toggleLike(resource.slug, next);
            setResource((r) => r && ({ ...r, stats: { ...r.stats, liked: result.liked, likes: result.likes } }));
        } catch {
            setResource((r) => r && ({
                ...r,
                stats: { ...r.stats, liked: !next, likes: Math.max(0, r.stats.likes + (next ? -1 : 1)) },
            }));
        }
    };

    const onToggleSave = async () => {
        if (!resource) return;
        const next = !resource.stats.saved;
        setResource((r) => r && ({ ...r, stats: { ...r.stats, saved: next } }));
        try {
            await toggleSave(resource.slug, next);
        } catch {
            setResource((r) => r && ({ ...r, stats: { ...r.stats, saved: !next } }));
        }
    };

    const onRate = async (value: RatingValue) => {
        if (!resource) return;
        const previous = resource.stats.myRating ?? null;
        setResource((r) => r && ({ ...r, stats: { ...r.stats, myRating: value } }));
        try {
            const result = await rateResource(resource.slug, value);
            setResource((r) => r && ({
                ...r,
                stats: { ...r.stats, myRating: result.rating, rating: result.average, ratingCount: result.ratingCount },
            }));
        } catch {
            setResource((r) => r && ({ ...r, stats: { ...r.stats, myRating: previous } }));
        }
    };

    const onJoin = async () => {
        if (!resource) return;
        const price = resource.workshop?.priceCents ?? null;

        if (price && price > 0) {
            // Paid seats go through the existing order and payment flow. This screen does
            // not take money — see the file header.
            router.push({ pathname: '/(tabs)/orders', params: { workshop: resource.slug } });
            return;
        }

        try {
            const result = await joinWorkshop(resource.slug);
            setResource((r) => r && ({
                ...r,
                stats: { ...r.stats, saved: true },
                workshop: r.workshop && { ...r.workshop, attendeeCount: result.attendeeCount },
            }));
            Alert.alert('You are on the list', 'This workshop is now saved to your library.');
        } catch (err) {
            Alert.alert('Could not join', err instanceof Error ? err.message : 'Please try again.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error || !resource) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="alert-circle-outline" size={36} color={Palette.textMuted} />
                    <Text style={styles.errorText}>{error ?? 'Resource not found'}</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.errorAction}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const workshop = resource.workshop;
    const isWorkshop = resource.type === 'workshop';
    const heroHeight = Math.min(320, width * 0.78);

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View>
                    {resource.heroImage
                        ? <Image source={{ uri: resource.heroImage }} style={[styles.hero, { height: heroHeight }]} />
                        : <View style={[styles.hero, { height: heroHeight, backgroundColor: Palette.borderLight }]} />}

                    <SafeAreaView edges={['top']} style={styles.heroBar}>
                        <TouchableOpacity style={styles.heroButton} onPress={() => router.back()} hitSlop={10}>
                            <Ionicons name="chevron-back" size={22} color={Palette.text} />
                        </TouchableOpacity>
                        <Text style={styles.heroTitle}>
                            {isWorkshop ? 'Workshop Details' : 'Article Details'}
                        </Text>
                        <TouchableOpacity style={styles.heroButton} onPress={onToggleSave} hitSlop={10}>
                            <Ionicons
                                name={resource.stats.saved ? 'bookmark' : 'bookmark-outline'}
                                size={20}
                                color={resource.stats.saved ? Palette.primary : Palette.text}
                            />
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>

                <View style={styles.body}>
                    {/* The floating title card, lifted over the hero as in the kit. */}
                    <View style={styles.titleCard}>
                        <View style={styles.chipRow}>
                            {!!resource.category && <Chip label={resource.category.name} />}
                            {resource.isPro && <ProBadge />}
                        </View>
                        <Text style={styles.title}>{resource.title}</Text>
                        <Text style={styles.meta}>
                            {formatDate(resource.publishedAt)}
                            {!!lengthLabel(resource) && `  ·  ${lengthLabel(resource)}`}
                        </Text>

                        {!!resource.author && (
                            <TouchableOpacity
                                style={styles.authorRow}
                                onPress={() => router.push({
                                    pathname: '/resources/author/[slug]',
                                    params: { slug: resource.author!.slug },
                                })}
                                activeOpacity={0.8}
                            >
                                {resource.author.avatar
                                    ? <Image source={{ uri: resource.author.avatar }} style={styles.authorAvatar} />
                                    : <View style={[styles.authorAvatar, styles.avatarFallback]}>
                                        <Text style={styles.avatarInitial}>{resource.author.name.charAt(0)}</Text>
                                    </View>}
                                <Text style={styles.authorName}>{resource.author.name}</Text>
                                <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.action} onPress={onToggleLike} activeOpacity={0.8}>
                            <Ionicons
                                name={resource.stats.liked ? 'heart' : 'heart-outline'}
                                size={20}
                                color={resource.stats.liked ? Palette.primary : Palette.textSecondary}
                            />
                            <Text style={styles.actionText}>{formatCount(resource.stats.likes)}</Text>
                        </TouchableOpacity>
                        <View style={styles.action}>
                            <Ionicons name="eye-outline" size={20} color={Palette.textSecondary} />
                            <Text style={styles.actionText}>{formatCount(resource.stats.views)}</Text>
                        </View>
                        <View style={styles.action}>
                            <Ionicons name="chatbox-outline" size={20} color={Palette.textSecondary} />
                            <Text style={styles.actionText}>{formatCount(resource.stats.comments)}</Text>
                        </View>
                        {resource.stats.rating != null && (
                            <View style={styles.action}>
                                <Ionicons name="star" size={18} color={Palette.amber} />
                                <Text style={styles.actionText}>{resource.stats.rating.toFixed(1)}</Text>
                            </View>
                        )}
                    </View>

                    {/* A piece with audio or video gets a play affordance that opens the
                        right player rather than trying to be a player itself. */}
                    {(resource.media.audioUrl || resource.media.videoUrl) && (
                        <TouchableOpacity
                            style={styles.playBanner}
                            activeOpacity={0.9}
                            onPress={() => router.push({
                                pathname: resource.media.audioUrl
                                    ? '/resources/player/audio'
                                    : '/resources/player/video',
                                params: { slug: resource.slug },
                            })}
                        >
                            <Ionicons
                                name={resource.media.audioUrl ? 'headset' : 'play-circle'}
                                size={22}
                                color={Palette.white}
                            />
                            <Text style={styles.playBannerText}>
                                {resource.media.audioUrl ? 'Listen to this' : 'Watch this'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <ArticleBody blocks={resource.body} />

                    {resource.locked && (
                        <GoProBanner
                            hiddenBlocks={resource.hiddenBlocks}
                            onPress={() => router.push('/resources/go-pro')}
                        />
                    )}

                    {isWorkshop && workshop && (
                        <View style={styles.workshopBlock}>
                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={22} color={Palette.text} />
                                    <View style={styles.infoBody}>
                                        <Text style={styles.infoTitle}>{formatDate(workshop.startsAt)}</Text>
                                        <Text style={styles.infoDetail}>
                                            {formatSchedule(workshop.startsAt, workshop.endsAt)}
                                        </Text>
                                    </View>
                                </View>

                                {(workshop.mode || workshop.address) && (
                                    <View style={[styles.infoRow, styles.infoRowDivided]}>
                                        <Ionicons name="location-outline" size={22} color={Palette.text} />
                                        <View style={styles.infoBody}>
                                            <Text style={styles.infoTitle}>
                                                {MODE_LABEL[workshop.mode ?? ''] ?? 'Location'}
                                            </Text>
                                            <Text style={styles.infoDetail}>
                                                {workshop.address ?? workshop.locationName ?? 'Joining details sent on booking'}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.infoRow, styles.infoRowDivided]}>
                                    <Ionicons name="people-outline" size={22} color={Palette.text} />
                                    <View style={styles.infoBody}>
                                        <Text style={styles.infoTitle}>
                                            {formatCount(workshop.attendeeCount)} joined
                                        </Text>
                                        <Text style={styles.infoDetail}>Join today and gain more insight.</Text>
                                    </View>
                                </View>
                            </View>

                            {workshop.whoShouldAttend.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Who should attend?</Text>
                                    <View style={styles.checkList}>
                                        {workshop.whoShouldAttend.map((person) => (
                                            <View key={person} style={styles.checkRow}>
                                                <Ionicons name="checkmark-circle" size={20} color={Palette.success} />
                                                <Text style={styles.checkText}>{person}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {workshop.topics.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Key topics covered</Text>
                                    <View style={styles.topicCard}>
                                        {workshop.topics.map((topic, index) => (
                                            <View
                                                key={topic.title}
                                                style={[styles.topicRow, index > 0 && styles.topicRowDivided]}
                                            >
                                                <View style={styles.topicBody}>
                                                    <Text style={styles.topicTitle}>{topic.title}</Text>
                                                    {!!topic.detail && <Text style={styles.topicDetail}>{topic.detail}</Text>}
                                                </View>
                                                <View style={styles.topicNumber}>
                                                    <Text style={styles.topicNumberText}>{index + 1}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    {!isWorkshop && !resource.locked && (
                        <RatingCard value={resource.stats.myRating ?? null} onRate={onRate} />
                    )}

                    {related.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>You might also like</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.relatedRail}
                            >
                                {related.map((card) => (
                                    <AutoCard
                                        key={card.id}
                                        card={card}
                                        variant="rail"
                                        onPress={() => {
                                            const { pathname, params } = routeFor(card);
                                            router.push({ pathname: pathname as any, params });
                                        }}
                                    />
                                ))}
                            </ScrollView>
                        </>
                    )}
                </View>
            </ScrollView>

            {isWorkshop && workshop && (
                <SafeAreaView edges={['bottom']} style={styles.checkoutBar}>
                    <View>
                        <Text style={styles.checkoutLabel}>1x Workshop Seat</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.price}>
                                {formatPrice(workshop.priceCents, workshop.currency) || 'Free'}
                            </Text>
                            {workshop.compareAtCents != null
                                && workshop.priceCents != null
                                && workshop.compareAtCents > workshop.priceCents && (
                                <Text style={styles.priceWas}>
                                    {formatPrice(workshop.compareAtCents, workshop.currency)}
                                </Text>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity style={styles.checkoutButton} onPress={onJoin} activeOpacity={0.85}>
                        <Text style={styles.checkoutText}>
                            {workshop.priceCents ? 'Checkout' : 'Join'}
                        </Text>
                        <Ionicons
                            name={workshop.priceCents ? 'cart-outline' : 'add-circle-outline'}
                            size={18}
                            color={Palette.white}
                        />
                    </TouchableOpacity>
                </SafeAreaView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    errorText: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary, textAlign: 'center' },
    errorAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    scroll: { paddingBottom: Spacing.xxxl * 2 },
    hero: { width: '100%' },
    heroBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
    },
    heroButton: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center', justifyContent: 'center',
    },
    heroTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    body: { paddingHorizontal: Spacing.xl },
    titleCard: {
        marginTop: -Spacing.xxxl, padding: Spacing.xl,
        borderRadius: Radius.xl, backgroundColor: Palette.background, ...Shadow.card,
    },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    title: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 30 },
    meta: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: Spacing.sm },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    authorAvatar: { width: 26, height: 26, borderRadius: 13 },
    avatarFallback: { backgroundColor: Palette.primarySurface, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 12, fontFamily: Fonts.bold, color: Palette.primary },
    authorName: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },

    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.xxl,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },

    playBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        marginTop: Spacing.lg, paddingVertical: Spacing.lg,
        borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    playBannerText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },

    workshopBlock: { marginTop: Spacing.md },
    infoCard: {
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        backgroundColor: Palette.background, marginTop: Spacing.lg, ...Shadow.card,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.lg },
    infoRowDivided: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    infoBody: { flex: 1 },
    infoTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    infoDetail: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    checkList: { gap: Spacing.md },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    checkText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text },

    topicCard: {
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        backgroundColor: Palette.background, ...Shadow.card,
    },
    topicRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    topicRowDivided: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    topicBody: { flex: 1 },
    topicTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    topicDetail: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 19 },
    topicNumber: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: Palette.primaryLight,
        alignItems: 'center', justifyContent: 'center',
    },
    topicNumberText: { fontSize: 12, fontFamily: Fonts.bold, color: Palette.primary },

    relatedRail: { gap: Spacing.md, paddingVertical: 4 },

    checkoutBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
        backgroundColor: Palette.background,
    },
    checkoutLabel: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    price: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    priceWas: {
        fontSize: 15, fontFamily: Fonts.regular, color: Palette.textMuted,
        textDecorationLine: 'line-through',
    },
    checkoutButton: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg,
        borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    checkoutText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
});
