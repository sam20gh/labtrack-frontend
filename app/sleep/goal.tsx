/**
 * Set Sleep Goal — `Design/sleep.svg` frames 19, 20 and 21.
 *
 * The dial sets a bedtime and a wake time; the span between them is the goal. That is the
 * design's arrangement and it is the right one — people do not think in "eight hours and
 * fifteen minutes", they think "eleven till seven".
 *
 * Two things this screen says that the kit does not:
 *
 * 1. **Where the suggestion came from.** The number under the dial is derived from the sleep
 *    advice on the person's health plan, and `explanation` is the server's own account of the
 *    arithmetic that produced it. A goal that appears from nowhere is a goal nobody trusts,
 *    and this app has an actual answer to "why 8h 30m?".
 * 2. **That it is bounded.** The server clamps a goal into the healthy adult range, so a
 *    four-hour night cannot be made to score full marks. When the clamp bites, the screen
 *    says so rather than quietly storing a different number from the one on the dial.
 *
 * The kit's "Recommended: 8h 10m" pill is kept and is real — it is the plan-derived figure,
 * and tapping it puts the dial back on it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { TimeDial } from '@/components/sleep/TimeDial';
import {
    getSleepPlan, updateSleepPlan, formatMinutes, formatClock,
    type SleepPlanResponse,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/** A sensible pair to open on when the person has never set a window: 23:00 to 07:00. */
const DEFAULT_WAKE = 7 * 60;

export default function SleepGoalScreen() {
    const router = useRouter();

    const [data, setData] = useState<SleepPlanResponse | null>(null);
    const [bedtimeMin, setBedtime] = useState(23 * 60);
    const [wakeMin, setWake] = useState(DEFAULT_WAKE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const result = await getSleepPlan();
            setData(result);

            // Open on what they already keep. Falling back to the derived goal worked back
            // from a default wake time, so the dial is never at an arbitrary place.
            const wake = result.plan.wakeWindow?.fromMin ?? DEFAULT_WAKE;
            setWake(wake);
            setBedtime(((wake - result.plan.goalMinutes) % 1440 + 1440) % 1440);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your sleep goal.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const span = useMemo(
        () => ((wakeMin - bedtimeMin) % 1440 + 1440) % 1440,
        [bedtimeMin, wakeMin]
    );

    /** The plan's own figure, which the "Recommended" pill puts the dial back on. */
    const recommended = data?.basis.derivedMinutes ?? data?.plan.goalMinutes ?? null;

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const result = await updateSleepPlan({
                goalMinutes: span,
                // The wake time is what the goal is worked back from on the dashboard, so it
                // is saved alongside rather than left behind on the dial.
                wakeWindow: { fromMin: wakeMin, toMin: data?.plan.wakeWindow?.toMin ?? null },
                bedtimeWindow: { fromMin: bedtimeMin, toMin: data?.plan.bedtimeWindow?.toMin ?? null },
            });

            if (result.basis.clamped) {
                // Said out loud rather than silently stored. The dial showed one number and
                // the record holds another; the person is owed the difference.
                Alert.alert(
                    'Kept inside the healthy range',
                    `We saved ${formatMinutes(result.plan.goalMinutes)} instead of ${formatMinutes(span)}. `
                    + 'Sleep goals are held between 6 and 10 hours so a night far outside the adult '
                    + 'range is not scored as a target met.',
                    [{ text: 'Got it', onPress: () => router.back() }]
                );
                return;
            }

            router.back();
        } catch (err) {
            Alert.alert('Not saved', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Set sleep goal</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.hero}>
                    <Text style={styles.heroValue}>{formatMinutes(span)}</Text>
                    <Text style={styles.heroCaption}>
                        {`I plan to sleep ${formatMinutes(span).toLowerCase()} every night`}
                    </Text>
                </View>

                <TimeDial
                    bedtimeMin={bedtimeMin}
                    wakeMin={wakeMin}
                    onChange={({ bedtimeMin: b, wakeMin: w }) => { setBedtime(b); setWake(w); }}
                />

                <View style={styles.times}>
                    <View style={styles.timeCard}>
                        <View style={styles.timeHead}>
                            <View style={[styles.dot, { backgroundColor: Palette.text }]} />
                            <Text style={styles.timeLabel}>Bedtime</Text>
                        </View>
                        <Text style={styles.timeValue}>{formatClock(bedtimeMin)}</Text>
                    </View>
                    <View style={styles.timeCard}>
                        <View style={styles.timeHead}>
                            <View style={[styles.dot, { backgroundColor: Palette.primary }]} />
                            <Text style={styles.timeLabel}>Wake up</Text>
                        </View>
                        <Text style={styles.timeValue}>{formatClock(wakeMin)}</Text>
                    </View>
                </View>

                {recommended !== null && recommended !== span ? (
                    <Pressable
                        style={styles.recommend}
                        onPress={() => setBedtime(((wakeMin - recommended) % 1440 + 1440) % 1440)}
                    >
                        <Ionicons name="sparkles" size={15} color={Palette.primary} />
                        <Text style={styles.recommendLabel}>Recommended</Text>
                        <Text style={styles.recommendValue}>{formatMinutes(recommended)}</Text>
                    </Pressable>
                ) : null}

                {/* The server's own account of how the recommendation was reached. */}
                {data?.explanation ? (
                    <View style={styles.why}>
                        <Text style={styles.whyTitle}>Where this comes from</Text>
                        <Text style={styles.whyBody}>{data.explanation}</Text>
                    </View>
                ) : null}

                {data && data.plan.guidance.length > 0 ? (
                    <View style={styles.why}>
                        <Text style={styles.whyTitle}>Sleep advice on your plan</Text>
                        {data.plan.guidance.map((g, i) => (
                            <Text key={`${g.key}-${i}`} style={styles.guidance}>• {g.directive}</Text>
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable style={styles.save} onPress={save} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : (
                            <>
                                <Text style={styles.saveLabel}>Set goal</Text>
                                <Ionicons name="checkmark" size={18} color={Palette.white} />
                            </>
                        )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.xxxl },
    error: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.danger, textAlign: 'center' },

    hero: { alignItems: 'center', gap: 4 },
    heroValue: { fontSize: 38, fontFamily: Fonts.bold, color: Palette.text },
    heroCaption: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },

    times: { flexDirection: 'row', gap: Spacing.md },
    timeCard: {
        flex: 1, padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.surface, gap: 4,
    },
    timeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4 },
    timeLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    timeValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },

    recommend: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primaryPale,
        backgroundColor: Palette.primarySurface,
    },
    recommendLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },
    recommendValue: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.primary },

    why: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.canvas, gap: 6,
    },
    whyTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    whyBody: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
    guidance: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },

    footer: {
        padding: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    save: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    saveLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
