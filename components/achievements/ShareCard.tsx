/**
 * The share card — the design's frame 8, and the thing that actually gets shared.
 *
 * **This view is the artefact, not a preview of one.** It used to be a preview: sharing sent
 * a link, and what appeared in a chat was the Open Graph image the portal rendered for that
 * link. Now `shareAchievement()` captures this view to a PNG and hands the *file* to the
 * share sheet, so what somebody's friend sees is these pixels.
 *
 * Three consequences, and every one of them shapes this file:
 *
 * 1. **Nothing interactive may live inside it.** A Share button rendered here would be
 *    captured and appear in the image as a button nobody can press. The button is the
 *    caller's, drawn outside the captured wrapper — see `app/achievements/[key].tsx`.
 * 2. **The card has to say where it came from.** An image carries no link; somebody seeing a
 *    badge in a group chat has nothing to tap. `shareHost` is printed in the corner and is
 *    the only route back to the product. It comes from the server, derived from the real
 *    share base, so it is never a domain nobody owns — and it is omitted rather than invented
 *    when a deployment has none.
 * 3. **It must be legible as a small image.** A chat thumbnail is a few hundred pixels wide,
 *    so the type is set larger and heavier than it would be for a screen, and there is
 *    nothing on it that has to be read at length.
 *
 * The portal's `opengraph-image.tsx` draws the same content for the link path, which still
 * exists as the fallback. Two implementations of one design is a real cost; it is paid
 * because a captured native view and a server-rendered PNG cannot be the same code, and both
 * routes have to work.
 *
 * **The card carries no health data.** A badge, a name the person chose, what the badge took
 * to earn, and the address. That is the whole of it, and it is drawn here exactly so that is
 * obvious before anybody taps Share.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    /** Which rung, for the corner chip. Omitted at level 1 — "Level 1" says nothing. */
    level?: number;
    /** The person's display name and picture, or nothing if they would rather not. */
    person?: { name: string | null; avatar: string | null };
    /** The address printed bottom-left. Null on a deployment with no share URL configured. */
    host?: string | null;
}

export function ShareCard({ name, shape, glyph, tone, how, level, person, host }: Props) {
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
                    // and an empty row would leave the chip floating with nothing to balance.
                    <Text style={styles.anonymous}>A LabTrack member</Text>
                )}

                {level && level > 1 ? (
                    <View style={styles.levelChip}>
                        <Text style={styles.levelChipText}>LEVEL {level}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.badge}>
                <BadgeMedal shape={shape} glyph={glyph} tone={tone} size={128} label={name} />
            </View>

            <Text style={styles.kicker}>CONGRATULATIONS!</Text>
            <Text style={styles.headline}>I just unlocked {name}!</Text>
            <Text style={styles.how}>{how}.</Text>

            {/*
              * The footer, bottom-left, and the only thing on this card that is for whoever
              * receives it rather than for whoever sends it. Omitted entirely rather than
              * printed empty when the server has no host to give — a wordmark floating above
              * a blank line reads as a rendering fault.
              */}
            <View style={styles.footer}>
                <BrandMark size={18} color={Palette.primary} />
                <View style={styles.footerText}>
                    <Text style={styles.wordmark}>LabTrack</Text>
                    {host ? <Text style={styles.host}>{host}</Text> : null}
                </View>
            </View>
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
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    personName: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text, flexShrink: 1 },
    anonymous: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.textSecondary, flexShrink: 1 },
    levelChip: {
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Palette.primarySurface,
    },
    levelChipText: {
        fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.8, color: Palette.primaryDark,
    },

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
    },

    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    footerText: { gap: 1 },
    wordmark: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 15 },
    host: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 13 },
});
