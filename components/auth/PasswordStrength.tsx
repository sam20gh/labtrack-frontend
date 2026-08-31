/**
 * The kit's four-segment strength meter, drawn hard against the underside of the password
 * field so it reads as part of it rather than as a separate row.
 *
 * The colour ramp is `meterWeak → amber → meterStrong`, never the clinical `danger`/
 * `success` pair — see the note on those tokens in `constants/theme.ts`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Palette } from '@/constants/theme';
import type { PasswordStrength as Strength } from '@/lib/password';

const SEGMENTS = 4;

function colorFor(level: number): string {
    if (level <= 1) return Palette.meterWeak;
    if (level === 2) return Palette.amber;
    return Palette.meterStrong;
}

export default function PasswordStrength({ strength }: { strength: Strength }) {
    if (strength.level === 0) return null;
    const filled = colorFor(strength.level);

    return (
        <View style={styles.wrap}>
            <View style={styles.track}>
                {Array.from({ length: SEGMENTS }, (_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.segment,
                            { backgroundColor: i < strength.level ? filled : Palette.borderStrong },
                        ]}
                    />
                ))}
            </View>
            <Text style={styles.caption}>
                Password strength:{' '}
                <Text style={[styles.captionValue, { color: filled }]}>
                    {strength.label} {strength.emoji}
                </Text>
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 8,
    },
    track: {
        flexDirection: 'row',
        gap: 6,
    },
    segment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    caption: {
        marginTop: 8,
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    captionValue: {
        fontFamily: Fonts.semibold,
    },
});
