/**
 * The dashboard's first-run card — `Design/activity.svg` frame 0's hero, brought onto the
 * dashboard itself.
 *
 * The kit opens the tracker with a five-screen questionnaire (frames 0–5) ending in
 * activity suggestions. None of it is built, and the suggestions would have to come from
 * somewhere: this app's exercise advice comes from the health plan, not from a quiz. What
 * frame 0 does well is say what the screen is *for* before it shows a chart of zeros, so
 * that is the part kept — the picture and one sentence, above two ways to get data in.
 *
 * Shown only when nothing at all has arrived: no sessions and no measured day. Someone
 * whose phone synced a week of steps has data, and greeting them as a newcomer would read
 * as the app not having noticed.
 *
 * The copy does not promise "AI insights", which is what the kit's title says. Every
 * reading on this dashboard comes from `utils/activityInsight.js`, a deterministic table.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { RunnerHeroArt, RUNNER_HERO_ART } from './art';

interface Props {
    onLog: () => void;
    /** Omitted where the platform has no health store to connect. */
    onConnect?: () => void;
}

export function WelcomeCard({ onLog, onConnect }: Props) {
    const { width } = useWindowDimensions();
    // Held to a size where the figure reads as a figure and the card stays one screen.
    const artWidth = Math.min(RUNNER_HERO_ART.width, width * 0.5);

    return (
        <LinearGradient
            colors={[Palette.primaryTint, Palette.white]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.card}
        >
            <View
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
            >
                <RunnerHeroArt width={artWidth} />
            </View>

            <Text style={styles.title} accessibilityRole="header">Track your activity, see your insights</Text>
            <Text style={styles.body}>
                Log a workout or connect your health app. Your steps, sessions and streaks will
                fill this page — and count towards your health plan.
            </Text>

            <View style={styles.actions}>
                <Pressable
                    onPress={onLog}
                    style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                    accessibilityRole="button"
                >
                    <Ionicons name="add" size={18} color={Palette.white} />
                    <Text style={styles.primaryText}>Log activity</Text>
                </Pressable>
                {onConnect && (
                    <Pressable
                        onPress={onConnect}
                        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                        accessibilityRole="button"
                    >
                        <Ionicons name="watch-outline" size={17} color={Palette.primary} />
                        <Text style={styles.secondaryText}>Connect</Text>
                    </Pressable>
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.primaryPale,
        padding: Spacing.xl,
        alignItems: 'center',
    },
    art: { marginBottom: Spacing.lg },
    title: { fontSize: 19, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    body: {
        fontSize: 13,
        ...BodyFont.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 19,
        marginTop: Spacing.sm,
    },
    actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl, alignSelf: 'stretch' },
    primary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Palette.primary,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
    },
    primaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
    secondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Palette.white,
        borderWidth: 1,
        borderColor: Palette.primaryPale,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
    },
    secondaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    pressed: { opacity: 0.8 },
});
