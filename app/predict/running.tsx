/**
 * The purple "Checking our database… / Predicting your health… / Compiling Result…" screen —
 * the design's frame 6.
 *
 * **The three lines are not a timed animation over nothing.** Each one marks a stage the
 * request is actually in: the forecast runs server-side and the Opus call that writes the
 * prose is seconds on a cold path, so this screen exists because there is genuinely
 * something to wait for. The stage advances on a timer *up to* the last one and then holds
 * there until the request settles — a progress indicator that reaches "done" before the work
 * does is the thing that makes a wait feel broken rather than long.
 *
 * It is a `replace`, not a `push`: coming back from the result should land on the picker, not
 * on a spinner that would immediately run a second, billable prediction.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ApiError } from '@/lib/api';
import { predict, type MetricKey } from '@/lib/prediction';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const STAGES = [
    'Checking our database…',
    'Predicting your health…',
    'Compiling Result…',
];

/** How long each stage holds before the next takes over. */
const STAGE_MS = 1100;

export default function RunningPredictionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ metric: string; horizon: string }>();

    const [stage, setStage] = useState(0);
    const [error, setError] = useState<string | null>(null);
    /** A refusal is a state with a screen of its own, not an error. */
    const [refusal, setRefusal] = useState<{ message: string; label: string } | null>(null);

    // A screen that unmounts mid-request must not write state afterwards. The rule every
    // model-backed fetch in this app follows.
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setStage((s) => Math.min(s + 1, STAGES.length - 1));
        }, STAGE_MS);
        return () => clearInterval(timer);
    }, []);

    const run = useCallback(async () => {
        try {
            const result = await predict(params.metric as MetricKey, params.horizon);
            if (!mounted.current) return;

            if (!result.ok) {
                setRefusal({ message: result.refusal.message, label: result.metricLabel });
                return;
            }
            router.replace(`/predict/result?id=${result.data.id}`);
        } catch (err) {
            if (!mounted.current) return;
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'That prediction could not be run.');
        }
    }, [params.metric, params.horizon, router]);

    useEffect(() => { run(); }, [run]);

    if (refusal || error) {
        return (
            <SafeAreaView style={styles.failScreen} edges={['top', 'bottom']}>
                <View style={styles.failBody}>
                    <Ionicons
                        name={refusal ? 'bar-chart-outline' : 'alert-circle-outline'}
                        size={40}
                        color={refusal ? Palette.primary : Palette.warning}
                    />
                    <Text style={styles.failTitle}>
                        {refusal ? `Not enough ${refusal.label.toLowerCase()} data yet` : 'We could not run that'}
                    </Text>
                    <Text style={styles.failBodyText}>{refusal?.message ?? error}</Text>

                    <TouchableOpacity
                        style={styles.failCta}
                        onPress={() => router.back()}
                        accessibilityRole="button"
                    >
                        <Text style={styles.failCtaText}>Pick another metric</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <LinearGradient
            colors={[Palette.primaryDark, Palette.primary, Palette.primaryLight]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.screen}
        >
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                <View style={styles.stages}>
                    {STAGES.map((line, i) => (
                        <Text
                            key={line}
                            style={[
                                styles.stage,
                                i === stage && styles.stageActive,
                                i < stage && styles.stageDone,
                            ]}
                            accessibilityLiveRegion={i === stage ? 'polite' : 'none'}
                        >
                            {line}
                        </Text>
                    ))}
                </View>

                <View style={styles.mark}>
                    <Ionicons name="medkit" size={30} color={Palette.white} />
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    safe: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
    stages: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.xxl },
    stage: {
        fontSize: 18, fontFamily: Fonts.semibold,
        color: 'rgba(255,255,255,0.35)', textAlign: 'center',
    },
    stageActive: { color: Palette.white, fontSize: 19 },
    stageDone: { color: 'rgba(255,255,255,0.5)' },
    mark: { position: 'absolute', bottom: 60, opacity: 0.9 },

    failScreen: { flex: 1, backgroundColor: Palette.background },
    failBody: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        padding: Spacing.xl, gap: Spacing.md,
    },
    failTitle: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    failBodyText: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center',
    },
    failCta: {
        marginTop: Spacing.lg, backgroundColor: Palette.primary,
        paddingHorizontal: Spacing.xxl, paddingVertical: 14, borderRadius: Radius.lg,
    },
    failCtaText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
