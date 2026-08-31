/**
 * Review an estimated meal before it is saved.
 *
 * The analyser writes nothing. This screen is the checkpoint between an estimate and the
 * person's record — the same one `add-result/review.tsx` puts between a misread digit and a
 * medical record. Every number here is editable, because a photograph cannot show how much
 * oil went in the pan and the person can.
 *
 * The plan verdict and the swap are shown but not editable: they describe the meal as it
 * was estimated, and letting them be edited would produce coaching text attached to numbers
 * it never described.
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { logMeal, ALIGNMENT_META, MEAL_TYPE_LABEL, mealTypeForNow } from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { AnalysisResult } from '@/lib/nutrition';
import type { MealType } from '@/types/api';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function ReviewMealScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ payload?: string; imageUri?: string }>();

    const parsed: AnalysisResult | null = (() => {
        try {
            return params.payload ? JSON.parse(params.payload) : null;
        } catch {
            return null;
        }
    })();

    const draft = parsed?.draft;
    const [name, setName] = useState(draft?.name || '');
    const [mealType, setMealType] = useState<MealType>((draft?.mealType as MealType) || mealTypeForNow());
    const [macros, setMacros] = useState({
        calories: String(Math.round(draft?.calories ?? 0)),
        protein: String(Math.round(draft?.protein ?? 0)),
        carbs: String(Math.round(draft?.carbs ?? 0)),
        fat: String(Math.round(draft?.fat ?? 0)),
    });
    const [saving, setSaving] = useState(false);

    if (!draft) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centred}>
                    <Text style={styles.emptyText}>That estimate could not be read. Please try again.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
                        <Text style={styles.primaryButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const alignment = ALIGNMENT_META[draft.analysis?.alignment || 'unassessed'];
    const swap = draft.analysis?.swap;

    const save = async (useSwap = false) => {
        const calories = Number(macros.calories);
        if (!name.trim() || !Number.isFinite(calories) || calories <= 0) {
            Alert.alert('Missing details', 'A name and a calorie figure are needed.');
            return;
        }
        setSaving(true);
        try {
            await logMeal(
                useSwap && swap
                    ? {
                        name: swap.name,
                        calories: Math.round(swap.calories),
                        protein: Math.round(swap.protein),
                        carbs: Math.round(swap.carbs),
                        fat: Math.round(swap.fat),
                        mealType,
                        // Logged as `swap` so the record shows the suggestion was taken —
                        // otherwise it is indistinguishable from having cooked it by chance.
                        source: 'swap',
                        // No photograph: the picture is of the meal they were about to
                        // eat, not the one they took instead.
                        imageUrl: null,
                        analysis: {
                            alignment: 'aligned',
                            rationale: swap.why,
                            guidanceKeys: draft.analysis?.guidanceKeys,
                            model: draft.analysis?.model,
                        },
                    }
                    : {
                        ...draft,
                        name: name.trim(),
                        mealType,
                        calories: Math.round(calories),
                        protein: Math.round(Number(macros.protein) || 0),
                        carbs: Math.round(Number(macros.carbs) || 0),
                        fat: Math.round(Number(macros.fat) || 0),
                        /*
                          The stored copy, not `params.imageUri`.
                          
                          `imageUri` is a `file://` path into this app's cache — it renders
                          on this screen and is gone by next week, so writing it to the
                          record would fill the gallery with tiles that load on the device
                          that took them and nowhere else. `parsed.imageUrl` is the
                          Cloudflare delivery URL the analyse call returned, and is null
                          when there was no photograph or storage was unavailable.
                        */
                        imageUrl: parsed.imageUrl ?? null,
                    }
            );
            // The log screen `replace`d itself with this one, so the stack is
            // [dashboard, review] and a single back lands on the dashboard — which reloads
            // on focus and shows the meal that was just saved.
            router.back();
        } catch (error) {
            Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Check this meal</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {!!params.imageUri && (
                        <Image source={{ uri: params.imageUri }} style={styles.photo} />
                    )}

                    {/* Low confidence is stated plainly rather than hidden behind a number */}
                    {parsed.needsConfirmation && (
                        <View style={styles.notice}>
                            <Ionicons name="alert-circle-outline" size={18} color={Palette.warning} />
                            <Text style={styles.noticeText}>
                                We weren&apos;t confident about this one. Please check the figures before saving.
                            </Text>
                        </View>
                    )}

                    <View style={styles.card}>
                        <Text style={styles.fieldLabel}>Meal</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} />

                        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>When</Text>
                        <View style={styles.chipRow}>
                            {MEAL_TYPES.map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.chip, mealType === t && styles.chipActive]}
                                    onPress={() => setMealType(t)}
                                >
                                    <Text style={[styles.chipText, mealType === t && styles.chipTextActive]}>
                                        {MEAL_TYPE_LABEL[t]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.numberRow}>
                            {(['calories', 'protein', 'carbs', 'fat'] as const).map((field) => (
                                <View key={field} style={styles.numberField}>
                                    <TextInput
                                        style={[styles.input, styles.numberInput]}
                                        keyboardType="numeric"
                                        value={macros[field]}
                                        onChangeText={(v) => setMacros((m) => ({ ...m, [field]: v }))}
                                    />
                                    <Text style={styles.numberLabel}>
                                        {field === 'calories' ? 'kcal' : `${field} g`}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {!!draft.items?.length && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>What we identified</Text>
                            {draft.items.map((item, i) => (
                                <View key={i} style={styles.itemRow}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemMeta}>
                                        {item.quantity}{item.calories ? ` · ${Math.round(item.calories)} kcal` : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {!!parsed.uncertainties?.length && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>What we had to assume</Text>
                            {parsed.uncertainties.map((u, i) => (
                                <Text key={i} style={styles.uncertainty}>• {u}</Text>
                            ))}
                        </View>
                    )}

                    {/* The plan verdict. Only rendered when there was guidance to judge against. */}
                    {draft.analysis && draft.analysis.alignment !== 'unassessed' && (
                        <View style={[styles.card, { backgroundColor: alignment.bg, borderColor: alignment.bg }]}>
                            <View style={styles.alignHeader}>
                                <Ionicons name={alignment.icon as any} size={18} color={alignment.color} />
                                <Text style={[styles.alignLabel, { color: alignment.color }]}>{alignment.label}</Text>
                            </View>
                            {!!draft.analysis.rationale && (
                                <Text style={styles.alignBody}>{draft.analysis.rationale}</Text>
                            )}
                        </View>
                    )}

                    {/*
                      The swap card. Logging the swap instead of the meal is offered only
                      because the design shows it; it records what they intend to eat, not a
                      correction of what they already ate.
                    */}
                    {!!swap && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>A closer fit to your plan</Text>
                            <Text style={styles.swapName}>{swap.name}</Text>
                            <Text style={styles.swapWhy}>{swap.why}</Text>
                            <View style={styles.swapMacros}>
                                <Text style={styles.swapMacro}>{Math.round(swap.calories)} kcal</Text>
                                <Text style={styles.swapMacro}>{Math.round(swap.protein)}g protein</Text>
                                <Text style={styles.swapMacro}>{Math.round(swap.fat)}g fat</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => save(true)}
                                disabled={saving}
                            >
                                <Text style={styles.secondaryButtonText}>Log this instead</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => save(false)} disabled={saving}>
                    {saving
                        ? <ActivityIndicator size="small" color={Palette.white} />
                        : <Text style={styles.primaryButtonText}>Save to today</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
    emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xxxl },

    photo: { width: '100%', height: 180, borderRadius: Radius.lg, backgroundColor: Palette.borderLight },

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
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, marginBottom: Spacing.sm },

    fieldLabel: {
        fontFamily: Fonts.medium,
        fontSize: 11,
        color: Palette.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: Spacing.xs,
    },
    input: {
        fontFamily: Fonts.regular,
        fontSize: 14,
        color: Palette.text,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },
    chipTextActive: { color: Palette.white },

    numberRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    numberField: { flex: 1 },
    numberInput: { textAlign: 'center' },
    numberLabel: {
        fontFamily: Fonts.regular,
        fontSize: 11,
        color: Palette.textMuted,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },

    itemRow: { paddingVertical: Spacing.sm },
    itemName: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.text },
    itemMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary },
    uncertainty: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 18,
    },

    alignHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    alignLabel: { fontFamily: Fonts.bold, fontSize: 13 },
    alignBody: {
        fontFamily: Fonts.regular,
        fontSize: 13,
        color: Palette.text,
        lineHeight: 19,
        marginTop: Spacing.sm,
    },

    swapName: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    swapWhy: {
        fontFamily: Fonts.regular,
        fontSize: 13,
        color: Palette.textSecondary,
        lineHeight: 19,
        marginTop: 2,
    },
    swapMacros: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
    swapMacro: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.text },

    secondaryButton: {
        height: 44,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.md,
    },
    secondaryButtonText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },

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
