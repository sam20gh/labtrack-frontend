/**
 * Health profile — review and update.
 *
 * The 23-screen assessment was a one-way street: you answered it once at signup and the
 * answers were never shown to you again. Anything that changes — a new medication, a
 * different sleep pattern, a diagnosis — had no way back in, and the only feedback that
 * the answers had saved at all was a card on Home that stopped appearing.
 *
 * This screen is the other half of that flow. It reads back what is stored, so the person
 * can see what the app is reasoning from, and every row is a way into the question that
 * produced it.
 *
 * Re-entry works by seeding the flow's router params from the saved assessment
 * (`seedParamsFromUser`) and pushing the screen the person tapped. From there the flow
 * behaves exactly as it does on a first run — each screen forwards the params it was
 * given — so they walk to `complete.tsx`, which saves the whole set again. Jumping into
 * the middle therefore means "change this, then confirm the rest", not "change only this".
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import type { User } from '@/types/api';
import { seedParamsFromUser, MOOD_ENUM_TO_ID } from './params';
import {
    healthGoals, exerciseTypes, eatingHabits, checkupFrequencies,
    fitnessLevels, sleepLevels, moodOptions, labelFor, labelForLevel,
} from './options';

type Row = {
    label: string;
    /** Undefined renders as "Not answered" rather than as a blank line. */
    value?: string;
    /** The screen that asks this question. */
    href: Href;
};

const listOrUndefined = (items: (string | undefined)[]) => {
    const kept = items.filter(Boolean);
    return kept.length ? kept.join(', ') : undefined;
};

const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined;

export default function HealthProfileReviewScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const userId = await getUserId();
        if (!userId) {
            router.replace('/(auth)/loginscreen');
            return;
        }
        try {
            setUser(await api.get<User>(`/users/${userId}`));
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Toast.show({ type: 'error', text1: 'Could not load your health profile', text2: 'Pull down to try again.' });
        }
    }, [router]);

    // Focus rather than mount: coming back from the flow must show the new answers.
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            load().finally(() => { if (active) setLoading(false); });
            return () => { active = false; };
        }, [load]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    /** Open a question with every saved answer in hand, so nothing else is lost on the way through. */
    const openStep = useCallback((href: Href) => {
        router.push({ pathname: href as string, params: seedParamsFromUser(user) } as Href);
    }, [router, user]);

    if (loading && !user) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const ha = user?.healthAssessment;
    const lifestyle = ha?.lifestyle;
    const started = Boolean(ha?.isComplete || ha?.completedAt || ha?.healthGoals?.length);
    const latestMood = ha?.moodHistory?.[ha.moodHistory.length - 1]?.mood;
    const latestNote = ha?.notes?.[ha.notes.length - 1]?.content;

    const sections: { title: string; rows: Row[] }[] = [
        {
            title: 'About you',
            rows: [
                {
                    label: 'Name',
                    value: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
                    href: '/health-assessment/name',
                },
                {
                    label: 'Year of birth',
                    value: user?.dob ? String(user.dob).slice(0, 4) : undefined,
                    href: '/health-assessment/birth-year',
                },
                { label: 'Gender', value: user?.gender ?? undefined, href: '/health-assessment/gender' },
                {
                    label: 'Weight',
                    value: user?.weight != null ? `${user.weight} kg` : undefined,
                    href: '/health-assessment/weight',
                },
                {
                    label: 'Height',
                    value: user?.height != null ? `${user.height} cm` : undefined,
                    href: '/health-assessment/height',
                },
                { label: 'Blood type', value: user?.bloodType ?? undefined, href: '/health-assessment/blood-type' },
            ],
        },
        {
            title: 'Goals',
            rows: [
                {
                    label: 'What you want from LabTrack',
                    value: listOrUndefined((ha?.healthGoals ?? []).map(g => labelFor(healthGoals, g))),
                    href: '/health-assessment/health-goals',
                },
            ],
        },
        {
            title: 'Lifestyle',
            rows: [
                {
                    label: 'Fitness level',
                    value: labelForLevel(fitnessLevels, lifestyle?.fitnessLevel),
                    href: '/health-assessment/fitness-level',
                },
                {
                    label: 'Sleep',
                    value: labelForLevel(sleepLevels, lifestyle?.sleepQuality),
                    href: '/health-assessment/sleep-level',
                },
                {
                    label: 'Exercise',
                    value: listOrUndefined((lifestyle?.exerciseTypes ?? []).map(t => labelFor(exerciseTypes, t))),
                    href: '/health-assessment/exercise-type',
                },
                {
                    label: 'Mood',
                    value: latestMood
                        ? moodOptions.find(m => m.id === MOOD_ENUM_TO_ID[latestMood])?.label ?? latestMood
                        : undefined,
                    href: '/health-assessment/mood',
                },
                {
                    label: 'Diet',
                    value: labelFor(eatingHabits, lifestyle?.dietType),
                    href: '/health-assessment/eating-habits',
                },
                {
                    label: 'Daily calories',
                    value: ha?.nutritionGoals?.dailyCalorieGoal
                        ? `${ha.nutritionGoals.dailyCalorieGoal.toLocaleString()} kcal`
                        : undefined,
                    href: '/health-assessment/calorie-intake',
                },
                {
                    label: 'Check-ups',
                    value: labelFor(checkupFrequencies, lifestyle?.checkupFrequency),
                    href: '/health-assessment/checkup-frequency',
                },
            ],
        },
        {
            title: 'Medical history',
            rows: [
                {
                    // "None" and "not answered" are different clinically, so an assessment
                    // that exists says None rather than leaving the row empty.
                    label: 'Medications',
                    value: listOrUndefined((ha?.medications ?? []).map(m => m.name)) ?? (started ? 'None' : undefined),
                    href: '/health-assessment/medications',
                },
                {
                    label: 'Allergies',
                    value: listOrUndefined((ha?.allergies ?? []).map(a => a.allergen)) ?? (started ? 'None' : undefined),
                    href: '/health-assessment/allergies',
                },
                {
                    label: 'Conditions',
                    value: listOrUndefined((ha?.conditions ?? []).map(c => c.name)) ?? (started ? 'None' : undefined),
                    href: '/health-assessment/conditions',
                },
                { label: 'Notes', value: latestNote, href: '/health-assessment/health-notes' },
            ],
        },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health profile</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                <View style={styles.statusCard}>
                    <View style={styles.statusIcon}>
                        <Ionicons
                            name={started ? 'checkmark-circle' : 'clipboard-outline'}
                            size={20}
                            color={started ? Palette.success : Palette.primary}
                        />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.statusTitle}>
                            {started ? 'Your answers' : 'Not completed yet'}
                        </Text>
                        <Text style={styles.statusBody}>
                            {started
                                ? `Last updated ${formatDate(ha?.completedAt) ?? 'recently'}. Tap any answer to change it.`
                                : 'The assessment tells LabTrack what to weigh alongside your results.'}
                        </Text>
                    </View>
                </View>

                {started && sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.card}>
                            {section.rows.map((row, index) => (
                                <TouchableOpacity
                                    key={row.label}
                                    style={[styles.row, index > 0 && styles.rowDivider]}
                                    onPress={() => openStep(row.href)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${row.label}: ${row.value ?? 'not answered'}. Tap to change.`}
                                >
                                    <View style={styles.flex}>
                                        <Text style={styles.rowLabel}>{row.label}</Text>
                                        <Text style={[styles.rowValue, !row.value && styles.rowValueEmpty]}>
                                            {row.value ?? 'Not answered'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                <Text style={styles.footnote}>
                    Changing one answer walks you through the remaining questions, pre-filled with what
                    you have here, and saves the whole set at the end.
                </Text>

                <TouchableOpacity style={styles.primaryButton} onPress={() => openStep('/health-assessment/name')}>
                    <Text style={styles.primaryButtonText}>
                        {started ? 'Review all answers' : 'Start assessment'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                </TouchableOpacity>
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    backButton: { width: 32, height: 32, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.xl },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    statusIcon: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        backgroundColor: Palette.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    statusBody: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
    section: { gap: Spacing.sm },
    sectionTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary, textTransform: 'uppercase' },
    card: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    rowLabel: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    rowValue: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.text, marginTop: 2 },
    rowValueEmpty: { color: Palette.textMuted, fontFamily: Fonts.regular },
    footnote: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 18 },
    primaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
        borderRadius: Radius.pill,
        backgroundColor: Palette.primary,
    },
    primaryButtonText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
