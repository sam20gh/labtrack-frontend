/**
 * One row in the activity history list.
 *
 * The design puts four figures on it — distance, score, calories, duration — in a 2×2 grid
 * under the title. Any of them can be missing: a yoga session has no distance, a manually
 * logged walk has no calorie estimate. Missing figures are dropped rather than rendered as
 * a dash or a zero, because "0 km" for a swim is wrong in a way "nothing here" is not.
 *
 * Pace and average heart rate join them when the session carries what they need — both come
 * from the health store's neighbouring records rather than the session record itself, so
 * before `enrich()` in the Health Connect reader every synced workout had only a duration
 * to show and this card looked like it was broken.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatDuration, formatDistance, formatPace, formatType, type ActivitySession } from '@/lib/activity';

/** The design's ten types, and something reasonable for everything else. */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    walking: 'walk-outline',
    jogging: 'walk-outline',
    hiking: 'trail-sign-outline',
    biking: 'bicycle-outline',
    swimming: 'water-outline',
    yoga: 'body-outline',
    meditation: 'leaf-outline',
    rowing: 'boat-outline',
    weightlifting: 'barbell-outline',
    soccer: 'football-outline',
};

const iconFor = (type: string) => ICONS[type] || 'fitness-outline';

interface Props {
    session: ActivitySession;
    onPress?: () => void;
}

export function SessionCard({ session, onPress }: Props) {
    const when = new Date(session.startedAt);
    const timeLabel = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const dateLabel = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const distance = formatDistance(session.distanceM);
    const pace = formatPace(session.distanceM, session.durationSec);

    const stats: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }[] = [];
    if (distance) stats.push({ icon: 'location-outline', text: distance, color: Palette.textSecondary });
    if (pace) stats.push({ icon: 'speedometer-outline', text: pace, color: Palette.textSecondary });
    if (Number.isFinite(session.avgBpm as number)) {
        stats.push({ icon: 'heart-outline', text: `${Math.round(session.avgBpm as number)} bpm`, color: Palette.danger });
    }
    if (session.scoreDelta > 0) {
        stats.push({ icon: 'add-circle-outline', text: `+${session.scoreDelta} score`, color: Palette.primary });
    }
    if (Number.isFinite(session.activeKcal as number)) {
        stats.push({ icon: 'flame-outline', text: `${Math.round(session.activeKcal as number)} kcal`, color: Palette.amber });
    }
    stats.push({ icon: 'time-outline', text: formatDuration(session.durationSec), color: Palette.textSecondary });

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${formatType(session.type)}, ${formatDuration(session.durationSec)} on ${dateLabel}`}
        >
            <View style={styles.icon}>
                <Ionicons name={iconFor(session.type)} size={22} color={Palette.text} />
            </View>

            <View style={styles.body}>
                <Text style={styles.title}>{formatType(session.type)}</Text>
                <Text style={styles.when}>
                    {dateLabel}, {timeLabel}
                </Text>

                <View style={styles.stats}>
                    {stats.map((s) => (
                        <View key={`${s.icon}-${s.text}`} style={styles.stat}>
                            <Ionicons name={s.icon} size={13} color={s.color} />
                            <Text style={styles.statText}>{s.text}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    pressed: { opacity: 0.7 },
    icon: {
        width: 40,
        alignItems: 'center',
    },
    body: { flex: 1, gap: 2 },
    title: {
        fontSize: 15,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
    when: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginTop: 6,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: {
        fontSize: 12,
        fontFamily: Fonts.medium,
        color: Palette.textSecondary,
    },
});
