/**
 * One AI meal suggestion.
 *
 * **The kit's card is a full-bleed food photograph, and this one is not.** There is no
 * source for a picture of a meal that has not been cooked: every photograph in this feature
 * is one the person took, and dropping stock imagery of someone else's salmon into a health
 * record dresses a suggestion up as evidence. So the tile is a tinted panel carrying the
 * dish, its macros and the one line saying which part of their plan it serves — which is
 * the information the photograph was decorating.
 *
 * The gradient is picked from the meal slot rather than at random, so the same suggestion
 * looks the same on the rail and on its detail sheet, and a rail of six does not shimmer.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { MEAL_TYPE_LABEL } from '@/lib/nutrition';
import type { MealSuggestion, MealType } from '@/types/api';

/** Slot → tile wash. Warm through the day, matching how the kit's photographs read. */
const SLOT_WASH: Record<MealType, [string, string]> = {
    breakfast: ['#FDE68A', '#FCA5A5'],
    lunch: ['#A7F3D0', '#93C5FD'],
    dinner: ['#C4B5FD', '#818CF8'],
    snack: ['#FBCFE8', '#C4B5FD'],
};

const SLOT_ICON: Record<MealType, string> = {
    breakfast: 'sunny-outline',
    lunch: 'partly-sunny-outline',
    dinner: 'moon-outline',
    snack: 'cafe-outline',
};

interface Props {
    suggestion: MealSuggestion;
    onPress?: () => void;
    /** `rail` is the fixed-width horizontal card; `list` fills its parent. */
    variant?: 'rail' | 'list';
}

export function SuggestionCard({ suggestion, onPress, variant = 'rail' }: Props) {
    const slot = suggestion.mealType || 'lunch';

    return (
        <TouchableOpacity
            style={[styles.card, variant === 'rail' ? styles.rail : styles.list]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.85}
        >
            <LinearGradient
                colors={SLOT_WASH[slot]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.wash}
            >
                <View style={styles.slotChip}>
                    <Ionicons name={SLOT_ICON[slot] as any} size={12} color={Palette.text} />
                    <Text style={styles.slotText}>{MEAL_TYPE_LABEL[slot]}</Text>
                </View>

                {suggestion.prepMinutes != null && (
                    <View style={styles.slotChip}>
                        <Ionicons name="time-outline" size={12} color={Palette.text} />
                        <Text style={styles.slotText}>{suggestion.prepMinutes}m</Text>
                    </View>
                )}
            </LinearGradient>

            <View style={styles.body}>
                <Text style={styles.name} numberOfLines={2}>{suggestion.name}</Text>

                {suggestion.why ? (
                    <Text style={styles.why} numberOfLines={variant === 'rail' ? 2 : 3}>
                        {suggestion.why}
                    </Text>
                ) : null}

                <View style={styles.stats}>
                    <Stat icon="flame-outline" value={`${suggestion.calories}kcal`} />
                    <Stat icon="barbell-outline" value={`${suggestion.protein}g`} />
                    <Stat icon="leaf-outline" value={`${suggestion.carbs}g`} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const Stat = ({ icon, value }: { icon: string; value: string }) => (
    <View style={styles.stat}>
        <Ionicons name={icon as any} size={13} color={Palette.textSecondary} />
        <Text style={styles.statText}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        overflow: 'hidden',
    },
    rail: { width: 250 },
    list: { width: '100%' },
    wash: {
        height: 96,
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    slotChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    slotText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.text },

    body: { padding: Spacing.md, gap: Spacing.xs },
    name: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    why: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, lineHeight: 17 },
    stats: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.text },
});
