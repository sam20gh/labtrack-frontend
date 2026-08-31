/**
 * Resources — the library home.
 *
 * The kit's purple header (avatar, title, bell, search field, category tiles) sitting above
 * five rails: Featured, Articles, Shorts, Courses, Workshops. Each rail's "See All" opens
 * `/resources/list` pinned to that type.
 *
 * **One request builds this whole screen.** `GET /resources/home` returns all five rails and
 * the category strip together. Five requests would mean five spinners resolving at five
 * different moments, on a screen whose entire job is to look browsable.
 *
 * The search field here does not search — it opens `/resources/search`, which owns the type
 * tabs and the filter sheet. A second, weaker search on the hub would be a control that
 * behaves differently from the one it looks identical to.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
    ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '@/lib/api';
import { getHub, routeFor, type ResourceCard, type ResourceHub } from '@/lib/resources';
import {
    FeaturedCard, ArticleCard, ShortCard, CourseRow, WorkshopRow,
} from '@/components/resources/ResourceCards';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const SectionHeader = ({ icon, title, onSeeAll }: {
    icon: string; title: string; onSeeAll?: () => void;
}) => (
    <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
            <Ionicons name={icon as any} size={18} color={Palette.text} />
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {!!onSeeAll && (
            <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
                <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
        )}
    </View>
);

export default function ResourcesScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [hub, setHub] = useState<ResourceHub | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setHub(await getHub());
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load resources');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const open = useCallback((card: ResourceCard) => {
        const { pathname, params } = routeFor(card);
        router.push({ pathname: pathname as any, params });
    }, [router]);

    const openList = (type: string) =>
        router.push({ pathname: '/resources/list', params: { type } });

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const articleWidth = Math.min(280, width * 0.74);

    return (
        <View style={styles.screen}>
            <LinearGradient colors={Palette.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                            <Ionicons name="chevron-back" size={24} color={Palette.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Resources</Text>
                        <TouchableOpacity onPress={() => router.push('/resources/saved')} hitSlop={12}>
                            <View style={styles.headerAction}>
                                <Ionicons name="bookmark-outline" size={18} color={Palette.primary} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.searchBar}
                        onPress={() => router.push('/resources/search')}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="search" size={18} color={Palette.textMuted} />
                        <Text style={styles.searchPlaceholder}>Search for a resource...</Text>
                        <Ionicons name="options-outline" size={18} color={Palette.textMuted} />
                    </TouchableOpacity>

                    {/* The category strip. "All categories" is the last tile rather than a
                        separate control, so the row reads as one list of destinations. */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryStrip}
                    >
                        {(hub?.categories ?? []).map((category) => (
                            <TouchableOpacity
                                key={category.slug}
                                style={styles.categoryTile}
                                onPress={() => router.push({
                                    pathname: '/resources/list',
                                    params: { category: category.slug, title: category.name },
                                })}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={category.icon as any} size={18} color={Palette.white} />
                                <Text style={styles.categoryLabel} numberOfLines={1}>{category.name}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.categoryTile, styles.categoryTileGhost]}
                            onPress={() => router.push('/resources/categories')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="grid-outline" size={18} color={Palette.white} />
                            <Text style={styles.categoryLabel}>All</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                {!!error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="cloud-offline-outline" size={20} color={Palette.textSecondary} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {!!hub?.featured.length && (
                    <>
                        <SectionHeader icon="sparkles-outline" title="Featured Resources" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                            {hub.featured.map((card) => (
                                <FeaturedCard key={card.id} card={card} onPress={() => open(card)} />
                            ))}
                        </ScrollView>
                    </>
                )}

                {!!hub?.articles.length && (
                    <>
                        <SectionHeader icon="document-text-outline" title="Articles" onSeeAll={() => openList('article')} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                            {hub.articles.map((card) => (
                                <ArticleCard key={card.id} card={card} width={articleWidth} onPress={() => open(card)} />
                            ))}
                        </ScrollView>
                    </>
                )}

                {!!hub?.shorts.length && (
                    <>
                        <SectionHeader icon="videocam-outline" title="Shorts" onSeeAll={() => openList('short')} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                            {hub.shorts.map((card) => (
                                <ShortCard key={card.id} card={card} onPress={() => open(card)} />
                            ))}
                        </ScrollView>
                    </>
                )}

                {!!hub?.courses.length && (
                    <>
                        <SectionHeader icon="school-outline" title="Courses" onSeeAll={() => openList('course')} />
                        <View style={styles.stack}>
                            {hub.courses.slice(0, 3).map((card) => (
                                <CourseRow key={card.id} card={card} onPress={() => open(card)} />
                            ))}
                        </View>
                    </>
                )}

                {!!hub?.workshops.length && (
                    <>
                        <SectionHeader icon="settings-outline" title="Workshops" onSeeAll={() => openList('workshop')} />
                        <View style={styles.stack}>
                            {hub.workshops.slice(0, 3).map((card) => (
                                <WorkshopRow key={card.id} card={card} onPress={() => open(card)} />
                            ))}
                        </View>
                    </>
                )}

                {/* An empty library is a real state — nothing has been published or imported
                    yet — and it has to say what to do about it rather than render blank. */}
                {!error && !hub?.featured.length && !hub?.articles.length && !hub?.shorts.length
                    && !hub?.courses.length && !hub?.workshops.length && (
                    <View style={styles.empty}>
                        <Ionicons name="library-outline" size={40} color={Palette.textMuted} />
                        <Text style={styles.emptyTitle}>No resources yet</Text>
                        <Text style={styles.emptyBody}>
                            Articles, courses and workshops will appear here as they are published.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg,
    },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.white },
    headerAction: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },

    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: Spacing.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.white,
    },
    searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.textMuted },

    categoryStrip: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.md },
    categoryTile: {
        width: 92, height: 62, borderRadius: Radius.lg,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingHorizontal: Spacing.sm,
    },
    categoryTileGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
    categoryLabel: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.white },

    content: { paddingBottom: Spacing.xxxl * 2 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, marginTop: Spacing.xxl, marginBottom: Spacing.md,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    seeAll: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    rail: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingVertical: 4 },
    stack: { paddingHorizontal: Spacing.xl, gap: Spacing.md },

    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        margin: Spacing.xl, padding: Spacing.lg,
        borderRadius: Radius.lg, backgroundColor: Palette.surface,
    },
    errorText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },

    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.xxxl * 2, gap: Spacing.md },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
});
