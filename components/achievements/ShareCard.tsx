/**
 * The share card — the design's frame 8.
 *
 * **This is a preview, not the artefact.** What actually reaches a WhatsApp thread or a
 * Facebook post is the Open Graph image on the public page the share link resolves to, drawn
 * by `labtrack-web`. This component is the app's copy of it, and it exists for one reason:
 * nobody should publish something they have not seen. `shareAchievement()` in
 * `lib/achievements.ts` explains the split.
 *
 * The two must therefore stay in step — the same badge, the same words, the same order. They
 * are two implementations of one design, which is a real cost, and the alternative was worse:
 * capturing this view to a bitmap needs `react-native-view-shot`, a native module, and a
 * captured screenshot would arrive in a chat as an attachment with no link back to LabTrack
 * and no way for the person to take it down afterwards.
 *
 * **The card carries no health data.** A badge, a name the person chose, and what the badge
 * took to earn. That is the whole of what `cardForToken` will publish, and it is drawn here
 * exactly so that is obvious before anybody taps Share.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeMedal } from './BadgeMedal';
import { Avatar } from '@/components/Avatar';
import BrandMark from '@/components/BrandMark';
import type { BadgeGlyph, BadgeShape } from './badgeArt';
import type { BadgeTone } from './BadgeMedal';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

/** "Ada Lovelace" → "AL". One letter is fine; `Avatar` falls back to a glyph on empty. */
const initialsOf = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

interface Props {
    name: string;
    shape: BadgeShape;
    glyph: BadgeGlyph;
    tone: BadgeTone;
    /** What it took. Shown verbatim under the headline. */
    how: string;
    /** The person's display name and picture, or nothing if they would rather not. */
    person?: { name: string | null; avatar: string | null };
    onShare?: () => void;
    sharing?: boolean;
}

export function ShareCard({
    name, shape, glyph, tone, how, person, onShare, sharing = false,
}: Props) {
    return (
        <View style={styles.card}>
            <View style={styles.head}>
                {person?.name ? (
                    <View style={styles.person}>
                        <Avatar uri={person.avatar} initials={initialsOf(person.name)} size={28} />
                        <Text style={styles.personName} numberOfLines={1}>{person.name}</Text>
                    </View>
                ) : (
                    // No name is a real state — somebody can share without publishing one —
                    // and an empty row would leave the mark floating with nothing to balance.
                    <Text style={styles.anonymous}>A LabTrack member</Text>
                )}
                <BrandMark size={28} color={Palette.primary} />
            </View>

            <View style={styles.badge}>
                <BadgeMedal shape={shape} glyph={glyph} tone={tone} size={128} label={name} />
            </View>

            <Text style={styles.kicker}>CONGRATULATIONS!</Text>
            <Text style={styles.headline}>I just unlocked {name}!</Text>
            <Text style={styles.how}>{how}.</Text>

            {onShare ? (
                <Pressable
                    style={[styles.cta, sharing && styles.ctaBusy]}
                    onPress={onShare}
                    disabled={sharing}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${name}`}
                >
                    <Text style={styles.ctaText}>{sharing ? 'Preparing…' : 'Share'}</Text>
                    <Ionicons name="share-social-outline" size={18} color={Palette.white} />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        gap: Spacing.sm,
        ...Shadow.card,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    personName: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text, flexShrink: 1 },
    anonymous: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.textSecondary, flex: 1 },
    badge: { alignItems: 'center', paddingVertical: Spacing.xxl },
    kicker: {
        fontSize: 12,
        fontFamily: Fonts.bold,
        color: Palette.primary,
        letterSpacing: 1,
        textAlign: 'center',
    },
    headline: {
        fontSize: 22,
        fontFamily: Fonts.bold,
        color: Palette.text,
        textAlign: 'center',
        lineHeight: 29,
    },
    how: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    cta: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Palette.primary,
        borderRadius: Radius.md,
        paddingVertical: 14,
    },
    ctaBusy: { opacity: 0.6 },
    ctaText: { color: Palette.white, fontSize: 15, fontFamily: Fonts.semibold },
});
