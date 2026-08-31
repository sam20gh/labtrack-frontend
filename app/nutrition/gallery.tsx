/**
 * Everything the person has photographed, newest first.
 *
 * Grouped by day rather than presented as one continuous grid. A food gallery is read as a
 * record of days — "that was the week I ate well" — and an undifferentiated wall of tiles
 * loses the only axis that makes it legible. The day header carries the day's calorie total
 * for the photographed meals, which is the number someone scanning back through a month
 * actually wants.
 *
 * Only photographed meals appear here, which is deliberately less than the full record: a
 * placeholder square for a typed meal would pad the grid with tiles that say nothing. The
 * caption under the header says so, so nobody reads a thin gallery as a thin diary.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
    ActivityIndicator, Modal, useWindowDimensions, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { getGallery, ALIGNMENT_META, MEAL_TYPE_LABEL } from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type { NutritionGalleryItem } from '@/types/api';

const PAGE = 30;
/** Columns in the grid. Three keeps a plate recognisable at phone width; four does not. */
const COLUMNS = 3;

const dayLabel = (day: string) => {
    // `day` is a local calendar string the server wrote from the client's own offset.
    // Parsing it with `new Date('2026-08-31')` would read it as UTC midnight and render
    // the previous day for anyone west of Greenwich — the exact bug `MealLog.day` exists
    // to avoid. Split it instead.
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d);

    const today = new Date();
    const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const daysAgo = Math.round((midnight(today) - midnight(date)) / 86_400_000);

    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
    });
};

const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function NutritionGalleryScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [items, setItems] = useState<NutritionGalleryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [viewing, setViewing] = useState<NutritionGalleryItem | null>(null);

    const tile = Math.floor((width - Spacing.lg * 2 - Spacing.sm * (COLUMNS - 1)) / COLUMNS);

    const load = useCallback(async () => {
        try {
            const data = await getGallery({ limit: PAGE });
            setItems(data.items);
            setTotal(data.total);
            setCursor(data.nextCursor);
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Alert.alert('Could not load your gallery', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    // Refetched on focus rather than on mount: the log flow pushes on top of this screen
    // and returns, and a gallery missing the photograph just taken is the first thing
    // anyone would notice.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const loadMore = async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const data = await getGallery({ limit: PAGE, before: cursor });
            // Appended by id rather than by index: a meal logged between the two requests
            // shifts the window, and the cursor alone cannot rule out an overlap.
            setItems((prev) => {
                const seen = new Set(prev.map((i) => i._id));
                return [...prev, ...data.items.filter((i) => !seen.has(i._id))];
            });
            setTotal(data.total);
            setCursor(data.nextCursor);
        } catch {
            // A failed page is not worth an alert over — the button stays, and tapping
            // again retries.
        } finally {
            setLoadingMore(false);
        }
    };

    const days = useMemo(() => {
        const grouped = new Map<string, NutritionGalleryItem[]>();
        for (const item of items) {
            if (!grouped.has(item.day)) grouped.set(item.day, []);
            grouped.get(item.day)!.push(item);
        }
        return [...grouped.entries()];
    }, [items]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Gallery</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor={Palette.primary}
                        />
                    }
                >
                    {items.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="images-outline" size={30} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>No photographs yet</Text>
                            <Text style={styles.emptyBody}>
                                Meals you log with a photo appear here, so you can look back over what
                                you&apos;ve actually been eating.
                            </Text>
                            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/nutrition/log')}>
                                <Ionicons name="camera-outline" size={17} color={Palette.white} />
                                <Text style={styles.emptyButtonText}>Photograph a meal</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.caption}>
                                {total} {total === 1 ? 'photograph' : 'photographs'} from your log. Meals you typed
                                in aren&apos;t shown here — you&apos;ll find those in your history.
                            </Text>

                            {days.map(([day, dayItems]) => (
                                <View key={day} style={styles.dayBlock}>
                                    <View style={styles.dayHead}>
                                        <Text style={styles.dayTitle}>{dayLabel(day)}</Text>
                                        <Text style={styles.dayMeta}>
                                            {dayItems.reduce((sum, i) => sum + Math.round(i.calories), 0).toLocaleString()} kcal
                                            {' · '}
                                            {dayItems.length} {dayItems.length === 1 ? 'photo' : 'photos'}
                                        </Text>
                                    </View>

                                    <View style={styles.grid}>
                                        {dayItems.map((item) => {
                                            const alignment = ALIGNMENT_META[item.alignment];
                                            return (
                                                <TouchableOpacity
                                                    key={item._id}
                                                    style={{ width: tile, height: tile, borderRadius: Radius.md, overflow: 'hidden' }}
                                                    activeOpacity={0.85}
                                                    onPress={() => setViewing(item)}
                                                >
                                                    <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
                                                    {/*
                                                      The alignment verdict as a dot, not a
                                                      label. At this size a word is unreadable,
                                                      and a red badge on a photograph of
                                                      someone's dinner is a scolding — the
                                                      thing every other surface in this
                                                      feature is careful not to do.
                                                    */}
                                                    {item.alignment !== 'unassessed' && (
                                                        <View style={[styles.dot, { backgroundColor: alignment.color }]} />
                                                    )}
                                                    <View style={styles.gridKcal}>
                                                        <Text style={styles.gridKcalText}>{Math.round(item.calories)} kcal</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}

                            {cursor && (
                                <TouchableOpacity style={styles.more} onPress={loadMore} disabled={loadingMore}>
                                    {loadingMore
                                        ? <ActivityIndicator color={Palette.primary} />
                                        : <Text style={styles.moreText}>Load older photos</Text>}
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </ScrollView>
            )}

            {/*
              The viewer. Full-bleed photograph with the meal on a card over it, following
              frame 31 — the picture is what the person came to look at, so it gets the
              screen and the numbers sit on top of it rather than beside it.
            */}
            <Modal
                visible={!!viewing}
                animationType="fade"
                transparent
                onRequestClose={() => setViewing(null)}
            >
                <View style={styles.viewer}>
                    {viewing && (
                        <>
                            <Image source={{ uri: viewing.imageUrl }} style={styles.viewerImage} resizeMode="cover" />

                            <SafeAreaView style={styles.viewerTop} edges={['top']}>
                                <TouchableOpacity style={styles.viewerClose} onPress={() => setViewing(null)} hitSlop={8}>
                                    <Ionicons name="close" size={22} color={Palette.text} />
                                </TouchableOpacity>
                            </SafeAreaView>

                            <SafeAreaView style={styles.viewerBottom} edges={['bottom']}>
                                <View style={styles.viewerCard}>
                                    <View style={styles.viewerChipRow}>
                                        <View style={styles.typeChip}>
                                            <Text style={styles.typeChipText}>
                                                {MEAL_TYPE_LABEL[viewing.mealType] || 'Meal'}
                                            </Text>
                                        </View>
                                        {viewing.alignment !== 'unassessed' && (
                                            <View style={[styles.typeChip, { backgroundColor: ALIGNMENT_META[viewing.alignment].bg }]}>
                                                <Text style={[styles.typeChipText, { color: ALIGNMENT_META[viewing.alignment].color }]}>
                                                    {ALIGNMENT_META[viewing.alignment].label}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text style={styles.viewerName}>{viewing.name}</Text>
                                    <Text style={styles.viewerWhen}>
                                        {dayLabel(viewing.day)} at {time(viewing.eatenAt)}
                                    </Text>

                                    <View style={styles.statRow}>
                                        {([
                                            ['Calories', `${Math.round(viewing.calories)}`, 'kcal'],
                                            ['Protein', `${Math.round(viewing.protein)}`, 'g'],
                                            ['Carbs', `${Math.round(viewing.carbs)}`, 'g'],
                                            ['Fat', `${Math.round(viewing.fat)}`, 'g'],
                                        ] as const).map(([label, value, unit]) => (
                                            <View key={label} style={styles.stat}>
                                                <Text style={styles.statValue}>
                                                    {value}<Text style={styles.statUnit}>{unit}</Text>
                                                </Text>
                                                <Text style={styles.statLabel}>{label}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </SafeAreaView>
                        </>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { flex: 1, textAlign: 'center', fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, paddingBottom: Spacing.xxxl, gap: Spacing.xl },

    caption: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        lineHeight: 17,
        color: Palette.textSecondary,
    },

    dayBlock: { gap: Spacing.md },
    dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    dayTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    dayMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    gridImage: { width: '100%', height: '100%', backgroundColor: Palette.borderLight },
    dot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.9)',
    },
    gridKcal: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 6,
        paddingVertical: 4,
        backgroundColor: 'rgba(17,24,39,0.55)',
    },
    gridKcalText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.white },

    more: {
        height: 44,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        backgroundColor: Palette.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },

    empty: {
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.lg,
    },
    emptyTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    emptyBody: {
        fontFamily: Fonts.regular,
        fontSize: 13,
        lineHeight: 19,
        color: Palette.textSecondary,
        textAlign: 'center',
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        height: 44,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.lg,
        backgroundColor: Palette.primary,
    },
    emptyButtonText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.white },

    viewer: { flex: 1, backgroundColor: '#0B0B0F' },
    viewerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    viewerTop: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    viewerClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewerBottom: { marginTop: 'auto' },
    viewerCard: {
        margin: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: Radius.xl,
        backgroundColor: Palette.background,
        gap: Spacing.xs,
        ...Shadow.card,
    },
    viewerChipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
    typeChip: {
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        backgroundColor: Palette.primarySurface,
    },
    typeChipText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.primary },
    viewerName: { fontFamily: Fonts.bold, fontSize: 19, color: Palette.text },
    viewerWhen: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    statRow: {
        flexDirection: 'row',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    statUnit: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    statLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
});
