/**
 * Explore Categories.
 *
 * Every active category, under its group heading, with a live count. The count is the whole
 * reason this screen is not a static list in the app: it comes from `GET
 * /resources/categories`, which aggregates published resources per category, so a tile that
 * says 12 opens onto 12.
 *
 * A category with nothing in it is still shown. This screen is also how someone learns a
 * subject exists, and hiding the empty ones means the library appears to shrink each time
 * something is unpublished.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import { getCategories, type ResourceCategory } from '@/lib/resources';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

type Group = { name: string; categories: ResourceCategory[] };

export default function ResourceCategoriesScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const { groups: next } = await getCategories();
            setGroups(next);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <Text style={styles.title}>Explore Categories</Text>
                <Text style={styles.subtitle}>Explore resources by category</Text>

                {groups.map((group) => (
                    <View key={group.name} style={styles.group}>
                        <Text style={styles.groupTitle}>{group.name}</Text>
                        <View style={styles.grid}>
                            {group.categories.map((category) => (
                                <TouchableOpacity
                                    key={category.slug}
                                    style={styles.tile}
                                    activeOpacity={0.85}
                                    onPress={() => router.push({
                                        pathname: '/resources/list',
                                        params: { category: category.slug, title: category.name },
                                    })}
                                >
                                    <View style={styles.tileIcon}>
                                        <Ionicons name={category.icon as any} size={22} color={Palette.text} />
                                    </View>
                                    <Text style={styles.tileName} numberOfLines={1}>{category.name}</Text>
                                    <Text style={styles.tileCount}>
                                        {category.resourceCount ?? 0} resource{category.resourceCount === 1 ? '' : 's'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {!groups.length && (
                    <View style={styles.empty}>
                        <Ionicons name="grid-outline" size={36} color={Palette.textMuted} />
                        <Text style={styles.emptyTitle}>No categories yet</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },

    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 4 },

    group: { marginTop: Spacing.xxl },
    groupTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginBottom: Spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        width: '47.5%', padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
        ...Shadow.card,
    },
    tileIcon: { marginBottom: Spacing.xxl },
    tileName: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    tileCount: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    empty: { alignItems: 'center', paddingTop: Spacing.xxxl * 2, gap: Spacing.md },
    emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
});
