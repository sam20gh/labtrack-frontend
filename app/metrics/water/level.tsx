/**
 * Your Hydration Level — `Design/hydration.svg` frame 7.
 *
 * The ladder, what each rung means, and how the target under it was arrived at.
 *
 * **What this screen refuses to be is a goal editor.** The kit's next five frames are "Set
 * Hydration Goal": weight, activity and sex on a form, a suggested figure, and a slider to
 * override it. LabTrack derives the target instead — `utils/hydrationTargets.js` computes
 * 33 ml/kg of measured body mass plus 8 ml per recorded minute of exercise, clamped to a
 * ceiling that exists because water intoxication is real and the people most likely to chase
 * a number on a screen are the ones who should not. There is no endpoint that writes a
 * user-set goal, and building the form would be five screens of controls that save nothing —
 * the dummy control this app keeps removing. So the screen shows **the derivation** in the
 * kit's place: the same three inputs, each with what it currently contributes and where it is
 * changed, which is the honest version of that form.
 *
 * The rung labels are the server's. See the note in `HydrationLevelMeter`.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getHydrationToday, type HydrationToday } from '@/lib/metrics';
import { attainment, drops, splitVolume } from '@/lib/hydration';
import { useUnits, formatVolume } from '@/lib/units';
import { HydrationLevelMeter } from '@/components/hydration/HydrationLevelMeter';
import { DropRow } from '@/components/hydration/WaterDrop';
import { WaterHeader, SectionHeader, cardStyles } from '@/components/hydration/HydrationChrome';
import { Palette, Spacing, Fonts } from '@/constants/theme';

/**
 * How to move up a rung.
 *
 * Behavioural and non-numeric on purpose: a figure here would eventually contradict the
 * derived target above it, which is the rule `biomarkerGlossary.js` and
 * `medicationCatalogue.js` both hold — no numbers in copy that sits beside a computed one.
 */
const STEPS = [
    'Drink small amounts through the day rather than a lot at once — it is absorbed better and is easier to keep up.',
    'Eat foods with water in them. Cucumber, oranges and watermelon all count towards the day.',
    'Keep a bottle you know the volume of nearby, so logging is a tap rather than a guess.',
    'Drink more around exercise, heat, and long stretches of talking or moving. Your target already rises with recorded activity.',
];

export default function HydrationLevelScreen() {
    const router = useRouter();
    const units = useUnits();

    const [today, setToday] = useState<HydrationToday | null>(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setToday(await getHydrationToday());
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const levels = today?.levels ?? [];
    const level = today?.level ?? null;
    const target = today?.targetMl ?? null;
    const consumed = today?.consumedMl ?? 0;
    const goalDrops = drops(consumed, target);
    const targetSplit = splitVolume(target, units);
    const number = level && levels.length
        ? levels.length - levels.findIndex((l) => l.key === level.key)
        : null;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <WaterHeader title="Your Hydration Level" />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.top}>
                    <Text style={styles.eyebrow}>
                        {number !== null ? `LEVEL ${number}` : 'NOT TRACKED TODAY'}
                    </Text>
                    <Text style={styles.title}>{level?.label ?? 'Nothing logged'}</Text>
                    <Text style={styles.subtitle}>
                        {level
                            ? level.blurb
                            : 'A day with no entries is a day nothing was measured on — not a day you were dehydrated.'}
                    </Text>
                </View>

                <HydrationLevelMeter levels={levels} activeKey={level?.key ?? null} />

                {/* ---- What the levels mean ------------------------------------- */}
                <SectionHeader title="What your level means" />
                <View style={cardStyles.card}>
                    {levels.map((l, i) => {
                        const expanded = open === l.key;
                        return (
                            <Pressable
                                key={l.key}
                                style={[styles.rung, i > 0 && styles.rungDivided]}
                                onPress={() => setOpen(expanded ? null : l.key)}
                                accessibilityRole="button"
                                accessibilityState={{ expanded }}
                                accessibilityLabel={`Level ${levels.length - i}, ${l.label}`}
                            >
                                <View style={styles.rungHead}>
                                    <View style={[styles.badge, l.key === level?.key && styles.badgeActive]}>
                                        <Text style={[styles.badgeText, l.key === level?.key && styles.badgeTextActive]}>
                                            {levels.length - i}
                                        </Text>
                                    </View>
                                    <Text style={styles.rungLabel}>Level {levels.length - i}</Text>
                                    <Text style={styles.rungName}>{l.label}</Text>
                                    <Ionicons
                                        name={expanded ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color={Palette.textMuted}
                                    />
                                </View>
                                {expanded && <Text style={styles.rungBlurb}>{l.blurb}</Text>}
                            </Pressable>
                        );
                    })}
                </View>

                {/* ---- Where the target comes from ------------------------------- */}
                <SectionHeader title="Your daily target" />
                <View style={cardStyles.card}>
                    <Text style={styles.big}>
                        {targetSplit.value}<Text style={styles.bigUnit}>{targetSplit.unit}</Text>
                    </Text>
                    <Text style={styles.blurb}>
                        {formatVolume(consumed, units)} logged so far — {Math.round(attainment(consumed, target) * 100)}% of it.
                    </Text>

                    <View style={styles.divider} />
                    <DropRow filled={goalDrops.filled} total={goalDrops.total} />
                    <View style={styles.divider} />

                    {/*
                      The kit's three form rows, made honest: each says what it contributes and
                      where it is actually changed. Nothing on this card writes a target.
                    */}
                    {(today?.basis ?? []).map((line) => (
                        <View key={line} style={styles.basisRow}>
                            <Ionicons name="ellipse" size={6} color={Palette.primary} />
                            <Text style={styles.basisText}>{line}</Text>
                        </View>
                    ))}

                    <Pressable
                        style={styles.link}
                        onPress={() => router.push('/metrics/log/weight')}
                        accessibilityRole="button"
                    >
                        <Ionicons name="barbell-outline" size={16} color={Palette.primary} />
                        <Text style={styles.linkText}>Log your weight to sharpen this</Text>
                        <Ionicons name="chevron-forward" size={15} color={Palette.textMuted} />
                    </Pressable>
                    <Pressable
                        style={styles.link}
                        onPress={() => router.push('/activity')}
                        accessibilityRole="button"
                    >
                        <Ionicons name="fitness-outline" size={16} color={Palette.primary} />
                        <Text style={styles.linkText}>Recorded activity raises it automatically</Text>
                        <Ionicons name="chevron-forward" size={15} color={Palette.textMuted} />
                    </Pressable>
                </View>

                {/* ---- How to improve -------------------------------------------- */}
                <SectionHeader title="How to move up a level" />
                <View style={cardStyles.card}>
                    {STEPS.map((step, i) => (
                        <View key={step} style={styles.step}>
                            <View style={styles.stepRail}>
                                <View style={styles.stepDot} />
                                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.stepTitle}>Step {i + 1}</Text>
                                <Text style={styles.stepText}>{step}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* The caution that travels with every target. Never edited down. */}
                {today?.note ? <Text style={styles.note}>{today.note}</Text> : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.xl },

    top: { alignItems: 'center', gap: 4 },
    eyebrow: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.primary, letterSpacing: 1.2 },
    title: { fontFamily: Fonts.bold, fontSize: 28, color: Palette.text },
    subtitle: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 19, paddingHorizontal: Spacing.lg,
    },

    rung: { paddingVertical: Spacing.md },
    rungDivided: { borderTopWidth: 1, borderTopColor: Palette.border },
    rungHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    badge: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 1.5, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    badgeActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    badgeText: { fontFamily: Fonts.semibold, fontSize: 11.5, color: Palette.textSecondary },
    badgeTextActive: { color: Palette.primary },
    rungLabel: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    rungName: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary },
    rungBlurb: {
        fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary,
        marginTop: Spacing.sm, marginLeft: 32, lineHeight: 18,
    },

    big: { fontFamily: Fonts.bold, fontSize: 30, color: Palette.text },
    bigUnit: { fontFamily: Fonts.medium, fontSize: 15, color: Palette.textSecondary },
    blurb: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
    divider: { height: 1, backgroundColor: Palette.border, marginVertical: Spacing.lg },

    basisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
    basisText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, lineHeight: 18 },

    link: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Palette.border,
    },
    linkText: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: Palette.text },

    step: { flexDirection: 'row', gap: Spacing.md },
    stepRail: { alignItems: 'center', width: 16 },
    stepDot: {
        width: 12, height: 12, borderRadius: 6, marginTop: 4,
        borderWidth: 3, borderColor: Palette.primary, backgroundColor: Palette.white,
    },
    stepLine: { flex: 1, width: 2, backgroundColor: Palette.primaryLight, marginVertical: 3 },
    stepTitle: { fontFamily: Fonts.semibold, fontSize: 13.5, color: Palette.text },
    stepText: {
        fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary,
        marginTop: 2, marginBottom: Spacing.lg, lineHeight: 18,
    },

    note: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, lineHeight: 17 },
});
