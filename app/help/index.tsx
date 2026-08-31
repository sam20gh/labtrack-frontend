/**
 * Help Center — `Design/profile.svg`, frame 6.
 *
 * The kit draws three rows: FAQ, Chat Live Support, Leave a feedback. Two of those survive
 * intact; the third is the interesting one.
 *
 * **There is no live chat, so this screen does not draw one.** Frames 24 and 25 show a
 * support conversation with an "~1m reply time" chip and a row of agent avatars. Nothing
 * in `labtrack-backend` models a support thread, and no team is staffing one — a chat that
 * opens, accepts a message about someone's health and answers nothing is worse than no
 * chat at all. In its place are the two things that do reach somebody: the AI assistant,
 * which answers immediately and can see the person's records, and email, which reaches a
 * human. Both say plainly which is which and how fast it is.
 *
 * The feedback row goes to a composer rather than straight to a `mailto:` — see
 * `app/help/feedback.tsx` for why.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { SUPPORT_EMAIL, allFaqEntries } from '@/lib/help';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

export default function HelpCenterScreen() {
    const router = useRouter();
    const faqCount = allFaqEntries().length;

    /**
     * Version and platform ride in the subject line. Support's first two questions are
     * always "which build" and "which phone", and the person asking rarely knows.
     */
    const emailSupport = () => {
        const version = Constants.expoConfig?.version ?? '1.0.0';
        const subject = encodeURIComponent(`LabTrack support — v${version}`);
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => { });
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <ScreenHeader title="Help Center" subtitle="Need any help? Please see below." />

                <View style={styles.body}>
                    <Card
                        icon="help-circle-outline"
                        title="FAQ"
                        blurb={`${faqCount} frequently asked questions`}
                        onPress={() => router.push('/help/faq')}
                    />

                    <Card
                        icon="sparkles-outline"
                        title="Ask the AI assistant"
                        blurb="Answers now, and it can see your own results"
                        meta="Instant"
                        onPress={() => router.push('/(tabs)/assistant')}
                    />

                    <Card
                        icon="mail-outline"
                        title="Email support"
                        blurb={SUPPORT_EMAIL}
                        meta="A person"
                        onPress={emailSupport}
                    />

                    <Card
                        icon="star-outline"
                        title="Leave a feedback"
                        blurb="Tell us what is wrong, missing or confusing"
                        onPress={() => router.push('/help/feedback')}
                    />

                    {/* The one thing the kit promises that this build cannot. Said here, once,
                        rather than discovered by tapping a chat that goes nowhere. */}
                    <View style={styles.note}>
                        <Ionicons name="chatbubbles-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.noteText}>
                            Live chat with a support agent is not available yet. Email is the way to reach a
                            person, and the assistant is the fastest way to get an answer about your own records.
                        </Text>
                    </View>

                    <View style={styles.urgent}>
                        <Ionicons name="alert-circle" size={18} color={Palette.danger} />
                        <Text style={styles.urgentText}>
                            This is product support, not medical care. If something is urgent — chest pain,
                            breathlessness, a reading in the crisis range — contact emergency services or your
                            doctor now.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const Card = ({
    icon, title, blurb, meta, onPress,
}: { icon: string; title: string; blurb: string; meta?: string; onPress: () => void }) => (
    <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${blurb}`}
    >
        <View style={styles.cardIcon}>
            <Ionicons name={icon as never} size={20} color={Palette.primary} />
        </View>
        <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardBlurb} numberOfLines={2}>{blurb}</Text>
        </View>
        {!!meta && (
            <View style={styles.metaPill}>
                <Text style={styles.metaText}>{meta}</Text>
            </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </Pressable>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.md },

    card: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    },
    cardPressed: { backgroundColor: Palette.primarySurface, borderColor: Palette.primaryLight },
    cardIcon: {
        width: 38, height: 38, borderRadius: Radius.md,
        backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center',
    },
    cardText: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    cardBlurb: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.regular, color: Palette.textSecondary },

    metaPill: {
        paddingHorizontal: Spacing.sm, paddingVertical: 3,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    metaText: { fontSize: 10, fontFamily: Fonts.semibold, color: Palette.primaryDark },

    note: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surface, borderRadius: Radius.xl, padding: Spacing.lg,
        marginTop: Spacing.sm,
    },
    noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },

    urgent: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.dangerSurface, borderRadius: Radius.xl, padding: Spacing.lg,
    },
    urgentText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: Fonts.medium, color: Palette.danger },
});
