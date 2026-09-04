/**
 * The product page.
 *
 * Replaces the Paper `Card` this screen used to be: a 250pt cover, a title, two paragraphs
 * and a button, all inside a bordered box floating on grey. It read as a database record
 * rather than as something you buy, and — the reason it was rewritten — **it hid the
 * gallery.** The pictures were a paged `FlatList` under a row of 6pt dots at the bottom of
 * a card, which on a product with three photographs is indistinguishable from a product
 * with one.
 *
 * Five things are load-bearing:
 *
 *   1. **The gallery is the hero, full-bleed and the width of the screen.** Paging is by
 *      `width`, and the slide is exactly `width`, so a half-scrolled pair — which reads as
 *      a rendering fault, not as an affordance — cannot happen.
 *   2. **The thumbnail strip is the discovery mechanism, not the dots.** Dots say "there is
 *      more"; thumbnails say *what* more, and are a target you can hit. They are drawn only
 *      when there is a second picture — a strip of one is a control that does nothing.
 *   3. **Tapping opens a full-screen viewer.** Catalogue photographs are the only evidence
 *      of what arrives in the post, and a 300pt crop is not enough to judge one.
 *   4. **What happens next is read from `ORDER_STAGES`**, the same ladder the order tracker
 *      draws. Writing the steps out here would be a second copy that drifts from the one
 *      the fulfilment status actually moves along.
 *   5. **The buy bar is pinned.** The description can run long; the price and the action
 *      must not scroll off with it.
 *
 * There is deliberately **no turnaround time, sample type or preparation advice**: `Product`
 * carries `name`, `sku`, `description`, `type` and `price`, and nothing else. A "results in
 * 3 days" line would be invented, and this is a page someone reads before a clinical
 * decision.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator,
    Modal, StatusBar, useWindowDimensions, Platform, type NativeSyntheticEvent,
    type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { api, ApiError } from '@/lib/api';
import { useBasket } from '@/lib/basket';
import { ORDER_STAGES, ORDER_STATUS_META } from '@/lib/orders';
import { galleryOf, metaFor, formatPrice } from '@/lib/catalogue';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Product } from '@/types/api';

const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
};

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

/**
 * The full-screen viewer.
 *
 * Its own pager rather than a zoom on the hero, because the hero is cropped to a fixed
 * height and this one is not: `resizeMode="contain"` on black is the only way to see a
 * whole photograph of a collection kit without guessing at what the crop removed.
 */
const Viewer = ({
    images, start, name, onClose,
}: { images: string[]; start: number; name: string; onClose: () => void }) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(start);
    const ref = useRef<ScrollView>(null);
    /** Positioning is a one-off. `onContentSizeChange` also fires on rotation, and jumping
     *  back to the picture the viewer opened on would undo the reader's own paging. */
    const positioned = useRef(false);

    return (
        <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <StatusBar barStyle="light-content" />
            <View style={styles.viewer}>
                <ScrollView
                    ref={ref}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    /* `contentOffset` is an iOS-only ScrollView prop, so opening the third
                       picture would land on the first on Android. Scrolling once the content
                       has been measured works on both. */
                    onContentSizeChange={() => {
                        if (positioned.current) return;
                        positioned.current = true;
                        ref.current?.scrollTo({ x: start * width, animated: false });
                    }}
                    onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                        setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                >
                    {images.map((uri, position) => (
                        <View key={uri} style={{ width, height }}>
                            <Image
                                source={{ uri }}
                                style={styles.viewerImage}
                                resizeMode="contain"
                                accessibilityLabel={`${name} — picture ${position + 1} of ${images.length}`}
                            />
                        </View>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={[styles.viewerClose, { top: insets.top + Spacing.md }]}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={10}
                >
                    <Ionicons name="close" size={22} color={Palette.white} />
                </TouchableOpacity>

                {images.length > 1 && (
                    <Text style={[styles.viewerCounter, { bottom: insets.bottom + Spacing.xxl }]}>
                        {index + 1} of {images.length}
                    </Text>
                )}
            </View>
        </Modal>
    );
};

/**
 * The hero.
 *
 * `scrollTo` on the pager and the thumbnail strip drive each other, so selecting a
 * thumbnail moves the picture and swiping the picture moves the selection — a strip that
 * only reported the state would look like a control and behave like a legend.
 */
const Hero = ({
    images, name, height, index, onIndex, onOpen,
}: {
    images: string[]; name: string; height: number;
    index: number; onIndex: (i: number) => void; onOpen: (i: number) => void;
}) => {
    const { width } = useWindowDimensions();
    const pager = useRef<ScrollView>(null);

    const select = (i: number) => {
        onIndex(i);
        pager.current?.scrollTo({ x: i * width, animated: true });
    };

    return (
        <View style={{ height }}>
            <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                scrollEnabled={images.length > 1}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                    onIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
                {images.map((uri, position) => (
                    <TouchableOpacity
                        key={uri}
                        activeOpacity={0.95}
                        onPress={() => onOpen(position)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`${name} — picture ${position + 1} of ${images.length}. Opens full screen.`}
                    >
                        <Image source={{ uri }} style={{ width, height }} />
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Legibility scrim for the floating controls, not decoration. */}
            <LinearGradient
                colors={['rgba(15,10,35,0.45)', 'transparent']}
                style={styles.heroScrim}
                pointerEvents="none"
            />

            {images.length > 1 && (
                <>
                    <View style={styles.heroCounter}>
                        <Ionicons name="images" size={12} color={Palette.white} />
                        <Text style={styles.heroCounterText}>{index + 1}/{images.length}</Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.stripScroll}
                        contentContainerStyle={styles.strip}
                    >
                        {images.map((uri, position) => (
                            <TouchableOpacity
                                key={uri}
                                onPress={() => select(position)}
                                accessibilityRole="button"
                                accessibilityLabel={`Show picture ${position + 1}`}
                            >
                                <Image
                                    source={{ uri }}
                                    style={[styles.thumb, position === index && styles.thumbActive]}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            )}
        </View>
    );
};

/** Drawn in place of the hero when the catalogue entry has no picture at all. */
const HeroPlaceholder = ({ type, height }: { type?: string; height: number }) => {
    const meta = metaFor(type);
    return (
        <LinearGradient colors={Palette.heroGradient} style={[styles.placeholder, { height }]}>
            <Ionicons name={`${meta.icon}-outline` as never} size={54} color="rgba(255,255,255,0.85)" />
            <Text style={styles.placeholderText}>No photograph yet</Text>
        </LinearGradient>
    );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProductDetails() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const { productId } = useLocalSearchParams<{ productId: string }>();
    const { add, has, count } = useBasket();

    const [product, setProduct] = useState<Product | null>(null);
    const [related, setRelated] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [viewerAt, setViewerAt] = useState<number | null>(null);

    /** Tall enough to be the page's subject, short enough that the name is on screen with it. */
    const heroHeight = Math.round(Math.min(420, Math.max(300, screenHeight * 0.44)));

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setIndex(0);

        (async () => {
            try {
                const one = await api.get<Product>(`/products/${productId}`);
                if (!mounted) return;
                setProduct(one);
                setError(null);

                // The catalogue is small and already cached by the shop; a second read is
                // what lets this page offer alternatives rather than dead-ending.
                const all = await api.get<Product[]>('/products');
                if (!mounted) return;
                setRelated(
                    (Array.isArray(all) ? all : [])
                        .filter((p) => p._id !== one._id && p.type === one.type)
                        .sort((a, b) => Math.abs(a.price - one.price) - Math.abs(b.price - one.price))
                        .slice(0, 8),
                );
            } catch (err) {
                if (!mounted) return;
                if (err instanceof ApiError && err.isAuthError) {
                    router.replace('/(auth)/loginscreen');
                    return;
                }
                setError(err instanceof ApiError ? err.message : 'Could not load this product');
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => { mounted = false; };
    }, [productId, router]);

    const images = useMemo(() => galleryOf(product), [product]);
    const meta = metaFor(product?.type);
    const inBasket = product ? has(product._id) : false;

    const onBuy = useCallback(() => {
        if (!product) return;
        if (inBasket) { router.push('/basket'); return; }
        tap();
        add(product);
    }, [product, inBasket, add, router]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error || !product) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={34} color={Palette.danger} />
                    <Text style={styles.errorTitle}>{error ?? 'Product not found'}</Text>
                    <TouchableOpacity style={styles.errorAction} onPress={() => router.back()}>
                        <Text style={styles.errorActionText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 128 + insets.bottom }}
                showsVerticalScrollIndicator={false}
            >
                {images.length ? (
                    <Hero
                        images={images}
                        name={product.name}
                        height={heroHeight}
                        index={index}
                        onIndex={setIndex}
                        onOpen={setViewerAt}
                    />
                ) : (
                    <HeroPlaceholder type={product.type} height={heroHeight} />
                )}

                {/* The sheet overlaps the picture, so the page reads as one surface rising
                    over the photograph rather than as two stacked blocks. */}
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    <View style={styles.tagRow}>
                        <View style={[styles.tag, { backgroundColor: meta.surface }]}>
                            <Ionicons name={meta.icon as never} size={12} color={meta.tint} />
                            <Text style={[styles.tagText, { color: meta.tint }]}>
                                {product.type ?? 'Test'}
                            </Text>
                        </View>
                        {/* The SKU is what a support conversation is keyed on, so it is worth showing. */}
                        {product.sku ? <Text style={styles.sku}>Ref {product.sku}</Text> : null}
                    </View>

                    <Text style={styles.name}>{product.name}</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.price}>{formatPrice(product.price)}</Text>
                        <Text style={styles.priceNote}>one-off, includes analysis</Text>
                    </View>

                    {product.description ? (
                        <Text style={styles.description}>{product.description}</Text>
                    ) : null}

                    <View style={styles.divider} />

                    <Text style={styles.blockTitle}>What happens after you order</Text>
                    <View style={styles.steps}>
                        {ORDER_STAGES.map((stage, position) => {
                            const stageMeta = ORDER_STATUS_META[stage];
                            return (
                                <View key={stage} style={styles.step}>
                                    <View style={styles.stepRail}>
                                        <View style={styles.stepDot}>
                                            <Text style={styles.stepDotText}>{position + 1}</Text>
                                        </View>
                                        {position < ORDER_STAGES.length - 1 && <View style={styles.stepLine} />}
                                    </View>
                                    <View style={styles.stepBody}>
                                        <Text style={styles.stepLabel}>{stageMeta.label}</Text>
                                        <Text style={styles.stepDescription}>{stageMeta.description}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.note}>
                        <Ionicons name="shield-checkmark-outline" size={17} color={Palette.primary} />
                        <Text style={styles.noteText}>
                            Results land in your record and are read alongside everything else LabTrack
                            knows about you, so the analysis is about you rather than about the number.
                        </Text>
                    </View>
                </View>

                {related.length > 0 && (
                    <View style={styles.relatedBlock}>
                        <Text style={styles.blockTitle}>Others in {product.type ?? 'the catalogue'}</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.relatedRail}
                        >
                            {related.map((other) => {
                                const cover = galleryOf(other)[0];
                                const otherMeta = metaFor(other.type);
                                return (
                                    <TouchableOpacity
                                        key={other._id}
                                        style={styles.relatedCard}
                                        activeOpacity={0.85}
                                        onPress={() => router.push({
                                            pathname: '/ProductDetails',
                                            params: { productId: other._id },
                                        })}
                                    >
                                        {cover ? (
                                            <Image source={{ uri: cover }} style={styles.relatedImage} />
                                        ) : (
                                            <View style={[styles.relatedImage, styles.relatedEmpty, { backgroundColor: otherMeta.surface }]}>
                                                <Ionicons name={`${otherMeta.icon}-outline` as never} size={22} color={otherMeta.tint} />
                                            </View>
                                        )}
                                        <Text style={styles.relatedName} numberOfLines={2}>{other.name}</Text>
                                        <Text style={styles.relatedPrice}>{formatPrice(other.price)}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </ScrollView>

            {/* Floating chrome. Drawn over the hero rather than in a navigation bar, so the
                photograph starts at the top of the screen. */}
            <View style={[styles.floating, { top: insets.top + Spacing.sm }]}>
                <TouchableOpacity
                    style={styles.floatingButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="chevron-back" size={22} color={Palette.white} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.floatingButton}
                    onPress={() => router.push('/basket')}
                    accessibilityRole="button"
                    accessibilityLabel={`Basket, ${count} ${count === 1 ? 'item' : 'items'}`}
                >
                    <Ionicons name="bag-handle-outline" size={20} color={Palette.white} />
                    {count > 0 && (
                        <View style={styles.floatingBadge}>
                            <Text style={styles.floatingBadgeText}>{count}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <View style={[styles.buyBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
                <View>
                    <Text style={styles.buyBarLabel}>Total</Text>
                    <Text style={styles.buyBarPrice}>{formatPrice(product.price)}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.buyButton, inBasket && styles.buyButtonDone]}
                    activeOpacity={0.9}
                    onPress={onBuy}
                >
                    <Ionicons
                        name={inBasket ? 'bag-check' : 'bag-add'}
                        size={18}
                        color={inBasket ? Palette.primary : Palette.white}
                    />
                    <Text style={[styles.buyButtonText, inBasket && styles.buyButtonTextDone]}>
                        {inBasket ? 'In basket — view' : 'Add to basket'}
                    </Text>
                </TouchableOpacity>
            </View>

            {viewerAt !== null && (
                <Viewer
                    images={images}
                    start={viewerAt}
                    name={product.name}
                    onClose={() => setViewerAt(null)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },
    errorTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text, textAlign: 'center' },
    errorAction: {
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    errorActionText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },

    // Hero ------------------------------------------------------------------
    heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
    /**
     * Sits directly above the thumbnail strip — `stripScroll` is pinned at 42 and the
     * thumbnails are 54 tall, so 104 clears them with a gap rather than by luck.
     */
    heroCounter: {
        position: 'absolute', right: Spacing.lg, bottom: 104,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill,
    },
    heroCounterText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.white },
    stripScroll: { position: 'absolute', left: 0, right: 0, bottom: 42 },
    strip: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    thumb: {
        width: 54, height: 54, borderRadius: Radius.md,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
        backgroundColor: Palette.borderLight,
    },
    thumbActive: { borderColor: Palette.white, borderWidth: 3 },
    placeholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    placeholderText: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },

    // Sheet -----------------------------------------------------------------
    sheet: {
        backgroundColor: Palette.background,
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        marginTop: -26,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    grabber: {
        alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
        backgroundColor: Palette.borderStrong, marginBottom: Spacing.lg,
    },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill,
    },
    tagText: { fontFamily: Fonts.semibold, fontSize: 12 },
    sku: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    name: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text, lineHeight: 33, marginTop: Spacing.md },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.sm },
    price: { fontFamily: Fonts.bold, fontSize: 28, color: Palette.primary },
    priceNote: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    description: {
        fontFamily: Fonts.regular, fontSize: 15, color: Palette.textSecondary,
        lineHeight: 24, marginTop: Spacing.lg,
    },
    divider: { height: 1, backgroundColor: Palette.borderLight, marginVertical: Spacing.xl },

    blockTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    steps: { marginTop: Spacing.lg },
    step: { flexDirection: 'row', gap: Spacing.md },
    stepRail: { alignItems: 'center', width: 26 },
    stepDot: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    stepDotText: { fontFamily: Fonts.bold, fontSize: 12, color: Palette.primary },
    stepLine: { flex: 1, width: 2, backgroundColor: Palette.borderLight, marginVertical: 2 },
    stepBody: { flex: 1, paddingBottom: Spacing.lg },
    stepLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    stepDescription: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        lineHeight: 19, marginTop: 2,
    },
    note: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        backgroundColor: Palette.primarySurface, borderRadius: Radius.xl,
        padding: Spacing.lg, marginTop: Spacing.sm,
    },
    noteText: {
        flex: 1, fontFamily: Fonts.regular, fontSize: 13,
        color: Palette.primaryDeep, lineHeight: 19,
    },

    // Related ---------------------------------------------------------------
    relatedBlock: { paddingTop: Spacing.xxl, paddingLeft: Spacing.xl },
    relatedRail: { paddingRight: Spacing.xl, gap: Spacing.md, paddingTop: Spacing.lg },
    relatedCard: { width: 148 },
    relatedImage: { width: 148, height: 108, borderRadius: Radius.xl, backgroundColor: Palette.borderLight },
    relatedEmpty: { alignItems: 'center', justifyContent: 'center' },
    relatedName: {
        fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text,
        lineHeight: 18, marginTop: Spacing.sm,
    },
    relatedPrice: { fontFamily: Fonts.bold, fontSize: 14, color: Palette.primary, marginTop: 2 },

    // Floating chrome -------------------------------------------------------
    floating: {
        position: 'absolute', left: Spacing.lg, right: Spacing.lg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    floatingButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(15,10,35,0.45)',
        alignItems: 'center', justifyContent: 'center',
    },
    floatingBadge: {
        position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
        paddingHorizontal: 4, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    floatingBadgeText: { fontFamily: Fonts.bold, fontSize: 10, color: Palette.primaryDark },

    // Buy bar ---------------------------------------------------------------
    buyBar: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
        backgroundColor: Palette.background,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
        ...Shadow.card,
    },
    buyBarLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
    buyBarPrice: { fontFamily: Fonts.bold, fontSize: 20, color: Palette.text },
    buyButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, backgroundColor: Palette.primary,
        paddingVertical: Spacing.lg, borderRadius: 16,
    },
    buyButtonDone: { backgroundColor: Palette.primarySurface },
    buyButtonText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    buyButtonTextDone: { color: Palette.primary },

    // Viewer ----------------------------------------------------------------
    viewer: { flex: 1, backgroundColor: '#000' },
    viewerImage: { width: '100%', height: '100%' },
    viewerClose: {
        position: 'absolute', right: Spacing.lg,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    viewerCounter: {
        position: 'absolute', alignSelf: 'center',
        fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)',
    },
});
