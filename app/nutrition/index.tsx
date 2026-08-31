/**
 * Nutrition tracker — today.
 *
 * The plan's dietary advice sits above the numbers on purpose. A calorie ring on its own is
 * a calorie counter; what makes this part of LabTrack is that the targets underneath it
 * were derived from the person's interpretation, and every meal is scored against the
 * advice their plan actually gave them.
 *
 * Refetched with `useFocusEffect` rather than on mount: the log and review screens push on
 * top of this one and return, and a stale ring after logging a meal is the first thing
 * anyone would notice.
 *
 * The gallery rail is loaded beside the day but settled independently. It is the least
 * important thing on the screen and must never be able to take the day down with it.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '@/lib/api';
import { getDay, deleteMeal, getGallery } from '@/lib/nutrition';
import { CalorieRing } from '@/components/nutrition/CalorieRing';
import { MacroBars } from '@/components/nutrition/MacroBars';
import { PlanGuidanceCard } from '@/components/nutrition/PlanGuidanceCard';
import { MealCard } from '@/components/nutrition/MealCard';
import { MealGallery } from '@/components/nutrition/MealGallery';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type { NutritionDay, NutritionGallery } from '@/types/api';

/** Thumbnails on the dashboard rail. The rest live behind "See all". */
const GALLERY_PREVIEW = 12;

export default function NutritionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [data, setData] = useState<NutritionDay | null>(null);
    const [gallery, setGallery] = useState<NutritionGallery | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            /*
              The gallery is settled separately from the day.
              
              `Promise.all` would let a gallery failure take the dashboard down with it, and
              the photographs are the least important thing on this screen. A day that loads
              without its rail is fine; a blank screen because a thumbnail query timed out
              is not.
            */
            const [day, photos] = await Promise.allSettled([
                getDay(),
                getGallery({ limit: GALLERY_PREVIEW }),
            ]);

            if (photos.status === 'fulfilled') setGallery(photos.value);
            if (day.status === 'rejected') throw day.reason;
            setData(day.value);
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Alert.alert('Could not load your nutrition', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const removeMeal = (id: string, name: string) => {
        // Frame 367 in the design: deleting a meal changes the day's totals, so it asks.
        Alert.alert('Delete this meal?', `"${name}" will be removed from today.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMeal(id);
                        await load();
                    } catch (error) {
                        Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
                    }
                },
            },
        ]);
    };
    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator style={{ marginTop: 120 }} color={Palette.primary} />
            </View>
        );
    }

    const targets = data?.targets && 'calories' in data.targets ? data.targets : undefined;
    const hasPlan = Boolean(data?.plan);
    const meals = data?.meals || [];
    const hasTarget = hasPlan && Boolean(targets?.calories);

    const caption = !targets?.calories
        ? undefined
        : data!.overBy > 0
            ? `${data!.overBy.toLocaleString()} kcal over`
            : `${(data!.remaining ?? 0).toLocaleString()} kcal left`;

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                {/*
                  The hero, following frame 10 of the kit.

                  It sits inside the ScrollView rather than pinned above it, so the gradient
                  runs under the status bar and scrolls away with the content — a fixed
                  purple band above a scrolling list eats a third of a small phone for a
                  number the person has already read. `insets.top` is applied here for the
                  same reason `(tabs)/_layout.tsx` gives: no screen in this app gets a
                  global app bar, so each one owns its own top inset.
                */}
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.hero, { paddingTop: insets.top + Spacing.sm }]}
                >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                            <Ionicons name="chevron-back" size={24} color={Palette.white} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Nutrition</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => router.push('/nutrition/history')} hitSlop={8}>
                                <Ionicons name="stats-chart-outline" size={20} color={Palette.white} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/nutrition/setup')} hitSlop={8}>
                                <Ionicons name="options-outline" size={20} color={Palette.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/*
                      No targets yet. The design shows a zeroed ring here; a zeroed ring
                      implies a target of zero, so the prompt to set one replaces it.
                    */}
                    {!hasTarget ? (
                        <TouchableOpacity style={styles.setupPrompt} onPress={() => router.push('/nutrition/setup')}>
                            <Ionicons name="flag-outline" size={22} color={Palette.white} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.setupTitle}>Set up your nutrition goal</Text>
                                <Text style={styles.setupBody}>
                                    We&apos;ll work your targets out from your profile and the dietary advice
                                    on your health plan.
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.ringRow}>
                            {/*
                              Consumed and target flank the ring, as the kit draws them. The
                              ring shows a proportion; these two are the figures someone
                              repeats to themselves, and reading them off an arc is work.
                            */}
                            <View style={styles.flank}>
                                <Text style={styles.flankValue}>
                                    {Math.round(data!.totals.calories).toLocaleString()}
                                </Text>
                                <Text style={styles.flankLabel}>consumed</Text>
                            </View>

                            <CalorieRing
                                consumed={data!.totals.calories}
                                target={targets!.calories}
                                caption={caption}
                                size={168}
                                tone="dark"
                            />

                            <View style={[styles.flank, { alignItems: 'flex-end' }]}>
                                <Text style={styles.flankValue}>
                                    {Math.round(targets!.calories).toLocaleString()}
                                </Text>
                                <Text style={styles.flankLabel}>target</Text>
                            </View>
                        </View>
                    )}
                </LinearGradient>

                <View style={styles.content}>
                    {/*
                      The macro card overlaps the gradient's lower edge, as in the kit. It is
                      the one element that belongs to both halves of the screen — the totals
                      it draws are the hero's, the targets are the plan's.
                    */}
                    {hasTarget && (
                        <View style={styles.macroCard}>
                            <MacroBars totals={data!.totals} targets={targets!} />
                        </View>
                    )}

                    <PlanGuidanceCard
                        guidance={data?.plan?.guidance || []}
                        onPressItem={() => router.push('/myplans')}
                    />

                    {/*
                      Adherence is only rendered when meals were actually assessed against
                      guidance. Someone whose plan says nothing about diet has not failed at
                      anything, and a 0% on their dashboard would say they had.
                    */}
                    {data && data.adherence.assessed > 0 && (
                        <View style={styles.adherence}>
                            <Text style={styles.adherenceValue}>
                                {data.adherence.aligned + data.adherence.partial}
                                <Text style={styles.adherenceOf}> of {data.adherence.assessed}</Text>
                            </Text>
                            <Text style={styles.adherenceLabel}>
                                meals today moved you towards your plan
                            </Text>
                        </View>
                    )}

                    {/*
                      The gallery draws itself only when there are photographs, so nothing
                      here guards it — see the component.
                    */}
                    <MealGallery
                        items={gallery?.items || []}
                        total={gallery?.total || 0}
                        onPressItem={() => router.push('/nutrition/gallery')}
                        onSeeAll={() => router.push('/nutrition/gallery')}
                    />

                    <View style={styles.section}>
                        <View style={styles.sectionHead}>
                            <Text style={styles.sectionTitle}>Today&apos;s meals</Text>
                            {meals.length > 0 && (
                                <TouchableOpacity onPress={() => router.push('/nutrition/history')} hitSlop={8}>
                                    <Text style={styles.seeAll}>See all</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {meals.length === 0 ? (
                            <View style={styles.empty}>
                                <Ionicons name="restaurant-outline" size={28} color={Palette.textMuted} />
                                <Text style={styles.emptyTitle}>You haven&apos;t eaten anything today.</Text>
                                <Text style={styles.emptyBody}>
                                    Log your first meal today and get insights.
                                </Text>
                            </View>
                        ) : (
                            <View style={{ gap: Spacing.md }}>
                                {meals.map((meal) => (
                                    <MealCard
                                        key={meal._id}
                                        meal={meal}
                                        onPress={() => removeMeal(meal._id, meal.name)}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={() => router.push('/nutrition/log')}>
                <Ionicons name="add" size={24} color={Palette.white} />
                <Text style={styles.fabText}>Log a meal</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    scroll: { paddingBottom: 110 },

    hero: {
        paddingHorizontal: Spacing.lg,
        // The macro card is pulled up over this edge, so the gradient carries the extra
        // depth rather than the card floating on the canvas below it.
        paddingBottom: Spacing.xxxl + Spacing.xl,
        borderBottomLeftRadius: Radius.xl * 2,
        borderBottomRightRadius: Radius.xl * 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
    },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: Palette.white },
    headerActions: { flexDirection: 'row', gap: Spacing.lg },

    ringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    // Fixed rather than flexed, so a four-digit target cannot squeeze the ring off-centre.
    flank: { width: 64 },
    flankValue: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.white },
    flankLabel: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' },

    setupPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginTop: Spacing.sm,
    },
    setupTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    setupBody: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 17,
        marginTop: 2,
    },

    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.xl },
    macroCard: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        // Lifts the card over the gradient's lower edge, matching the kit.
        marginTop: -(Spacing.xxxl + Spacing.sm),
        ...Shadow.card,
    },

    adherence: {
        backgroundColor: Palette.successSurface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    adherenceValue: { fontFamily: Fonts.bold, fontSize: 22, color: Palette.success },
    adherenceOf: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.success },
    adherenceLabel: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.text, marginTop: 2 },

    section: { gap: Spacing.md },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    seeAll: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

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
    emptyTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' },

    fab: {
        position: 'absolute',
        left: Spacing.lg,
        right: Spacing.lg,
        bottom: Spacing.xxl,
        height: 52,
        borderRadius: Radius.lg,
        backgroundColor: Palette.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        ...Shadow.card,
    },
    fabText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
});
