/**
 * Predyqt Age, as the last line of the home screen's score card.
 *
 * It used to be a section of its own: a 140pt orb under its own heading, sat among the
 * trackers. Two things moved it. It is a number computed over six months that cannot move
 * between two opens of the app, so a whole card on a screen whose job is "what does today
 * need" was the most expensive way to show it. And it is the score's sibling — the score says
 * how well somebody is using their trackers, the age what those trackers imply about their
 * body, the adjacency `app/score` already draws — so the two aggregate numbers now sit in one
 * card, above the fold. The orb, the contributors and the levers stay on `/age`, which this
 * opens.
 *
 * Three states, and the row keeps one height through all of them. It arrives after the first
 * paint — `GET /age` is the heaviest read the home screen makes — and a line appearing or
 * vanishing at the top of the page would shove everything under it.
 *
 *   - `null`             a bar where the line will be
 *   - an answer          the age, with the gap worded and tinted by band
 *   - a refusal, or a    an invitation. This row is the home screen's only way onto `/age`,
 *     failed read        so it is never simply dropped
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { deltaLabel, tintForBand, type PredyqtAge } from '@/lib/age';
import { SkeletonGroup, SkeletonBlock } from '@/components/nutrition/Skeleton';
import { Spacing, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

interface Props {
    /** `null` until the read resolves; a refusal is `{ ok: false }`. */
    age: PredyqtAge | null;
    onPress: () => void;
}

export default function AgeRow({ age, onPress }: Props) {
    const Palette = usePalette();
    const styles = useStyles();

    if (!age) {
        return (
            <View style={styles.row} accessible accessibilityLabel="Loading your Predyqt Age">
                <SkeletonGroup>
                    <SkeletonBlock width="64%" height={14} />
                </SkeletonGroup>
            </View>
        );
    }

    const value = age.ok && typeof age.value === 'number' ? age.value : null;
    const gap = value === null ? '' : deltaLabel(age.delta, age.band);

    return (
        <TouchableOpacity
            style={styles.row}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={value === null
                ? 'Find your Predyqt Age'
                : `Predyqt Age ${value.toFixed(1)}${gap ? `, ${gap}` : ''}`}
        >
            <Ionicons name="hourglass-outline" size={15} color={Palette.textSecondary} />
            <Text style={styles.label}>Predyqt Age</Text>

            {value === null ? (
                <>
                    <View style={styles.flex} />
                    <Text style={styles.invite}>Find yours</Text>
                </>
            ) : (
                <>
                    {/* The gap carries the band's colour, as it does under the orb — never
                        `danger`, see `tintForBand`. */}
                    <Text style={[styles.gap, { color: tintForBand(age.band) }]} numberOfLines={1}>
                        {gap}
                    </Text>
                    <Text style={styles.value}>{value.toFixed(1)}</Text>
                </>
            )}

            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
        </TouchableOpacity>
    );
}

// The score card's own footer rhythm — a hairline, then 12pt — with the height fixed so the
// three states are interchangeable in place.
const useStyles = makeStyles((Palette) => ({
    flex: { flex: 1 },
    row: {
        height: 22 + Spacing.md,
        paddingTop: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    label: { fontSize: 13, color: Palette.textSecondary, ...BodyFont.medium },
    gap: { flex: 1, fontSize: 13, ...BodyFont.semibold },
    value: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    invite: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.semibold },
}));
