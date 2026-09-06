/**
 * "Explore your health & wellness achievements" — the design's frame 1.
 *
 * Shown once, gated on `ACHIEVEMENTS_INTRO_KEY`, on the same terms as the predictions and
 * resources intros: a splash somebody has to dismiss on every visit is a tax on the feature
 * it advertises.
 *
 * **The three points say what a badge is, because that is the thing most likely to be
 * misread.** A scoreboard inside a health app invites exactly one wrong assumption — that a
 * high number means a healthy person — and this is the screen where that has to be settled.
 * Every badge counts an action; none of them reads a result. See the note at the top of
 * `utils/achievementCatalogue.js` for why that line is drawn where it is.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACHIEVEMENTS_INTRO_KEY } from '@/lib/achievements';
import { AchievementIllustration } from '@/components/achievements/AchievementIllustration';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AchievementsIntroScreen() {
    const router = useRouter();

    const start = async () => {
        await AsyncStorage.setItem(ACHIEVEMENTS_INTRO_KEY, 'true').catch(() => { });
        router.replace('/achievements');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                <AchievementIllustration width={310} />

                <Text style={styles.title}>Explore your health &{'\n'}wellness achievements</Text>
                <Text style={styles.subtitle}>
                    Badges for what you do here — sessions recorded, meals logged, doses taken.
                    Collect them, level them up, and share the ones you are proud of.
                </Text>

                <View style={styles.points}>
                    <Point icon="ribbon-outline" text="24 badges, each with four levels to climb" />
                    <Point icon="shield-checkmark-outline" text="They count what you did, never what your results say" />
                    <Point icon="share-social-outline" text="Share a badge as a card — nothing else goes with it" />
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.cta} onPress={start} accessibilityRole="button">
                    <Text style={styles.ctaText}>See Achievements</Text>
                    <Ionicons name="trophy-outline" size={18} color={Palette.white} />
                </TouchableOpacity>
                <Text style={styles.small}>
                    Points measure how you use LabTrack. They are not a health score, and nobody
                    else can see your results.
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
