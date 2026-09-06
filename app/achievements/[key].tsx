/**
 * One badge — the design's frame 5, with frame 8's share card folded into it.
 *
 * ```
 * radial glow + medal
 * LEVEL n  ·  Earned Nov 2025
 * name, what it took
 * next milestone bar
 * the ladder, with the date each rung was reached
 * Share  → the card, then the system share sheet
 * ```
 *
 * Four things about it are deliberate:
 *
 * 1. **Share is only offered on a badge that was actually earned.** The server answers 409
 *    for anything else, and a button that exists to produce an error is worse than no button.
 * 2. **The card is shown before it is shared, on this screen.** Tapping Share opens the
 *    preview; sharing again from there is what opens the system sheet. One extra tap buys
 *    the person sight of exactly what will be published, which matters because the link is
 *    public and the audience is not LabTrack.
 * 3. **The ladder shows every rung, including the ones still ahead.** The kit draws only the
 *    next milestone. Seeing all four is what makes a level-one badge feel like the start of
 *    something rather than a thing that is finished.
 * 4. **A shared badge can be un-shared, from here.** Somebody who thought better of a card
 *    has to be able to take the page down without deleting the achievement.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getAchievement, shareAchievement, revokeShareLink, earnedLabel, progressLabel, toneColour,
    type AchievementDetail,
} from '@/lib/achievements';
import { BadgeMedal } from '@/components/achievements/BadgeMedal';
import { ShareCard } from '@/components/achievements/ShareCard';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AchievementDetailScreen() {
    const router = useRouter();
    const { key } = useLocalSearchParams<{ key: string }>();

    const [data, setData] = useState<AchievementDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState(false);
    const [sharing, setSharing] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await getAchievement(String(key)));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
            else if (err instanceof ApiError && err.status === 404) router.back();
        } finally {
            setLoading(false);
        }
    }, [key, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onShare = async () => {
        if (!data) return;
        setSharing(true);
        try {
            const outcome = await shareAchievement(data.key);
            if (outcome === 'unavailable') {
                // The deployment has no share URL, so the message went out without a link.
                // Saying so is better than letting somebody believe a card was published.
                Alert.alert(
                    'Shared as text',
                    'Your badge went out as a message. The picture card is not available on this '
                    + 'build yet, so there was no link to attach.',
                );
            }
            await load();
        } catch (err) {
            Alert.alert('Could not share', err instanceof ApiError ? err.message : 'Please try again.');
        } finally {
            setSharing(false);
        }
    };

    const onRevoke = () => {
        if (!data) return;
        Alert.alert(
            'Turn off the link?',
            'The page you shared will stop opening for everyone who has the link. You keep the '
            + 'badge, and you can share it again later.',
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: 'Turn it off',
                    style: 'destructive',
                    onPress: async () => { await revokeShareLink(data.key).catch(() => { }); await load(); },
                },
            ],
        );
    };

    if (loading || !data) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const tint = toneColour(data.tone, !data.unlocked);
    const earned = earnedLabel(data.unlockedAt);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                {data.shareToken ? (
                    <TouchableOpacity onPress={onRevoke} hitSlop={12} accessibilityLabel="Turn off the share link">
                        <Ionicons name="link-outline" size={20} color={Palette.primary} />
                    </TouchableOpacity>
                ) : <View style={{ width: 20 }} />}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Concentric rings rather than a radial gradient: `react-native-svg`'s
                    RadialGradient renders inconsistently across the two platforms, and three
                    stacked circles at low opacity produce the same halo everywhere. */}
                <View style={styles.glowWrap}>
                    <View style={[styles.glow, styles.glow3, { backgroundColor: `${tint}14` }]} />
                    <View style={[styles.glow, styles.glow2, { backgroundColor: `${tint}1F` }]} />
                    <View style={[styles.glow, styles.glow1, { backgroundColor: `${tint}2E` }]} />
                    <BadgeMedal
                        shape={data.shape}
                        glyph={data.glyph}
                        tone={data.tone}
                        locked={!data.unlocked}
                        size={132}
                        label={data.name}
                    />
                </View>

                <Text style={[styles.level, { color: data.unlocked ? Palette.primary : Palette.textMuted }]}>
                    {data.unlocked ? `LEVEL ${data.level}` : 'LOCKED'}
                </Text>

                {earned ? (
                    <View style={styles.earned}>
                        <Ionicons name="calendar-outline" size={14} color={Palette.textSecondary} />
                        <Text style={styles.earnedText}>Earned {earned}</Text>
                    </View>
                ) : null}

                <Text style={styles.name}>{data.name}</Text>
                <Text style={styles.blurb}>{data.blurb}</Text>

                {/* The next rung. Absent at the top of the ladder rather than drawn full. */}
                {data.next !== null ? (
                    <View style={styles.milestone}>
                        <View style={styles.milestoneHead}>
                            <View style={styles.milestoneTitle}>
                                <Ionicons name="ribbon-outline" size={16} color={Palette.primary} />
                                <Text style={styles.milestoneLevel}>Level {data.level + 1}</Text>
                            </View>
                            <Text style={styles.milestoneNext}>Next Milestone</Text>
                        </View>

                        <View style={styles.track}>
                            <View style={[styles.fill, { width: `${Math.round(data.progress * 100)}%` }]} />
                        </View>

                        <View style={styles.milestoneFoot}>
                            <Text style={styles.milestoneHow}>{data.how}</Text>
                            <Text style={styles.milestonePct}>{Math.round(data.progress * 100)}%</Text>
                        </View>
                        <Text style={styles.milestoneValue}>{progressLabel(data)}</Text>
                    </View>
                ) : (
                    <View style={styles.milestone}>
                        <Text style={styles.milestoneLevel}>Every level earned</Text>
                        <Text style={styles.milestoneValue}>
                            {data.value.toLocaleString()} {data.unit} recorded
                        </Text>
                    </View>
                )}

                <Text style={styles.section}>Levels</Text>
                <View style={styles.ladder}>
                    {data.ladder.map((rung, i) => (
                        <View key={rung.level} style={[styles.rung, i > 0 && styles.rungDivided]}>
                            <View style={[
                                styles.rungDot,
                                rung.reached && { backgroundColor: tint, borderColor: tint },
                            ]}>
                                {rung.reached ? (
                                    <Ionicons name="checkmark" size={12} color={Palette.white} />
                                ) : (
                                    <Text style={styles.rungNumber}>{rung.level}</Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.rungHow, !rung.reached && styles.rungHowOff]}>
                                    {rung.how}
                                </Text>
                                {rung.reachedAt ? (
                                    <Text style={styles.rungDate}>{earnedLabel(rung.reachedAt)}</Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>

                {/* Sharing is offered only once there is something to share. */}
                {data.unlocked ? (
                    preview ? (
                        <View style={styles.previewWrap}>
                            <Text style={styles.previewNote}>
                                This is what people will see. Your results are not part of it.
                            </Text>
                            <ShareCard
                                name={data.name}
                                shape={data.shape}
                                glyph={data.glyph}
                                tone={data.tone}
                                how={data.how}
                                person={data.person}
                                onShare={onShare}
                                sharing={sharing}
                            />
                            <TouchableOpacity onPress={() => setPreview(false)} accessibilityRole="button">
                                <Text style={styles.cancel}>Not now</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.cta}
                            onPress={() => setPreview(true)}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaText}>Share</Text>
                            <Ionicons name="share-social-outline" size={18} color={Palette.white} />
                        </TouchableOpacity>
                    )
                ) : (
                    <TouchableOpacity
                        style={styles.secondary}
                        onPress={() => router.push(data.route as never)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.secondaryText}>Open {data.categoryLabel}</Text>
                        <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2, alignItems: 'center' },

    glowWrap: { alignItems: 'center', justifyContent: 'center', height: 260, alignSelf: 'stretch' },
    glow: { position: 'absolute', borderRadius: 999 },
    glow1: { width: 190, height: 190 },
    glow2: { width: 232, height: 232 },
    glow3: { width: 260, height: 260 },

    level: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginTop: Spacing.sm },
    earned: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md, paddingVertical: 6, marginTop: Spacing.md,
    },
    earnedText: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },

    name: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.lg, textAlign: 'center' },
    blurb: {
        fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular,
        color: Palette.textSecondary, textAlign: 'center', marginTop: Spacing.sm,
    },

    milestone: {
        alignSelf: 'stretch', backgroundColor: Palette.surface,
        borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.xxl, gap: Spacing.sm,
    },
    milestoneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    milestoneTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    milestoneLevel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    milestoneNext: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    track: { height: 8, borderRadius: 4, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: Palette.primary },
    milestoneFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    milestoneHow: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    milestonePct: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    milestoneValue: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    section: { alignSelf: 'flex-start', fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xxl },
    ladder: {
        alignSelf: 'stretch', backgroundColor: Palette.surface,
        borderRadius: Radius.lg, marginTop: Spacing.md,
    },
    rung: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    rungDivided: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    rungDot: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 1.5, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    rungNumber: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.textMuted },
    rungHow: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },
    rungHowOff: { color: Palette.textSecondary },
    rungDate: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, marginTop: 2 },

    cta: {
        alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, backgroundColor: Palette.primary,
        borderRadius: Radius.lg, paddingVertical: 16, marginTop: Spacing.xxl,
    },
    ctaText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    secondary: {
        alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, borderWidth: 1, borderColor: Palette.primaryPale,
        borderRadius: Radius.lg, paddingVertical: 15, marginTop: Spacing.xxl,
    },
    secondaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    previewWrap: { alignSelf: 'stretch', marginTop: Spacing.xxl, gap: Spacing.md },
    previewNote: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center',
    },
    cancel: {
        fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary,
        textAlign: 'center', paddingVertical: Spacing.md,
    },
});
