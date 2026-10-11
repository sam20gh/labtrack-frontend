/**
 * "What counted today" — the Effort dial's working, under it on the activity page.
 *
 * Built after a real morning: a 30-minute swim and a short jog logged, and the dial read
 * "4 of 60". The arithmetic was right by its rules (the swim was rated Light; the band read
 * the jog as light) and nothing on screen said so, so it read as broken. A number that can
 * surprise somebody has to show its working where the number is.
 *
 * One row per workout: what it was, what it added, and which evidence decided that
 * (`effortReason`). Then the band's own minutes outside workouts. Each workout opens its page,
 * where the rating can be changed — the day is recomputed when it is.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { formatType } from '@/lib/activity';
import { typeStyle } from '@/lib/activityTypes';
import { effortReason, readoutTint, type Readout } from '@/lib/readout';

interface Props {
    effort: Readout['effort'];
    onOpenSession: (id: string) => void;
}

export default function EffortBreakdownCard({ effort, onOpenSession }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const breakdown = effort.breakdown;
    if (!breakdown || (!breakdown.sessions.length && breakdown.bandMin == null)) return null;

    const tint = readoutTint('effort', Palette);
    const plus = (n: number) => (n > 0 ? `+${n}` : '0');

    return (
        <View style={styles.card}>
            <Text style={styles.title}>What counted today</Text>

            {breakdown.sessions.map((s, i) => {
                const style = typeStyle(s.type);
                return (
                    <Pressable
                        key={s.id ?? `${s.type}-${i}`}
                        style={styles.row}
                        onPress={s.id ? () => onOpenSession(s.id as string) : undefined}
                        disabled={!s.id}
                        accessibilityRole={s.id ? 'button' : undefined}
                        accessibilityLabel={`${formatType(s.type)}, ${s.durationMin} minutes. ${effortReason(s)}. ${s.effortMin} effort minutes.`}
                    >
                        <View style={[styles.icon, { backgroundColor: style.surface }]}>
                            <MaterialCommunityIcons name={style.icon} size={18} color={style.tint} />
                        </View>
                        <View style={styles.text}>
                            <Text style={styles.name}>{formatType(s.type)} · {s.durationMin} min</Text>
                            <Text style={styles.reason}>{effortReason(s)}</Text>
                        </View>
                        <Text style={[styles.value, s.effortMin > 0 && { color: tint }]}>{plus(s.effortMin)}</Text>
                        {s.id ? <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} /> : null}
                    </Pressable>
                );
            })}

            {breakdown.bandMin != null ? (
                <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: Palette.borderLight }]}>
                        <Ionicons name="watch-outline" size={17} color={Palette.textSecondary} />
                    </View>
                    <View style={styles.text}>
                        <Text style={styles.name}>Your band, outside workouts</Text>
                        <Text style={styles.reason}>Minutes your heart rate was moderate or higher</Text>
                    </View>
                    <Text style={[styles.value, breakdown.bandMin > 0 && { color: tint }]}>{plus(breakdown.bandMin)}</Text>
                    <View style={{ width: 16 }} />
                </View>
            ) : null}

            <Text style={styles.footnote}>
                Effort counts moderate minutes once and vigorous minutes twice, toward the WHO&apos;s 150 a
                week. Light activity is good for you but isn&apos;t counted. If a rating is wrong, open the
                workout and change it.
            </Text>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        padding: Spacing.lg, gap: Spacing.md, borderRadius: Radius.xl,
        backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.borderLight,
    },
    title: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
    icon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: 2 },
    name: { fontSize: 14, color: Palette.text, ...BodyFont.semibold },
    reason: { fontSize: 12, lineHeight: 16, color: Palette.textSecondary, ...BodyFont.regular },
    value: { fontSize: 16, color: Palette.textSecondary, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
    footnote: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, ...BodyFont.regular },
}));
