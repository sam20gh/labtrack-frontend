/**
 * The schedule — a day at a time, with a week strip and a month view.
 *
 * The design has separate Daily and Monthly frames reached through a "Choose Timeline"
 * sheet. They are one screen here with a toggle: the two views answer the same question at
 * different zoom levels, and a modal between them adds a tap to every switch.
 *
 * The month grid marks a day `taken` only when every dose on it was taken. A tick on a day
 * someone missed their evening dose is a lie they will act on, so a partial day gets its own
 * mark — see `medicationSchedule.byDay`.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSchedule, getCalendar, updateDose, today, addDays } from '@/lib/medications';
import { DoseRow } from '@/components/medications/DoseRow';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationScheduleDay, MedicationCalendar, CalendarDay } from '@/types/api';

type View_ = 'day' | 'month';

/** How each day status is drawn in the month grid. */
const DAY_STATUS: Record<CalendarDay['status'], { colour: string; icon: string | null }> = {
    taken: { colour: Palette.success, icon: 'checkmark' },
    partial: { colour: Palette.warning, icon: 'remove' },
    missed: { colour: Palette.danger, icon: 'close' },
    skipped: { colour: Palette.textMuted, icon: 'close' },
    upcoming: { colour: Palette.border, icon: null },
};

export default function ScheduleScreen() {
    const router = useRouter();
    const [view, setView] = useState<View_>('day');
    const [selected, setSelected] = useState(today());
    const [day, setDay] = useState<MedicationScheduleDay | null>(null);
    const [calendar, setCalendar] = useState<MedicationCalendar | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyDose, setBusyDose] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [dayRes, calRes] = await Promise.allSettled([
                getSchedule(selected),
                getCalendar(addDays(today(), -30), addDays(today(), 14)),
            ]);
            if (dayRes.status === 'fulfilled') setDay(dayRes.value);
            if (calRes.status === 'fulfilled') setCalendar(calRes.value);
        } finally {
            setLoading(false);
        }
    }, [selected]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const act = async (id: string, action: 'take' | 'skip' | 'undo') => {
        setBusyDose(id);
        try {
            await updateDose(id, action);
            await load();
        } catch (error) {
            Alert.alert('Could not update', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setBusyDose(null);
        }
    };

    // A week either side of today, for the strip
    const week = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 6));
    const statusFor = (d: string) => calendar?.days.find((x) => x.day === d)?.status;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Schedule</Text>
                <View style={styles.toggle}>
                    <TouchableOpacity
                        style={[styles.toggleButton, view === 'day' && styles.toggleActive]}
                        onPress={() => setView('day')}
                    >
                        <Ionicons name="list-outline" size={15} color={view === 'day' ? Palette.primary : Palette.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, view === 'month' && styles.toggleActive]}
                        onPress={() => setView('month')}
                    >
                        <Ionicons name="calendar-outline" size={15} color={view === 'month' ? Palette.primary : Palette.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {view === 'day' ? (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.weekStrip}
                    >
                        {week.map((d) => {
                            const isSelected = d === selected;
                            const status = statusFor(d);
                            return (
                                <TouchableOpacity
                                    key={d}
                                    style={[styles.weekDay, isSelected && styles.weekDaySelected]}
                                    onPress={() => { setSelected(d); setLoading(true); }}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.weekDayName, isSelected && styles.weekDayTextSelected]}>
                                        {new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }).slice(0, 1)}
                                    </Text>
                                    <Text style={[styles.weekDayNum, isSelected && styles.weekDayTextSelected]}>
                                        {Number(d.slice(8))}
                                    </Text>
                                    <View style={[
                                        styles.weekDot,
                                        status ? { backgroundColor: DAY_STATUS[status].colour } : { backgroundColor: 'transparent' },
                                    ]} />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
                    ) : (
                        <ScrollView contentContainerStyle={styles.content}>
                            {day?.doses.length ? (
                                <>
                                    {day.adherence.assessed > 0 ? (
                                        <Text style={styles.daySummary}>
                                            {day.adherence.taken} of {day.adherence.assessed} due doses taken
                                        </Text>
                                    ) : null}
                                    {day.doses.map((dose) => (
                                        <DoseRow
                                            key={dose._id}
                                            dose={dose}
                                            busy={busyDose === dose._id}
                                            onTake={() => act(dose._id, 'take')}
                                            onSkip={() => act(dose._id, 'skip')}
                                            onUndo={() => act(dose._id, 'undo')}
                                            onPress={() => dose.medication && router.push(`/medications/${dose.medication._id}`)}
                                        />
                                    ))}
                                </>
                            ) : (
                                <View style={styles.empty}>
                                    <Ionicons name="calendar-clear-outline" size={30} color={Palette.textMuted} />
                                    <Text style={styles.emptyTitle}>Nothing scheduled</Text>
                                    <Text style={styles.emptyBody}>
                                        No doses fall on this day. Medicines taken only when needed
                                        never appear on the schedule.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {calendar ? (
                        <>
                            <View style={styles.monthStats}>
                                <MonthStat value={calendar.adherence.taken} label="Taken" colour={Palette.success} />
                                <MonthStat value={calendar.adherence.missed} label="Missed" colour={Palette.danger} />
                                <MonthStat value={calendar.adherence.skipped} label="Skipped" colour={Palette.textMuted} />
                            </View>

                            <View style={styles.grid}>
                                {calendar.days.map((d) => {
                                    const meta = DAY_STATUS[d.status];
                                    return (
                                        <TouchableOpacity
                                            key={d.day}
                                            style={styles.cell}
                                            onPress={() => { setSelected(d.day); setView('day'); setLoading(true); }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.cellDate}>{Number(d.day.slice(8))}</Text>
                                            <View style={[
                                                styles.cellMark,
                                                { borderColor: meta.colour },
                                                meta.icon ? { backgroundColor: meta.colour } : null,
                                            ]}>
                                                {meta.icon ? (
                                                    <Ionicons name={meta.icon as any} size={11} color={Palette.white} />
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={styles.legend}>
                                <LegendItem colour={Palette.success} label="All taken" />
                                <LegendItem colour={Palette.warning} label="Some taken" />
                                <LegendItem colour={Palette.danger} label="Missed" />
                                <LegendItem colour={Palette.border} label="Upcoming" />
                            </View>

                            {/*
                              Stated because the grid invites the opposite reading: a day
                              with one dose taken and one missed is amber, not a tick.
                            */}
                            <Text style={styles.gridNote}>
                                A day counts as taken only when every dose on it was taken.
                            </Text>
                        </>
                    ) : (
                        <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const MonthStat = ({ value, label, colour }: { value: number; label: string; colour: string }) => (
    <View style={styles.monthStat}>
        <Text style={[styles.monthStatValue, { color: colour }]}>{value}</Text>
        <Text style={styles.monthStatLabel}>{label}</Text>
    </View>
);

const LegendItem = ({ colour, label }: { colour: string; label: string }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colour }]} />
        <Text style={styles.legendLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    toggle: { flexDirection: 'row', gap: 2, backgroundColor: Palette.borderLight, borderRadius: Radius.sm, padding: 2 },
    toggleButton: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.sm },
    toggleActive: { backgroundColor: Palette.white },

    weekStrip: { paddingHorizontal: Spacing.xl, gap: 8, paddingBottom: Spacing.md },
    weekDay: {
        width: 46, paddingVertical: 8, borderRadius: Radius.md,
        alignItems: 'center', gap: 2,
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white,
    },
    weekDaySelected: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    weekDayName: { fontSize: 10, color: Palette.textSecondary, fontFamily: Fonts.regular },
    weekDayNum: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    weekDayTextSelected: { color: Palette.primary },
    weekDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxxl * 2 },
    daySummary: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, marginBottom: Spacing.xs },

    monthStats: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    monthStat: {
        flex: 1, alignItems: 'center', gap: 2,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, paddingVertical: Spacing.lg,
    },
    monthStatValue: { fontSize: 22, fontFamily: Fonts.bold },
    monthStatLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-start' },
    cell: { width: '12%', alignItems: 'center', gap: 3, paddingVertical: 4 },
    cellDate: { fontSize: 10, color: Palette.textSecondary, fontFamily: Fonts.regular },
    cellMark: {
        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    gridNote: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 16, marginTop: Spacing.sm },

    empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl * 2 },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.semibold },
    emptyBody: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular,
        textAlign: 'center', lineHeight: 19, paddingHorizontal: Spacing.xl,
    },
});
