/**
 * Sleep setup — `Design/sleep.svg` frames 0 to 5.
 *
 * The kit draws six screens: a value proposition, an assistant greeting, "what's your average
 * sleep time", "what's your ideal sleep and wake-up time", "how would you classify your sleep
 * level", and a recommendation. They are **one route with steps** here, and that is a
 * deliberate departure.
 *
 * Six routes would mean six files carrying state forward in router params — which is exactly
 * what `app/health-assessment/` does, and exactly why `docs/KNOWN-ISSUES.md` lists several
 * answers that are silently dropped today because a param name was typed differently in the
 * screen that produced it and the screen that reads it. Nothing errors; the answer just never
 * arrives. One component holding one object cannot have that bug.
 *
 * **Nothing is saved until the last step.** The same checkpoint the meal review and the
 * medication scan put between an estimate and the record: somebody who backs out halfway has
 * told the app nothing.
 *
 * The kit's second frame is the assistant introducing itself and asking "are you ready?".
 * That is not reproduced — it is a screen whose only content is a question about whether to
 * show the next screen, and the answer is always yes.
 */
import React, { useMemo, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { SleepIllustration } from '@/components/sleep/SleepIllustration';
import { TimeDial } from '@/components/sleep/TimeDial';
import { updateSleepPlan, formatMinutes, formatClock } from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/** The hours the "average sleep time" wheel offers. Below 4 and above 11 is not a typical night. */
const HOURS = [4, 5, 6, 7, 8, 9, 10, 11];

/**
 * The five points on the "sleep level" slider, frame 4.
 *
 * Self-reported and used only as context — it never adjusts the score, because a number
 * somebody could improve by re-answering a question is not a measurement. `SleepPlan` says
 * the same thing beside the field.
 */
const DEPTHS = [
    { value: 1, label: 'Light', caption: 'I wake up at the slightest noise' },
    { value: 2, label: 'Fairly light', caption: 'Small things wake me' },
    { value: 3, label: 'Average', caption: 'Some nights are better than others' },
    { value: 4, label: 'Fairly deep', caption: 'Not much wakes me' },
    { value: 5, label: 'Deep', caption: 'I sleep through almost anything' },
];

type Step = 'intro' | 'average' | 'window' | 'depth' | 'summary';
const ORDER: Step[] = ['intro', 'average', 'window', 'depth', 'summary'];

export default function SleepSetupScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [step, setStep] = useState<Step>('intro');
    const [averageHours, setAverageHours] = useState(7);
    const [bedtimeMin, setBedtime] = useState(22 * 60 + 30);
    const [wakeMin, setWake] = useState(6 * 60 + 30);
    const [depth, setDepth] = useState(3);
    const [saving, setSaving] = useState(false);

    const index = ORDER.indexOf(step);
    const span = useMemo(
        () => ((wakeMin - bedtimeMin) % 1440 + 1440) % 1440,
        [bedtimeMin, wakeMin]
    );

    const next = () => setStep(ORDER[Math.min(ORDER.length - 1, index + 1)]);
    const back = () => {
        if (index === 0) { router.back(); return; }
        setStep(ORDER[index - 1]);
    };

    /** One write, at the end. See the note at the top. */
    const finish = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await updateSleepPlan({
                goalMinutes: span,
                reportedAverageHours: averageHours,
                selfRatedDepth: depth,
                bedtimeWindow: { fromMin: bedtimeMin, toMin: null },
                wakeWindow: { fromMin: wakeMin, toMin: null },
                onboarded: true,
            });
            router.replace('/sleep');
        } catch (err) {
            Alert.alert(
                'Not saved',
                err instanceof ApiError ? err.message : 'Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={back} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <View style={styles.progress}>
                    {ORDER.map((s, i) => (
                        <View key={s} style={[styles.pip, i <= index && styles.pipOn]} />
                    ))}
                </View>
                <Pressable onPress={() => router.replace('/sleep')} hitSlop={10}>
                    <Text style={styles.skip}>Skip</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {step === 'intro' ? (
                    <View style={styles.intro}>
                        <SleepIllustration width={Math.min(320, width - Spacing.xl * 2)} />
                        <Text style={styles.title}>Track your sleep, feel the difference</Text>
                        <Text style={styles.body}>
                            Your nights come from your watch or your phone&apos;s health store. Answer
                            three quick questions and we will set a goal that matches your health plan.
                        </Text>
                        <View style={styles.bullets}>
                            {[
                                'A sleep score you can check the working of',
                                'Stage balance, weekday patterns and how steady your schedule is',
                                'A goal derived from the sleep advice on your results',
                            ].map((line) => (
                                <View key={line} style={styles.bullet}>
                                    <Ionicons name="checkmark-circle" size={18} color={Palette.success} />
                                    <Text style={styles.bulletText}>{line}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {step === 'average' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>What&apos;s your average sleep time?</Text>
                        <Text style={styles.body}>
                            Roughly, on a normal night. It only nudges your starting goal — your
                            score is always measured against what your device records.
                        </Text>
                        <View style={styles.wheel}>
                            {HOURS.map((h) => (
                                <Pressable
                                    key={h}
                                    style={[styles.wheelItem, averageHours === h && styles.wheelItemOn]}
                                    onPress={() => setAverageHours(h)}
                                >
                                    <Text style={[styles.wheelValue, averageHours === h && styles.wheelValueOn]}>
                                        {h}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.reported}>
                            <Ionicons name="moon-outline" size={15} color={Palette.textSecondary} />
                            <Text style={styles.reportedText}>
                                {`I usually sleep about ${averageHours} hours`}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {step === 'window' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>
                            When do you want to sleep and wake up on most days?
                        </Text>
                        <TimeDial
                            bedtimeMin={bedtimeMin}
                            wakeMin={wakeMin}
                            onChange={({ bedtimeMin: b, wakeMin: w }) => { setBedtime(b); setWake(w); }}
                            size={Math.min(260, width - Spacing.xl * 2 - 20)}
                        />
                        <View style={styles.windowRow}>
                            <View style={styles.windowCard}>
                                <View style={styles.windowHead}>
                                    <Ionicons name="moon-outline" size={15} color={Palette.text} />
                                    <Text style={styles.windowLabel}>Sleep</Text>
                                </View>
                                <Text style={styles.windowValue}>{formatClock(bedtimeMin)}</Text>
                            </View>
                            <View style={styles.windowCard}>
                                <View style={styles.windowHead}>
                                    <Ionicons name="sunny-outline" size={15} color={Palette.amber} />
                                    <Text style={styles.windowLabel}>Wake up</Text>
                                </View>
                                <Text style={styles.windowValue}>{formatClock(wakeMin)}</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {step === 'depth' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>How would you classify your sleep level?</Text>
                        <Text style={styles.depthValue}>
                            {DEPTHS.find((d) => d.value === depth)?.label}
                        </Text>
                        <View style={styles.depthRow}>
                            {DEPTHS.map((d) => (
                                <Pressable
                                    key={d.value}
                                    style={styles.depthStop}
                                    onPress={() => setDepth(d.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: depth === d.value }}
                                >
                                    <View style={[styles.depthDot, depth >= d.value && styles.depthDotOn]} />
                                </Pressable>
                            ))}
                        </View>
                        <Text style={styles.depthCaption}>
                            {DEPTHS.find((d) => d.value === depth)?.caption}
                        </Text>
                        {/* Said out loud so nobody assumes a "deeper" answer improves anything. */}
                        <Text style={styles.footnote}>
                            This is context for what the app suggests. It never changes your sleep
                            score — a number you could improve by re-answering a question would not
                            be a measurement.
                        </Text>
                    </View>
                ) : null}

                {step === 'summary' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>Here is your recommended night</Text>
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryHead}>
                                <Ionicons name="sparkles" size={18} color={Palette.primary} />
                                <Text style={styles.summaryValue}>{formatMinutes(span)}</Text>
                            </View>
                            <Text style={styles.summaryCaption}>Your sleep goal</Text>

                            <View style={styles.summaryGrid}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.summaryKey}>Bedtime</Text>
                                    <Text style={styles.summaryTime}>{formatClock(bedtimeMin)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.summaryKey}>Wake up</Text>
                                    <Text style={styles.summaryTime}>{formatClock(wakeMin)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* The server may move this: the goal is clamped into the healthy adult
                            range and can be shifted by the sleep advice on the person's plan.
                            Promised as a starting point rather than as a final number. */}
                        <Text style={styles.footnote}>
                            We will adjust this against the sleep advice on your health plan, and keep
                            it inside the healthy adult range. You can change it any time from your
                            sleep goal.
                        </Text>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.cta}
                    onPress={step === 'summary' ? finish : next}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : (
                            <>
                                <Text style={styles.ctaLabel}>
                                    {step === 'intro' ? 'Get started'
                                        : step === 'summary' ? 'Save and finish' : 'Continue'}
                                </Text>
                                <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                            </>
                        )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.lg,
    },
    progress: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center' },
    pip: { width: 20, height: 4, borderRadius: 2, backgroundColor: Palette.borderSlate },
    pipOn: { backgroundColor: Palette.primary },
    skip: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },

    content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.xl },

    intro: { alignItems: 'center', gap: Spacing.lg },
    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    body: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 21,
    },
    bullets: { gap: Spacing.md, alignSelf: 'stretch', marginTop: Spacing.sm },
    bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    bulletText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 19 },

    stepBlock: { gap: Spacing.lg },
    question: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 32 },

    wheel: { gap: Spacing.sm },
    wheelItem: {
        paddingVertical: Spacing.md, borderRadius: Radius.lg, alignItems: 'center',
        borderWidth: 1, borderColor: 'transparent',
    },
    wheelItemOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    wheelValue: { fontSize: 24, fontFamily: Fonts.medium, color: Palette.textMuted },
    wheelValueOn: { color: Palette.primary, fontFamily: Fonts.bold },
    reported: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
    reportedText: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },

    windowRow: { flexDirection: 'row', gap: Spacing.md },
    windowCard: { flex: 1, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.surface, gap: 4 },
    windowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    windowLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    windowValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },

    depthValue: { fontSize: 34, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    depthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    depthStop: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
    depthDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: Palette.borderSlate },
    depthDotOn: { backgroundColor: Palette.primary },
    depthCaption: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center',
    },
    footnote: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 17 },

    summaryCard: {
        borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        padding: Spacing.lg, gap: 2,
    },
    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    summaryValue: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    summaryCaption: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    summaryGrid: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.lg },
    summaryKey: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    summaryTime: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },

    footer: {
        padding: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    ctaLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
