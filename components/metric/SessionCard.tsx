/**
 * One row in the activity history list — `Design/activity.svg` frame 7.
 *
 * The design puts the figures in a 2×2 grid under the title, each with its own coloured
 * glyph, and the value and its unit set differently so the number carries. That grid is the
 * reason the card is worth its height: four facts read at a glance beat a sentence.
 *
 * **Any of them can be missing and missing ones are dropped**, never rendered as a dash or
 * a zero: a yoga session has no distance and a manually logged walk has no calorie estimate,
 * and "0 km" for either is wrong in a way "nothing here" is not. Pace and heart rate join
 * the grid when the session carries what they need — both come from the health store's
 * neighbouring records rather than the session record itself, so before `enrich()` in the
 * Health Connect reader every synced workout had only a duration and this card looked broken.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont, activePalette } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { formatDuration, formatDistance, formatPace, formatType, type ActivitySession } from '@/lib/activity';
import { typeStyle } from '@/lib/activityTypes';

interface Stat {
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    value: string;
    unit: string;
}

/** Split "1.8 km" into a bold figure and a quiet unit, the way the design sets them. */
const split = (text: string): { value: string; unit: string } => {
    const at = text.indexOf(' ');
    return at < 0 ? { value: text, unit: '' } : { value: text.slice(0, at), unit: text.slice(at + 1) };
};

export const statsFor = (session: ActivitySession): Stat[] => {
    const stats: Stat[] = [];

    const distance = formatDistance(session.distanceM);
    if (distance) stats.push({ icon: 'location-outline', tint: activePalette().text, ...split(distance) });

    if (session.scoreDelta > 0) {
        stats.push({ icon: 'add-circle-outline', tint: activePalette().primary, value: `+${session.scoreDelta}`, unit: 'score' });
    }

    if (Number.isFinite(session.activeKcal as number)) {
        stats.push({ icon: 'flame-outline', tint: activePalette().amber, value: String(Math.round(session.activeKcal as number)), unit: 'kcal' });
    }

    // `formatDuration` gives "30m" or "1h 20m". Only the first splits cleanly into a figure
    // and a unit; an hours-and-minutes string is one value and is left whole.
    const minutes = Math.round(session.durationSec / 60);
    stats.push(minutes < 60
        ? { icon: 'time-outline', tint: activePalette().danger, value: String(minutes), unit: 'min' }
        : { icon: 'time-outline', tint: activePalette().danger, value: formatDuration(session.durationSec), unit: '' });

    const pace = formatPace(session.distanceM, session.durationSec);
    if (pace) stats.push({ icon: 'speedometer-outline', tint: activePalette().indigo, ...split(pace) });

    if (Number.isFinite(session.avgBpm as number)) {
        stats.push({ icon: 'heart-outline', tint: activePalette().danger, value: String(Math.round(session.avgBpm as number)), unit: 'bpm' });
    }

    return stats;
};

interface Props {
    session: ActivitySession;
    onPress?: () => void;
}

export function SessionCard({ session, onPress }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const when = new Date(session.startedAt);
    const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateLabel = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const ended = session.endedAt ? new Date(session.endedAt) : null;

    const stats = statsFor(session);
    const look = typeStyle(session.type);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${formatType(session.type)}, ${formatDuration(session.durationSec)} on ${dateLabel}`}
        >
            <View style={styles.top}>
                {/*
                  The type's own glyph on its own tint, so a list of a week reads as walks,
                  swims and rides before a word of it is read. See `lib/activityTypes.ts`.
                */}
                <View style={[styles.icon, { backgroundColor: look.surface }]}>
                    <MaterialCommunityIcons name={look.icon} size={22} color={look.tint} />
                </View>

                <View style={styles.heading}>
                    <Text style={styles.title}>{formatType(session.type)}</Text>
                    <Text style={styles.when}>
                        {dateLabel}, {time(when)}{ended ? ` – ${time(ended)}` : ''}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </View>

            <View style={styles.stats}>
                {stats.map((s) => (
                    <View key={`${s.icon}-${s.value}-${s.unit}`} style={styles.stat}>
                        <Ionicons name={s.icon} size={14} color={s.tint} />
                        <Text style={styles.statValue} numberOfLines={1}>
                            {s.value}
                            {s.unit ? <Text style={styles.statUnit}> {s.unit}</Text> : null}
                        </Text>
                    </View>
                ))}
            </View>
        </Pressable>
    );
}

/** The icon tile's side, which the stats grid indents by so it lines up under the title. */
const ICON = 40;

const useStyles = makeStyles((Palette) => ({
    card: {
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    pressed: { opacity: 0.7 },

    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    icon: {
        width: ICON,
        height: ICON,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heading: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    when: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },

    // Two columns, as the design sets them. A session with six figures wraps to three rows
    // rather than shrinking the type.
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingLeft: ICON + Spacing.md,
        rowGap: Spacing.sm,
    },
    stat: {
        width: '50%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: Spacing.sm,
    },
    statValue: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    statUnit: { fontSize: 11.5, ...BodyFont.regular, color: Palette.textSecondary },
}));
