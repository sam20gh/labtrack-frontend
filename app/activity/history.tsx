/**
 * Activity history and search — frames 9 to 17.
 *
 * The design draws the list, the search screen, the empty-result state and the filtered
 * results as four screens. They are one screen with different state, and the API backs them
 * with one query, so building four would mean four ways for the same list to disagree with
 * itself.
 *
 * The filter sheet (frame 13) and its date and calorie pickers arrive with phase 11.2,
 * alongside the goals they filter against. Search and type filtering work now.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, SectionList, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { SessionCard } from '@/components/metric/SessionCard';
import { listSessions, formatType, type ActivitySession } from '@/lib/activity';
import { ApiError } from '@/lib/api';

const TYPE_FILTERS = ['walking', 'jogging', 'biking', 'swimming', 'yoga', 'weightlifting'];

/** Group by local day, newest first, with a human heading. */
const groupByDay = (sessions: ActivitySession[]) => {
    const map = new Map<string, ActivitySession[]>();
    for (const s of sessions) {
        if (!map.has(s.day)) map.set(s.day, []);
        map.get(s.day)!.push(s);
    }

    const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
        .toISOString().slice(0, 10);

    return [...map.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([day, data]) => {
            const d = new Date(`${day}T00:00:00`);
            return {
                title: day === todayKey
                    ? 'Today'
                    : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
                data,
            };
        });
};

export default function ActivityHistory() {
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [types, setTypes] = useState<string[]>([]);
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const result = await listSessions({
                q: query.trim() || undefined,
                type: types.length ? types : undefined,
                limit: 100,
            });
            setSessions(result.sessions);
            setTotal(result.total);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your history.');
        } finally {
            setLoading(false);
        }
    }, [query, types, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const sections = useMemo(() => groupByDay(sessions), [sessions]);
    const filtering = Boolean(query.trim() || types.length);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Activity history</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={Palette.textMuted} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={load}
                    returnKeyType="search"
                    placeholder="Search for an activity…"
                    placeholderTextColor={Palette.textMuted}
                    style={styles.search}
                    accessibilityLabel="Search activities"
                />
                {query.length > 0 && (
                    <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                        <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                    </Pressable>
                )}
            </View>

            <View style={styles.filters}>
                {TYPE_FILTERS.map((t) => {
                    const active = types.includes(t);
                    return (
                        <Pressable
                            key={t}
                            onPress={() => setTypes(active ? types.filter((x) => x !== t) : [...types, t])}
                            style={[styles.filter, active && styles.filterActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                        >
                            <Text style={[styles.filterText, active && styles.filterTextActive]}>
                                {formatType(t)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            ) : error ? (
                <View style={styles.centre}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable onPress={load} accessibilityRole="button">
                        <Text style={styles.link}>Try again</Text>
                    </Pressable>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.list}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <Text style={styles.sectionHeader}>{section.title}</Text>
                    )}
                    renderItem={({ item }) => (
                        <SessionCard
                            session={item}
                            onPress={() => router.push(`/activity/session/${item._id}`)}
                        />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                    ListEmptyComponent={
                        <View style={styles.centre}>
                            <Ionicons name="search-outline" size={30} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>
                                {filtering ? 'No activities match' : 'Nothing logged yet'}
                            </Text>
                            <Text style={styles.emptyBody}>
                                {filtering
                                    ? 'Try another search, or clear the filters.'
                                    : 'Log your first activity and it will appear here.'}
                            </Text>
                            <Pressable
                                onPress={() => (filtering
                                    ? (setQuery(''), setTypes([]))
                                    : router.push('/activity/log'))}
                                accessibilityRole="button"
                            >
                                <Text style={styles.link}>
                                    {filtering ? 'Clear filters' : 'Log an activity'}
                                </Text>
                            </Pressable>
                        </View>
                    }
                    ListFooterComponent={
                        sessions.length > 0 ? (
                            <Text style={styles.footer}>
                                Showing {sessions.length} of {total}{' '}
                                {total === 1 ? 'activity' : 'activities'}
                            </Text>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },

    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginHorizontal: Spacing.xl,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
    },
    search: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text, padding: 0 },

    filters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        marginTop: Spacing.md,
    },
    filter: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    filterActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    filterText: { fontSize: 12.5, fontFamily: Fonts.medium, color: Palette.textSecondary },
    filterTextActive: { fontFamily: Fonts.semibold, color: Palette.primary },

    list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },
    sectionHeader: {
        fontSize: 13,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },

    centre: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xxxl },
    emptyTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    emptyBody: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
    },
    error: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.danger, textAlign: 'center' },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    footer: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        textAlign: 'center',
        marginTop: Spacing.xl,
    },
});
