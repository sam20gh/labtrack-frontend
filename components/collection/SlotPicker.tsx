/**
 * Choose when a technician visits: a row of days, then that day's slots.
 *
 * The UAE runs around the clock in 30-minute slots — 48 a day — so the slots are grouped by
 * part of the day (night, morning, afternoon, evening) rather than laid out as one wall of
 * times. A full slot stays on the grid, greyed and saying "Full", so a busy morning reads as
 * busy rather than as times that mysteriously do not exist; one with a single place left says
 * so, because that is the moment somebody decides.
 *
 * Every label arrives from the server in the market's own clock (`lib/collection.ts`), and the
 * caption says which clock that is — a person in London booking for Dubai must not wonder.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import type { SlotDay } from '@/lib/collection';

interface Props {
    days: SlotDay[];
    value: string | null;
    onChange: (start: string) => void;
    /** The market's name for its clock, e.g. "UAE time". */
    clockLabel: string;
}

const PARTS = [
    { key: 'night', label: 'Night', from: 0, to: 6 },
    { key: 'morning', label: 'Morning', from: 6, to: 12 },
    { key: 'afternoon', label: 'Afternoon', from: 12, to: 17 },
    { key: 'evening', label: 'Evening', from: 17, to: 24 },
];

const hourOf = (label: string) => Number(label.slice(0, 2));

export function SlotPicker({ days, value, onChange, clockLabel }: Props) {
    const styles = useStyles();
    const open = days.filter((d) => !d.closed && d.slots.length);

    // Start on the day of the chosen slot, else the first day with anything free.
    const initial = useMemo(() => {
        if (value) {
            const day = days.find((d) => d.slots.some((s) => s.start === value));
            if (day) return day.date;
        }
        return (open.find((d) => d.slots.some((s) => s.remaining > 0)) ?? open[0])?.date ?? null;
    }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
    const [date, setDate] = useState<string | null>(initial);
    useEffect(() => { if (!date && initial) setDate(initial); }, [initial, date]);

    const day = days.find((d) => d.date === date);

    if (!open.length) {
        return <Text style={styles.empty}>There are no visit times available in the next two weeks. Please try again later.</Text>;
    }

    return (
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {days.map((d) => {
                    const free = d.slots.filter((s) => s.remaining > 0).length;
                    const on = d.date === date;
                    const disabled = d.closed || !free;
                    return (
                        <TouchableOpacity
                            key={d.date}
                            onPress={() => setDate(d.date)}
                            disabled={disabled}
                            style={[styles.day, on && styles.dayOn, disabled && styles.dayOff]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled }}
                            accessibilityLabel={`${d.label}${disabled ? ', no times' : `, ${free} times free`}`}
                        >
                            <Text style={[styles.dayTop, on && styles.dayTextOn]}>{d.label.split(' ')[0].replace(',', '')}</Text>
                            <Text style={[styles.dayNum, on && styles.dayTextOn]}>{d.label.split(' ').slice(1).join(' ')}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={styles.clock}>Times are {clockLabel}.</Text>

            {day ? PARTS.map((part) => {
                const slots = day.slots.filter((s) => hourOf(s.label) >= part.from && hourOf(s.label) < part.to);
                if (!slots.length) return null;
                return (
                    <View key={part.key} style={styles.part}>
                        <Text style={styles.partLabel}>{part.label}</Text>
                        <View style={styles.grid}>
                            {slots.map((s) => {
                                const on = s.start === value;
                                const full = s.remaining <= 0;
                                return (
                                    <TouchableOpacity
                                        key={s.start}
                                        disabled={full}
                                        onPress={() => onChange(s.start)}
                                        style={[styles.slot, on && styles.slotOn, full && styles.slotFull]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on, disabled: full }}
                                        accessibilityLabel={`${day.label} ${s.label}${full ? ', full' : s.remaining === 1 ? ', one place left' : ''}`}
                                    >
                                        <Text style={[styles.slotText, on && styles.slotTextOn, full && styles.slotTextFull]}>{s.label}</Text>
                                        {full ? <Text style={styles.slotNote}>Full</Text>
                                            : s.remaining === 1 && !on ? <Text style={styles.slotNote}>1 left</Text> : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );
            }) : null}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    empty: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 20 },
    days: { gap: Spacing.sm, paddingVertical: 2 },
    day: {
        width: 64, paddingVertical: Spacing.sm, borderRadius: Radius.lg, alignItems: 'center',
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.background,
    },
    dayOn: { backgroundColor: Palette.primaryFill, borderColor: Palette.primaryFill },
    dayOff: { opacity: 0.4 },
    dayTop: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    dayNum: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 2 },
    dayTextOn: { color: Palette.white },
    clock: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted, marginTop: Spacing.sm },
    part: { marginTop: Spacing.md },
    partLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary, marginBottom: Spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    slot: {
        width: '22.6%', paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center',
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.background,
    },
    slotOn: { backgroundColor: Palette.primaryFill, borderColor: Palette.primaryFill },
    slotFull: { backgroundColor: Palette.borderLight, borderColor: Palette.borderLight },
    slotText: { fontSize: 14, ...BodyFont.medium, color: Palette.text, fontVariant: ['tabular-nums'] },
    slotTextOn: { color: Palette.white },
    slotTextFull: { color: Palette.textMuted },
    slotNote: { fontSize: 10, ...BodyFont.regular, color: Palette.textMuted, marginTop: 1 },
}));

export default SlotPicker;
