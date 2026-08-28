/**
 * One logged meal in the day's list.
 *
 * Carries its alignment verdict because that is what makes this a health-plan tracker
 * rather than a food diary — but neutrally. The label says "Off plan", never "Bad choice":
 * someone recording an honest meal is doing the thing the app wants, and a screen that
 * scolds them teaches them to stop recording.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { ALIGNMENT_META, MEAL_TYPE_LABEL } from '@/lib/nutrition';
import type { MealLog } from '@/types/api';

interface Props {
    meal: MealLog;
    onPress?: () => void;
}

const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function MealCard({ meal, onPress }: Props) {
    const alignment = ALIGNMENT_META[meal.analysis?.alignment || 'unassessed'];

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.7}
        >
            {meal.imageUrl ? (
                <Image source={{ uri: meal.imageUrl }} style={styles.thumb} />
            ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="restaurant-outline" size={20} color={Palette.textMuted} />
                </View>
            )}

            <View style={styles.body}>
                <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                        {time(meal.eatenAt)} · {MEAL_TYPE_LABEL[meal.mealType] || 'Meal'}
                        {meal.servings !== 1 ? ` · ${meal.servings} servings` : ''}
                    </Text>
                </View>

                <Text style={styles.name} numberOfLines={2}>{meal.name}</Text>

                <View style={styles.macroRow}>
                    <Text style={styles.macro}>
                        <Text style={styles.macroValue}>{Math.round(meal.calories)}</Text> kcal
                    </Text>
                    <Text style={styles.macro}>
                        <Text style={styles.macroValue}>{Math.round(meal.protein)}g</Text> protein
                    </Text>
                    <Text style={styles.macro}>
                        <Text style={styles.macroValue}>{Math.round(meal.carbs)}g</Text> carbs
                    </Text>
                </View>

                {/* Only shown when there was guidance to judge against */}
                {meal.analysis && meal.analysis.alignment !== 'unassessed' && (
                    <View style={[styles.badge, { backgroundColor: alignment.bg }]}>
                        <Ionicons name={alignment.icon as any} size={12} color={alignment.color} />
                        <Text style={[styles.badgeText, { color: alignment.color }]}>{alignment.label}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.md,
    },
    thumb: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Palette.canvas },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    meta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },
    name: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, marginTop: 1 },
    macroRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    macro: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    macroValue: { fontFamily: Fonts.bold, fontSize: 12, color: Palette.text },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        alignSelf: 'flex-start',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        marginTop: Spacing.sm,
    },
    badgeText: { fontFamily: Fonts.semibold, fontSize: 10 },
});
