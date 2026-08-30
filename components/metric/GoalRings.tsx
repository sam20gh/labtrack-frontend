/**
 * The weekly goal card — `Design/activity.svg` frames 7 and 43–46.
 *
 * The design leads with the one number a person came for — sessions done out of sessions
 * planned — as a ring, and puts the rest underneath as targets. That ordering is the point
 * of the card: "4/5 activities this week" is the answer, and the kcal and kilometre goals
 * are context for it.
 *
 * A target the person has not set is **omitted, not drawn empty**. An unfilled ring labelled
 * "0 km" reads as a failure at something nobody asked for, which is the same call the
 * nutrition tracker's `unassessed` alignment makes. Over-target fills the ring and shows the
 * real figure rather than pinning the number at the target — someone who did double their
 * sessions needs to see that.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { GoalProgress } from '@/lib/activity';

const SIZE = 62;
const STROKE = 6;

function Ring({ progress }: { progress: GoalProgress }) {
    const r = (SIZE - STROKE) / 2;
    const c = 2 * Math.PI * r;
    const ratio = progress.target > 0 ? progress.done / progress.target : 0;
    const filled = Math.min(1, ratio);

    return (
        <View style={styles.ringBox}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                    <Circle
                        cx={SIZE / 2} cy={SIZE / 2} r={r}
                        stroke={Palette.borderLight} strokeWidth={STROKE} fill="none"
                    />
                    {filled > 0 && (
                        <Circle
                            cx={SIZE / 2} cy={SIZE / 2} r={r}
                            stroke={Palette.primary}
                            strokeWidth={STROKE}
                            strokeDasharray={c}
                            strokeDashoffset={c * (1 - filled)}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                </G>
            </Svg>
            <Ionicons
                name="flame"
                size={22}
                color={ratio >= 1 ? Palette.amber : Palette.textMuted}
            />
        </View>
    );
}

/** `430 / 1,500` — done over target, rounded the way each unit is normally written. */
const pair = (progress: GoalProgress, decimals = 0) => {
    const fmt = (v: number) => (decimals
        ? (Math.round(v * 10) / 10).toFixed(1)
        : Math.round(v).toLocaleString());
    return `${fmt(progress.done)} / ${fmt(progress.target)}`;
};

interface Props {
    goal: {
        sessions: GoalProgress;
        minutes: GoalProgress;
        distanceKm: GoalProgress | null;
        calories: GoalProgress | null;
    };
    /** Shown beside the ring, e.g. "On track". Omitted when there is no score yet. */
    band?: string | null;
}

export function GoalRings({ goal, band }: Props) {
    const targets: { key: string; value: string; label: string }[] = [];
    if (goal.calories) targets.push({ key: 'kcal', value: pair(goal.calories), label: 'kcal goal' });
    targets.push({ key: 'min', value: pair(goal.minutes), label: 'min goal' });
    if (goal.distanceKm) targets.push({ key: 'km', value: pair(goal.distanceKm, 1), label: 'km goal' });

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <View style={styles.headText}>
                    <Text style={styles.headline}>
                        {Math.round(goal.sessions.done)}
                        <Text style={styles.headlineTarget}>/{Math.round(goal.sessions.target)}</Text>
                    </Text>
                    <Text style={styles.headlineLabel}>Activities this week</Text>
                    {band && <Text style={styles.band}>{band}</Text>}
                </View>
                <Ring progress={goal.sessions} />
            </View>

            <View style={styles.divider} />

            <View style={styles.targets}>
                {targets.map((t) => (
                    <View key={t.key} style={styles.target}>
                        <Text style={styles.targetValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                            {t.value}
                        </Text>
                        <Text style={styles.targetLabel}>{t.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headText: { flex: 1, gap: 1 },
    headline: { fontSize: 27, fontFamily: Fonts.bold, color: Palette.text },
    headlineTarget: { fontSize: 19, fontFamily: Fonts.semibold, color: Palette.textMuted },
    headlineLabel: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    band: { fontSize: 12.5, fontFamily: Fonts.semibold, color: Palette.primary, marginTop: 4 },

    ringBox: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },

    divider: {
        height: 1,
        backgroundColor: Palette.border,
        marginVertical: Spacing.lg,
    },

    targets: { flexDirection: 'row' },
    target: { flex: 1, gap: 2 },
    targetValue: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    targetLabel: { fontSize: 11.5, fontFamily: Fonts.regular, color: Palette.textSecondary },
});
