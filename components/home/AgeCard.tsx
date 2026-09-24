/**
 * Predyqt Age — the home card.
 *
 * A compact version of the hub's hero: the orb at a glanceable size, the gap worded, and the
 * pace beside it. Nothing else — the contributors, the levers and the provenance detail all
 * live on the screen this opens, and a home card that tried to carry them would be the hub
 * with worse typography.
 *
 * **It is only ever drawn when there is a number**, and it carries no empty state of its own.
 * `HomeScreen` decides: an answer earns a `<Section>`, and no answer produces a `SetupItem`
 * row in "Get more from Predyqt" instead. This is the rule the home screen is built on — a
 * card saying "connect a watch" used to occupy exactly as much of the screen as one showing a
 * real reading. The guard below therefore cannot fire from that screen, and exists so the
 * component is honest on its own terms.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AgeOrb from '@/components/age/AgeOrb';
import { deltaLabel, tintForBand, type PredyqtAge } from '@/lib/age';
import { Palette, Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';

interface Props {
    age: PredyqtAge | null;
    onPress: () => void;
}

export default function AgeCard({ age, onPress }: Props) {
    if (!age?.ok || age.value === undefined) return null;

    const tint = tintForBand(age.band);
    const pace = age.pace;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
            {/*
              `chronologicalAge` is what the dial's tick is, so the arc has nothing to measure
              from without it and would sit at zero however large the gap.
            */}
            <AgeOrb
                value={age.value}
                band={age.band ?? null}
                chronologicalAge={age.chronologicalAge ?? null}
                size={140}
            />

            <View style={styles.body}>
                <Text style={[styles.gap, { color: tint }]}>{deltaLabel(age.delta, age.band)}</Text>
                <Text style={styles.chrono}>
                    Your body against {age.chronologicalAge?.toFixed(0)} calendar years
                </Text>

                {/*
                  The pace is shown only when it means something. A row reading "1.0× — aging
                  normally" for somebody with no history is a reassurance about a person
                  nothing is known about, which is why `state: 'unknown'` draws nothing here
                  rather than a neutral-looking default.
                */}
                {pace?.ok && pace.value !== undefined && (
                    <View style={styles.paceRow}>
                        <Ionicons name="speedometer-outline" size={13} color={Palette.textSecondary} />
                        <Text style={styles.paceText}>
                            {pace.value.toFixed(2)}× pace
                            {pace.state === 'provisional' ? ' · early estimate' : ''}
                        </Text>
                    </View>
                )}

                <View style={styles.cta}>
                    <Text style={styles.ctaText}>See what would move it</Text>
                    <Ionicons name="chevron-forward" size={14} color={Palette.primary} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

/** Holds the card's slot while it loads, so the sections below do not jump. */
export const AgeCardSkeleton = () => <View style={styles.skeleton} />;

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background, borderRadius: Radius.xl,
        padding: Spacing.lg, borderWidth: 1, borderColor: Palette.border,
    },
    body: { flex: 1 },
    gap: { fontFamily: Fonts.bold, fontSize: 15.5 },
    chrono: { ...BodyFont.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 },
    paceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
    paceText: { ...BodyFont.medium, fontSize: 11.5, color: Palette.textSecondary },
    cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md },
    ctaText: { fontFamily: Fonts.semibold, fontSize: 12.5, color: Palette.primary },
    skeleton: { height: 164, borderRadius: Radius.xl, backgroundColor: Palette.borderLight },
});
