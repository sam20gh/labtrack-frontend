/**
 * The interaction check.
 *
 * This is the screen the whole feature exists for, and its design constraint is unusual:
 * **it must never reassure.** Everything else in the app gets more useful as it gets more
 * confident; this screen gets more dangerous. Someone who reads "no interactions found" here
 * stops asking their pharmacist, and the rule table behind it only knows the medicines they
 * happened to enter, and only the ones in a catalogue of a few dozen drugs.
 *
 * Three things enforce that, and none of them is a disclaimer at the bottom:
 *
 *   1. **The headline comes from `interactionVerdict`**, never from `findings.length`. That
 *      function has no positive verdict to return. There is no green state on this screen.
 *   2. **`uncheckable` is rendered as a peer of the findings**, not a footnote. Those
 *      medicines were not tested against anything, and a list of findings shown without
 *      them implies a completeness the check does not have.
 *   3. **The check is never run implicitly.** A `useFocusEffect` that spent a model call on
 *      every tab switch would also be a screen that quietly re-runs and shows a different
 *      answer than the one someone was reading a minute ago.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { getCheck, runCheck, interactionVerdict, SEVERITY_META } from '@/lib/medications';
import { FindingCard } from '@/components/medications/FindingCard';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationCheckResponse } from '@/types/api';

export default function InteractionsScreen() {
    const router = useRouter();
    const [data, setData] = useState<MedicationCheckResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await getCheck());
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Alert.alert('Could not load your check', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Explicit only. This spends a model call and takes a few seconds. */
    const run = async () => {
        setRunning(true);
        try {
            const result = await runCheck();
            setData({
                check: result.check,
                stale: false,
                medicationCount: result.check.medicationNames.length,
                safetyNote: result.safetyNote,
            });
        } catch (error) {
            Alert.alert('Could not run the check', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setRunning(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const check = data?.check || null;
    const verdict = interactionVerdict(check);
    const tone = verdict.tone === 'neutral' ? null : SEVERITY_META[verdict.tone];

    const severe = check?.findings.filter((f) => f.severity === 'severe') || [];
    const moderate = check?.findings.filter((f) => f.severity === 'moderate') || [];
    const mild = check?.findings.filter((f) => f.severity === 'mild') || [];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Interaction check</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Palette.primary} />
                }
            >
                {data && data.medicationCount === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="medkit-outline" size={26} color={Palette.textMuted} />
                        <Text style={styles.emptyTitle}>Nothing to check yet</Text>
                        <Text style={styles.emptyBody}>
                            Add the medicines you take — including anything you buy over the
                            counter — and we will check how they sit together.
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => router.push('/medications/add')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryButtonText}>Add a medication</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* The verdict. Never green, never an all-clear. */}
                        <View style={[
                            styles.verdict,
                            tone ? { backgroundColor: tone.bg, borderColor: tone.border } : null,
                        ]}>
                            <View style={styles.verdictHead}>
                                <Ionicons
                                    name={tone ? tone.icon as any : 'shield-outline'}
                                    size={22}
                                    color={tone ? tone.color : Palette.textSecondary}
                                />
                                <Text style={[styles.verdictTitle, tone ? { color: tone.color } : null]}>
                                    {verdict.title}
                                </Text>
                            </View>
                            <Text style={styles.verdictDetail}>{verdict.detail}</Text>
                        </View>

                        {check ? (
                            <>
                                {/* The model's summary, where there was one */}
                                {check.summary ? (
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summary}>{check.summary}</Text>
                                        {check.degraded ? (
                                            <View style={styles.degradedRow}>
                                                <Ionicons name="cloud-offline-outline" size={13} color={Palette.textSecondary} />
                                                <Text style={styles.degraded}>
                                                    Written from our interaction rules alone — the AI review was
                                                    unavailable. The findings below are unaffected.
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}

                                {/*
                                  What could not be checked. A peer of the findings, above
                                  them where the list is short — not a footnote. These
                                  medicines were tested against nothing at all.
                                */}
                                {check.uncheckable.length ? (
                                    <View style={styles.uncheckedCard}>
                                        <View style={styles.uncheckedHead}>
                                            <Ionicons name="help-circle-outline" size={17} color={Palette.textSecondary} />
                                            <Text style={styles.uncheckedTitle}>
                                                Not checked ({check.uncheckable.length})
                                            </Text>
                                        </View>
                                        <Text style={styles.uncheckedBody}>
                                            We do not hold {check.uncheckable.join(', ')} in our catalogue, so
                                            {check.uncheckable.length === 1 ? ' it was' : ' they were'} not
                                            tested against anything. Ask your pharmacist about
                                            {check.uncheckable.length === 1 ? ' it' : ' them'} specifically.
                                        </Text>
                                    </View>
                                ) : null}

                                {severe.length ? (
                                    <Section title="Serious" subtitle="Worth asking about before your next dose">
                                        {severe.map((f, i) => <FindingCard key={`s${i}`} finding={f} />)}
                                    </Section>
                                ) : null}

                                {moderate.length ? (
                                    <Section title="Worth checking" subtitle="Raise these at your next appointment">
                                        {moderate.map((f, i) => <FindingCard key={`m${i}`} finding={f} />)}
                                    </Section>
                                ) : null}

                                {mild.length ? (
                                    <Section title="Good to know" subtitle="Usually solved by when you take things">
                                        {mild.map((f, i) => <FindingCard key={`l${i}`} finding={f} />)}
                                    </Section>
                                ) : null}

                                {check.timingAdvice.length ? (
                                    <Section title="When to take what">
                                        <View style={styles.timingCard}>
                                            {check.timingAdvice.map((t, i) => (
                                                <View key={i} style={styles.timingRow}>
                                                    <Ionicons name="time-outline" size={15} color={Palette.primary} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.timingMed}>{t.medication}</Text>
                                                        <Text style={styles.timingAdvice}>{t.advice}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </Section>
                                ) : null}

                                {/*
                                  Questions to take to a clinician. The point of the whole
                                  screen is getting someone to a pharmacy counter knowing
                                  what to ask, so these are phrased to be read out loud.
                                */}
                                {check.questionsForClinician.length ? (
                                    <Section title="What to ask" subtitle="Read these out at the pharmacy counter">
                                        <View style={styles.questionCard}>
                                            {check.questionsForClinician.map((q, i) => (
                                                <View key={i} style={styles.questionRow}>
                                                    <Text style={styles.questionNumber}>{i + 1}</Text>
                                                    <Text style={styles.question}>{q}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </Section>
                                ) : null}

                                <Text style={styles.ranAt}>
                                    Checked {check.checkedCount} of {check.medicationNames.length}{' '}
                                    {check.medicationNames.length === 1 ? 'medicine' : 'medicines'} on{' '}
                                    {new Date(check.generatedAt).toLocaleDateString(undefined, {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </Text>
                            </>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.runButton, running && styles.runButtonBusy]}
                            onPress={run}
                            disabled={running}
                            activeOpacity={0.85}
                        >
                            {running ? (
                                <ActivityIndicator color={Palette.white} size="small" />
                            ) : (
                                <Ionicons name="refresh" size={17} color={Palette.white} />
                            )}
                            <Text style={styles.runButtonText}>
                                {running ? 'Checking…' : check ? 'Check again' : 'Run a check'}
                            </Text>
                        </TouchableOpacity>

                        {data?.stale && check ? (
                            <Text style={styles.staleNote}>
                                Your medication list has changed since this check ran, so it
                                may not reflect what you take now.
                            </Text>
                        ) : null}
                    </>
                )}

                <Text style={styles.footer}>{data?.safetyNote}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const Section = ({ title, subtitle, children }: {
    title: string; subtitle?: string; children: React.ReactNode;
}) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        <View style={styles.sectionBody}>{children}</View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    verdict: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.xl,
        gap: Spacing.sm,
    },
    verdictHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    verdictTitle: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold },
    verdictDetail: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 20 },

    summaryCard: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    summary: { fontSize: 14, color: Palette.text, fontFamily: Fonts.regular, lineHeight: 21 },
    degradedRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    degraded: { flex: 1, fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 16 },

    uncheckedCard: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        borderStyle: 'dashed',
        padding: Spacing.lg,
        gap: Spacing.xs,
    },
    uncheckedHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    uncheckedTitle: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    uncheckedBody: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },

    section: { gap: Spacing.sm },
    sectionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    sectionSubtitle: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: -4 },
    sectionBody: { gap: Spacing.sm, marginTop: Spacing.xs },

    timingCard: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    timingRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    timingMed: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    timingAdvice: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },

    questionCard: {
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    questionRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    questionNumber: {
        fontSize: 12, color: Palette.primary, fontFamily: Fonts.bold,
        width: 18, textAlign: 'center',
    },
    question: { flex: 1, fontSize: 13, color: Palette.text, fontFamily: Fonts.medium, lineHeight: 19 },

    ranAt: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, textAlign: 'center' },

    runButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary,
        borderRadius: Radius.md,
        paddingVertical: 15,
    },
    runButtonBusy: { opacity: 0.7 },
    runButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    staleNote: {
        fontSize: 11, color: Palette.warning, fontFamily: Fonts.medium,
        textAlign: 'center', marginTop: -Spacing.sm,
    },

    footer: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 17, marginTop: Spacing.sm },

    emptyCard: {
        alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.xxxl,
    },
    emptyTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    emptyBody: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20 },
    primaryButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 13, paddingHorizontal: Spacing.xxl, marginTop: Spacing.sm,
    },
    primaryButtonText: { fontSize: 14, color: Palette.white, fontFamily: Fonts.semibold },
});
