/**
 * "How it went" and "How to improve" for one night or nap — drawn from
 * `utils/sleepAnalysis.js`, which is a deterministic table on the server.
 *
 * Attention findings are amber, never `danger`: `danger` is a verdict on a result, and a
 * short night is not one. The same line `Palette.alert` draws for error screens.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type { SleepAnalysis, SleepAnalysisTone } from '@/lib/sleep';

const TONE: Record<SleepAnalysisTone, {
    icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; surface: string;
}> = {
    positive: { icon: 'checkmark-circle', tint: Palette.success, surface: Palette.successSurface },
    neutral: { icon: 'ellipse', tint: Palette.primary, surface: Palette.primarySurface },
    attention: { icon: 'alert-circle', tint: Palette.amber, surface: Palette.warningSurface },
};

const HEADLINE_TINT: Record<SleepAnalysis['tone'], string> = {
    positive: Palette.success,
    mixed: Palette.primary,
    attention: Palette.amber,
};

export function SleepAnalysisCard({ analysis }: { analysis: SleepAnalysis }) {
    const router = useRouter();

    return (
        <>
            <View style={styles.card}>
                <Text style={styles.eyebrow}>{analysis.kind === 'nap' ? 'How the nap went' : 'How the night went'}</Text>
                <Text style={[styles.headline, { color: HEADLINE_TINT[analysis.tone] }]}>{analysis.headline}</Text>
                <View style={{ gap: Spacing.md }}>
                    {analysis.findings.map((f) => {
                        const t = TONE[f.tone];
                        return (
                            <View key={f.key} style={styles.row}>
                                <View style={[styles.icon, { backgroundColor: t.surface }]}>
                                    <Ionicons name={t.icon} size={14} color={t.tint} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                    <Text style={styles.title}>{f.title}</Text>
                                    <Text style={styles.detail}>{f.detail}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {analysis.recommendations.length ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>How to improve</Text>
                    <View style={{ gap: Spacing.md }}>
                        {analysis.recommendations.map((r, i) => {
                            const body = (
                                <>
                                    <View style={styles.step}>
                                        <Text style={styles.stepText}>{i + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1, gap: 2 }}>
                                        {r.source === 'plan' ? <Text style={styles.planTag}>Your health plan</Text> : null}
                                        <Text style={styles.title}>{r.source === 'plan' ? r.detail : r.title}</Text>
                                        {r.source === 'plan' ? null : <Text style={styles.detail}>{r.detail}</Text>}
                                    </View>
                                    {r.route ? <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} /> : null}
                                </>
                            );
                            return r.route ? (
                                <Pressable
                                    key={r.key}
                                    style={styles.row}
                                    onPress={() => router.push(r.route as Href)}
                                    accessibilityRole="link"
                                >
                                    {body}
                                </Pressable>
                            ) : (
                                <View key={r.key} style={styles.row}>{body}</View>
                            );
                        })}
                    </View>
                    <Text style={styles.basis}>{analysis.basis}</Text>
                </View>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.background,
        borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.md,
        ...Shadow.card,
    },
    eyebrow: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
    headline: { fontSize: 17, fontFamily: Fonts.bold, marginTop: -Spacing.xs },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    step: {
        width: 22, height: 22, borderRadius: 11, marginTop: 1,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    stepText: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.primary },
    title: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    detail: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 19 },
    planTag: { fontSize: 10, fontFamily: Fonts.semibold, color: Palette.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    basis: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 16 },
});
