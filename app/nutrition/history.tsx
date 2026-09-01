/**
 * Nutrition History — every meal on record, newest first, grouped by day.
 *
 * This is the kit's "Nutrition History" frame: a search field, a filter sheet, and day
 * headings over meal rows. The charts that used to live here have moved to
 * `insight.tsx`, matching both the design's two separate frames and the split
 * `medications/{schedule,insight}.tsx` already makes.
 *
 * Search and filtering are done on the client over the window that was fetched, not on the
 * server. The window is bounded (90 days at most) and a person's meals inside it are a few
 * hundred rows; a search endpoint would be a second query path over the same data that
 * could disagree with this one about what a day contains.
 *
 * Days with nothing logged do not appear. A heading with no rows under it says someone ate
 * nothing that day, which is a claim about them rather than about the record.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
    TextInput, Modal, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDay, getCalendar, today, addDays, MEAL_TYPE_LABEL } from '@/lib/nutrition';
import { MacroChips } from '@/components/nutrition/MacroChips';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MealLog, MealType, NutritionTargets } from '@/types/api';

/** How far back the list reaches. The filter sheet narrows within this, never beyond it. */
const RANGES = [
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
] as const;

const SLOTS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const SLOT_ICON: Record<MealType, string> = {
    breakfast: 'sunny-outline',
    lunch: 'partly-sunny-outline',
    dinner: 'moon-outline',
    snack: 'cafe-outline',
};

const dayHeading = (day: string) => {
    if (day === today()) return 'Today';
    if (day === addDays(today(), -1)) return 'Yesterday';
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
};

export default function NutritionHistoryScreen() {
    const router = useRouter();
    const [range, setRange] = useState<number>(30);
    const [meals, setMeals] = useState<MealLog[]>([]);
    const [targets, setTargets] = useState<NutritionTargets | null>(null);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [slots, setSlots] = useState<MealType[]>([]);
    const [maxCalories, setMaxCalories] = useState<number | null>(null);

    /**
     * The calendar names the days that have meals on them, and each of those is then
     * fetched. Fetching a fixed 90 calendar days would be 90 requests for someone who logged
     * on four of them; this is one request plus one per day that actually has something.
     */
    const load = useCallback(async () => {
        try {
            const calendar = await getCalendar(addDays(today(), -(range - 1)), today());
            const days = calendar.days.slice().sort((a, b) => b.day.localeCompare(a.day));

            const loaded = await Promise.all(days.map((d) => getDay(d.day)));
            setMeals(loaded.flatMap((d) => d.meals));

            const first = loaded.find((d) => d.targets && 'calories' in d.targets);
            setTargets(first ? (first.targets as NutritionTargets) : null);
        } catch (error) {
            Alert.alert('Could not load your history', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [range]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return meals.filter((m) => {
            if (slots.length && !slots.includes(m.mealType)) return false;
            if (maxCalories != null && m.calories > maxCalories) return false;
            if (!q) return true;
            // The dish and its components — someone searching "egg" means the ingredient
            // as often as the dish name
            return m.name.toLowerCase().includes(q)
                || (m.items || []).some((i) => i.name.toLowerCase().includes(q));
        });
    }, [meals, query, slots, maxCalories]);

    /** Newest day first, and newest meal first inside each day. */
    const grouped = useMemo(() => {
        const map = new Map<string, MealLog[]>();
        for (const m of filtered) {
            if (!map.has(m.day)) map.set(m.day, []);
            map.get(m.day)!.push(m);
        }
        return [...map.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, rows]) => ({
                day,
                meals: rows.sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)),
                calories: Math.round(rows.reduce((n, m) => n + m.calories, 0)),
            }));
    }, [filtered]);

    const activeFilters = slots.length + (maxCalories != null ? 1 : 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/nutrition/insight')} hitSlop={8}>
                    <Ionicons name="stats-chart-outline" size={20} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.titleBlock}>
                <Text style={styles.title}>Nutrition History</Text>
                <Text style={styles.subtitle}>Every meal you have logged, day by day.</Text>
            </View>

            <View style={styles.searchRow}>
                <View style={styles.search}>
                    <Ionicons name="search-outline" size={17} color={Palette.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search nutrition history..."
                        placeholderTextColor={Palette.textMuted}
                        value={query}
                        onChangeText={setQuery}
                        autoCorrect={false}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                            <Ionicons name="close-circle" size={17} color={Palette.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.filterButton, activeFilters > 0 && styles.filterButtonOn]}
                    onPress={() => setFilterOpen(true)}
                >
                    <Ionicons
                        name="options-outline"
                        size={19}
                        color={activeFilters > 0 ? Palette.primary : Palette.textSecondary}
                    />
                    {activeFilters > 0 && (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl * 2 }} color={Palette.primary} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.count}>
                        {filtered.length === meals.length
                            ? `All meals · last ${range} days`
                            : `${filtered.length} of ${meals.length} meals`}
                    </Text>

                    {grouped.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons
                                name={meals.length ? 'search-outline' : 'restaurant-outline'}
                                size={30}
                                color={Palette.textMuted}
                            />
                            <Text style={styles.emptyTitle}>
                                {meals.length ? 'Nothing matches that' : 'No meals in this window'}
                            </Text>
                            <Text style={styles.emptyBody}>
                                {meals.length
                                    ? 'Try a different word, or clear the filters.'
                                    : 'Meals you log appear here, grouped by the day you ate them.'}
                            </Text>
                        </View>
                    ) : grouped.map((group) => (
                        <View key={group.day} style={styles.group}>
                            <View style={styles.groupHead}>
                                <Text style={styles.groupTitle}>{dayHeading(group.day)}</Text>
                                <Text style={styles.groupTotal}>{group.calories.toLocaleString()} kcal</Text>
                            </View>

                            {group.meals.map((meal) => (
                                <TouchableOpacity
                                    key={meal._id}
                                    style={styles.row}
                                    activeOpacity={0.8}
                                    onPress={() => router.push(`/nutrition/${meal._id}`)}
                                >
                                    <View style={styles.rowHead}>
                                        <View style={styles.rowIcon}>
                                            <Ionicons
                                                name={SLOT_ICON[meal.mealType] as any}
                                                size={18}
                                                color={Palette.primary}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.rowName} numberOfLines={1}>{meal.name}</Text>
                                            <Text style={styles.rowMeta}>
                                                {MEAL_TYPE_LABEL[meal.mealType]} at{' '}
                                                {new Date(meal.eatenAt).toLocaleTimeString(undefined, {
                                                    hour: 'numeric', minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                        <View style={styles.rowCalories}>
                                            <Text style={styles.rowCaloriesValue}>{Math.round(meal.calories)}</Text>
                                            <Ionicons name="flame-outline" size={15} color={Palette.textMuted} />
                                        </View>
                                    </View>

                                    <View style={styles.rowDivider} />
                                    {/* Bars only when the plan has targets to divide by — see MacroChips */}
                                    <MacroChips values={meal} targets={targets} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            )}

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                range={range}
                setRange={(d) => { setRange(d); setLoading(true); }}
                slots={slots}
                setSlots={setSlots}
                maxCalories={maxCalories}
                setMaxCalories={setMaxCalories}
                matches={filtered.length}
            />
        </SafeAreaView>
    );
}

/**
 * The kit's "Filter Nutrition" sheet.
 *
 * The kit draws two-handle range sliders for calories, fat and protein. Those are replaced
 * with a single calorie ceiling and meal-type chips: a three-macro range filter is six
 * numbers to set before anyone sees a result, and the search field already answers the
 * question people actually bring here — "when did I last eat that". The Apply button counts
 * the matches so the effect is visible before the sheet closes.
 */
function FilterSheet({
    open, onClose, range, setRange, slots, setSlots, maxCalories, setMaxCalories, matches,
}: {
    open: boolean;
    onClose: () => void;
    range: number;
    setRange: (d: number) => void;
    slots: MealType[];
    setSlots: (s: MealType[]) => void;
    maxCalories: number | null;
    setMaxCalories: (n: number | null) => void;
    matches: number;
}) {
    const toggleSlot = (slot: MealType) =>
        setSlots(slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot]);

    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHead}>
                    <Text style={styles.sheetTitle}>Filter Nutrition</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <Ionicons name="close" size={22} color={Palette.text} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Date</Text>
                <View style={styles.chipRow}>
                    {RANGES.map((r) => (
                        <TouchableOpacity
                            key={r.days}
                            style={[styles.chip, range === r.days && styles.chipOn]}
                            onPress={() => setRange(r.days)}
                        >
                            <Text style={[styles.chipText, range === r.days && styles.chipTextOn]}>
                                {r.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.fieldLabel}>Meal type</Text>
                <View style={styles.chipRow}>
                    {SLOTS.map((slot) => (
                        <TouchableOpacity
                            key={slot}
                            style={[styles.chip, slots.includes(slot) && styles.chipOn]}
                            onPress={() => toggleSlot(slot)}
                        >
                            <Ionicons
                                name={SLOT_ICON[slot] as any}
                                size={14}
                                color={slots.includes(slot) ? Palette.primary : Palette.textSecondary}
                            />
                            <Text style={[styles.chipText, slots.includes(slot) && styles.chipTextOn]}>
                                {MEAL_TYPE_LABEL[slot]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.fieldLabel}>Calories, at most</Text>
                <View style={styles.chipRow}>
                    {[300, 500, 800, null].map((n) => (
                        <TouchableOpacity
                            key={String(n)}
                            style={[styles.chip, maxCalories === n && styles.chipOn]}
                            onPress={() => setMaxCalories(n)}
                        >
                            <Text style={[styles.chipText, maxCalories === n && styles.chipTextOn]}>
                                {n == null ? 'Any' : `${n} kcal`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.apply} onPress={onClose}>
                    <Text style={styles.applyText}>Show {matches} {matches === 1 ? 'meal' : 'meals'}</Text>
                    <Ionicons name="options-outline" size={17} color={Palette.white} />
                </TouchableOpacity>

                {(slots.length > 0 || maxCalories != null) && (
                    <TouchableOpacity
                        style={styles.clear}
                        onPress={() => { setSlots([]); setMaxCalories(null); }}
                    >
                        <Text style={styles.clearText}>Clear filters</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    titleBlock: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    title: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text },
    subtitle: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: Spacing.xs },

    searchRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    search: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Palette.text },
    filterButton: {
        width: 44, height: 44, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate, backgroundColor: Palette.canvas,
        alignItems: 'center', justifyContent: 'center',
    },
    filterButtonOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    filterBadge: {
        position: 'absolute', top: -4, right: -4,
        minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
        backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center',
    },
    filterBadgeText: { fontFamily: Fonts.bold, fontSize: 9, color: Palette.white },

    scroll: { paddingBottom: Spacing.xxxl * 2 },
    count: {
        fontFamily: Fonts.semibold, fontSize: 13, color: Palette.textSecondary,
        paddingHorizontal: Spacing.lg, marginTop: Spacing.xl,
    },

    group: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
    groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.md },
    groupTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    groupTotal: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },

    row: {
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate,
        padding: Spacing.md, marginBottom: Spacing.md,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowIcon: {
        width: 38, height: 38, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface, alignItems: 'center', justifyContent: 'center',
    },
    rowName: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    rowMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    rowCalories: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    rowCaloriesValue: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.textSecondary },
    rowDivider: { height: 1, backgroundColor: Palette.border, marginVertical: Spacing.md },

    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, marginTop: Spacing.xxxl, gap: Spacing.sm },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text, marginTop: Spacing.sm },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
    sheet: {
        backgroundColor: Palette.background,
        borderTopLeftRadius: Radius.xl * 2, borderTopRightRadius: Radius.xl * 2,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl * 1.5,
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2, backgroundColor: Palette.border,
        alignSelf: 'center', marginBottom: Spacing.lg,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    sheetTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    fieldLabel: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text, marginBottom: Spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    chipOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },
    chipTextOn: { fontFamily: Fonts.semibold, color: Palette.primary },
    apply: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    },
    applyText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    clear: { alignItems: 'center', paddingVertical: Spacing.md },
    clearText: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },
});
