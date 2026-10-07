/**
 * Welcome — where a new account lands after its first sign-in.
 *
 * It replaces landing on an empty home screen. That screen draws a card only when it has
 * something to report, so for somebody with no data it was close to blank, and nothing on it
 * said what to do. The steps were all in the app; nothing put them in order.
 *
 * Three decisions behind this screen:
 *
 *  1. **It sets out the timeline before asking for anything.** The DNA report takes about
 *     two weeks. A wait somebody expects feels like progress; one they did not expect feels
 *     broken. So the hero says what happens today, this week and in about two weeks, and the
 *     steps below are what fills the first two.
 *  2. **It is a hub, not a wizard.** Each step is a screen that already exists — the
 *     assessment, the storefront, add-result, the bracelet — opened with `returnTo` so it
 *     comes back here. A wizard would have to own all four, and would be lost the moment
 *     somebody closed the app halfway through, which over a two-week journey is certain.
 *  3. **Everything is skippable and nothing blocks home.** "Not now" is remembered by the
 *     server and the home journey card keeps the step. Being made to order a kit before you
 *     can see the app you downloaded is how an app gets deleted.
 *
 * Seen once: the server records `welcomedAt` on the first visit, and `landAfterSignIn` only
 * sends people here while that is unset and the profile is unanswered. After that the journey
 * card on home carries the same steps.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { BodyFont, Fonts, Palettes, Radius, Shadow, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { HeroStatusBar } from '@/components/ui/HeroStatusBar';
import { StepRow } from '@/components/onboarding/StepRow';
import { KitTracker } from '@/components/onboarding/KitTracker';
import {
    getJourney, markWelcomed, openStep, resumeStep, skipStep,
    type Journey, type StepKey,
} from '@/lib/onboarding';
import { ApiError } from '@/lib/api';

const HERE = '/welcome';

/** The two-week shape of it, said once, in the person's terms. */
const TIMELINE = [
    { when: 'Today', what: 'Tell us about you, and bring in any results you already have' },
    { when: 'This week', what: 'Your kits arrive. A bracelet starts learning your sleep and heart' },
    { when: 'In about 2 weeks', what: 'Your DNA results complete the picture, and your plan updates' },
];

export default function WelcomeScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();

    const [journey, setJourney] = useState<Journey | null>(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setJourney(await getJourney());
            setError(false);
        } catch (e) {
            if (e instanceof ApiError && e.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(true);
        }
    }, [router]);

    // Refresh on every return: each step is another screen, and coming back is how the hub
    // learns a step was finished.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Seen. Fire and forget — failing to record it costs, at worst, this screen once more.
    useEffect(() => { markWelcomed().catch(() => {}); }, []);

    const goHome = () => router.replace('/(tabs)');

    const choose = async (fn: () => Promise<Journey>) => {
        setBusy(true);
        try {
            setJourney(await fn());
        } catch {
            Toast.show({ type: 'error', text1: 'That did not save', text2: 'Please try again.' });
        } finally {
            setBusy(false);
        }
    };

    if (!journey) {
        return (
            <View style={[styles.screen, styles.centre]}>
                {error ? (
                    <>
                        <Text style={styles.errorText}>We could not load your setup.</Text>
                        <TouchableOpacity onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
                        <TouchableOpacity onPress={goHome} hitSlop={8}><Text style={styles.later}>Go to my home</Text></TouchableOpacity>
                    </>
                ) : (
                    <ActivityIndicator color={Palette.primary} />
                )}
            </View>
        );
    }

    const next = journey.next;
    const packageStep = journey.steps.find((s) => s.key === 'package');
    const foundOrder = packageStep?.status === 'done' && journey.kits.length > 0;

    return (
        <View style={styles.screen}>
            <HeroStatusBar />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <LinearGradient colors={Palette.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                    <SafeAreaView edges={['top']}>
                        <Text style={styles.kicker}>WELCOME TO PREDYQT</Text>
                        <Text style={styles.heroTitle}>Let’s get you set up</Text>
                        <Text style={styles.heroBody}>
                            Predyqt reads your blood, your DNA and your days together. Here is how the next two weeks go.
                        </Text>

                        <View style={styles.timeline}>
                            {TIMELINE.map((t, i) => (
                                <View key={t.when} style={styles.tlRow}>
                                    <View style={styles.tlRail}>
                                        <View style={[styles.tlDot, i === 0 && styles.tlDotNow]} />
                                        {i < TIMELINE.length - 1 ? <View style={styles.tlLine} /> : null}
                                    </View>
                                    <View style={styles.tlText}>
                                        <Text style={styles.tlWhen}>{t.when}</Text>
                                        <Text style={styles.tlWhat}>{t.what}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {foundOrder ? (
                        <View style={styles.found}>
                            <Ionicons name="gift-outline" size={18} color={Palette.success} />
                            <Text style={styles.foundText}>
                                We found your order — {packageStep?.detail?.replace(/ ordered$/, '')}. You can follow it below.
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle}>Your first steps</Text>
                        <Text style={styles.count}>{journey.progress.done} of {journey.progress.total} done</Text>
                    </View>

                    {journey.steps.map((step, i) => (
                        <StepRow
                            key={step.key}
                            step={step}
                            index={i}
                            busy={busy}
                            onOpen={(route) => openStep(router, route, HERE)}
                            onSkip={() => choose(() => skipStep(step.key as StepKey))}
                            onResume={() => choose(() => resumeStep(step.key as StepKey))}
                        />
                    ))}

                    {journey.kits.length ? (
                        <View style={styles.kits}>
                            <Text style={styles.kitsTitle}>Your parcels</Text>
                            <KitTracker kits={journey.kits} />
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            <SafeAreaView edges={['bottom']} style={styles.footer}>
                {next ? (
                    <TouchableOpacity
                        style={styles.primary}
                        onPress={() => openStep(router, next.route, HERE)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryText}>{next.label}</Text>
                        <Ionicons name="arrow-forward" size={18} color={Palettes.light.white} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.primary} onPress={goHome} accessibilityRole="button">
                        <Text style={styles.primaryText}>Go to my home</Text>
                        <Ionicons name="arrow-forward" size={18} color={Palettes.light.white} />
                    </TouchableOpacity>
                )}
                {next ? (
                    <TouchableOpacity onPress={goHome} hitSlop={8} style={styles.laterWrap} accessibilityRole="button">
                        <Text style={styles.later}>I’ll finish this later</Text>
                    </TouchableOpacity>
                ) : null}
            </SafeAreaView>
        </View>
    );
}

const WHITE = Palettes.light.white;

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
    content: { paddingBottom: Spacing.xxxl },

    hero: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
    kicker: { fontSize: 12, fontFamily: Fonts.semibold, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2, marginTop: Spacing.lg },
    heroTitle: { fontSize: 28, fontFamily: Fonts.bold, color: WHITE, marginTop: Spacing.sm },
    heroBody: { fontSize: 15, ...BodyFont.regular, color: 'rgba(255,255,255,0.88)', lineHeight: 22, marginTop: Spacing.sm },

    timeline: { marginTop: Spacing.xl },
    tlRow: { flexDirection: 'row', gap: Spacing.md },
    tlRail: { width: 14, alignItems: 'center' },
    tlDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', marginTop: 4 },
    tlDotNow: { backgroundColor: WHITE, borderColor: WHITE },
    tlLine: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 2 },
    tlText: { flex: 1, paddingBottom: Spacing.md },
    tlWhen: { fontSize: 13, fontFamily: Fonts.semibold, color: WHITE },
    tlWhat: { fontSize: 13, ...BodyFont.regular, color: 'rgba(255,255,255,0.8)', lineHeight: 19, marginTop: 1 },

    body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
    found: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.successSurface, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.lg,
    },
    foundText: { flex: 1, fontSize: 14, ...BodyFont.regular, color: Palette.text, lineHeight: 20 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.md },
    sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    count: { fontSize: 13, ...BodyFont.medium, color: Palette.textSecondary },

    kits: {
        marginTop: Spacing.lg, backgroundColor: Palette.background, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },
    kitsTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, marginBottom: Spacing.md },

    footer: {
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
        backgroundColor: Palette.canvas, borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingVertical: 15,
        ...Shadow.card,
    },
    primaryText: { fontSize: 16, fontFamily: Fonts.bold, color: WHITE },
    laterWrap: { alignItems: 'center', paddingVertical: Spacing.md },
    later: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },

    errorText: { fontSize: 15, ...BodyFont.regular, color: Palette.text },
    retry: { backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 12 },
    retryText: { fontSize: 15, fontFamily: Fonts.bold, color: WHITE },
}));
