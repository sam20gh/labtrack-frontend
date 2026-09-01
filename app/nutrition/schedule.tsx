/**
 * Nutrition Schedule — a day laid out on a time rail.
 *
 * The kit draws a rail of hour chips from 1 AM with meal cards hanging off it. Reproducing
 * that literally means twenty-four chips for a day with three meals on it, so the rail here
 * only prints an hour that has something at it, plus the hours immediately around a meal —
 * the rail is there to show *when* someone ate and how far apart, and empty hours between
 * 1 AM and 6 AM carry none of that.
 *
 * **This is a record, not a plan.** Nothing in LabTrack schedules a meal in advance:
 * `NutritionPlan.mealsPerDay` says how many times a day someone eats and nothing says at
 * what time. So a future day is drawn as empty with the meal slots they usually fill listed
 * as a reminder, and never as appointments they have missed. Drawing an unlogged 8 PM
 * dinner as a pending item would be inventing a commitment nobody made — the same line
 * `app/appointments/*` holds about professional availability.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    getDay, getCalendar, deleteMeal, today, addDays, MEAL_TYPE_LABEL, MACRO_META,
} from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionDay, NutritionCalendar, MealLog } from '@/types/api';

/** A fortnight either side, so the strip can be scrolled back through a fair run of days. */
const STRIP_BACK = 20;
const STRIP_FORWARD = 6;

const SLOT_ICON: Record<string, string> = {
    breakfast: 'sunny-outline',
    lunch: 'partly-sunny-outline',
    dinner: 'moon-outline',
    snack: 'cafe-outline',
};

const hourLabel = (hour: number) => {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
};

export default function NutritionScheduleScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState(today());
    const [day, setDay] = useState<NutritionDay | null>(null);
    const [calendar, setCalendar] = useState<NutritionCalendar | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        /*
          Settled separately. The strip is context; the day is the screen. A calendar query
          that fails must not be able to blank out the meals someone came here to see —
          the same split `nutrition/index.tsx` makes for its gallery rail.
        */
        const [dayRes, calRes] = await Promise.allSettled([
            getDay(selected),
            getCalendar(addDays(today(), -STRIP_BACK), addDays(today(), STRIP_FORWARD)),
        ]);
        if (calRes.status === 'fulfilled') setCalendar(calRes.value);
        if (dayRes.status === 'fulfilled') setDay(dayRes.value);
        else Alert.alert('Could not load that day', 'Please try again.');
        setLoading(false);
    }, [selected]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const strip = useMemo(
        () => Array.from(
            { length: STRIP_BACK + STRIP_FORWARD + 1 },
            (_, i) => addDays(today(), i - STRIP_BACK)
        ),
        []
    );

    const remove = (meal: MealLog) => {
        Alert.alert('Delete this meal?', `"${meal.name}" will be removed from this day.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMeal(meal._id);
                        setLoading(true);
                        await load();
                    } catch (error) {
                        Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
                    }
                },
            },
        ]);
    };

    const meals = useMemo(() => day?.meals || [], [day]);
    const targets = day?.targets && 'calories' in day.targets ? day.targets : null;
    const isFuture = selected > today();

    /**
     * The rail: hour rows, but only the hours that carry something plus one either side.
     * Twenty-four chips for a three-meal day is a rail of empty labels.
     */
    const rail = useMemo(() => {
        const byHour = new Map<number, MealLog[]>();
        for (const m of meals) {
            const h = new Date(m.eatenAt).getHours();
            if (!byHour.has(h)) byHour.set(h, []);
            byHour.get(h)!.push(m);
        }
        const shown = new Set<number>();
        for (const h of byHour.keys()) {
            for (const n of [h - 1, h, h + 1]) if (n >= 0 && n <= 23) shown.add(n);
        }
        return [...shown].sort((a, b) => a - b).map((hour) => ({ hour, meals: byHour.get(hour) || [] }));
    }, [meals]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Schedule</Text>
                <TouchableOpacity onPress={() => router.push('/nutrition/insight')} hitSlop={8}>
                    <Ionicons name="stats-chart-outline" size={20} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
            >
                {strip.map((d) => {
                    const isOn = d === selected;
                    const entry = calendar?.days.find((x) => x.day === d);
                    return (
                        <TouchableOpacity
                            key={d}
                            style={[styles.stripDay, isOn && styles.stripDayOn]}
                            onPress={() => { setSelected(d); setLoading(true); }}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.stripName, isOn && styles.stripTextOn]}>
                                {new Date(`${d}T12:00:00Z`)
                                    .toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
                                    .slice(0, 1)}
                            </Text>
                            <Text style={[styles.stripNum, isOn && styles.stripTextOn]}>
                                {Number(d.slice(8))}
                            </Text>
                            {/*
                              A dot means meals were logged. Its colour never grades the day —
                              a calendar that marks yesterday red for going over is a calendar
                              people stop opening.
                            */}
                            <View style={[
                                styles.stripDot,
                                entry ? { backgroundColor: Palette.primary } : { backgroundColor: 'transparent' },
                            ]} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* The kit's P/F/C bar under the strip: this day's totals against the plan */}
            {day && (
                <View style={styles.macroStrip}>
                    {MACRO_META.map((m) => {
                        const value = Math.round(day.totals[m.key] || 0);
                        const target = targets?.[m.key];
                        return (
                            <View key={m.key} style={styles.macroCol}>
                                <Text style={styles.macroText}>
                                    <Text style={{ color: m.color }}>{m.initial}: </Text>
                                    {value}
                                    {target ? <Text style={styles.macroTarget}>/{Math.round(target)}g</Text> : 'g'}
                                </Text>
                                {target ? (
                                    <View style={styles.macroTrack}>
                                        <View style={[
                                            styles.macroFill,
                                            { width: `${Math.min(100, (value / target) * 100)}%`, backgroundColor: m.color },
                                        ]} />
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            )}

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl * 2 }} color={Palette.primary} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.dayHead}>
                        <Text style={styles.dayTitle}>
                            {selected === today()
                                ? 'Today'
                                : new Date(`${selected}T12:00:00Z`).toLocaleDateString(undefined, {
                                    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
                                })}
                        </Text>
                        {meals.length > 0 && (
                            <Text style={styles.daySub}>
                                {Math.round(day!.totals.calories).toLocaleString()} kcal
                                {targets?.calories ? ` of ${Math.round(targets.calories).toLocaleString()}` : ''}
                                {' · '}{meals.length} {meals.length === 1 ? 'meal' : 'meals'}
                            </Text>
                        )}
                    </View>

                    {meals.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="restaurant-outline" size={30} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>
                                {isFuture ? 'Nothing here yet' : 'You have no meal on this day.'}
                            </Text>
                            <Text style={styles.emptyBody}>
                                {isFuture
                                    /*
                                      Nothing in the app schedules a meal ahead, so a future day
                                      cannot list one. Saying so is better than an empty rail
                                      that looks like something failed to load.
                                    */
                                    ? 'Meals are recorded as you eat them — nothing is scheduled in advance, '
                                        + 'so this day fills in on the day itself.'
                                    : 'Add a meal below and it will appear on this rail at the time you ate it.'}
                            </Text>
                            {day?.plan?.mealsPerDay ? (
                                <Text style={styles.emptyMeta}>
                                    Your plan is built around {day.plan.mealsPerDay} meals a day.
                                </Text>
                            ) : null}
                        </View>
                    ) : (
                        <View style={styles.rail}>
                            {rail.map(({ hour, meals: atHour }) => (
                                <View key={hour} style={styles.railRow}>
                                    <View style={styles.railGutter}>
                                        <View style={styles.hourChip}>
                                            <Text style={styles.hourText}>{hourLabel(hour)}</Text>
                                        </View>
                                        <View style={styles.railLine} />
                                    </View>

                                    <View style={styles.railBody}>
                                        {atHour.map((meal) => (
                                            <View key={meal._id} style={styles.mealRow}>
                                                <TouchableOpacity
                                                    style={styles.mealCard}
                                                    activeOpacity={0.8}
                                                    onPress={() => router.push(`/nutrition/${meal._id}`)}
                                                >
                                                    <View style={styles.mealIcon}>
                                                        <Ionicons
                                                            name={SLOT_ICON[meal.mealType] as any}
                                                            size={18}
                                                            color={Palette.primary}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                                                        <Text style={styles.mealSlot}>
                                                            {MEAL_TYPE_LABEL[meal.mealType]} ·{' '}
                                                            {new Date(meal.eatenAt).toLocaleTimeString(undefined, {
                                                                hour: 'numeric', minute: '2-digit',
                                                            })}
                                                        </Text>
                                                        <View style={styles.mealMacros}>
                                                            <Text style={styles.mealMacro}>
                                                                {Math.round(meal.calories)}c
                                                            </Text>
                                                            {MACRO_META.map((m) => (
                                                                <Text key={m.key} style={styles.mealMacro}>
                                                                    <Text style={{ color: m.color }}>{m.initial}</Text>
                                                                    {' '}{Math.round(meal[m.key])}g
                                                                </Text>
                                                            ))}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.delete}
                                                    onPress={() => remove(meal)}
                                                    hitSlop={6}
                                                >
                                                    <Ionicons name="trash-outline" size={17} color={Palette.white} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

            <TouchableOpacity style={styles.fab} onPress={() => router.push('/nutrition/log')}>
                <Ionicons name="add" size={26} color={Palette.white} />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        backgroundColor: Palette.background,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },

    strip: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md, backgroundColor: Palette.background },
    stripDay: {
        width: 46, paddingVertical: Spacing.sm, alignItems: 'center', gap: 2,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.borderSlate,
        backgroundColor: Palette.background,
    },
    stripDayOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    stripName: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    stripNum: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    stripTextOn: { color: Palette.primary },
    stripDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

    macroStrip: {
        flexDirection: 'row', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
        backgroundColor: Palette.background,
        borderBottomWidth: 1, borderBottomColor: Palette.border,
    },
    macroCol: { flex: 1 },
    macroText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.text },
    macroTarget: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
    macroTrack: { height: 4, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, overflow: 'hidden', marginTop: Spacing.xs },
    macroFill: { height: '100%', borderRadius: Radius.pill },

    scroll: { paddingBottom: 120 },
    dayHead: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
    dayTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    daySub: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 2 },

    rail: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    railRow: { flexDirection: 'row', gap: Spacing.md },
    railGutter: { width: 62, alignItems: 'center' },
    hourChip: {
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.borderSlate,
        backgroundColor: Palette.background,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
    },
    hourText: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textSecondary },
    railLine: { flex: 1, width: 1, backgroundColor: Palette.border, marginVertical: Spacing.xs, minHeight: Spacing.xl },
    railBody: { flex: 1, paddingBottom: Spacing.md, gap: Spacing.sm },

    mealRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    mealCard: {
        flex: 1, flexDirection: 'row', gap: Spacing.md, alignItems: 'center',
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate, padding: Spacing.md,
    },
    mealIcon: {
        width: 36, height: 36, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface, alignItems: 'center', justifyContent: 'center',
    },
    mealName: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    mealSlot: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    mealMacros: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    mealMacro: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textSecondary },
    delete: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center',
    },

    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, marginTop: Spacing.xxxl, gap: Spacing.sm },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text, marginTop: Spacing.sm },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
    emptyMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, marginTop: Spacing.sm },

    fab: {
        position: 'absolute', right: Spacing.xl, bottom: Spacing.xxxl,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center',
        shadowColor: Palette.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    },
});
