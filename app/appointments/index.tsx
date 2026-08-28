/**
 * Your appointments.
 *
 * The turing kit draws this as a diary, not a list: a week strip across the top, then a
 * vertical time rail with each booking pinned to its hour and the empty hours left visible
 * (Doctor Appointment, frame 14). The empty rows are the point — a day with one 10:00
 * consultation should look like a day with one consultation, not like a one-item list.
 *
 * Actions follow the kit's card: reschedule and cancel as icon buttons on the card itself,
 * each behind a confirmation (frames 16 and 18), because both are irreversible from the
 * professional's side. Cancel is destructive-coloured; reschedule is not.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
    ActivityIndicator, RefreshControl, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import {
    getAppointments, cancelAppointment, groupByDay, dayKey, addDays, startOfDay,
    formatTime, formatRelativeDay, formatDayLong, STATUS_META, MODE_LABEL, MODE_ICON,
    professionalOf, professionalIdOf, nameOf, initialsOf, isLive, isImminent, splitByTime,
    DEFAULT_DURATION, type AppointmentMode,
} from '@/lib/appointments';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Appointment } from '@/types/api';

/** Days shown in the strip, starting today. */
const STRIP_DAYS = 14;

export default function AppointmentsScreen() {
    const router = useRouter();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedKey, setSelectedKey] = useState(dayKey(new Date()));
    const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const load = useCallback(async () => {
        try {
            setAppointments(await getAppointments());
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Could not load your appointments';
            Toast.show({ type: 'error', text1: 'Could not load your appointments', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

    const byDay = useMemo(() => groupByDay(appointments), [appointments]);
    const { upcoming } = useMemo(() => splitByTime(appointments), [appointments]);

    const days = useMemo(() => {
        const today = startOfDay(new Date());
        return Array.from({ length: STRIP_DAYS }, (_, i) => {
            const date = addDays(today, i);
            const key = dayKey(date);
            return {
                date,
                key,
                weekday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()],
                dayOfMonth: date.getDate(),
                count: (byDay[key] ?? []).filter(isLive).length,
                today: i === 0,
            };
        });
    }, [byDay]);

    const selectedDate = useMemo(() => {
        const found = days.find((d) => d.key === selectedKey);
        return found?.date ?? new Date();
    }, [days, selectedKey]);

    const dayAppointments = useMemo(
        () => (byDay[selectedKey] ?? []).filter((a) => a.status !== 'cancelled'),
        [byDay, selectedKey],
    );

    /** The next thing happening, whatever day is on screen — it outranks browsing. */
    const nextUp = upcoming[0];
    const imminent = nextUp && isImminent(nextUp) ? nextUp : null;

    const confirmCancel = useCallback(async () => {
        if (!pendingCancel) return;
        setCancelling(true);
        try {
            await cancelAppointment(pendingCancel._id);
            Toast.show({ type: 'success', text1: 'Appointment cancelled' });
            setPendingCancel(null);
            await load();
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not cancel',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setCancelling(false);
        }
    }, [pendingCancel, load]);

    const goReschedule = (a: Appointment) =>
        router.push({
            pathname: '/appointments/book',
            params: {
                appointmentId: a._id,
                professionalId: professionalIdOf(a),
                day: dayKey(new Date(a.scheduledFor)),
            },
        });

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.navButton}>
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                <View style={styles.flex}>
                    <Text style={styles.pageTitle}>Appointments</Text>
                    <Text style={styles.pageSubtitle}>
                        {upcoming.length === 0
                            ? 'Nothing scheduled'
                            : `${upcoming.length} upcoming · next ${formatRelativeDay(new Date(upcoming[0].scheduledFor))}`}
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                {imminent && (
                    <ImminentBanner
                        appointment={imminent}
                        onReschedule={() => goReschedule(imminent)}
                    />
                )}

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dayStrip}
                >
                    {days.map((d) => {
                        const active = d.key === selectedKey;
                        return (
                            <TouchableOpacity
                                key={d.key}
                                onPress={() => setSelectedKey(d.key)}
                                activeOpacity={0.85}
                                style={[styles.dayCell, active && styles.dayCellActive]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={`${formatDayLong(d.date)}, ${d.count} appointments`}
                            >
                                <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                                    {d.weekday}
                                </Text>
                                <Text style={[styles.dayNumber, active && styles.dayTextActive]}>
                                    {d.dayOfMonth}
                                </Text>
                                <View
                                    style={[
                                        styles.dayDot,
                                        d.count > 0 && styles.dayDotFilled,
                                        active && d.count > 0 && styles.dayDotOnActive,
                                    ]}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <Text style={styles.dayHeading}>
                    {formatRelativeDay(selectedDate)} · {formatDayLong(selectedDate)}
                </Text>

                {dayAppointments.length === 0 ? (
                    <EmptyDay
                        isToday={selectedKey === dayKey(new Date())}
                        onFind={() => router.push('/(tabs)/professionals')}
                    />
                ) : (
                    <View style={styles.agenda}>
                        {dayAppointments.map((a, index) => (
                            <AgendaRow
                                key={a._id}
                                appointment={a}
                                last={index === dayAppointments.length - 1}
                                onReschedule={() => goReschedule(a)}
                                onCancel={() => setPendingCancel(a)}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/(tabs)/professionals')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Find a specialist"
            >
                <Ionicons name="add" size={26} color={Palette.white} />
            </TouchableOpacity>

            <ConfirmSheet
                visible={Boolean(pendingCancel)}
                busy={cancelling}
                title="Cancel this appointment?"
                body={
                    pendingCancel
                        ? `${nameOf(professionalOf(pendingCancel))} on ${formatDayLong(new Date(pendingCancel.scheduledFor))} at ${formatTime(new Date(pendingCancel.scheduledFor))}. The slot is released and cannot be taken back.`
                        : ''
                }
                confirmLabel="Yes, cancel it"
                cancelLabel="Keep appointment"
                destructive
                onConfirm={confirmCancel}
                onDismiss={() => setPendingCancel(null)}
            />
        </SafeAreaView>
    );
}

/**
 * "Time for your appointment" (frames 20–21).
 *
 * Only rendered inside the half-hour around the start, and only ever for a live booking —
 * a banner urging someone into a call that was cancelled is worse than no banner.
 */
const ImminentBanner = ({ appointment, onReschedule }: {
    appointment: Appointment; onReschedule: () => void;
}) => {
    const professional = professionalOf(appointment);
    const mode = (appointment.mode ?? 'video') as AppointmentMode;
    const at = new Date(appointment.scheduledFor);

    return (
        <View style={styles.imminent}>
            <View style={styles.imminentHeader}>
                <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>NOW</Text>
                </View>
                <Text style={styles.imminentTime}>{formatTime(at)}</Text>
            </View>

            <Text style={styles.imminentTitle}>
                Your {MODE_LABEL[mode].toLowerCase()} with {nameOf(professional)}
            </Text>
            <Text style={styles.imminentBody}>
                {appointment.status === 'confirmed'
                    ? 'Confirmed and starting now.'
                    : 'Still awaiting confirmation — check with the clinic before you join.'}
            </Text>

            <TouchableOpacity style={styles.imminentAction} onPress={onReschedule} activeOpacity={0.85}>
                <Ionicons name="calendar-outline" size={17} color={Palette.primary} />
                <Text style={styles.imminentActionText}>Move to another time</Text>
            </TouchableOpacity>
        </View>
    );
};

/** One row of the time rail: the hour, the rail itself, then the card. */
const AgendaRow = ({ appointment, last, onReschedule, onCancel }: {
    appointment: Appointment; last: boolean; onReschedule: () => void; onCancel: () => void;
}) => {
    const professional = professionalOf(appointment);
    const at = new Date(appointment.scheduledFor);
    const meta = STATUS_META[appointment.status] ?? STATUS_META.requested;
    const mode = (appointment.mode ?? 'video') as AppointmentMode;
    const actionable = isLive(appointment) && at.getTime() > Date.now();

    return (
        <View style={styles.agendaRow}>
            <View style={styles.rail}>
                <Text style={styles.railTime}>{formatTime(at)}</Text>
                <View style={styles.railDot} />
                {!last && <View style={styles.railLine} />}
            </View>

            <View style={styles.apptCard}>
                <View style={styles.apptHead}>
                    {professional?.profile_image ? (
                        <Image source={{ uri: professional.profile_image }} style={styles.apptAvatar} />
                    ) : (
                        <View style={[styles.apptAvatar, styles.apptAvatarFallback]}>
                            <Text style={styles.apptInitials}>{initialsOf(professional)}</Text>
                        </View>
                    )}

                    <View style={styles.flex}>
                        <Text style={styles.apptName} numberOfLines={1}>{nameOf(professional)}</Text>
                        <Text style={styles.apptSpeciality} numberOfLines={1}>
                            {(professional?.speciality ?? []).join(' · ') || 'Specialist'}
                        </Text>
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                </View>

                <View style={styles.apptMeta}>
                    <Ionicons name={MODE_ICON[mode] as any} size={14} color={Palette.textSecondary} />
                    <Text style={styles.apptMetaText}>{MODE_LABEL[mode]}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.apptMetaText}>
                        {appointment.durationMinutes ?? DEFAULT_DURATION} min
                    </Text>
                </View>

                {!!appointment.reasonForVisit && (
                    <Text style={styles.apptReason} numberOfLines={2}>{appointment.reasonForVisit}</Text>
                )}

                {actionable && (
                    <View style={styles.apptActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onReschedule}
                            activeOpacity={0.8}
                            accessibilityLabel="Reschedule"
                        >
                            <Ionicons name="calendar-outline" size={17} color={Palette.warning} />
                            <Text style={[styles.actionText, { color: Palette.warning }]}>Reschedule</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onCancel}
                            activeOpacity={0.8}
                            accessibilityLabel="Cancel appointment"
                        >
                            <Ionicons name="close-circle-outline" size={17} color={Palette.danger} />
                            <Text style={[styles.actionText, { color: Palette.danger }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

/** Frame 15: an empty day is an invitation, not an error. */
const EmptyDay = ({ isToday, onFind }: { isToday: boolean; onFind: () => void }) => (
    <View style={styles.empty}>
        <View style={styles.emptyMark}>
            <Ionicons name="calendar-clear-outline" size={26} color={Palette.primary} />
        </View>
        <Text style={styles.emptyTitle}>
            {isToday ? 'Nothing booked today' : 'Nothing booked this day'}
        </Text>
        <Text style={styles.emptyBody}>
            Consultations you request appear here, with the time you asked for and whether the
            specialist has confirmed it.
        </Text>
        <TouchableOpacity style={styles.emptyCta} onPress={onFind} activeOpacity={0.85}>
            <Ionicons name="search" size={16} color={Palette.white} />
            <Text style={styles.emptyCtaText}>Find a specialist</Text>
        </TouchableOpacity>
    </View>
);

/** Frames 16 and 18 — a sheet rather than a system alert, so the copy fits. */
const ConfirmSheet = ({
    visible, title, body, confirmLabel, cancelLabel, destructive, busy, onConfirm, onDismiss,
}: {
    visible: boolean; title: string; body: string;
    confirmLabel: string; cancelLabel: string;
    destructive?: boolean; busy?: boolean;
    onConfirm: () => void; onDismiss: () => void;
}) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onDismiss}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                <View style={[styles.sheetMark, destructive && styles.sheetMarkDanger]}>
                    <Ionicons
                        name={destructive ? 'alert-circle-outline' : 'help-circle-outline'}
                        size={26}
                        color={destructive ? Palette.danger : Palette.primary}
                    />
                </View>
                <Text style={styles.sheetTitle}>{title}</Text>
                <Text style={styles.sheetBody}>{body}</Text>

                <TouchableOpacity
                    style={[styles.sheetPrimary, destructive && styles.sheetPrimaryDanger]}
                    onPress={onConfirm}
                    disabled={busy}
                    activeOpacity={0.85}
                >
                    {busy
                        ? <ActivityIndicator color={Palette.white} />
                        : <Text style={styles.sheetPrimaryText}>{confirmLabel}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.sheetSecondary}
                    onPress={onDismiss}
                    disabled={busy}
                    activeOpacity={0.8}
                >
                    <Text style={styles.sheetSecondaryText}>{cancelLabel}</Text>
                </TouchableOpacity>
            </Pressable>
        </Pressable>
    </Modal>
);

const GUTTER = Spacing.lg;
/** Width of the time rail. Fixed so every card's left edge lines up down the day. */
const RAIL = 62;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 96 },

    navBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
        paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    },
    navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    pageTitle: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold },
    pageSubtitle: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },

    imminent: {
        marginHorizontal: GUTTER, marginBottom: Spacing.lg,
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.primaryDeep, gap: 6,
    },
    imminentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    livePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.sm, paddingVertical: 3,
        borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.15)',
    },
    liveDot: { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: '#4ADE80' },
    liveText: { fontSize: 10, letterSpacing: 1, color: Palette.white, fontFamily: Fonts.bold },
    imminentTime: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.semibold },
    imminentTitle: { fontSize: 18, lineHeight: 24, color: Palette.white, fontFamily: Fonts.bold },
    imminentBody: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.regular },
    imminentAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: Spacing.md, height: 42,
        borderRadius: Radius.md, backgroundColor: Palette.white,
    },
    imminentActionText: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold },

    dayStrip: { gap: Spacing.sm, paddingHorizontal: GUTTER },
    dayCell: {
        width: 48, height: 70, alignItems: 'center', justifyContent: 'center', gap: 2,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    dayCellActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    dayWeekday: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },
    dayNumber: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    dayTextActive: { color: Palette.white },
    dayDot: { width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: 'transparent' },
    dayDotFilled: { backgroundColor: Palette.success },
    dayDotOnActive: { backgroundColor: Palette.white },

    dayHeading: {
        marginTop: Spacing.xl, marginBottom: Spacing.md, paddingHorizontal: GUTTER,
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.semibold,
    },

    agenda: { paddingHorizontal: GUTTER },
    agendaRow: { flexDirection: 'row', gap: Spacing.md },
    rail: { width: RAIL, alignItems: 'flex-start' },
    railTime: { fontSize: 12, color: Palette.text, fontFamily: Fonts.bold },
    railDot: {
        width: 9, height: 9, borderRadius: Radius.pill, marginTop: 6, marginLeft: 2,
        backgroundColor: Palette.primary,
    },
    railLine: {
        position: 'absolute', top: 32, bottom: -Spacing.md, left: 6,
        width: 1.5, backgroundColor: Palette.borderSlate,
    },

    apptCard: {
        flex: 1, marginBottom: Spacing.md, padding: Spacing.md, gap: Spacing.sm,
        borderRadius: Radius.lg, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate, ...Shadow.card,
    },
    apptHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    apptAvatar: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.surface },
    apptAvatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    apptInitials: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold },
    apptName: { fontSize: 14, color: Palette.text, fontFamily: Fonts.bold },
    apptSpeciality: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
    statusText: { fontSize: 10, fontFamily: Fonts.bold },

    apptMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    apptMetaText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    metaDot: {
        width: 3, height: 3, borderRadius: Radius.pill,
        backgroundColor: Palette.textMuted, marginHorizontal: 3,
    },
    apptReason: {
        fontSize: 12, lineHeight: 18, color: Palette.text, fontFamily: Fonts.regular,
        paddingTop: 2,
    },

    apptActions: {
        flexDirection: 'row', gap: Spacing.sm,
        paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    actionButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        height: 36, borderRadius: Radius.sm, backgroundColor: Palette.surface,
    },
    actionText: { fontSize: 12, fontFamily: Fonts.semibold },

    empty: {
        alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: GUTTER, padding: Spacing.xxl,
        borderRadius: Radius.lg, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    emptyMark: {
        width: 52, height: 52, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primarySurface, marginBottom: Spacing.xs,
    },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    emptyBody: {
        fontSize: 13, lineHeight: 19, color: Palette.textSecondary,
        textAlign: 'center', fontFamily: Fonts.regular,
    },
    emptyCta: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
        paddingHorizontal: Spacing.xl, height: 42,
        borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    emptyCtaText: { fontSize: 14, color: Palette.white, fontFamily: Fonts.semibold },

    fab: {
        position: 'absolute', right: GUTTER, bottom: Spacing.xxl,
        width: 52, height: 52, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primary,
        shadowColor: Palette.primaryDeep, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },

    backdrop: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)', padding: GUTTER,
    },
    sheet: {
        alignItems: 'center', gap: Spacing.sm,
        padding: Spacing.xl, paddingBottom: Spacing.xxl,
        borderRadius: Radius.xl, backgroundColor: Palette.white,
    },
    sheetMark: {
        width: 52, height: 52, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    sheetMarkDanger: { backgroundColor: Palette.dangerSurface },
    sheetTitle: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    sheetBody: {
        fontSize: 13, lineHeight: 20, color: Palette.textSecondary,
        textAlign: 'center', fontFamily: Fonts.regular,
    },
    sheetPrimary: {
        alignSelf: 'stretch', height: 48, marginTop: Spacing.md,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    sheetPrimaryDanger: { backgroundColor: Palette.danger },
    sheetPrimaryText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.bold },
    sheetSecondary: { alignSelf: 'stretch', height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetSecondaryText: { fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.semibold },
});
