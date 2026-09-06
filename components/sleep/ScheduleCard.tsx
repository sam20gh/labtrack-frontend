/**
 * One sleep schedule in a list — `Design/sleep.svg` frames 7 and 14.
 *
 * **The switch turns a bedtime reminder on and off, not an alarm.** The kit draws these rows
 * as alarms, with a sound picker, a volume slider and a vibration toggle behind them. None of
 * that ships — see the note at the top of `models/SleepSchedule.js` — so the row says
 * "Reminder" rather than a time it will ring, and there is no bell. A switch labelled like an
 * alarm that silently does not wake somebody is worse than not offering one.
 */
import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatClock, formatMinutes, type SleepSchedule } from '@/lib/sleep';

/** `Mon, Wed, Sun` — or "Every day" for the empty list, which is what empty means. */
export const daysLabel = (days: number[] = []): string => {
    if (!days.length) return 'Every day';
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.slice().sort((a, b) => a - b).map((d) => names[d]).join(', ');
};

interface Props {
    schedule: SleepSchedule;
    onPress?: () => void;
    onToggle?: (enabled: boolean) => void;
}

export function ScheduleCard({ schedule, onPress, onToggle }: Props) {
    return (
        <Pressable
            style={styles.card}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
        >
            {onToggle ? (
                <Switch
                    value={schedule.enabled}
                    onValueChange={onToggle}
                    trackColor={{ false: Palette.borderSlate, true: Palette.primary }}
                    thumbColor={Palette.white}
                />
            ) : null}

            <View style={styles.body}>
                <Text style={styles.name}>{schedule.name}</Text>
                <Text style={styles.time}>{formatClock(schedule.bedtimeMin)}</Text>
                <Text style={styles.detail}>
                    {`Up at ${formatClock(schedule.wakeMin)} · ${formatMinutes(schedule.durationMin)}`}
                </Text>
                <Text style={styles.detail}>
                    {daysLabel(schedule.days)}
                    {schedule.remindMinutesBefore > 0
                        ? ` · reminder ${schedule.remindMinutesBefore}m before`
                        : ' · no reminder'}
                </Text>
            </View>

            {onPress ? <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} /> : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.lg,
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderLight,
    },
    body: { flex: 1, gap: 1 },
    name: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    time: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    detail: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
});

export default ScheduleCard;
