/**
 * The vertical shorts feed — the kit's frames 14 and 15.
 *
 * A paged `FlatList`, one full-screen short per page, with the reaction rail on the right and
 * the title, author and description over the bottom of the video.
 *
 * ## Only the visible short plays
 *
 * `onViewableItemsChanged` is what makes this true. Every mounted `Video` playing at once is
 * a phone that gets hot and a bill for bandwidth nobody watched; it is also four
 * soundtracks. The item that becomes visible plays, and every other one pauses.
 *
 * ## "Swipe to go next" is shown once
 *
 * The hint in frame 15 is drawn only on the first short of a session, and it disappears on
 * the first swipe. A permanent instruction on a gesture people already know is clutter.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
    useWindowDimensions, Image, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

import { ApiError } from '@/lib/api';
import {
    listResources, getResource, toggleLike, recordView, formatCount,
    type ResourceCard, type ResourceDetail,
} from '@/lib/resources';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

type Short = ResourceCard & { videoUrl?: string | null };

export default function ShortsScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug?: string }>();
    const { height, width } = useWindowDimensions();

    const [shorts, setShorts] = useState<Short[]>([]);
    const [videoUrls, setVideoUrls] = useState<Record<string, string | null>>({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showHint, setShowHint] = useState(true);
    const [paused, setPaused] = useState(false);

    const listRef = useRef<FlatList<Short>>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const page = await listResources({ type: 'short', limit: 20 });
                if (cancelled) return;

                let items = page.items as Short[];

                // Opened from a card: that short leads, and the rest of the feed follows it.
                if (slug) {
                    const index = items.findIndex((s) => s.slug === slug);
                    if (index > 0) items = [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
                    else if (index < 0) {
                        // Not in the first page — fetch it directly rather than dropping the
                        // thing the person actually tapped.
                        const { resource } = await getResource(String(slug));
                        items = [resource as unknown as Short, ...items];
                    }
                }

                setShorts(items);
            } catch (err) {
                if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [slug, router]);

    /**
     * Video URLs are not on the card view — a list endpoint that shipped every media URL
     * would be handing out Pro content. They are fetched per short, as it comes into view.
     */
    const ensureVideo = useCallback(async (short: Short) => {
        if (videoUrls[short.id] !== undefined) return;
        setVideoUrls((prev) => ({ ...prev, [short.id]: null }));
        try {
            const { resource } = await getResource(short.slug);
            setVideoUrls((prev) => ({ ...prev, [short.id]: (resource as ResourceDetail).media.videoUrl }));
        } catch {
            setVideoUrls((prev) => ({ ...prev, [short.id]: null }));
        }
    }, [videoUrls]);

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        const first = viewableItems[0];
        if (!first) return;
        setActiveIndex(first.index ?? 0);
        setPaused(false);
        if ((first.index ?? 0) > 0) setShowHint(false);
        recordView(first.item.slug).catch(() => { });
    }).current;

    useEffect(() => {
        const short = shorts[activeIndex];
        if (short) ensureVideo(short);
        // Warm the next one so a swipe does not land on a black frame.
        const next = shorts[activeIndex + 1];
        if (next) ensureVideo(next);
    }, [activeIndex, shorts, ensureVideo]);

    const onLike = async (short: Short) => {
        const next = !short.stats.liked;
        setShorts((prev) => prev.map((s) => (s.id === short.id
            ? { ...s, stats: { ...s.stats, liked: next, likes: Math.max(0, s.stats.likes + (next ? 1 : -1)) } }
            : s)));
        try {
            await toggleLike(short.slug, next);
        } catch {
            setShorts((prev) => prev.map((s) => (s.id === short.id
                ? { ...s, stats: { ...s.stats, liked: !next, likes: Math.max(0, s.stats.likes + (next ? -1 : 1)) } }
                : s)));
        }
    };

    if (loading) {
        return (
            <View style={styles.screen}>
                <View style={styles.centre}><ActivityIndicator color={Palette.white} /></View>
            </View>
        );
    }

    if (!shorts.length) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="videocam-off-outline" size={40} color={Palette.textMuted} />
                    <Text style={styles.emptyText}>No shorts have been published yet.</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.emptyAction}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.screen}>
            <FlatList
                ref={listRef}
                data={shorts}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                decelerationRate="fast"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
                getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
                renderItem={({ item, index }) => {
                    const active = index === activeIndex;
                    const uri = videoUrls[item.id];

                    return (
                        <Pressable style={{ height, width }} onPress={() => active && setPaused((p) => !p)}>
                            {uri ? (
                                <Video
                                    style={StyleSheet.absoluteFill}
                                    source={{ uri }}
                                    resizeMode={ResizeMode.COVER}
                                    isLooping
                                    // Only the visible short plays. See the file header.
                                    shouldPlay={active && !paused}
                                    isMuted={!active}
                                    useNativeControls={false}
                                />
                            ) : item.thumbnail ? (
                                <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} />
                            ) : (
                                <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
                            )}

                            <View style={styles.scrim} />

                            <SafeAreaView edges={['top']} style={styles.topBar}>
                                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                                    <Ionicons name="chevron-back" size={26} color={Palette.white} />
                                </TouchableOpacity>
                            </SafeAreaView>

                            {active && paused && (
                                <View style={styles.pausedOverlay}>
                                    <Ionicons name="play" size={56} color="rgba(255,255,255,0.9)" />
                                </View>
                            )}

                            {active && showHint && index === 0 && (
                                <View style={styles.hint}>
                                    <Ionicons name="hand-left-outline" size={30} color={Palette.white} />
                                    <Text style={styles.hintText}>Swipe to go next</Text>
                                </View>
                            )}

                            <View style={styles.rail}>
                                <TouchableOpacity style={styles.railItem} onPress={() => onLike(item)} hitSlop={10}>
                                    <Ionicons
                                        name={item.stats.liked ? 'heart' : 'heart-outline'}
                                        size={30}
                                        color={item.stats.liked ? Palette.primaryLight : Palette.white}
                                    />
                                    <Text style={styles.railCount}>{formatCount(item.stats.likes)}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.railItem}
                                    onPress={() => router.push({
                                        pathname: '/resources/[slug]', params: { slug: item.slug },
                                    })}
                                    hitSlop={10}
                                >
                                    <Ionicons name="information-circle-outline" size={30} color={Palette.white} />
                                    <Text style={styles.railCount}>Info</Text>
                                </TouchableOpacity>

                                <View style={styles.railItem}>
                                    <Ionicons name="chatbox-outline" size={28} color={Palette.white} />
                                    <Text style={styles.railCount}>{formatCount(item.stats.comments)}</Text>
                                </View>
                            </View>

                            <SafeAreaView edges={['bottom']} style={styles.caption}>
                                {!!item.tags[0] && (
                                    <View style={styles.tagChip}>
                                        <Ionicons name="bulb-outline" size={13} color={Palette.white} />
                                        <Text style={styles.tagText}>{item.tags[0]}</Text>
                                    </View>
                                )}
                                <Text style={styles.captionTitle} numberOfLines={2}>{item.title}</Text>
                                {!!item.author && (
                                    <TouchableOpacity
                                        style={styles.captionAuthor}
                                        onPress={() => router.push({
                                            pathname: '/resources/author/[slug]',
                                            params: { slug: item.author!.slug },
                                        })}
                                    >
                                        {item.author.avatar
                                            ? <Image source={{ uri: item.author.avatar }} style={styles.captionAvatar} />
                                            : <View style={[styles.captionAvatar, styles.placeholder]} />}
                                        <Text style={styles.captionAuthorName}>{item.author.name}</Text>
                                    </TouchableOpacity>
                                )}
                                {!!item.excerpt && (
                                    <Text style={styles.captionBody} numberOfLines={2}>{item.excerpt}</Text>
                                )}
                            </SafeAreaView>
                        </Pressable>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000' },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyText: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.white, textAlign: 'center' },
    emptyAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primaryLight },
    placeholder: { backgroundColor: '#111827' },

    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },

    pausedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

    hint: {
        position: 'absolute', top: '45%', left: 0, right: 0,
        alignItems: 'center', gap: Spacing.sm,
    },
    hintText: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.white },

    rail: { position: 'absolute', right: Spacing.lg, bottom: 200, gap: Spacing.xxl, alignItems: 'center' },
    railItem: { alignItems: 'center', gap: 4 },
    railCount: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.white },

    caption: { position: 'absolute', left: 0, right: 80, bottom: 0, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.sm },
    tagChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
        borderRadius: Radius.sm, backgroundColor: 'rgba(0,0,0,0.55)',
    },
    tagText: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.white },
    captionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.white, lineHeight: 23 },
    captionAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    captionAvatar: { width: 22, height: 22, borderRadius: 11 },
    captionAuthorName: { fontSize: 13, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.9)' },
    captionBody: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
});
