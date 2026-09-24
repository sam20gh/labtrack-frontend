/**
 * Predyqt Age — the first-run screen.
 *
 * Shown once, gated on `AGE_INTRO_KEY`, on the same terms as Predict, Resources and Badges: a
 * splash somebody has to dismiss on every visit is a tax on the feature it advertises.
 *
 * **The copy has to survive being checked**, which is a higher bar here than anywhere else in
 * the app. Every competitor's version of this screen says something like "we accurately
 * measure how fast you are aging", and there is no version of that sentence which is true. So
 * this one says what actually runs: a published equation on blood results, an aggregation of
 * published research on habits, and an honest note that the second has never been tested as a
 * whole. That is a better pitch anyway, because none of it can be contradicted by the first
 * screen the person lands on.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AgeOrb from '@/components/age/AgeOrb';
import { AGE_INTRO_KEY } from '@/lib/age';
import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

export default function AgeIntroScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();

    const start = async () => {
        await AsyncStorage.setItem(AGE_INTRO_KEY, 'true').catch(() => { });
        router.replace('/age');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                {/*
                  The orb, unlit and with no number. It is the thing the feature produces, and
                  showing it lit with an invented age would be advertising a result.
                */}
                <AgeOrb value={null} band={null} caption="Your age, from your own results" size={230} />

                <Text style={styles.title}>How old is your body?</Text>
                <Text style={styles.subtitle}>
                    Your chronological age counts birthdays. This estimates what your blood results
                    and your habits actually say — and what would change it.
                </Text>

                <View style={styles.points}>
                    <Point
                        icon="flask-outline"
                        title="From your blood results"
                        body="Using a published, peer-reviewed method built on nine routine markers."
                    />
                    <Point
                        icon="pulse-outline"
                        title="And from six months of your habits"
                        body="Sleep, movement, fitness and vitals, each weighted by published research."
                    />
                    <Point
                        icon="trending-down-outline"
                        title="With the things that would lower it"
                        body="Ranked by how many years each one is actually worth, for you."
                    />
                </View>

                <Text style={styles.caveat}>
                    It is not a diagnosis and it does not predict how long you will live. Combining
                    habit research this way has never been tested against real outcomes, and the
                    app says so wherever it shows you a number built that way.
                </Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.cta} onPress={start} accessibilityRole="button">
                    <Text style={styles.ctaText}>Work out my Predyqt Age</Text>
                    <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const Point = ({ icon, title, body }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.point}>
            <View style={styles.pointIcon}>
                <Ionicons name={icon} size={17} color={Palette.primary} />
            </View>
            <View style={styles.pointBody}>
                <Text style={styles.pointTitle}>{title}</Text>
                <Text style={styles.pointText}>{body}</Text>
            </View>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
    topBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    body: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl },
    title: { fontFamily: Fonts.bold, fontSize: 25, color: Palette.text, textAlign: 'center', marginTop: Spacing.md },
    subtitle: {
        ...BodyFont.regular, fontSize: 14, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 21, marginTop: Spacing.sm,
    },
    points: { width: '100%', marginTop: Spacing.xl, gap: Spacing.lg },
    point: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    pointIcon: {
        width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primarySurface,
    },
    pointBody: { flex: 1 },
    pointTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    pointText: { ...BodyFont.regular, fontSize: 12.5, color: Palette.textSecondary, lineHeight: 18, marginTop: 1 },
    caveat: {
        ...BodyFont.regular, fontSize: 11.5, color: Palette.textMuted,
        lineHeight: 17, marginTop: Spacing.xl, textAlign: 'center',
    },
    footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primaryFill, paddingVertical: Spacing.lg, borderRadius: Radius.pill,
    },
    ctaText: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.white },
}));
