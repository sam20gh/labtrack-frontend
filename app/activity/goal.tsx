/**
 * Edit Activity Goal — frames 45 to 47.
 *
 * The design draws four free-entry fields. What is actually on screen here is the *plan's*
 * numbers with the option to override them, because that is the difference between this and
 * a generic goal app: the targets came from the exercise advice on the person's results,
 * and the screen has to say so.
 *
 * Clearing a field returns that one target to the plan-derived figure. That is why each row
 * carries a "Use plan's N" affordance rather than a bare input — without it, someone who
 * typed a number once could never get back to what their plan says, and there would be no
 * way to tell an override from a coincidence.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { PlanGuidanceCard } from '@/components/metric/PlanGuidanceCard';
import { getPlan, savePlan, type ActivityPlan } from '@/lib/activity';
import { ApiError } from '@/lib/api';

type Field = 'sessions' | 'minutes' | 'distanceKm' | 'calories';

const FIELDS: { key: Field; label: string; unit: string; hint: string }[] = [
    { key: 'sessions', label: 'Sessions a week', unit: '', hint: 'How many times you want to move' },
    { key: 'minutes', label: 'Active minutes a week', unit: 'min', hint: 'Total across all sessions' },
    { key: 'distanceKm', label: 'Distance a week', unit: 'km', hint: 'Optional' },
    { key: 'calories', label: 'Energy a week', unit: 'kcal', hint: 'Optional' },
];

export default function ActivityGoalScreen() {
    const router = useRouter();

    const [plan, setPlan] = useState<ActivityPlan | null>(null);
    const [explanation, setExplanation] = useState('');
    const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const result = await getPlan();
            setPlan(result.plan);
            setExplanation(result.explanation);
            setDraft({
                sessions: result.plan.overrides?.sessions?.toString() ?? '',
                minutes: result.plan.overrides?.minutes?.toString() ?? '',
                distanceKm: result.plan.overrides?.distanceKm?.toString() ?? '',
                calories: result.plan.overrides?.calories?.toString() ?? '',
            });
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your goal.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const overrides: Partial<Record<Field, number | null>> = {};
            for (const { key } of FIELDS) {
                const raw = (draft[key] ?? '').trim();
                // Empty clears the override, which is how someone returns a target to the
                // figure their plan derived.
                if (!raw) { overrides[key] = null; continue; }
                const value = parseFloat(raw);
                overrides[key] = Number.isFinite(value) && value > 0 ? value : null;
            }

            const result = await savePlan({ overrides });
            setPlan(result.plan);
            setExplanation(result.explanation);
            router.back();
        } catch (err) {
            Alert.alert(
                'Not saved',
                err instanceof Error ? err.message : 'Could not save your goal. Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (error || !plan) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Text style={styles.error}>{error || 'Goal not found.'}</Text>
                    <Pressable onPress={load} accessibilityRole="button">
                        <Text style={styles.link}>Try again</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Weekly goal</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Edit your activity goal</Text>

                <View style={{ marginTop: Spacing.lg }}>
                    <PlanGuidanceCard guidance={plan.guidance} explanation={explanation} />
                </View>

                {FIELDS.map(({ key, label, unit, hint }) => {
                    const planValue = plan.targets[key];
                    const overridden = plan.overrides?.[key] != null;

                    return (
                        <View key={key} style={styles.field}>
                            <View style={styles.fieldHead}>
                                <Text style={styles.fieldLabel}>{label}</Text>
                                {overridden && <Text style={styles.yours}>Yours</Text>}
                            </View>
                            <Text style={styles.fieldHint}>{hint}</Text>

                            <View style={styles.inputRow}>
                                <TextInput
                                    value={draft[key] ?? ''}
                                    onChangeText={(v) => setDraft({ ...draft, [key]: v })}
                                    keyboardType="decimal-pad"
                                    placeholder={planValue != null ? String(planValue) : '—'}
                                    placeholderTextColor={Palette.textMuted}
                                    style={styles.input}
                                    accessibilityLabel={label}
                                />
                                {unit ? <Text style={styles.unit}>{unit}</Text> : null}
                            </View>

                            {planValue != null && (draft[key] ?? '') !== '' && (
                                <Pressable
                                    onPress={() => setDraft({ ...draft, [key]: '' })}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <Text style={styles.reset}>
                                        Use your plan&apos;s {planValue}{unit ? ` ${unit}` : ''}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    );
                })}

                <Text style={styles.footnote}>
                    Leave a field blank to follow the target your health plan works out for you.
                </Text>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    onPress={save}
                    disabled={saving}
                    style={[styles.cta, saving && styles.ctaDisabled]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: saving }}
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} />
                        : <Text style={styles.ctaText}>Update goal</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },

    field: { marginTop: Spacing.xxl, gap: 4 },
    fieldHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    fieldLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    yours: {
        fontSize: 10,
        fontFamily: Fonts.semibold,
        color: Palette.primary,
        backgroundColor: Palette.primarySurface,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    fieldHint: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: 15,
        fontFamily: Fonts.regular,
        color: Palette.text,
    },
    unit: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary },
    reset: { fontSize: 12.5, fontFamily: Fonts.semibold, color: Palette.primary, marginTop: 6 },

    footnote: {
        fontSize: 12.5,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        lineHeight: 18,
        marginTop: Spacing.xxl,
    },

    footer: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    cta: {
        backgroundColor: Palette.primary,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },

    centre: { alignItems: 'center', gap: Spacing.md, padding: Spacing.xxxl },
    error: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.danger, textAlign: 'center' },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
});
