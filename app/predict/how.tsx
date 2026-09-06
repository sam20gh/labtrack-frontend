/**
 * "How do we predict?" — the design's frame 14.
 *
 * The kit's three steps are "We analyse your data / We use the power of AI / You get accurate
 * prediction", and the middle and last are not true of what was built. The numbers come from
 * a weighted regression over the person's own readings; the model writes the sentences around
 * them; and nothing about a projection from a handful of measurements is accurate — it is
 * bounded, which is a different and better claim.
 *
 * The steps below say what actually happens. That matters more here than on any other screen
 * in the feature, because this is the screen somebody opens when they are deciding whether to
 * believe the rest of it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getStatus, getAccuracy, type Accuracy } from '@/lib/prediction';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const STEPS = [
    {
        title: 'We read what you have logged',
        body: 'Only your own recorded readings — synced sessions, logged weights, blood-pressure '
            + 'entries, meals. Nothing from anyone else, and no population averages.',
    },
    {
        title: 'We fit a line through them',
        body: 'A weighted regression that counts recent readings more heavily than old ones, and '
            + 'reports a range rather than a single number. It runs the same way every time, so '
            + 'the same data always gives the same answer.',
    },
    {
        title: 'AI writes the explanation',
        body: 'A language model turns the projection into sentences. It is given the figures and '
            + 'cannot change them — every number you see came from the arithmetic above.',
    },
    {
        title: 'We check ourselves afterwards',
        body: 'When the date arrives we compare the prediction against what you actually measured, '
            + 'and keep the score.',
    },
];

export default function HowWePredictScreen() {
    const router = useRouter();
    const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
    const [narrative, setNarrative] = useState<boolean | null>(null);

    useEffect(() => {
        getAccuracy().then((r) => setAccuracy(r.overall)).catch(() => { });
        getStatus().then((s) => setNarrative(s.narrative)).catch(() => { });
    }, []);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.mark}>
                    <Ionicons name="help" size={26} color={Palette.textSecondary} />
                </View>

                <Text style={styles.title}>How do we predict?</Text>
                <Text style={styles.blurb}>
                    We project your own measurements forward. There is no crystal ball and no
                    population model — just your readings, a line through them, and an honest
                    range around it.
                </Text>

                {STEPS.map((step, i) => (
                    <View key={step.title} style={styles.step}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.stepTitle}>{step.title}</Text>
                            <Text style={styles.stepBody}>{step.body}</Text>
                        </View>
                    </View>
                ))}

                {/* The scorecard. On this screen rather than hidden, because it is the answer to
                    the question this screen is opened to ask. */}
                <View style={styles.scoreCard}>
                    <Text style={styles.scoreTitle}>How we have done so far</Text>
                    {accuracy ? (
                        <>
                            <Text style={styles.scoreValue}>{accuracy.withinIntervalPct}%</Text>
                            <Text style={styles.scoreBody}>
                                of your {accuracy.resolved} checked predictions landed inside the range we
                                gave{accuracy.medianErrorPct !== null
                                    ? `, with a typical miss of ${accuracy.medianErrorPct}%.`
                                    : '.'}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.scoreBody}>
                            None of your predictions have reached their target date with a reading to
                            check against yet. When they do, the score appears here.
                        </Text>
                    )}
                </View>

                {narrative === false ? (
                    <View style={styles.notice}>
                        <Ionicons name="information-circle-outline" size={18} color={Palette.info} />
                        <Text style={styles.noticeText}>
                            Written explanations are unavailable right now, so predictions are showing the
                            projection alone. The numbers are unaffected.
                        </Text>
                    </View>
                ) : null}

                <Text style={styles.footer}>
                    Predictions are not a diagnosis, not a measurement, and not a substitute for
                    clinical advice. If a reading worries you, speak to a clinician rather than
                    waiting for a projected date.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl, alignItems: 'center' },
    mark: {
        width: 54, height: 54, borderRadius: 27, backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl,
    },
    title: {
        fontSize: 26, fontFamily: Fonts.bold, color: Palette.text,
        textAlign: 'center', marginTop: Spacing.lg,
    },
    blurb: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
        marginTop: Spacing.md, marginBottom: Spacing.xl,
    },
    step: {
        flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch',
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        padding: Spacing.lg, marginBottom: Spacing.md,
    },
    stepNumber: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    stepNumberText: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.primary },
    stepTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text },
    stepBody: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular,
        color: Palette.textSecondary, marginTop: 3,
    },
    scoreCard: {
        alignSelf: 'stretch', backgroundColor: Palette.primarySurface,
        borderRadius: Radius.lg, padding: Spacing.xl, marginTop: Spacing.lg, gap: 4,
    },
    scoreTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    scoreValue: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text },
    scoreBody: { fontSize: 13, lineHeight: 20, fontFamily: Fonts.regular, color: Palette.text },
    notice: {
        flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch',
        backgroundColor: Palette.infoSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginTop: Spacing.md,
    },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.text },
    footer: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular,
        color: Palette.textMuted, textAlign: 'center', marginTop: Spacing.xl,
    },
});
