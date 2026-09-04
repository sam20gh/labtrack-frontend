/**
 * The shop — tests, scans and screens you can order.
 *
 * ## Why it looks like this
 *
 * It used to be a flat column of 48pt thumbnails: every product the same height, the same
 * weight, and the picture too small to be worth loading. A catalogue whose rows are
 * interchangeable is one a person scrolls rather than browses, and it wasted the only
 * asset the catalogue actually has — the photographs.
 *
 * Four things are load-bearing:
 *
 *   1. **The chrome is pinned and the catalogue scrolls under it.** Search and the category
 *      rail are the two controls someone reaches for repeatedly, and a filter that scrolls
 *      away is one you have to scroll back up to change.
 *   2. **The category rail sizes itself.** It carried `maxHeight: 46` against chips whose
 *      own box is ~44pt before the strip's padding, so the labels were clipped at rest and
 *      vanished entirely at any accessibility text size. Nothing here caps a text row's
 *      height — see `styles.railScroll`.
 *   3. **A gallery is advertised on the card.** `galleryOf` is the same function the
 *      product page uses, so a product with three pictures says "3" in the corner of the
 *      grid rather than looking identical to one with a single cover. Discovering the
 *      gallery only after opening the product is how it went unnoticed.
 *   4. **Featured is earned, not curated.** There is no editorial flag on `Product`, so the
 *      rail is drawn from the products that carry more than one photograph — the ones a
 *      big card actually has something to show. It hides itself while searching or
 *      filtering, where a fixed rail would be answering a question nobody asked.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput,
    TouchableOpacity, Image, RefreshControl, useWindowDimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { api, ApiError } from '@/lib/api';
import { useBasket } from '@/lib/basket';
import { galleryOf, metaFor, byTypeOrder, formatPrice, matchesQuery } from '@/lib/catalogue';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Product } from '@/types/api';

/** The gutter the grid and every pinned control share. */
const GUTTER = 20;
/** The gap between the two columns. */
const COLUMN_GAP = 14;

/** A press that adds something to the basket is worth a tap of feedback; a miss is not. */
const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/**
 * The count of photographs, drawn only when there is more than one.
 *
 * A "1" on every card is noise; a "3" on the one card that has three is the only signal
 * from the grid that the product page has more to show.
 */
const PhotoCount = ({ count }: { count: number }) => {
    if (count < 2) return null;
    return (
        <View style={styles.photoCount}>
            <Ionicons name="images" size={11} color={Palette.white} />
            <Text style={styles.photoCountText}>{count}</Text>
        </View>
    );
};

/** The add control. Green tick once the line exists, so the grid shows what is already in. */
const AddButton = ({
    inBasket, onPress, size = 38,
}: { inBasket: boolean; onPress: () => void; size?: number }) => (
    <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={inBasket ? 'In your basket' : 'Add to basket'}
        hitSlop={8}
        style={[
            styles.add,
            { width: size, height: size, borderRadius: size / 2 },
            inBasket && styles.addDone,
        ]}
        onPress={onPress}
    >
        <Ionicons
            name={inBasket ? 'checkmark' : 'add'}
            size={size * 0.55}
            color={inBasket ? Palette.success : Palette.white}
        />
    </TouchableOpacity>
);

/** A grid tile — picture on top, then the name, then price against the add control. */
const ProductTile = ({
    product, width, onOpen, onAdd, inBasket,
}: {
    product: Product; width: number; onOpen: () => void; onAdd: () => void; inBasket: boolean;
}) => {
    const meta = metaFor(product.type);
    const images = galleryOf(product);
    const cover = images[0];

    return (
        <TouchableOpacity style={[styles.tile, { width }]} activeOpacity={0.85} onPress={onOpen}>
            <View style={[styles.tileImageWrap, { height: width * 0.86 }]}>
                {cover ? (
                    <Image source={{ uri: cover }} style={styles.tileImage} />
                ) : (
                    <View style={[styles.tileImage, styles.tileImageEmpty, { backgroundColor: meta.surface }]}>
                        <Ionicons name={`${meta.icon}-outline` as never} size={30} color={meta.tint} />
                    </View>
                )}

                <View style={[styles.typeDot, { backgroundColor: meta.surface }]}>
                    <Ionicons name={meta.icon as never} size={12} color={meta.tint} />
                </View>
                <PhotoCount count={images.length} />
            </View>

            <Text style={styles.tileName} numberOfLines={2}>{product.name}</Text>

            <View style={styles.tileFooter}>
                <Text style={styles.tilePrice}>{formatPrice(product.price)}</Text>
                <AddButton inBasket={inBasket} onPress={onAdd} size={34} />
            </View>
        </TouchableOpacity>
    );
};

/** The featured card — the same product, given the room its gallery deserves. */
const FeatureCard = ({
    product, onOpen, onAdd, inBasket,
}: { product: Product; onOpen: () => void; onAdd: () => void; inBasket: boolean }) => {
    const meta = metaFor(product.type);
    const images = galleryOf(product);

    return (
        <TouchableOpacity style={styles.feature} activeOpacity={0.9} onPress={onOpen}>
            <Image source={{ uri: images[0] }} style={styles.featureImage} />
            <LinearGradient
                colors={['transparent', 'rgba(15,10,35,0.35)', 'rgba(15,10,35,0.92)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.featureTop}>
                <View style={styles.featureType}>
                    <Ionicons name={meta.icon as never} size={11} color={Palette.white} />
                    <Text style={styles.featureTypeText}>{product.type ?? 'Test'}</Text>
                </View>
                <PhotoCount count={images.length} />
            </View>

            <View style={styles.featureBody}>
                <Text style={styles.featureName} numberOfLines={2}>{product.name}</Text>
                <View style={styles.featureFooter}>
                    <Text style={styles.featurePrice}>{formatPrice(product.price)}</Text>
                    <AddButton inBasket={inBasket} onPress={onAdd} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OrdersScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { add, has, count, estimatedTotal } = useBasket();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    const tileWidth = (width - GUTTER * 2 - COLUMN_GAP) / 2;

    const load = useCallback(async () => {
        try {
            const data = await api.get<Product[]>('/products');
            setProducts(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load the catalogue');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Every category present, with its size — the rail states the count so a tap is informed. */
    const categories = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of products) {
            const key = p.type || 'Other';
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => byTypeOrder(a[0], b[0]))
            .map(([type, n]) => ({ type, n }));
    }, [products]);

    const visible = useMemo(
        () => products.filter((p) => (!activeType || p.type === activeType) && matchesQuery(p, query)),
        [products, activeType, query],
    );

    const grouped = useMemo(() => {
        const map: Record<string, Product[]> = {};
        for (const p of visible) (map[p.type || 'Other'] ||= []).push(p);
        for (const key of Object.keys(map)) map[key].sort((a, b) => a.price - b.price);
        return map;
    }, [visible]);

    /** Products whose gallery is worth a big card. Hidden while filtering — see the header. */
    const featured = useMemo(() => {
        if (activeType || query.trim()) return [];
        return products
            .filter((p) => galleryOf(p).length > 1)
            .sort((a, b) => galleryOf(b).length - galleryOf(a).length)
            .slice(0, 6);
    }, [products, activeType, query]);

    const onAdd = useCallback((product: Product) => {
        tap();
        add(product);
    }, [add]);

    const openProduct = useCallback((product: Product) => {
        router.push({ pathname: '/ProductDetails', params: { productId: product._id } });
    }, [router]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const filtering = Boolean(activeType || query.trim());

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {/* Pinned chrome. Nothing below this line scrolls it away. */}
            <LinearGradient
                colors={Palette.heroGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerRow}>
                    <View style={styles.headerText}>
                        <Text style={styles.eyebrow}>LabTrack shop</Text>
                        <Text style={styles.title}>Order a test</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.basketButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Basket, ${count} ${count === 1 ? 'item' : 'items'}`}
                        onPress={() => router.push('/basket')}
                    >
                        <Ionicons name="bag-handle-outline" size={21} color={Palette.white} />
                        {count > 0 && (
                            <View style={styles.basketBadge}>
                                <Text style={styles.basketBadgeText}>{count}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={17} color="rgba(255,255,255,0.75)" />
                    <TextInput
                        style={styles.searchInput}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search tests, scans and screens"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        returnKeyType="search"
                        autoCorrect={false}
                        accessibilityLabel="Search the catalogue"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity hitSlop={10} onPress={() => setQuery('')}>
                            <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.75)" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            {/* The rail sizes itself. Capping its height is what clipped the labels. */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.railScroll}
                contentContainerStyle={styles.rail}
            >
                <TouchableOpacity
                    style={[styles.chip, !activeType && styles.chipActive]}
                    onPress={() => setActiveType(null)}
                >
                    <Ionicons
                        name="apps"
                        size={13}
                        color={activeType ? Palette.textSecondary : Palette.white}
                    />
                    <Text style={[styles.chipText, !activeType && styles.chipTextActive]}>All</Text>
                    <Text style={[styles.chipCount, !activeType && styles.chipCountActive]}>
                        {products.length}
                    </Text>
                </TouchableOpacity>

                {categories.map(({ type, n }) => {
                    const active = activeType === type;
                    const meta = metaFor(type);
                    return (
                        <TouchableOpacity
                            key={type}
                            style={[styles.chip, active && { backgroundColor: meta.tint, borderColor: meta.tint }]}
                            onPress={() => setActiveType(active ? null : type)}
                        >
                            <Ionicons
                                name={meta.icon as never}
                                size={13}
                                color={active ? Palette.white : meta.tint}
                            />
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                            <Text style={[styles.chipCount, active && styles.chipCountActive]}>{n}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <ScrollView
                contentContainerStyle={[styles.scroll, count > 0 && styles.scrollWithBar]}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        tintColor={Palette.primary}
                        onRefresh={() => { setRefreshing(true); load(); }}
                    />
                }
            >
                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={17} color={Palette.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {featured.length > 0 && (
                    <View style={styles.featureBlock}>
                        <View style={styles.sectionHead}>
                            <Text style={styles.sectionTitle}>Worth a closer look</Text>
                            <Text style={styles.sectionNote}>Photographed in detail</Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={264 + Spacing.md}
                            decelerationRate="fast"
                            contentContainerStyle={styles.featureRail}
                        >
                            {featured.map((product) => (
                                <FeatureCard
                                    key={product._id}
                                    product={product}
                                    inBasket={has(product._id)}
                                    onAdd={() => onAdd(product)}
                                    onOpen={() => openProduct(product)}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {visible.length === 0 ? (
                    <View style={styles.empty}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="search-outline" size={26} color={Palette.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>Nothing matches that</Text>
                        <Text style={styles.emptyBody}>
                            {query.trim()
                                ? `No test in the catalogue mentions “${query.trim()}”.`
                                : 'This category is empty at the moment.'}
                        </Text>
                        {filtering && (
                            <TouchableOpacity
                                style={styles.emptyAction}
                                onPress={() => { setQuery(''); setActiveType(null); }}
                            >
                                <Text style={styles.emptyActionText}>Show everything</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    Object.keys(grouped).sort(byTypeOrder).map((type) => {
                        const meta = metaFor(type);
                        return (
                            <View key={type} style={styles.section}>
                                <View style={styles.sectionHead}>
                                    <View style={[styles.sectionIcon, { backgroundColor: meta.surface }]}>
                                        <Ionicons name={meta.icon as never} size={14} color={meta.tint} />
                                    </View>
                                    <Text style={styles.sectionTitle}>{type}</Text>
                                    <Text style={styles.sectionNote}>{grouped[type].length}</Text>
                                </View>

                                <View style={styles.grid}>
                                    {grouped[type].map((product) => (
                                        <ProductTile
                                            key={product._id}
                                            product={product}
                                            width={tileWidth}
                                            inBasket={has(product._id)}
                                            onAdd={() => onAdd(product)}
                                            onOpen={() => openProduct(product)}
                                        />
                                    ))}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {count > 0 && (
                <TouchableOpacity style={styles.basketBar} activeOpacity={0.9} onPress={() => router.push('/basket')}>
                    <View style={styles.basketBarCount}>
                        <Text style={styles.basketBarCountText}>{count}</Text>
                    </View>
                    <Text style={styles.basketBarText}>View basket</Text>
                    {/* Indicative, exactly as `useBasket` names it — the server re-prices at checkout. */}
                    <Text style={styles.basketBarTotal}>{formatPrice(estimatedTotal)}</Text>
                    <Ionicons name="arrow-forward" size={17} color={Palette.white} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header ----------------------------------------------------------------
    header: {
        paddingHorizontal: GUTTER,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headerText: { flex: 1 },
    eyebrow: {
        fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 1.4,
        color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase',
    },
    title: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.white, marginTop: 2 },
    basketButton: {
        width: 44, height: 44, borderRadius: Radius.xl,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    basketBadge: {
        position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 5,
    },
    basketBadgeText: { fontFamily: Fonts.bold, fontSize: 11, color: Palette.primaryDark },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: Radius.xl,
        paddingHorizontal: Spacing.md,
        marginTop: Spacing.lg,
        minHeight: 44,
    },
    searchInput: {
        flex: 1, paddingVertical: Spacing.md,
        fontFamily: Fonts.regular, fontSize: 14, color: Palette.white,
    },

    // Category rail ---------------------------------------------------------
    /**
     * `flexGrow: 0` keeps the strip from eating the scroll area. There is deliberately no
     * `maxHeight`: the chips are a text row, and a text row's height is the font's, which
     * changes with the reader's accessibility setting.
     */
    railScroll: { flexGrow: 0 },
    rail: {
        paddingHorizontal: GUTTER,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        alignItems: 'center',
    },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.borderSlate,
        backgroundColor: Palette.white,
    },
    chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
    chipTextActive: { color: Palette.white },
    chipCount: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textMuted },
    chipCountActive: { color: 'rgba(255,255,255,0.75)' },

    // Scroll body -----------------------------------------------------------
    scroll: { paddingBottom: Spacing.xxxl },
    scrollWithBar: { paddingBottom: 96 },
    errorBox: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
        backgroundColor: Palette.dangerSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    errorText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Palette.danger },

    sectionHead: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    sectionIcon: {
        width: 26, height: 26, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    sectionNote: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textMuted },

    // Featured --------------------------------------------------------------
    featureBlock: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
    featureRail: { paddingHorizontal: GUTTER, gap: Spacing.md },
    feature: {
        width: 264, height: 300, borderRadius: 22, overflow: 'hidden',
        backgroundColor: Palette.primaryDeep,
        ...Shadow.card,
    },
    featureImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    featureTop: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: Spacing.md,
    },
    featureType: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill,
    },
    featureTypeText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.white },
    featureBody: { marginTop: 'auto', padding: Spacing.lg, gap: Spacing.md },
    featureName: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.white, lineHeight: 23 },
    featureFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    featurePrice: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: Palette.white },

    // Grid ------------------------------------------------------------------
    section: { marginBottom: Spacing.xl },
    grid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: GUTTER, gap: COLUMN_GAP,
    },
    tile: {
        backgroundColor: Palette.white,
        borderRadius: 18,
        padding: Spacing.sm,
        ...Shadow.card,
    },
    tileImageWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: Palette.borderLight },
    tileImage: { width: '100%', height: '100%' },
    tileImageEmpty: { alignItems: 'center', justifyContent: 'center' },
    typeDot: {
        position: 'absolute', top: Spacing.sm, left: Spacing.sm,
        width: 24, height: 24, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    photoCount: {
        position: 'absolute', top: Spacing.sm, right: Spacing.sm,
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill,
    },
    photoCountText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.white },
    tileName: {
        fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text,
        lineHeight: 19, marginTop: Spacing.md, minHeight: 38,
        paddingHorizontal: 2,
    },
    tileFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: Spacing.sm, paddingLeft: 2,
    },
    tilePrice: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.primary },

    add: {
        backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    addDone: { backgroundColor: Palette.successSurface },

    // Empty -----------------------------------------------------------------
    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, paddingVertical: 56, gap: Spacing.sm },
    emptyIcon: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
    },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    emptyBody: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 19,
    },
    emptyAction: {
        marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    emptyActionText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    // Basket bar ------------------------------------------------------------
    basketBar: {
        position: 'absolute', left: GUTTER, right: GUTTER, bottom: Spacing.xl,
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.primary,
        paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
        borderRadius: 18,
        shadowColor: Palette.primaryDeep,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
        elevation: 8,
    },
    basketBarCount: {
        minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center', justifyContent: 'center',
    },
    basketBarCountText: { fontFamily: Fonts.bold, fontSize: 12, color: Palette.white },
    basketBarText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    basketBarTotal: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.white },
});
