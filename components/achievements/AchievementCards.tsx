/**
 * The three ways a badge appears in a list.
 *
 * `AchievementRow`  — the design's frame 2: badge, name, what it takes, a progress bar.
 * `AchievementTile` — frame 3's grid cell: badge, name, Locked / Unlocked.
 * `FeaturedBadge`   — the three across the top of the hub, drawn larger with no chrome.
 *
 * They are together because they render the same object and must agree about it. The rule
 * they all follow is the one `BadgeMedal` states: **a locked badge shows the padlock, never
 * its own mark dimmed.** A grid that previews what you have not earned spoils it; a greyed
 * glyph reads as broken rather than as pending.
 *
 * The progress bar draws `progress`, which the server measures from the *previous* rung. A
 * bar filled from zero would barely move for the whole of a long level and then jump — see
 * `grade()` in `utils/achievementCatalogue.js`.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeMedal } from './BadgeMedal';
import { progressLabel, toneColour, type Achievement } from '@/lib/achievements';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

interface RowProps {
    achievement: Achievement;
    onPress?: () => void;
}

export function AchievementRow({ achievement: a, onPress }: RowProps) {
    const tint = toneColour(a.tone, !a.unlocked);

    return (
        <Pressable
            style={styles.row}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${a.name}. ${a.unlocked ? `Level ${a.level}` : 'Locked'}. ${a.how}`}
        >
            <BadgeMedal
                shape={a.shape}
                glyph={a.glyph}
                tone={a.tone}
                locked={!a.unlocked}
                size={48}
                label={a.name}
            />

            <View style={styles.rowBody}>
                <View style={styles.rowHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{a.plainName}</Text>
                    {a.level > 0 ? (
                        <View style={[styles.levelChip, { backgroundColor: `${tint}22` }]}>
                            <Text style={[styles.levelChipText, { color: tint }]}>LVL {a.level}</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={styles.rowHow} numberOfLines={1}>{a.how}</Text>

                {/* At the top of the ladder there is nothing left to fill, so the bar is
                    replaced by the badge's standing rather than drawn permanently full. */}
                {a.next === null ? (
                    <Text style={[styles.maxed, { color: tint }]}>
                        Every level earned · {a.value.toLocaleString()} {a.unit}
                    </Text>
                ) : (
                    <>
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.fill,
                                    { width: `${Math.round(a.progress * 100)}%`, backgroundColor: Palette.primary },
                                ]}
                            />
                        </View>
                        <View style={styles.rowFoot}>
                            <Text style={styles.rowValue}>{progressLabel(a)}</Text>
                            <Text style={styles.rowPct}>{Math.round(a.progress * 100)}%</Text>
                        </View>
                    </>
                )}
            </View>
        </Pressable>
    );
}

interface TileProps {
    achievement: Achievement;
    onPress?: () => void;
    size?: number;
}

export function AchievementTile({ achievement: a, onPress, size = 56 }: TileProps) {
    return (
        <Pressable
            style={styles.tile}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${a.name}. ${a.unlocked ? 'Unlocked' : 'Locked'}`}
        >
            <BadgeMedal
                shape={a.shape}
                glyph={a.glyph}
                tone={a.tone}
                locked={!a.unlocked}
                size={size}
                label={a.name}
            />
            <Text style={styles.tileName} numberOfLines={2}>{a.plainName}</Text>
            <Text style={[styles.tileState, a.unlocked && styles.tileStateOn]}>
                {a.unlocked ? 'Unlocked' : 'Locked'}
            </Text>
        </Pressable>
    );
}

export function FeaturedBadge({ achievement: a, onPress, size = 64 }: TileProps) {
    return (
        <Pressable
            style={styles.featured}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${a.name}. ${a.unlocked ? 'Unlocked' : 'Locked'}`}
        >
            <BadgeMedal
                shape={a.shape}
                glyph={a.glyph}
                tone={a.tone}
                locked={!a.unlocked}
                size={size}
                label={a.name}
            />
            <Text style={styles.featuredName} numberOfLines={1}>{a.plainName}</Text>
            <Text style={[styles.tileState, a.unlocked && styles.tileStateOn]}>
                {a.unlocked ? 'Unlocked' : 'Locked'}
            </Text>
        </Pressable>
    );
}

/**
 * The row that offers a tracker a badge lives in.
 *
 * Shown under "Get started" for a category the person has never used, on the same terms as
 * the home screen's `SetupItem`: a category with nothing in it earns a way in, not a wall of
 * locked squares explaining what it could have been.
 */
export function CategoryPrompt({
    label, blurb, onPress,
}: { label: string; blurb: string; onPress: () => void }) {
    return (
        <Pressable style={styles.prompt} onPress={onPress} accessibilityRole="button">
            <View style={styles.promptIcon}>
                <Ionicons name="add" size={18} color={Palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.promptTitle}>{label}</Text>
                <Text style={styles.promptBlurb} numberOfLines={2}>{blurb}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        ...Shadow.card,
    },
    rowBody: { flex: 1, gap: 4 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowTitle: { flex: 1, fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    levelChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
    levelChipText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.4 },
    rowHow: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    track: {
        height: 8,
        borderRadius: 4,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden',
        marginTop: 4,
    },
    fill: { height: 8, borderRadius: 4 },
    rowFoot: { flexDirection: 'row', justifyContent: 'space-between' },
    rowValue: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
    rowPct: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.text },
    maxed: { fontSize: 11, fontFamily: Fonts.semibold, marginTop: 6 },

    tile: { alignItems: 'center', gap: 6, paddingVertical: Spacing.md },
    tileName: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.text,
        textAlign: 'center',
    },
    tileState: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
    tileStateOn: { color: Palette.textSecondary },

    featured: { alignItems: 'center', gap: 6, flex: 1 },
    featuredName: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, textAlign: 'center' },

    prompt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Palette.borderLight,
    },
    promptIcon: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    promptTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    promptBlurb: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
