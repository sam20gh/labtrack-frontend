/**
 * Nutrition goal setup.
 *
 * Targets are computed from the profile and the plan's dietary advice, and the person can
 * override the calorie figure. They cannot edit the guidance: it comes from their
 * interpretation, and a tracker whose copy of the advice can be edited here would quietly
 * drift from the advice it exists to enforce. Changing it means changing the plan.
 *
 * `explanation` is shown rather than a bare number. "2,675 kcal" invites suspicion;
 * "estimated from your height, weight and age, adjusted for moderate activity" does not.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getNutritionPlan, saveNutritionPlan, DIETARY_PREFERENCES } from '@/lib/nutrition';
import { PlanGuidanceCard } from '@/components/nutrition/PlanGuidanceCard';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionPlan } from '@/types/api';

export default function NutritionSetupScreen() {
    const router = useRouter();
    const [plan, setPlan] = useState<NutritionPlan | null>(null);
    const [explanation, setExplanation] = useState('');
    const [missingProfile, setMissingProfile] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [calories, setCalories] = useState('');
    const [mealsPerDay, setMealsPerDay] = useState(3);
    const [preferences, setPreferences] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    const load = useCallback(async () => {
        try {
            const data = await getNutritionPlan();
            setPlan(data.plan);
            setExplanation(data.explanation);
            setMissingProfile(data.missingProfile || []);
            if (data.plan) {
                setCalories(String(data.plan.calorieOverride ?? data.plan.targets.calories ?? ''));
                setMealsPerDay(data.plan.mealsPerDay ?? 3);
                setPreferences(data.plan.dietaryPreferences ?? []);
                setNotes(data.plan.notes ?? '');
            }
        } catch (error) {
            Alert.alert('Could not load', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const togglePreference = (id: string) =>
        setPreferences((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

    const save = async () => {
        const value = Number(calories);
        // An empty box means "use the estimate", which is a null override, not a zero.
        const calorieTarget = calories.trim() === '' ? null : value;
        if (calorieTarget !== null && (!Number.isFinite(value) || value < 800 || value > 6000)) {
            Alert.alert('Check that figure', 'A daily target should be between 800 and 6,000 kcal.');
            return;
        }

        setSaving(true);
        try {
            const result = await saveNutritionPlan({
                calorieTarget,
                mealsPerDay,
                dietaryPreferences: preferences,
                notes: notes.trim(),
            });
            setPlan(result.plan);
            setExplanation(result.explanation);
            router.back();
        } catch (error) {
            Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Your nutrition goal</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <PlanGuidanceCard
                        guidance={plan?.guidance || []}
                        emptyHint="Your plan has no dietary advice yet. Your targets will use a balanced split until it does."
                    />

                    {/*
                      Stated up front rather than at save time. Without these the server
                      cannot estimate anything, and finding that out after filling the form
                      is the worst moment to learn it.
                    */}
                    {missingProfile.length > 0 && (
                        <TouchableOpacity style={styles.notice} onPress={() => router.push('/profile')}>
                            <Ionicons name="person-outline" size={18} color={Palette.warning} />
                            <Text style={styles.noticeText}>
                                Add your {missingProfile.join(', ')} to your profile and we can estimate
                                a target for you. Until then, set one below.
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                        </TouchableOpacity>
                    )}

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Daily intake</Text>
                        <View style={styles.calorieRow}>
                            <TouchableOpacity
                                style={styles.stepper}
                                onPress={() => setCalories(String(Math.max(800, (Number(calories) || 2000) - 50)))}
                            >
                                <Ionicons name="remove" size={20} color={Palette.primary} />
                            </TouchableOpacity>
                            <View style={styles.calorieField}>
                                <TextInput
                                    style={styles.calorieInput}
                                    keyboardType="numeric"
                                    value={calories}
                                    onChangeText={setCalories}
                                    placeholder="—"
                                    placeholderTextColor={Palette.textMuted}
                                />
                                <Text style={styles.calorieUnit}>kcal</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.stepper}
                                onPress={() => setCalories(String(Math.min(6000, (Number(calories) || 2000) + 50)))}
                            >
                                <Ionicons name="add" size={20} color={Palette.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.explanation}>{explanation}</Text>
                        {!!plan?.calorieOverride && (
                            <TouchableOpacity onPress={() => setCalories('')}>
                                <Text style={styles.resetLink}>Use the estimate instead</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* The split, so the plan's effect on the day is visible before saving */}
                    {!!plan?.targets && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Your split</Text>
                            <Text style={styles.cardBody}>
                                Shaped by the dietary advice on your plan.
                            </Text>
                            <View style={styles.splitRow}>
                                {(['protein', 'carbs', 'fat'] as const).map((macro) => (
                                    <View key={macro} style={styles.splitCell}>
                                        <Text style={styles.splitValue}>{plan.targets[macro] ?? '—'}g</Text>
                                        <Text style={styles.splitLabel}>{macro}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Meals a day</Text>
                        <View style={styles.chipRow}>
                            {[2, 3, 4, 5].map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[styles.chip, mealsPerDay === n && styles.chipActive]}
                                    onPress={() => setMealsPerDay(n)}
                                >
                                    <Text style={[styles.chipText, mealsPerDay === n && styles.chipTextActive]}>
                                        {n} times
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>How you eat</Text>
                        <Text style={styles.cardBody}>You can select multiple options.</Text>
                        <View style={styles.chipRow}>
                            {DIETARY_PREFERENCES.map((p) => {
                                const active = preferences.includes(p.id);
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={[styles.chip, active && styles.chipActive]}
                                        onPress={() => togglePreference(p.id)}
                                    >
                                        <Ionicons
                                            name={p.icon as any}
                                            size={13}
                                            color={active ? Palette.white : Palette.textSecondary}
                                        />
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Anything else</Text>
                        <Text style={styles.cardBody}>
                            Allergies, foods you avoid, anything a suggestion should never include.
                        </Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Please describe here..."
                            placeholderTextColor={Palette.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                        />
                        {/*
                          Allergies already on the health assessment are shown as read-only:
                          they are carried into every suggestion automatically, and asking
                          someone to retype a severe allergy is how one gets missed.
                        */}
                        {!!plan?.allergies?.length && (
                            <View style={styles.allergyNote}>
                                <Ionicons name="medkit-outline" size={14} color={Palette.textSecondary} />
                                <Text style={styles.allergyText}>
                                    From your health assessment: {plan.allergies.join(', ')}
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.primaryButton} onPress={save} disabled={saving}>
                    {saving
                        ? <ActivityIndicator size="small" color={Palette.white} />
                        : <Text style={styles.primaryButtonText}>Save goal</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xxxl },

    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.warningSurface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    noticeText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Palette.text, lineHeight: 17 },

    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
    },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    cardBody: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        marginTop: 2,
        marginBottom: Spacing.md,
    },

    calorieRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.lg,
    },
    stepper: {
        width: 44,
        height: 44,
        borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calorieField: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    calorieInput: {
        fontFamily: Fonts.bold,
        fontSize: 36,
        color: Palette.text,
        minWidth: 110,
        textAlign: 'center',
    },
    calorieUnit: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary },
    explanation: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 17,
        marginTop: Spacing.lg,
    },
    resetLink: {
        fontFamily: Fonts.medium,
        fontSize: 12,
        color: Palette.primary,
        marginTop: Spacing.sm,
    },

    splitRow: { flexDirection: 'row', gap: Spacing.md },
    splitCell: { flex: 1, alignItems: 'center' },
    splitValue: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    splitLabel: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },
    chipTextActive: { color: Palette.white },

    notesInput: {
        fontFamily: Fonts.regular,
        fontSize: 14,
        color: Palette.text,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.md,
        padding: Spacing.md,
        minHeight: 88,
        textAlignVertical: 'top',
    },
    allergyNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    allergyText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },

    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Palette.borderSlate,
        backgroundColor: Palette.background,
    },
    primaryButton: {
        height: 48,
        borderRadius: Radius.md,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
});
