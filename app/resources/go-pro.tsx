/**
 * Go Pro — where the paywall banner leads.
 *
 * **Nothing here takes money, and the screen says so.** `User.proMember` is a flag with no
 * billing behind it yet: there is no plan, no price, no renewal and no Stripe product for a
 * content subscription. Drawing a "Subscribe — £4.99/month" button over that would be the
 * one thing worse than not having the feature, because a person would tap it, be charged
 * nothing, and believe they had bought something.
 *
 * So this states what Pro unlocks, and offers the only honest action available: register
 * interest. When billing exists, this screen gains a price and a checkout that goes through
 * `/api/payments` like every other charge in the app, and `gateBody` on the server stops
 * reading a boolean and starts reading a subscription. Nothing else changes.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const BENEFITS = [
    { icon: 'document-text-outline', title: 'Every article in full', detail: 'No preview cut-off part way through a piece.' },
    { icon: 'school-outline', title: 'All course lessons', detail: 'Not just the free preview session.' },
    { icon: 'headset-outline', title: 'Full audio and transcripts', detail: 'Listen and read along, wherever you are.' },
    { icon: 'notifications-outline', title: 'New releases first', detail: 'Workshops and courses before general release.' },
];

export default function GoProScreen() {
    const router = useRouter();

    return (
        <View style={styles.screen}>
            <LinearGradient colors={Palette.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                            <Ionicons name="close" size={24} color={Palette.white} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.hero}>
                        <View style={styles.heroBadge}>
                            <Ionicons name="lock-open-outline" size={26} color={Palette.white} />
                        </View>
                        <Text style={styles.heroTitle}>LabTrack Pro</Text>
                        <Text style={styles.heroBody}>
                            The full health library — every article, course and recording, without a preview cut-off.
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {BENEFITS.map((benefit) => (
                    <View key={benefit.title} style={styles.benefit}>
                        <View style={styles.benefitIcon}>
                            <Ionicons name={benefit.icon as any} size={20} color={Palette.primary} />
                        </View>
                        <View style={styles.benefitBody}>
                            <Text style={styles.benefitTitle}>{benefit.title}</Text>
                            <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                        </View>
                    </View>
                ))}

                {/* The honest state. See the file header — this is not a price, and there is
                    no charge behind the button. */}
                <View style={styles.notice}>
                    <Ionicons name="information-circle-outline" size={20} color={Palette.info} />
                    <Text style={styles.noticeText}>
                        Pro is not on sale yet. Register your interest and we will let you know
                        when it opens — you will not be charged anything now.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.cta}
                    activeOpacity={0.85}
                    onPress={() => Alert.alert(
                        'Thanks',
                        'We will let you know as soon as LabTrack Pro is available.',
                        [{ text: 'OK', onPress: () => router.back() }],
                    )}
                >
                    <Text style={styles.ctaText}>Notify me when Pro launches</Text>
                    <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.ghost} onPress={() => router.back()}>
                    <Text style={styles.ghostText}>Keep reading the free library</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
    hero: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, paddingTop: Spacing.lg, gap: Spacing.md },
    heroBadge: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    heroTitle: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.white },
    heroBody: { fontSize: 15, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.9)', lineHeight: 22 },

    content: { padding: Spacing.xl, gap: Spacing.lg },
    benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
    benefitIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    benefitBody: { flex: 1 },
    benefitTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    benefitDetail: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 19 },

    notice: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        padding: Spacing.lg, marginTop: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.infoSurface,
    },
    noticeText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 20 },

    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.primary,
        marginTop: Spacing.md,
    },
    ctaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    ghost: { alignItems: 'center', paddingVertical: Spacing.md },
    ghostText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.textSecondary },
});
