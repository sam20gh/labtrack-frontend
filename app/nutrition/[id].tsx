/**
 * Nutrition Details — one meal.
 *
 * Four departures from the kit's frame, each because the number it draws has no honest
 * source here:
 *
 *   1. **"Score Added +3" is not reproduced.** `labtrackScore` is a weighted snapshot
 *      recomputed from every row the trackers hold, not an event ledger, so there is no
 *      such thing as the points one meal earned. What is shown instead is how this meal
 *      sat against the plan — which is the thing the score is reading anyway — with a
 *      route into the breakdown.
 *   2. **The gallery holds the person's own photographs of meals by this name**, and
 *      nothing else. The server returns them; when there are none the section is absent
 *      rather than filled with stock imagery of somebody else's omelette.
 *   3. **"Percent of daily goals" is drawn only for macros the plan actually targets.** A
 *      bar against a target nobody set is a number with no denominator.
 *   4. The kit prints a fixed "Vitamin B / Fiber" pair in Key Stats. The analyser estimates
 *      fibre and sodium and nothing else, so only what it returned is listed.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
    Image, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMeal, deleteMeal, ALIGNMENT_META, MEAL_TYPE_LABEL, MACRO_META } from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionMealDetail } from '@/types/api';

const dateLine = (iso: string) => {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
};

export default function NutritionDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [data, setData] = useState<NutritionMealDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [photo, setPhoto] = useState(0);

    const load = useCallback(async () => {
        try {
            setData(await getMeal(String(id)));
        } catch (error) {
            Alert.alert('Could not load this meal', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const remove = () => {
        Alert.alert('Delete this meal?', 'It will be removed from that day\'s totals.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMeal(String(id));
                        router.back();
                    } catch (error) {
                        Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
                    }
                },
            },
        ]);
    };

    if (loading || !data) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 120 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const { meal, targets, percentOfDay, dayContext, photos, guidance } = data;
    const when = dateLine(meal.eatenAt);
    const alignment = ALIGNMENT_META[meal.analysis?.alignment || 'unassessed'];

    // Only what the analyser actually estimated. A blank "Vitamin B" row is a claim.
    const keyStats = [
        { initial: 'P', label: 'Protein', value: Math.round(meal.protein), unit: 'gram' },
        { initial: 'C', label: 'Carbohydrate', value: Math.round(meal.carbs), unit: 'gram' },
        { initial: 'F', label: 'Fat', value: Math.round(meal.fat), unit: 'gram' },
        ...(meal.fibre != null ? [{ initial: 'B', label: 'Fibre', value: Math.round(meal.fibre), unit: 'gram' }] : []),
        ...(meal.sodium != null ? [{ initial: 'S', label: 'Sodium', value: Math.round(meal.sodium), unit: 'mg' }] : []),
    ];

    // The stacked bar in the kit's Breakdown card: energy share, not gram share. 30g of fat
    // and 30g of carbohydrate are not the same slice of a day, and drawing them equal is
    // the most common way a macro bar lies.
    const energy = {
        protein: meal.protein * 4,
        carbs: meal.carbs * 4,
        fat: meal.fat * 9,
    };
    const energyTotal = energy.protein + energy.carbs + energy.fat || 1;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Details</Text>
                <TouchableOpacity onPress={remove} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={Palette.danger} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.hero}>
                    {meal.imageUrl ? (
                        <Image source={{ uri: meal.imageUrl }} style={styles.heroImage} />
                    ) : (
                        <View style={styles.heroIcon}>
                            <Ionicons name="restaurant-outline" size={30} color={Palette.primary} />
                        </View>
                    )}

                    <Text style={styles.calories}>{Math.round(meal.calories).toLocaleString()}kcal</Text>
                    <Text style={styles.name}>{meal.name}</Text>

                    <View style={styles.whenRow}>
                        <Ionicons name="calendar-outline" size={13} color={Palette.textMuted} />
                        <Text style={styles.when}>{when.date}</Text>
                        <Text style={styles.dot}>·</Text>
                        <Ionicons name="time-outline" size={13} color={Palette.textMuted} />
                        <Text style={styles.when}>{when.time}</Text>
                    </View>

                    <View style={[styles.slotBadge, { backgroundColor: alignment.bg }]}>
                        <Ionicons name={alignment.icon as any} size={13} color={alignment.color} />
                        <Text style={[styles.slotBadgeText, { color: alignment.color }]}>
                            {MEAL_TYPE_LABEL[meal.mealType]} · {alignment.label}
                        </Text>
                    </View>

                    {/* The analyser's own words, never paraphrased into a verdict */}
                    {meal.analysis?.rationale ? (
                        <Text style={styles.rationale}>{meal.analysis.rationale}</Text>
                    ) : null}
                </View>

                <Section title="Key Stats">
                    <View style={styles.card}>
                        {keyStats.map((s, i) => (
                            <View key={s.label} style={[styles.statRow, i > 0 && styles.divided]}>
                                <View style={styles.statLabel}>
                                    <View style={styles.statInitial}>
                                        <Text style={styles.statInitialText}>{s.initial}</Text>
                                    </View>
                                    <Text style={styles.statName}>{s.label}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.statValue}>{s.value}</Text>
                                    <Text style={styles.statUnit}>{s.unit}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </Section>

                {/* Their own photographs of this dish. Absent when there are none. */}
                {photos.length > 0 && (
                    <Section title="Your photos of this meal">
                        <View style={styles.card}>
                            <ScrollView
                                horizontal
                                pagingEnabled={false}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: Spacing.sm }}
                                onScroll={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / 96))}
                                scrollEventThrottle={64}
                            >
                                {photos.map((p) => (
                                    <Image key={p._id} source={{ uri: p.imageUrl }} style={styles.galleryTile} />
                                ))}
                            </ScrollView>
                            {photos.length > 1 && (
                                <View style={styles.dots}>
                                    {photos.map((p, i) => (
                                        <View key={p._id} style={[styles.pageDot, i === photo && styles.pageDotOn]} />
                                    ))}
                                </View>
                            )}
                        </View>
                    </Section>
                )}

                <Section title="Breakdown">
                    <View style={styles.card}>
                        <Text style={styles.breakdownTitle}>
                            {meal.analysis?.alignment === 'unassessed' || !meal.analysis
                                ? 'Logged'
                                : alignment.label}
                        </Text>
                        <Text style={styles.breakdownBody}>
                            {guidance.length
                                ? `Judged against ${guidance.length === 1 ? 'this directive' : 'these directives'} on your health plan.`
                                : 'Your plan has no dietary advice on it yet, so this meal was recorded without being judged against anything.'}
                        </Text>

                        {/* Energy share, not gram share — see above */}
                        <View style={styles.stack}>
                            {MACRO_META.map((m) => {
                                const share = energy[m.key] / energyTotal;
                                if (share <= 0) return null;
                                return (
                                    <View
                                        key={m.key}
                                        style={{ flex: share, backgroundColor: m.color, height: 44 }}
                                    />
                                );
                            })}
                        </View>

                        <Text style={styles.stackCaption}>
                            {Math.round(meal.calories).toLocaleString()} kcal, by where the energy came from
                        </Text>

                        {MACRO_META.map((m) => (
                            <View key={m.key} style={styles.legendRow}>
                                <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                                <Text style={styles.legendLabel}>{m.label}</Text>
                                <Text style={styles.legendValue}>
                                    {Math.round(meal[m.key])}g
                                    <Text style={styles.legendPct}>
                                        {'  '}{Math.round((energy[m.key] / energyTotal) * 100)}%
                                    </Text>
                                </Text>
                            </View>
                        ))}
                    </View>
                </Section>

                {/* Only macros the plan actually targets */}
                {targets && MACRO_META.some((m) => percentOfDay[m.key] != null) && (
                    <Section title="Percent of your daily goals">
                        <View style={styles.card}>
                            {(['calories', ...MACRO_META.map((m) => m.key)] as const).map((key) => {
                                const pct = percentOfDay[key];
                                if (pct == null) return null;
                                const colour = key === 'calories'
                                    ? Palette.primary
                                    : MACRO_META.find((m) => m.key === key)!.color;
                                return (
                                    <View key={key} style={styles.goalRow}>
                                        <View style={styles.goalHead}>
                                            <Text style={styles.goalLabel}>
                                                {key === 'calories' ? 'Calories' : MACRO_META.find((m) => m.key === key)!.label}
                                            </Text>
                                            <Text style={styles.goalPct}>{pct}%</Text>
                                        </View>
                                        <View style={styles.goalTrack}>
                                            <View style={[
                                                styles.goalFill,
                                                { width: `${Math.min(100, pct)}%`, backgroundColor: colour },
                                            ]} />
                                        </View>
                                        <Text style={styles.goalMeta}>
                                            {Math.round(meal[key === 'calories' ? 'calories' : key])}
                                            {key === 'calories' ? ' kcal' : 'g'} of {Math.round(targets[key]!)}
                                            {key === 'calories' ? ' kcal' : 'g'} for the day
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </Section>
                )}

                {/* What else was on that day. A big dinner reads differently after a skipped lunch. */}
                <Section title="That day">
                    <TouchableOpacity
                        style={styles.card}
                        activeOpacity={0.75}
                        onPress={() => router.push('/nutrition/schedule')}
                    >
                        <View style={styles.dayRow}>
                            <View>
                                <Text style={styles.dayValue}>
                                    {Math.round(dayContext.totals.calories).toLocaleString()}
                                </Text>
                                <Text style={styles.dayLabel}>kcal across {dayContext.mealCount} meals</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.dayValue}>
                                    {Math.round((meal.calories / (dayContext.totals.calories || 1)) * 100)}%
                                </Text>
                                <Text style={styles.dayLabel}>of that came from this meal</Text>
                            </View>
                        </View>
                        <View style={styles.linkRow}>
                            <Text style={styles.link}>See the whole day</Text>
                            <Ionicons name="chevron-forward" size={15} color={Palette.primary} />
                        </View>
                    </TouchableOpacity>
                </Section>

                {/* The directives this meal was actually judged against, worded as the plan worded them */}
                {guidance.length > 0 && (
                    <Section title="What your plan asks for">
                        {guidance.map((g) => (
                            <View key={g.key} style={[styles.card, { marginBottom: Spacing.sm }]}>
                                {g.label ? <Text style={styles.guidanceLabel}>{g.label}</Text> : null}
                                <Text style={styles.guidanceDirective}>{g.directive}</Text>
                                {g.rationale ? <Text style={styles.guidanceWhy}>{g.rationale}</Text> : null}
                            </View>
                        ))}
                    </Section>
                )}

                {/* The kit's swap card. Only drawn when the analyser proposed one. */}
                {meal.analysis?.swap ? (
                    <Section title="A swap for next time">
                        <View style={[styles.card, styles.swapCard]}>
                            <Text style={styles.swapName}>{meal.analysis.swap.name}</Text>
                            <Text style={styles.swapWhy}>{meal.analysis.swap.why}</Text>
                            <Text style={styles.swapMacros}>
                                {Math.round(meal.analysis.swap.calories)} kcal ·{' '}
                                {Math.round(meal.analysis.swap.protein)}g protein ·{' '}
                                {Math.round(meal.analysis.swap.carbs)}g carbs
                            </Text>
                        </View>
                    </Section>
                ) : null}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.primary}
                        onPress={() => router.push('/score')}
                    >
                        <Text style={styles.primaryText}>See how this feeds your score</Text>
                        <Ionicons name="arrow-forward" size={17} color={Palette.white} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondary}
                        onPress={() => router.push({
                            pathname: '/(tabs)/assistant',
                            params: { prompt: `I logged "${meal.name}" — ${Math.round(meal.calories)} kcal. What should I know about it?` },
                        })}
                    >
                        <Text style={styles.secondaryText}>Ask the assistant</Text>
                        <Ionicons name="chatbubble-ellipses-outline" size={17} color={Palette.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.tertiary}
                        onPress={() => Share.share({
                            message: `${meal.name} — ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)}g protein, ${Math.round(meal.carbs)}g carbs, ${Math.round(meal.fat)}g fat.`,
                        })}
                    >
                        <Ionicons name="share-social-outline" size={16} color={Palette.primary} />
                        <Text style={styles.tertiaryText}>Share</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    scroll: { paddingBottom: Spacing.xxxl * 2 },

    hero: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    heroImage: { width: 120, height: 120, borderRadius: Radius.xl, marginBottom: Spacing.lg },
    heroIcon: {
        width: 64, height: 64, borderRadius: Radius.xl,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    calories: { fontFamily: Fonts.bold, fontSize: 34, color: Palette.text },
    name: { fontFamily: Fonts.medium, fontSize: 17, color: Palette.text, marginTop: Spacing.xs, textAlign: 'center' },
    whenRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
    when: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    dot: { color: Palette.textMuted, marginHorizontal: Spacing.xs },
    slotBadge: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
        borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4,
        marginTop: Spacing.md,
    },
    slotBadgeText: { fontFamily: Fonts.semibold, fontSize: 12 },
    rationale: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 20, marginTop: Spacing.md,
    },

    section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text, marginBottom: Spacing.md },
    card: {
        backgroundColor: Palette.canvas,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
    },

    statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
    divided: { borderTopWidth: 1, borderTopColor: Palette.border },
    statLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    statInitial: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: Palette.borderStrong,
        alignItems: 'center', justifyContent: 'center',
    },
    statInitialText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.textSecondary },
    statName: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    statValue: { fontFamily: Fonts.bold, fontSize: 20, color: Palette.text },
    statUnit: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },

    galleryTile: { width: 88, height: 88, borderRadius: Radius.md, backgroundColor: Palette.borderLight },
    dots: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center', marginTop: Spacing.md },
    pageDot: { width: 14, height: 5, borderRadius: 3, backgroundColor: Palette.border },
    pageDotOn: { backgroundColor: Palette.primary },

    breakdownTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    breakdownBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 19, marginTop: Spacing.xs },
    stack: { flexDirection: 'row', borderRadius: Radius.sm, overflow: 'hidden', marginTop: Spacing.lg },
    stackCaption: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.sm },
    legendRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Palette.border, marginTop: Spacing.sm,
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: Palette.text },
    legendValue: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
    legendPct: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },

    goalRow: { marginBottom: Spacing.lg },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    goalLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.text },
    goalPct: { fontFamily: Fonts.bold, fontSize: 13, color: Palette.text },
    goalTrack: { height: 8, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    goalFill: { height: '100%', borderRadius: Radius.pill },
    goalMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.xs },

    dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayValue: { fontFamily: Fonts.bold, fontSize: 20, color: Palette.text },
    dayLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary, maxWidth: 130 },
    linkRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
        marginTop: Spacing.lg, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.border,
    },
    link: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    guidanceLabel: { fontFamily: Fonts.bold, fontSize: 11, color: Palette.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    guidanceDirective: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, marginTop: Spacing.xs, lineHeight: 20 },
    guidanceWhy: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: Spacing.xs, lineHeight: 18 },

    swapCard: { backgroundColor: Palette.primarySurface, borderColor: Palette.primaryLight },
    swapName: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    swapWhy: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: Spacing.xs, lineHeight: 19 },
    swapMacros: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.primaryDark, marginTop: Spacing.sm },

    actions: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xxl, gap: Spacing.md },
    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    },
    primaryText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    secondary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    },
    secondaryText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.primary },
    tertiary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
    tertiaryText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },
});
