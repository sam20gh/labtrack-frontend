/**
 * The list screen behind "Our Articles", "Our Workshops", "Our Courses" and "Our Shorts",
 * and behind every category tile.
 *
 * One screen rather than four. The kit draws them as four pages, but they differ only in the
 * heading, the card variant and which facet arrives pinned — and four copies of a paginated,
 * filterable, searchable list is four places for the pagination to be got subtly wrong.
 *
 * Params:
 *   `type`      pin to one resource type, and title the page after it
 *   `category`  pin to one category slug
 *   `title`     override the heading (used by the category tiles)
 *
 * Pagination is "Load More" rather than the kit's numbered pager. A numbered pager on a
 * phone means tapping a 4mm target to move one page and losing your place on the way back;
 * the result count the pager was carrying is kept, because "Showing 40 of 1,000" is the
 * useful half of it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    listResources, getFilterOptions, routeFor, TYPE_PLURAL,
    type FilterOptions, type ResourceCard, type ResourceType,
} from '@/lib/resources';
import { AutoCard } from '@/components/resources/ResourceCards';
import FilterSheet, { EMPTY_FILTERS, countActive, toQuery, type Filters } from '@/components/resources/FilterSheet';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const PAGE_SIZE = 12;

export default function ResourceListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type?: string; category?: string; title?: string }>();

    const pinnedType = (params.type as ResourceType | undefined) || undefined;
    const pinnedCategory = params.category || undefined;

    const [items, setItems] = useState<ResourceCard[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [options, setOptions] = useState<FilterOptions | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const heading = params.title
        ? String(params.title)
        : pinnedType ? `Our ${TYPE_PLURAL[pinnedType]}` : 'All Resources';

    const subtitle = pinnedType
        ? `Explore our ${TYPE_PLURAL[pinnedType].toLowerCase()} here`
        : 'Explore every resource in the library';

    // The pinned facets are applied outside the sheet's control, so the sheet can neither
    // show them as changeable nor drop them when it applies.
    const baseQuery = useMemo(() => ({
        type: pinnedType,
        category: pinnedCategory,
    }), [pinnedType, pinnedCategory]);

    useEffect(() => {
        getFilterOptions().then(setOptions).catch(() => setOptions(null));
    }, []);

    // Debounced so typing does not fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchPage = useCallback(async (nextPage: number, append: boolean) => {
        try {
            const query = {
                ...toQuery(filters, options, baseQuery),
                q: debounced || undefined,
                page: nextPage,
                limit: PAGE_SIZE,
            };
            // A pinned facet always wins over the sheet's copy of it.
            if (pinnedType) query.type = pinnedType;
            if (pinnedCategory) query.category = pinnedCategory;

            const result = await listResources(query);
            setItems((prev) => (append ? [...prev, ...result.items] : result.items));
            setTotal(result.total);
            setHasMore(result.hasMore);
            setPage(result.page);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [filters, options, baseQuery, debounced, pinnedType, pinnedCategory, router]);

    // Any change to the query resets to page one. Appending onto a list built under
    // different filters is how duplicate rows appear.
    useEffect(() => {
        setLoading(true);
        fetchPage(1, false);
    }, [fetchPage]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        fetchPage(page + 1, true);
    };

    const open = (card: ResourceCard) => {
        const { pathname, params: routeParams } = routeFor(card);
        router.push({ pathname: pathname as any, params: routeParams });
    };

    const activeFilters = countActive(filters);
    const tagChips = options?.tags.slice(0, 8) ?? [];

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchPage(1, false); }}
                        tintColor={Palette.primary}
                    />
                }
                ListHeaderComponent={
                    <View>
                        <Text style={styles.title}>{heading}</Text>
                        <Text style={styles.subtitle}>{subtitle}</Text>

                        <View style={styles.searchRow}>
                            <Ionicons name="search" size={18} color={Palette.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                value={search}
                                onChangeText={setSearch}
                                placeholder={pinnedType ? `Search for a ${pinnedType}...` : 'Search for a resource...'}
                                placeholderTextColor={Palette.textMuted}
                                returnKeyType="search"
                            />
                            <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={10}>
                                <Ionicons
                                    name="options-outline"
                                    size={20}
                                    color={activeFilters ? Palette.primary : Palette.textMuted}
                                />
                                {activeFilters > 0 && <View style={styles.filterDot} />}
                            </TouchableOpacity>
                        </View>

                        {!pinnedCategory && tagChips.length > 0 && (
                            <FlatList
                                horizontal
                                data={tagChips}
                                keyExtractor={(t) => t}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.tagRow}
                                renderItem={({ item: tag }) => (
                                    <TouchableOpacity
                                        style={[styles.tagChip, search === tag && styles.tagChipActive]}
                                        onPress={() => setSearch(search === tag ? '' : tag)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.tagText, search === tag && styles.tagTextActive]}>
                                            {tag}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}

                        <View style={styles.countRow}>
                            <Text style={styles.countText}>
                                {loading ? 'Loading…' : `${items.length} of ${total} result${total === 1 ? '' : 's'}`}
                            </Text>
                            <TouchableOpacity style={styles.sortButton} onPress={() => setSheetOpen(true)}>
                                <Ionicons name="calendar-outline" size={15} color={Palette.primary} />
                                <Text style={styles.sortText}>
                                    {options?.sorts.find((s) => s.key === filters.sort)?.label ?? 'Newest first'}
                                </Text>
                                <Ionicons name="chevron-down" size={15} color={Palette.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.cardWrap}>
                        <AutoCard card={item} onPress={() => open(item)} />
                    </View>
                )}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator color={Palette.primary} style={styles.loader} />
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={36} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>Nothing matches those filters</Text>
                            <TouchableOpacity onPress={() => { setFilters(EMPTY_FILTERS); setSearch(''); }}>
                                <Text style={styles.emptyAction}>Clear filters</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
                ListFooterComponent={
                    hasMore ? (
                        <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
                            {loadingMore
                                ? <ActivityIndicator color={Palette.white} />
                                : (
                                    <>
                                        <Text style={styles.loadMoreText}>Load More</Text>
                                        <Ionicons name="add" size={18} color={Palette.white} />
                                    </>
                                )}
                        </TouchableOpacity>
                    ) : items.length > 0 ? (
                        <Text style={styles.endNote}>Showing all {total} results</Text>
                    ) : null
                }
                onEndReachedThreshold={0.6}
                onEndReached={loadMore}
            />

            <FilterSheet
                visible={sheetOpen}
                options={options}
                value={filters}
                baseQuery={baseQuery}
                onClose={() => setSheetOpen(false)}
                onApply={(next) => { setFilters(next); setSheetOpen(false); }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    topBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },

    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 4 },

    searchRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text, padding: 0 },
    filterDot: {
        position: 'absolute', top: -2, right: -2,
        width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.primary,
    },

    tagRow: { gap: Spacing.sm, paddingVertical: Spacing.lg },
    tagChip: {
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    tagChipActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    tagText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tagTextActive: { color: Palette.primary },

    countRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: Spacing.md, marginBottom: Spacing.lg,
    },
    countText: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text },
    sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sortText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    cardWrap: { marginBottom: Spacing.md },
    loader: { marginTop: Spacing.xxxl },

    empty: { alignItems: 'center', paddingTop: Spacing.xxxl * 2, gap: Spacing.md },
    emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    emptyAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    loadMore: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        marginTop: Spacing.lg, paddingVertical: Spacing.lg,
        borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    loadMoreText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    endNote: {
        textAlign: 'center', marginTop: Spacing.xl,
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textMuted,
    },
});
