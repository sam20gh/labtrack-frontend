/**
 * Search — the kit's screen with the All / Articles / Workshop / Courses / Shorts tabs.
 *
 * The tabs are a facet on the same query, not five searches. `listResources` already ranks
 * every type together, so "All" is the unfiltered call and each tab pins `type`. That is why
 * the result count changes as you move between tabs rather than the list being rebuilt from
 * a different endpoint.
 *
 * An empty query is a valid state and shows the newest of whatever tab you are on, so the
 * screen is browsable before anything is typed. A search screen that renders blank until you
 * type is a dead end for someone who opened it to see what is there.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    listResources, getFilterOptions, routeFor, TYPE_ICON,
    type FilterOptions, type ResourceCard,
} from '@/lib/resources';
import { AutoCard } from '@/components/resources/ResourceCards';
import FilterSheet, { EMPTY_FILTERS, countActive, toQuery, type Filters } from '@/components/resources/FilterSheet';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const TABS = [
    { key: 'all', label: 'All', icon: 'shapes-outline' },
    { key: 'article', label: 'Articles', icon: TYPE_ICON.article },
    { key: 'workshop', label: 'Workshop', icon: TYPE_ICON.workshop },
    { key: 'course', label: 'Courses', icon: TYPE_ICON.course },
    { key: 'short', label: 'Shorts', icon: TYPE_ICON.short },
    { key: 'audio', label: 'Audio', icon: TYPE_ICON.audio },
];

export default function ResourceSearchScreen() {
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [tab, setTab] = useState('all');
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [options, setOptions] = useState<FilterOptions | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const [items, setItems] = useState<ResourceCard[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        getFilterOptions().then(setOptions).catch(() => setOptions(null));
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    // The tab is the type facet, so it must beat whatever the sheet has for `type`.
    const baseQuery = useMemo(() => ({ type: tab === 'all' ? undefined : (tab as any) }), [tab]);

    const fetchPage = useCallback(async (nextPage: number, append: boolean) => {
        try {
            const result = await listResources({
                ...toQuery(filters, options, baseQuery),
                type: tab === 'all' ? undefined : (tab as any),
                q: debounced || undefined,
                sort: debounced ? undefined : (filters.sort as any),
                page: nextPage,
                limit: 12,
            });
            setItems((prev) => (append ? [...prev, ...result.items] : result.items));
            setTotal(result.total);
            setHasMore(result.hasMore);
            setPage(result.page);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, options, baseQuery, tab, debounced, router]);

    useEffect(() => {
        setLoading(true);
        fetchPage(1, false);
    }, [fetchPage]);

    const open = (card: ResourceCard) => {
        const { pathname, params } = routeFor(card);
        router.push({ pathname: pathname as any, params });
    };

    const activeFilters = countActive(filters);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>

                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color={Palette.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search anything..."
                        placeholderTextColor={Palette.textMuted}
                        autoFocus
                        returnKeyType="search"
                    />
                    {!!query && (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                            <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={10}>
                    <Ionicons
                        name="options-outline"
                        size={22}
                        color={activeFilters ? Palette.primary : Palette.textMuted}
                    />
                    {activeFilters > 0 && <View style={styles.filterDot} />}
                </TouchableOpacity>
            </View>

            <FlatList
                horizontal
                data={TABS}
                keyExtractor={(t) => t.key}
                showsHorizontalScrollIndicator={false}
                style={styles.tabStrip}
                contentContainerStyle={styles.tabRow}
                renderItem={({ item }) => {
                    const active = tab === item.key;
                    return (
                        <TouchableOpacity
                            style={[styles.tab, active && styles.tabActive]}
                            onPress={() => setTab(item.key)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={item.icon as any}
                                size={20}
                                color={active ? Palette.primary : Palette.textSecondary}
                            />
                            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
                        </TouchableOpacity>
                    );
                }}
            />

            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                    <View style={styles.countRow}>
                        <Text style={styles.countText}>
                            {loading ? 'Searching…' : `${debounced ? 'Results' : 'All Results'} (${total})`}
                        </Text>
                        <TouchableOpacity style={styles.sortButton} onPress={() => setSheetOpen(true)}>
                            <Ionicons name="swap-vertical-outline" size={15} color={Palette.primary} />
                            <Text style={styles.sortText}>
                                {debounced
                                    ? 'Most relevant'
                                    : options?.sorts.find((s) => s.key === filters.sort)?.label ?? 'Newest first'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.cardWrap}>
                        <AutoCard card={item} onPress={() => open(item)} variant="row" />
                    </View>
                )}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator color={Palette.primary} style={styles.loader} />
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={36} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>
                                {debounced ? `Nothing found for “${debounced}”` : 'Nothing here yet'}
                            </Text>
                            <Text style={styles.emptyBody}>
                                Try a different word, another tab, or fewer filters.
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={loadingMore ? <ActivityIndicator color={Palette.primary} style={styles.loader} /> : null}
                onEndReachedThreshold={0.6}
                onEndReached={() => {
                    if (loadingMore || !hasMore) return;
                    setLoadingMore(true);
                    fetchPage(page + 1, true);
                }}
            />

            <FilterSheet
                visible={sheetOpen}
                options={options}
                value={filters}
                baseQuery={baseQuery}
                onClose={() => setSheetOpen(false)}
                onApply={(next) => {
                    setFilters(next);
                    // The sheet can also change the type, so keep the tabs in step with it —
                    // a tab strip showing "All" over a list filtered to articles is a lie.
                    setTab(next.type);
                    setSheetOpen(false);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    topBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    searchRow: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text, padding: 0 },
    filterDot: {
        position: 'absolute', top: -2, right: -2,
        width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.primary,
    },

    tabStrip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    tabRow: { paddingHorizontal: Spacing.xl, gap: Spacing.xxl },
    tab: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: Palette.primary },
    tabLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tabLabelActive: { color: Palette.primary, fontFamily: Fonts.semibold },

    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },
    countRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: Spacing.lg,
    },
    countText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sortText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    cardWrap: { marginBottom: Spacing.md },
    loader: { marginTop: Spacing.xxl },
    empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.sm },
    emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    emptyBody: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center' },
});
