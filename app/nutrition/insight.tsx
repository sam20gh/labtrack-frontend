/**
 * Nutrition Insight — the run of days, rather than today.
 *
 * The whole screen rests on one rule, enforced on the server in `utils/nutritionInsight.js`
 * and repeated here in how things are drawn: **a day with nothing logged is absent, never
 * zero.** Averages divide by days logged; a weekday nobody ever logged on is a gap in the
 * chart, not a bar at the floor; and with nothing logged at all the screen says so instead
 * of drawing an empty chart that reads as a fortnight of starvation.
 *
 * This replaces what `history.tsx` used to draw. History is now the meal list the kit shows
 * under that name, and the charts live here — matching both the design's two frames and
 * the split `medications/insight.tsx` already makes.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getInsight, MACRO_META } from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionInsight } from '@/types/api';

/** The windows the header offers. 7 is a week's shape; 90 is whether anything has changed. */
const WINDOWS = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
] as const;

const CHART_HEIGHT = 150;

export default function NutritionInsightScreen() {
    const router = useRouter();
    const [days, setDays] = useState<number>(30);
    const [data, setData] = useState<NutritionInsight | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setData(await getInsight(days));
        } catch (error) {
            Alert.alert('Could not load your insight', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const share = () => {
        if (!data?.averages) return;
        Share.share({
            message: `My last ${data.windowDays} days: ${data.averages.calories} kcal a day on average `
                + `across ${data.loggedDays} logged days, ${data.averages.protein}g protein, `
                + `${data.averages.carbs}g carbs, ${data.averages.fat}g fat.`,
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Insight</Text>
                <TouchableOpacity onPress={share} hitSlop={8} disabled={!data?.averages}>
                    <Ionicons
                        name="share-social-outline"
                        size={20}
                        color={data?.averages ? Palette.text : Palette.border}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.windowRow}>
                {WINDOWS.map((w) => (
                    <TouchableOpacity
                        key={w.days}
                        style={[styles.window, days === w.days && styles.windowOn]}
                        onPress={() => { setDays(w.days); setLoading(true); }}
                    >
                        <Text style={[styles.windowText, days === w.days && styles.windowTextOn]}>
                            {w.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl * 2 }} color={Palette.primary} />
            ) : !data || data.loggedDays === 0 ? (
                /*
                  Nothing logged. Deliberately not an empty chart: axes and a flat line at
                  zero say someone ate nothing for a month, which is a claim the app has no
                  basis for making.
                */
                <View style={styles.empty}>
                    <Ionicons name="analytics-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Nothing logged in this window</Text>
                    <Text style={styles.emptyBody}>
                        Log a few meals and this fills in. Nothing here is estimated from
                        anything but what you record.
                    </Text>
                    <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/nutrition/log')}>
                        <Text style={styles.emptyCtaText}>Log a meal</Text>
                        <Ionicons name="add" size={17} color={Palette.white} />
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    <Text style={styles.basis}>
                        {data.loggedDays} of the last {data.windowDays} days have meals on them.
                        Everything below is an average across those {data.loggedDays}
                        {data.loggedDays === 1 ? ' day' : ' days'}, not across the whole window.
                    </Text>

                    <Section title="Stats">
                        <View style={styles.statGrid}>
                            <Stat initial="C" value={data.averages!.calories.toLocaleString()} unit="cal" label="Average day" />
                            <Stat initial="P" value={String(data.averages!.protein)} unit="g" label="Protein a day" />
                            <Stat initial="F" value={String(data.averages!.fat)} unit="g" label="Fat a day" />
                            <Stat initial="B" value={String(data.averages!.fibre)} unit="g" label="Fibre a day" />
                        </View>
                    </Section>

                    <Section title="Average calories consumed">
                        <View style={styles.card}>
                            <Text style={styles.bigValue}>
                                {data.averageCalories?.toLocaleString()}
                            </Text>
                            <Text style={styles.bigLabel}>
                                kcal average over {data.windowDays} days
                            </Text>

                            <WeekdayChart data={data} />

                            {/*
                              The kit's coaching line. Ours is derived from the numbers on
                              screen rather than written by a model — a sentence claiming a
                              trend the chart does not show is the one thing on this screen
                              nobody could check.
                            */}
                            <Text style={styles.coach}>{coachLine(data)}</Text>
                        </View>
                    </Section>

                    <Section title="Goal progress">
                        <View style={styles.card}>
                            {data.goals.every((g) => g.target == null) ? (
                                <>
                                    <Text style={styles.noTarget}>
                                        You have no macro targets yet, so there is nothing to measure
                                        these against.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.linkRow}
                                        onPress={() => router.push('/nutrition/setup')}
                                    >
                                        <Text style={styles.link}>Set up your goal</Text>
                                        <Ionicons name="chevron-forward" size={15} color={Palette.primary} />
                                    </TouchableOpacity>
                                </>
                            ) : data.goals.map((g) => {
                                if (g.target == null) return null;
                                const meta = MACRO_META.find((m) => m.key === g.key)!;
                                return (
                                    <View key={g.key} style={styles.goal}>
                                        <View style={styles.goalHead}>
                                            <Text style={styles.goalLabel}>{meta.label}</Text>
                                            {g.reached ? (
                                                <View style={styles.reached}>
                                                    <Text style={styles.reachedText}>Reached</Text>
                                                    <Ionicons name="checkmark-circle" size={15} color={Palette.success} />
                                                </View>
                                            ) : (
                                                <Text style={styles.shortfall}>
                                                    {Math.max(0, g.target - (g.average ?? 0))}g short a day
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.goalTrack}>
                                            <View style={[
                                                styles.goalFill,
                                                {
                                                    width: `${Math.min(100, (g.ratio ?? 0) * 100)}%`,
                                                    backgroundColor: meta.color,
                                                },
                                            ]} />
                                            {/* The target mark, so an overshoot is legible rather than just full */}
                                            <View style={styles.goalMark} />
                                        </View>
                                        <Text style={styles.goalMeta}>
                                            {g.average}g a day against a {g.target}g target
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </Section>

                    {/* Their plan's own wording, so the numbers above have something to be for */}
                    {data.guidance.length > 0 && (
                        <Section title="What these are measured against">
                            {data.guidance.map((g) => (
                                <TouchableOpacity
                                    key={g.key}
                                    style={[styles.card, { marginBottom: Spacing.sm }]}
                                    onPress={() => router.push('/myplans')}
                                    activeOpacity={0.75}
                                >
                                    {g.label ? <Text style={styles.guidanceLabel}>{g.label}</Text> : null}
                                    <Text style={styles.guidanceDirective}>{g.directive}</Text>
                                </TouchableOpacity>
                            ))}
                        </Section>
                    )}

                    <TouchableOpacity
                        style={styles.footerLink}
                        onPress={() => router.push('/nutrition/history')}
                    >
                        <Text style={styles.footerLinkText}>See every meal</Text>
                        <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                    </TouchableOpacity>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

/**
 * The seven-bar weekday chart.
 *
 * Scaled from the smallest to the largest weekday rather than from zero, matching the kit's
 * 1.6k–2k axis: a 200 kcal difference between Tuesday and Friday is invisible on an axis
 * that starts at nothing. The floor is labelled so the truncation is stated rather than
 * hidden — a truncated axis with no floor label is how a chart flatters a small difference.
 *
 * A weekday with no logged days draws nothing at all.
 */
function WeekdayChart({ data }: { data: NutritionInsight }) {
    const values = data.weekdays.map((w) => w.calories).filter((v): v is number => v != null);
    if (!values.length) return null;

    const max = Math.max(...values, data.calorieTarget ?? 0);
    const min = Math.min(...values, data.calorieTarget ?? Infinity);
    // A little headroom either side so the tallest bar is not flush with the frame
    const floor = Math.max(0, Math.floor((min * 0.92) / 100) * 100);
    const ceiling = Math.ceil((max * 1.04) / 100) * 100;
    const span = Math.max(1, ceiling - floor);

    const avg = data.averageCalories;
    const avgY = avg != null ? CHART_HEIGHT * (1 - (avg - floor) / span) : null;

    return (
        <View style={styles.chart}>
            <View style={styles.chartAxis}>
                <Text style={styles.axisLabel}>{Math.round(ceiling).toLocaleString()}</Text>
                <Text style={styles.axisLabel}>{Math.round(floor).toLocaleString()}</Text>
            </View>

            <View style={styles.chartBody}>
                <View style={{ height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm }}>
                    {data.weekdays.map((w) => {
                        if (w.calories == null) {
                            return (
                                <View key={w.label} style={styles.barSlot}>
                                    <View style={styles.barGap} />
                                </View>
                            );
                        }
                        const h = Math.max(4, ((w.calories - floor) / span) * CHART_HEIGHT);
                        // The strongest weekday gets the solid purple, as the kit draws it
                        const isPeak = w.calories === max;
                        return (
                            <View key={w.label} style={styles.barSlot}>
                                <View style={[
                                    styles.bar,
                                    { height: h, backgroundColor: isPeak ? Palette.primary : Palette.primaryLight },
                                ]} />
                            </View>
                        );
                    })}
                </View>

                {/* The dashed average line */}
                {avgY != null && avgY >= 0 && avgY <= CHART_HEIGHT && (
                    <View pointerEvents="none" style={[styles.avgLine, { top: avgY }]}>
                        <View style={styles.avgDash} />
                        <View style={styles.avgChip}>
                            <Text style={styles.avgChipText}>AVG</Text>
                        </View>
                    </View>
                )}

                <View style={styles.chartLabels}>
                    {data.weekdays.map((w) => (
                        <Text
                            key={w.label}
                            style={[styles.chartLabel, w.calories == null && styles.chartLabelMuted]}
                        >
                            {w.label}
                        </Text>
                    ))}
                </View>
            </View>
        </View>
    );
}

/**
 * One sentence about what the chart shows.
 *
 * Derived, not generated. Everything it says can be read off the same numbers on screen,
 * which is the only way a coaching line on a health screen can be checked.
 */
const coachLine = (data: NutritionInsight): string => {
    const logged = data.weekdays.filter((w) => w.calories != null);
    if (logged.length < 3) {
        return 'A few more days of logging and a weekly pattern will start to show here.';
    }

    const highest = logged.reduce((a, b) => (b.calories! > a.calories! ? b : a));
    const lowest = logged.reduce((a, b) => (b.calories! < a.calories! ? b : a));
    const spread = highest.calories! - lowest.calories!;

    if (data.calorieTarget && data.averageCalories) {
        const gap = data.averageCalories - data.calorieTarget;
        if (Math.abs(gap) <= data.calorieTarget * 0.05) {
            return `Your average day is within 5% of your ${data.calorieTarget.toLocaleString()} kcal target. `
                + `${highest.label} runs highest.`;
        }
        return gap > 0
            ? `You are averaging ${Math.round(gap).toLocaleString()} kcal a day above your target. `
                + `Most of the difference sits on ${highest.label}.`
            : `You are averaging ${Math.round(-gap).toLocaleString()} kcal a day below your target. `
                + `${lowest.label} is your lightest day.`;
    }

    return spread > 300
        ? `${highest.label} runs about ${Math.round(spread).toLocaleString()} kcal above ${lowest.label}.`
        : 'Your days are fairly even across the week.';
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const Stat = ({ initial, value, unit, label }: { initial: string; value: string; unit: string; label: string }) => (
    <View style={styles.stat}>
        <View style={styles.statInitial}>
            <Text style={styles.statInitialText}>{initial}</Text>
        </View>
        <Text style={styles.statValue}>
            {value}<Text style={styles.statUnit}> {unit}</Text>
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },

    windowRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
    window: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    windowOn: { backgroundColor: Palette.primarySurface, borderColor: Palette.primaryLight },
    windowText: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },
    windowTextOn: { fontFamily: Fonts.semibold, color: Palette.primary },

    scroll: { paddingBottom: Spacing.xxxl * 2 },
    basis: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary,
        paddingHorizontal: Spacing.lg, lineHeight: 18,
    },

    section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text, marginBottom: Spacing.md },
    card: {
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate, padding: Spacing.lg,
    },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    stat: {
        width: '47%', flexGrow: 1,
        backgroundColor: Palette.canvas, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate, padding: Spacing.lg,
    },
    statInitial: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Palette.borderStrong,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    },
    statInitialText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.textSecondary },
    statValue: { fontFamily: Fonts.bold, fontSize: 22, color: Palette.text },
    statUnit: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    statLabel: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 2 },

    bigValue: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text },
    bigLabel: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary },

    chart: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
    chartAxis: { height: CHART_HEIGHT, justifyContent: 'space-between' },
    axisLabel: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },
    chartBody: { flex: 1 },
    barSlot: { flex: 1, justifyContent: 'flex-end', height: CHART_HEIGHT },
    bar: { borderRadius: Radius.sm },
    // A weekday with nothing logged: a hairline on the baseline, never a bar at zero
    barGap: { height: 1, backgroundColor: Palette.border },
    avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    avgDash: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Palette.text },
    avgChip: {
        backgroundColor: Palette.text, borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm, paddingVertical: 2, marginLeft: Spacing.xs,
    },
    avgChipText: { fontFamily: Fonts.bold, fontSize: 9, color: Palette.white },
    chartLabels: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    chartLabel: { flex: 1, textAlign: 'center', fontFamily: Fonts.regular, fontSize: 10, color: Palette.textSecondary },
    chartLabelMuted: { color: Palette.border },
    coach: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        lineHeight: 20, marginTop: Spacing.xl,
    },

    goal: { marginBottom: Spacing.xl },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    goalLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    reached: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    reachedText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.success },
    shortfall: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textSecondary },
    goalTrack: { height: 10, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    goalFill: { height: '100%', borderRadius: Radius.pill },
    goalMark: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: Palette.borderStrong },
    goalMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.xs },
    noTarget: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 },

    guidanceLabel: { fontFamily: Fonts.bold, fontSize: 11, color: Palette.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    guidanceDirective: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.text, marginTop: 2, lineHeight: 19 },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
    link: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },
    footerLink: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
        marginTop: Spacing.xxl, paddingVertical: Spacing.md,
    },
    footerLinkText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },

    empty: { alignItems: 'center', paddingHorizontal: Spacing.xxxl, marginTop: Spacing.xxxl * 2, gap: Spacing.md },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
    emptyCta: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.lg,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.md,
    },
    emptyCtaText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.white },
});
