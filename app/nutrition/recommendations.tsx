/**
 * AI Recommendations — meals for the gap that is actually left today.
 *
 * Three things this screen is careful about, all of them because a suggestion is an
 * instruction someone may act on rather than a description of something that happened:
 *
 *   1. **Everything here has already passed the server's allergen and preference screen**
 *      (`utils/nutritionSafety.js`), which drops rather than flags. The ingredient list is
 *      still shown in full on the detail sheet, because a person checking for themselves is
 *      not a redundancy.
 *   2. **When the set is not grounded in the person's plan, the screen says so.** A
 *      `grounded: false` set is ordinary balanced-eating advice; letting it borrow the
 *      plan's authority is the same mistake as rendering `alignment: 'unassessed'` as 0%.
 *   3. **Nothing is logged from here without confirmation.** "Log this" fills the review
 *      screen; the same checkpoint the photo analyser puts between an estimate and the
 *      record.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
    Modal, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRecommendations, logMeal, mealFromSuggestion, MEAL_TYPE_LABEL, MACRO_META } from '@/lib/nutrition';
import { SuggestionCard } from '@/components/nutrition/SuggestionCard';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionRecommendations, MealSuggestion } from '@/types/api';

export default function RecommendationsScreen() {
    const router = useRouter();
    const [data, setData] = useState<NutritionRecommendations | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [open, setOpen] = useState<MealSuggestion | null>(null);
    const [logging, setLogging] = useState(false);

    const load = useCallback(async (refresh = false) => {
        try {
            setData(await getRecommendations({ refresh }));
        } catch (error) {
            Alert.alert('Could not load suggestions', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const log = async (suggestion: MealSuggestion) => {
        setLogging(true);
        try {
            await logMeal(mealFromSuggestion(suggestion));
            setOpen(null);
            router.replace('/nutrition');
        } catch (error) {
            Alert.alert('Could not log that', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLogging(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Recommendations</Text>
                <TouchableOpacity
                    onPress={() => { setRefreshing(true); load(true); }}
                    hitSlop={8}
                    disabled={refreshing || loading}
                >
                    {refreshing
                        ? <ActivityIndicator size="small" color={Palette.primary} />
                        : <Ionicons name="refresh-outline" size={20} color={Palette.text} />}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={Palette.primary} />
                    <Text style={styles.loadingText}>Reading your plan and today&apos;s meals…</Text>
                </View>
            ) : !data?.available ? (
                /*
                  Not an error card. The rail is unavailable, the dashboard behind it is
                  working, and saying which is which is the whole difference.
                */
                <View style={styles.empty}>
                    <Ionicons name="sparkles-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Suggestions are unavailable</Text>
                    <Text style={styles.emptyBody}>
                        {data?.reason || 'Please try again later.'} Everything else in the tracker
                        works as usual.
                    </Text>
                </View>
            ) : data.suggestions.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="restaurant-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Nothing to suggest right now</Text>
                    <Text style={styles.emptyBody}>
                        Nothing came back that fits what you have told us you cannot eat.
                        Ask again later, or log a meal and the suggestions will follow the day.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {data.headline ? <Text style={styles.headline}>{data.headline}</Text> : null}

                    {/*
                      The provenance line. `grounded` is the difference between "your plan
                      asked for this" and "this is ordinary good advice", and conflating the
                      two is what a tracker built on a health plan must never do.
                    */}
                    <View style={[styles.basis, !data.grounded && styles.basisGeneral]}>
                        <Ionicons
                            name={data.grounded ? 'shield-checkmark-outline' : 'information-circle-outline'}
                            size={16}
                            color={data.grounded ? Palette.primary : Palette.textSecondary}
                        />
                        <Text style={[styles.basisText, !data.grounded && styles.basisTextGeneral]}>
                            {data.grounded
                                ? 'Built from the dietary advice on your health plan, what you have eaten today, and what you have told us you cannot eat.'
                                : 'Your plan has no dietary advice on it yet, so these are general suggestions rather than your plan’s. They still respect your allergies and preferences.'}
                        </Text>
                    </View>

                    {data.suggestions.map((s, i) => (
                        <View key={`${s.name}-${i}`} style={{ marginBottom: Spacing.md }}>
                            <SuggestionCard suggestion={s} variant="list" onPress={() => setOpen(s)} />
                        </View>
                    ))}

                    <TouchableOpacity style={styles.footer} onPress={() => router.push('/nutrition/setup')}>
                        <Ionicons name="options-outline" size={16} color={Palette.primary} />
                        <Text style={styles.footerText}>Change your preferences and allergies</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* The detail sheet: ingredients in full, then the confirm step */}
            <Modal visible={open != null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(null)} />
                {open && (
                    <View style={styles.sheet}>
                        <View style={styles.sheetHandle} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.sheetSlot}>{MEAL_TYPE_LABEL[open.mealType]}</Text>
                            <Text style={styles.sheetTitle}>{open.name}</Text>
                            {open.why ? <Text style={styles.sheetWhy}>{open.why}</Text> : null}

                            <View style={styles.macroRow}>
                                <SheetStat label="kcal" value={open.calories} />
                                {MACRO_META.map((m) => (
                                    <SheetStat key={m.key} label={m.label} value={open[m.key]} unit="g" colour={m.color} />
                                ))}
                            </View>

                            {open.tags.length > 0 && (
                                <View style={styles.tagRow}>
                                    {open.tags.map((t) => (
                                        <View key={t} style={styles.tag}>
                                            <Text style={styles.tagText}>{t}</Text>
                                        </View>
                                    ))}
                                    {open.prepMinutes != null && (
                                        <View style={styles.tag}>
                                            <Text style={styles.tagText}>{open.prepMinutes} min</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/*
                              Listed in full and never truncated. The server already dropped
                              anything containing a declared allergen; this is so the person
                              can check for themselves, which is the point at which a filter
                              becomes trustworthy rather than merely present.
                            */}
                            <Text style={styles.sheetSection}>What is in it</Text>
                            <View style={styles.ingredients}>
                                {open.ingredients.map((ing) => (
                                    <View key={ing} style={styles.ingredient}>
                                        <View style={styles.ingredientDot} />
                                        <Text style={styles.ingredientText}>{ing}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.disclaimer}>
                                Estimated figures for one serving of the dish as described. Cook it
                                differently and the numbers move — log what you actually ate rather
                                than these.
                            </Text>

                            <TouchableOpacity
                                style={styles.primary}
                                onPress={() => log(open)}
                                disabled={logging}
                            >
                                {logging
                                    ? <ActivityIndicator size="small" color={Palette.white} />
                                    : (
                                        <>
                                            <Text style={styles.primaryText}>Log this as eaten</Text>
                                            <Ionicons name="add" size={18} color={Palette.white} />
                                        </>
                                    )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondary}
                                onPress={() => {
                                    setOpen(null);
                                    router.push({
                                        pathname: '/(tabs)/assistant',
                                        params: { prompt: `How would I make "${open.name}"? It was suggested for me.` },
                                    });
                                }}
                            >
                                <Text style={styles.secondaryText}>Ask the assistant how to make it</Text>
                                <Ionicons name="chatbubble-ellipses-outline" size={17} color={Palette.primary} />
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}

const SheetStat = ({ label, value, unit = '', colour }: {
    label: string; value: number; unit?: string; colour?: string;
}) => (
    <View style={styles.sheetStat}>
        <Text style={[styles.sheetStatValue, colour ? { color: colour } : null]}>
            {Math.round(value)}{unit}
        </Text>
        <Text style={styles.sheetStatLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },

    loading: { alignItems: 'center', marginTop: Spacing.xxxl * 3, gap: Spacing.md },
    loadingText: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary },

    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    headline: { fontFamily: Fonts.bold, fontSize: 19, color: Palette.text, lineHeight: 27, marginBottom: Spacing.lg },

    basis: {
        flexDirection: 'row', gap: Spacing.sm,
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.xl,
    },
    basisGeneral: { backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.borderSlate },
    basisText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Palette.primaryDark, lineHeight: 18 },
    basisTextGeneral: { color: Palette.textSecondary },

    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, marginTop: Spacing.sm,
    },
    footerText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, marginTop: Spacing.xxxl * 2, gap: Spacing.md },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
    sheet: {
        maxHeight: '86%',
        backgroundColor: Palette.background,
        borderTopLeftRadius: Radius.xl * 2, borderTopRightRadius: Radius.xl * 2,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl,
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2, backgroundColor: Palette.border,
        alignSelf: 'center', marginBottom: Spacing.lg,
    },
    sheetSlot: {
        fontFamily: Fonts.bold, fontSize: 11, color: Palette.primary,
        textTransform: 'uppercase', letterSpacing: 0.6,
    },
    sheetTitle: { fontFamily: Fonts.bold, fontSize: 21, color: Palette.text, marginTop: Spacing.xs },
    sheetWhy: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginTop: Spacing.sm },

    macroRow: {
        flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl,
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate, padding: Spacing.lg,
    },
    sheetStat: { flex: 1, alignItems: 'center' },
    sheetStatValue: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    sheetStatLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
    tag: {
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.md, paddingVertical: 4,
    },
    tagText: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textSecondary },

    sheetSection: { fontFamily: Fonts.bold, fontSize: 14, color: Palette.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    ingredients: { gap: Spacing.sm },
    ingredient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.primary },
    ingredientText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Palette.text },

    disclaimer: {
        fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted,
        lineHeight: 17, marginTop: Spacing.xl,
    },

    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.lg,
        paddingVertical: Spacing.lg, marginTop: Spacing.lg,
    },
    primaryText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    secondary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg,
        paddingVertical: Spacing.lg, marginTop: Spacing.md,
    },
    secondaryText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },
});
