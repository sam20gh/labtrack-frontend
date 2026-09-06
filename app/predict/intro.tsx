/**
 * "Predict Your Health With The Power Of AI" — the design's frame 1.
 *
 * Shown once, gated on `PREDICT_INTRO_KEY`, on the same terms as the resources intro: a
 * splash somebody has to dismiss on every visit is a tax on the feature it advertises.
 *
 * **The copy is honest about what is behind it.** The kit's line is "With the power of our
 * LLM, we can accurately predict your health", and neither half of that is true here: the
 * numbers come from a weighted regression over the person's own readings, not from a model,
 * and nothing about a projection from a handful of measurements is accurate. The screen says
 * what actually happens instead — which is a better pitch anyway, because it is checkable.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PREDICT_INTRO_KEY } from '@/lib/prediction';
import { PredictIllustration } from '@/components/predict/PredictIllustration';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function PredictIntroScreen() {
    const router = useRouter();

    const start = async () => {
        await AsyncStorage.setItem(PREDICT_INTRO_KEY, 'true').catch(() => { });
        router.replace('/predict');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                <PredictIllustration width={310} />

                <Text style={styles.title}>Predict Your Health{'\n'}With The Power Of AI</Text>
                <Text style={styles.subtitle}>
                    We project your own recorded readings forward and show you the range they are
                    heading for — with how much of your history that projection actually rests on.
                </Text>

                <View style={styles.points}>
                    <Point icon="analytics-outline" text="Built from your logs, not from averages" />
                    <Point icon="git-branch-outline" text="Always a range, never a single number" />
                    <Point icon="checkmark-done-outline" text="Checked against what actually happens" />
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.cta} onPress={start} accessibilityRole="button">
                    <Text style={styles.ctaText}>Predict My Health</Text>
                    <Ionicons name="search" size={18} color={Palette.white} />
                </TouchableOpacity>
                <Text style={styles.small}>
                    Predictions are not a diagnosis and not a substitute for clinical advice.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const Point = ({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) => (
    <View style={styles.point}>
        <Ionicons name={icon} size={18} color={Palette.primary} />
        <Text style={styles.pointText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    topBar: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, alignItems: 'flex-start' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    title: {
        marginTop: Spacing.xxxl, fontSize: 26, lineHeight: 34,
        fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center',
    },
    subtitle: {
        marginTop: Spacing.md, fontSize: 14, lineHeight: 21,
        fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center',
    },
    points: { marginTop: Spacing.xxl, gap: Spacing.md, alignSelf: 'stretch' },
    point: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    pointText: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },
    footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, paddingVertical: 16, borderRadius: Radius.lg,
    },
    ctaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    small: {
        fontSize: 11, lineHeight: 16, fontFamily: Fonts.regular,
        color: Palette.textMuted, textAlign: 'center',
    },
});
