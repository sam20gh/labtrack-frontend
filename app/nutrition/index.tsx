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
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { getDay, deleteMeal } from '@/lib/nutrition';
import { CalorieRing } from '@/components/nutrition/CalorieRing';
import { MacroBars } from '@/components/nutrition/MacroBars';
import { PlanGuidanceCard } from '@/components/nutrition/PlanGuidanceCard';
import { MealCard } from '@/components/nutrition/MealCard';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type { NutritionDay } from '@/types/api';

export default function NutritionScreen() {
    const router = useRouter();
    const [data, setData] = useState<NutritionDay | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await getDay());
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const targets = data?.targets && 'calories' in data.targets ? data.targets : undefined;
    const hasPlan = Boolean(data?.plan);
    const meals = data?.meals || [];

    const caption = !targets?.calories
        ? undefined
        : data!.overBy > 0
            ? `${data!.overBy.toLocaleString()} kcal over`
            : `${(data!.remaining ?? 0).toLocaleString()} kcal left`;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Nutrition</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => router.push('/nutrition/history')} hitSlop={8}>
                        <Ionicons name="stats-chart-outline" size={20} color={Palette.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/nutrition/setup')} hitSlop={8}>
                        <Ionicons name="options-outline" size={20} color={Palette.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

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
                {/*
                  No targets yet. The design shows a zeroed ring here; a zeroed ring implies
                  a target of zero, so the prompt to set one replaces it instead.
                */}
                {!hasPlan || !targets?.calories ? (
                    <TouchableOpacity style={styles.setupPrompt} onPress={() => router.push('/nutrition/setup')}>
                        <Ionicons name="flag-outline" size={22} color={Palette.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.setupTitle}>Set up your nutrition goal</Text>
                            <Text style={styles.setupBody}>
                                We&apos;ll work your targets out from your profile and the dietary advice on your health plan.
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.ringCard}>
                        <CalorieRing
                            consumed={data!.totals.calories}
                            target={targets.calories}
                            caption={caption}
                        />
                        <View style={styles.macroWrap}>
                            <MacroBars totals={data!.totals} targets={targets} />
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <PlanGuidanceCard
                        guidance={data?.plan?.guidance || []}
                        onPressItem={() => router.push('/myplans')}
                    />
                </View>

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

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today&apos;s meals</Text>

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
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={() => router.push('/nutrition/log')}>
                <Ionicons name="add" size={24} color={Palette.white} />
                <Text style={styles.fabText}>Log a meal</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 22, color: Palette.text },
    headerActions: { flexDirection: 'row', gap: Spacing.lg },
    content: { padding: Spacing.lg, paddingTop: 0, paddingBottom: 110, gap: Spacing.lg },

    ringCard: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        ...Shadow.card,
    },
    macroWrap: { alignSelf: 'stretch', paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },

    setupPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    setupTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    setupBody: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 17,
        marginTop: 2,
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
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },

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
