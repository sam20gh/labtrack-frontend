/**
 * How is this worked out?
 *
 * **Not an optional screen.** The lab half is a published equation and the behavioural half is
 * an aggregation whose composite has never been validated — and the second is the half most
 * people's number will lean on, because most people have a watch and no recent bloods. A
 * product that shows somebody a biological age without a reachable page explaining which of
 * those they are looking at is making a claim it has not earned.
 *
 * It is also the screen that has to survive being read by a clinician, so it names the paper,
 * the markers and the limits rather than gesturing at "science".
 *
 * The copy lives here rather than on the server, unlike `biomarkerGlossary`: this is a
 * description of *how the software works*, not clinical guidance about a result, so it changes
 * when the code changes and shipping the two together is the point. The per-result wording —
 * the disclaimers, the refusal messages — stays server-side for exactly the opposite reason.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AgeHowScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>How this works</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <Text style={styles.lede}>
                    Your Predyqt Age is built from two separate estimates. They are not equally well
                    founded, and the app always tells you which one you are looking at.
                </Text>

                <Block
                    icon="flask-outline"
                    title="From your blood results"
                    strength="Published and peer-reviewed"
                    strong
                >
                    <P>
                        This uses PhenoAge, published by Levine and colleagues in PLOS Medicine in 2018.
                        It takes nine routine markers — albumin, creatinine, glucose, C-reactive protein,
                        lymphocyte percentage, red cell size, red cell variation, alkaline phosphatase and
                        white cell count — alongside your age.
                    </P>
                    <P>
                        The method was developed against a large national health survey with long-term
                        follow-up, and its coefficients are the published ones. We have not adjusted them.
                    </P>
                    <P>
                        All nine are needed. We never fill in a missing marker with an average, because
                        the result would mostly be that average wearing your name and you would have no
                        way to tell.
                    </P>
                </Block>

                <Block
                    icon="pulse-outline"
                    title="From your activity, sleep and vitals"
                    strength="Assembled from research — the combination is untested"
                >
                    <P>
                        This looks at six months of your cardio fitness, resting heart rate, daily steps,
                        hard-effort minutes, strength work, sleep length, sleep consistency, body mass
                        index and blood pressure.
                    </P>
                    <P>
                        Each one is weighted by published research on that measure by itself. Combining
                        them the way we do has not been tested against real outcomes — not by us and not
                        by anyone else — which is the honest difference between this half and the one
                        above it.
                    </P>
                    <P>
                        Measures of the same thing are not counted twice. Your fitness shows up in four
                        of those figures, so the strongest signal counts in full and the rest count for
                        progressively less.
                    </P>
                </Block>

                <Block icon="people-outline" title="You are compared with your peers">
                    <P>
                        Both halves compare you with typical people of your age and sex, not with an
                        ideal. Someone sitting on the average for everything we measure comes out at
                        exactly their own age.
                    </P>
                    <P>
                        That is deliberate. Scored against guidelines instead, almost everybody would
                        read as older than they are — which would make this a distance-from-perfect
                        score, not an age. The guidelines are still what the suggestions aim at.
                    </P>
                </Block>

                <Block icon="speedometer-outline" title="Pace of aging">
                    <P>
                        This is how fast the gap between your biological and calendar age is changing.
                        1.0× means it is holding steady. Below that it is closing, above it is widening.
                    </P>
                    <P>
                        Once there is enough history we measure it from your own readings over time.
                        Before that we show an early estimate from your last month compared with your
                        last six — it is labelled, because it is a projection rather than something we
                        have watched happen.
                    </P>
                </Block>

                <Block icon="alert-circle-outline" title="When we will not show a number" warn>
                    <P>
                        If your C-reactive protein was raised when the sample was taken, we do not
                        estimate from it. Fighting off an infection raises this estimate by years on its
                        own, and that is not what your body is like the rest of the time.
                    </P>
                    <P>
                        We also hold back when a result looks like it was recorded in a different unit,
                        when you are under 20 — every method here was developed on adults — and when
                        there is simply not enough to work from. In each case we say which, rather than
                        showing you a number we do not stand behind.
                    </P>
                </Block>

                <View style={styles.limits}>
                    <Text style={styles.limitsTitle}>What this is not</Text>
                    <Limit text="It is not a diagnosis, and it cannot see anything your results did not measure." />
                    <Limit text="It does not predict how long you will live, and we will not show you anything that implies it does." />
                    <Limit text="A single reading moves it. Two panels months apart are two measurements, not a trend." />
                    <Limit text="Talk to a clinician about anything that concerns you. This is a summary of your records." />
                </View>

                <Text style={styles.source}>
                    Levine ME, Liu Z, Kuo P-L, Horvath S, Crimmins EM, Ferrucci L. A new aging measure
                    captures morbidity and mortality risk across diverse subpopulations from NHANES IV.
                    PLOS Medicine, 2018.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const Block = ({ icon, title, strength, strong, warn, children }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    strength?: string;
    strong?: boolean;
    warn?: boolean;
    children: React.ReactNode;
}) => (
    <View style={[styles.block, warn && styles.blockWarn]}>
        <View style={styles.blockHead}>
            <Ionicons name={icon} size={18} color={warn ? Palette.warning : Palette.primary} />
            <Text style={styles.blockTitle}>{title}</Text>
        </View>
        {!!strength && (
            <View style={[styles.strengthChip, strong ? styles.strengthStrong : styles.strengthSoft]}>
                <Text style={[styles.strengthText, strong ? styles.strengthTextStrong : styles.strengthTextSoft]}>
                    {strength}
                </Text>
            </View>
        )}
        {children}
    </View>
);

const P = ({ children }: { children: React.ReactNode }) => <Text style={styles.p}>{children}</Text>;

const Limit = ({ text }: { text: string }) => (
    <View style={styles.limitRow}>
        <Ionicons name="remove" size={14} color={Palette.textMuted} />
        <Text style={styles.limitText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    lede: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.text, lineHeight: 21, marginBottom: Spacing.lg },

    block: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Palette.border, marginBottom: Spacing.md,
    },
    blockWarn: { borderColor: Palette.warningSurface, backgroundColor: Palette.warningSurface },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    blockTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text, flex: 1 },
    strengthChip: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, marginBottom: Spacing.sm },
    strengthStrong: { backgroundColor: Palette.successSurface },
    strengthSoft: { backgroundColor: Palette.surface },
    strengthText: { fontFamily: Fonts.semibold, fontSize: 10.5 },
    strengthTextStrong: { color: Palette.successDeep },
    strengthTextSoft: { color: Palette.textSecondary },
    p: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },

    limits: { marginTop: Spacing.lg, gap: Spacing.sm },
    limitsTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text, marginBottom: Spacing.xs },
    limitRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    limitText: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, lineHeight: 19, flex: 1 },

    source: { fontFamily: Fonts.regular, fontSize: 10.5, color: Palette.textMuted, lineHeight: 16, marginTop: Spacing.xl },
});
