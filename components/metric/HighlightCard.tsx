/**
 * "Activity Highlight" — `Design/activity.svg` frame 7.
 *
 * A row of flames, an intensity word, one large number and a caption. The design's flames
 * are the same five it uses for effort on the log screen, so they read as a level rather
 * than as decoration.
 *
 * The flames are lit from the **activity score**, which is the only intensity figure in the
 * app that means anything — it is computed server-side from the person's own plan. When
 * there is no plan there is no score, and the row is dropped rather than lit from a guess:
 * an invented "MODERATE" over somebody's calorie burn is a clinical-sounding claim nothing
 * backs.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

const FLAMES = 5;

interface Props {
    /** The range's average daily burn, and how many days actually reported it. */
    kcal: number;
    days: number;
    /** 0–100, or null when no plan exists to measure against. */
    score: number | null;
    /** The band's own words — "On track", "Building". Never invented here. */
    band: string | null;
}

export function HighlightCard({ kcal, days, score, band }: Props) {
    // Five bands of twenty. A score of 1 still lights one flame: it is not nothing.
    const lit = Number.isFinite(score as number)
        ? Math.min(FLAMES, Math.ceil((score as number) / (100 / FLAMES)))
        : 0;

    return (
        <View style={styles.card}>
            {lit > 0 && (
                <View style={styles.flames} accessibilityLabel={`Intensity ${lit} of ${FLAMES}`}>
                    {Array.from({ length: FLAMES }, (_, i) => (
                        <Ionicons
                            key={i}
                            name="flame"
                            size={19}
                            color={i < lit ? Palette.amber : Palette.border}
                        />
                    ))}
                </View>
            )}

            {band && <Text style={styles.band}>{band.toUpperCase()}</Text>}

            <Text style={styles.value}>
                {Math.round(kcal).toLocaleString()}
                <Text style={styles.unit}>kcal</Text>
            </Text>

            {/*
              Averaged over the days that reported, and it says so. Dividing by days a watch
              was not worn understates the figure and then calls it an average.
            */}
            <Text style={styles.caption}>
                Average daily burn across {days} {days === 1 ? 'day' : 'days'} with data
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: 2,
    },
    flames: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
    band: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.textMuted,
        letterSpacing: 0.8,
    },
    value: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text },
    unit: { fontSize: 18, fontFamily: Fonts.semibold, color: Palette.text },
    caption: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
