/**
 * The weekly goal card — frames 43 to 46.
 *
 * Three rings, one per target that exists. Targets the person has not set (distance,
 * calories) are omitted rather than drawn empty: an unfilled ring labelled "0 km" reads as
 * a failure at something nobody asked for.
 *
 * Over-target draws past the ring rather than pinning at full, for the reason
 * `CalorieRing` gives: someone who did double their sessions needs to see that, and a ring
 * stopped at 100% tells them they landed exactly on target.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { GoalProgress } from '@/lib/activity';

interface RingProps {
    progress: GoalProgress;
    label: string;
    unit: string;
    color: string;
    size?: number;
}

function Ring({ progress, label, unit, color, size = 74 }: RingProps) {
    const stroke = 7;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const ratio = progress.target > 0 ? progress.done / progress.target : 0;
    const filled = Math.min(1, ratio);
    const complete = ratio >= 1;

    return (
        <View style={styles.ring}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke={Palette.borderLight}
                            strokeWidth={stroke}
                            fill="none"
                        />
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke={color}
                            strokeWidth={stroke}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - filled)}
                            strokeLinecap="round"
                            fill="none"
                        />
                    </G>
                </Svg>
                <Text style={[styles.ringValue, complete && { color }]}>
                    {Math.round(progress.done)}
                </Text>
                <Text style={styles.ringTarget}>of {Math.round(progress.target)}</Text>
            </View>
            <Text style={styles.ringLabel}>{label}</Text>
            <Text style={styles.ringUnit}>{unit}</Text>
        </View>
    );
}

interface Props {
    goal: {
        sessions: GoalProgress;
        minutes: GoalProgress;
        distanceKm: GoalProgress | null;
        calories: GoalProgress | null;
    };
    /** Shown above the rings, e.g. "On track". Omitted when there is no score yet. */
    band?: string | null;
}

export function GoalRings({ goal, band }: Props) {
    const rings: RingProps[] = [
        { progress: goal.sessions, label: 'Sessions', unit: 'this week', color: Palette.primary },
        { progress: goal.minutes, label: 'Minutes', unit: 'active', color: Palette.indigo },
    ];
    if (goal.distanceKm) {
        rings.push({ progress: goal.distanceKm, label: 'Distance', unit: 'km', color: Palette.success });
    }
    if (goal.calories) {
        rings.push({ progress: goal.calories, label: 'Energy', unit: 'kcal', color: Palette.amber });
    }

    return (
        <View style={styles.card}>
            {band && <Text style={styles.band}>{band}</Text>}
            <View style={styles.rings}>
                {rings.map((r) => (
                    <Ring key={r.label} {...r} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    band: {
        fontSize: 13,
        fontFamily: Fonts.semibold,
        color: Palette.primary,
    },
    rings: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    ring: { alignItems: 'center', gap: 2 },
    ringValue: {
        fontSize: 17,
        fontFamily: Fonts.bold,
        color: Palette.text,
        // Absolutely centred over the SVG by the parent's justify/align
    },
    ringTarget: { fontSize: 10, fontFamily: Fonts.regular, color: Palette.textMuted },
    ringLabel: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 4 },
    ringUnit: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
