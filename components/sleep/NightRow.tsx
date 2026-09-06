/**
 * One night in a list — `Design/sleep.svg` frames 7 (Sleep History card) and 9 (the screen).
 *
 * The design puts a `zZ` mark, the duration, the times either side of it and a chevron. What
 * it does not put there is a verdict, and neither does this: the band is available on the row
 * and is drawn as a small tinted dot rather than a word, because a list of nights each
 * labelled "Suboptimal" is a scroll of judgements about somebody's week.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatMinutes, formatClock, dayLabel, bandTint, type SleepNight } from '@/lib/sleep';

interface Props {
    night: SleepNight;
    onPress?: () => void;
    /** Shows the source when it is worth saying — a hand-typed night among synced ones. */
    showSource?: boolean;
}

export function NightRow({ night, onPress, showSource = false }: Props) {
    return (
        <Pressable
            style={styles.row}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${dayLabel(night.day)}, ${formatMinutes(night.asleepMin)} asleep`}
        >
            <View style={styles.mark}>
                <Ionicons name="moon" size={16} color={Palette.primary} />
            </View>

            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.duration}>{formatMinutes(night.asleepMin)}</Text>
                    {night.band ? (
                        <View style={[styles.bandDot, { backgroundColor: bandTint(night.band.key) }]} />
                    ) : null}
                </View>
                <Text style={styles.times}>
                    {formatClock(night.bedtimeMin)} – {formatClock(night.wakeMin)}
                    {showSource && night.source === 'manual' ? ' · entered by hand' : ''}
                </Text>
            </View>

            <Text style={styles.day}>{dayLabel(night.day)}</Text>
            {onPress ? <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} /> : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
    },
    mark: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primarySurface,
    },
    body: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    duration: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    bandDot: { width: 7, height: 7, borderRadius: 4 },
    times: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    day: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
});

export default NightRow;
