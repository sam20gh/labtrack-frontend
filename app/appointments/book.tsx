/**
 * Request a consultation.
 *
 * The turing kit's booking screen (Doctor Appointment, frames 5–6) is a doctor summary, a
 * day strip and a slot grid over a sticky primary action. This is that screen, with one
 * change of vocabulary that runs through the whole flow: the kit says *book*, the API says
 * `status: 'requested'`. A person who reads "Booked" and clears their afternoon for an
 * appointment nobody has confirmed has been misled by the interface, so every label here
 * says request until the professional says otherwise.
 *
 * Doubles as the reschedule screen. `appointmentId` in the params moves an existing row via
 * `POST /appointments/:id/reschedule` rather than creating a second one — cancel-then-rebook
 * would drop the plan-item link and the price snapshot the original carries.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import {
    MODES, DEFAULT_DURATION, bookableDays, slotsForDay, getAppointments,
    createAppointment, rescheduleAppointment, formatDayLong, initialsOf,
    type AppointmentMode, type BookableDay,
} from '@/lib/appointments';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Appointment, Professional } from '@/types/api';

export default function BookAppointmentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        professionalId?: string;
        appointmentId?: string;
        planItemId?: string;
        reason?: string;
        /** Preselected day from a doctor card's strip, as `YYYY-MM-DD`. */
        day?: string;
    }>();

    const rescheduling = Boolean(params.appointmentId);

    const [professional, setProfessional] = useState<Professional | null>(null);
    const [diary, setDiary] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [mode, setMode] = useState<AppointmentMode>('video');
    const [dayKeySelected, setDayKeySelected] = useState<string | null>(params.day ?? null);
    const [slotAt, setSlotAt] = useState<Date | null>(null);
    const [reason, setReason] = useState(params.reason ?? '');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // The diary is what makes the strip honest: it is the only per-day signal
                // the API can supply, and it stops a slot the person already holds.
                const [prof, appointments] = await Promise.all([
                    params.professionalId
                        ? api.get<Professional>(`/professionals/${params.professionalId}`)
                        : Promise.resolve(null),
                    getAppointments().catch(() => [] as Appointment[]),
                ]);
                if (cancelled) return;
                setProfessional(prof);
                setDiary(appointments);
            } catch (error) {
                if (cancelled) return;
                Toast.show({
                    type: 'error',
                    text1: 'Could not load this specialist',
                    text2: error instanceof ApiError ? error.message : 'Please try again',
                });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [params.professionalId]);

    /**
     * When rescheduling, start from the booking being moved rather than from defaults —
     * a person changing a Tuesday video call to Thursday should not also have to re-pick
     * "video" and retype why they are going.
     */
    useEffect(() => {
        if (!rescheduling || !diary.length) return;
        const current = diary.find((a) => a._id === params.appointmentId);
        if (!current) return;
        setMode((current.mode ?? 'video') as AppointmentMode);
        if (current.reasonForVisit && !params.reason) setReason(current.reasonForVisit);
    }, [rescheduling, diary, params.appointmentId, params.reason]);

    /** Exclude the appointment being moved: its own slot is not a clash. */
    const otherAppointments = useMemo(
        () => diary.filter((a) => a._id !== params.appointmentId),
        [diary, params.appointmentId],
    );

    const days = useMemo(
        () => bookableDays(otherAppointments, params.professionalId),
        [otherAppointments, params.professionalId],
    );

    const selectedDay: BookableDay | undefined = useMemo(() => {
        const chosen = days.find((d) => d.key === dayKeySelected && d.open);
        // Default to the next open day rather than today — a Saturday opening the screen
        // onto an empty grid reads as "nothing is bookable at all".
        return chosen ?? days.find((d) => d.open);
    }, [days, dayKeySelected]);

    const slots = useMemo(
        () => (selectedDay ? slotsForDay(selectedDay.date, otherAppointments) : []),
        [selectedDay, otherAppointments],
    );

    const openSlots = slots.filter((s) => !s.disabled).length;

    // A slot picked on Tuesday is meaningless once the person moves to Wednesday.
    useEffect(() => { setSlotAt(null); }, [selectedDay?.key]);

    const submit = useCallback(async () => {
        if (!slotAt || !params.professionalId) return;
        setSubmitting(true);
        try {
            const appointment = rescheduling
                ? await rescheduleAppointment(params.appointmentId!, slotAt, mode)
                : await createAppointment({
                    professionalId: params.professionalId,
                    scheduledFor: slotAt,
                    mode,
                    reasonForVisit: reason,
                    durationMinutes: DEFAULT_DURATION,
                    planItemId: params.planItemId,
                });

            router.replace({
                pathname: '/appointments/confirmed',
                params: {
                    appointmentId: appointment._id,
                    at: appointment.scheduledFor,
                    mode: appointment.mode ?? mode,
                    doctor: professional
                        ? `Dr ${professional.firstname} ${professional.lastname}`
                        : 'your specialist',
                    rescheduled: rescheduling ? '1' : '0',
                },
            });
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: rescheduling ? 'Could not move that appointment' : 'Could not request that time',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setSubmitting(false);
        }
    }, [slotAt, params, rescheduling, mode, reason, professional, router]);

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
                <Text style={styles.navTitle}>{rescheduling ? 'Reschedule' : 'Request a consultation'}</Text>
                <View style={styles.navButton} />
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={8}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {professional && <DoctorSummary professional={professional} />}

                    <Section title="How would you like to meet?" icon="options-outline">
                        <View style={styles.modeRow}>
                            {MODES.map((m) => {
                                const active = mode === m.value;
                                return (
                                    <TouchableOpacity
                                        key={m.value}
                                        style={[styles.modeCard, active && styles.modeCardActive]}
                                        onPress={() => setMode(m.value)}
                                        activeOpacity={0.85}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Ionicons
                                            name={m.icon as any}
                                            size={20}
                                            color={active ? Palette.primary : Palette.textSecondary}
                                        />
                                        <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>
                                            {m.label}
                                        </Text>
                                        <Text style={styles.modeHint} numberOfLines={1}>{m.hint}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </Section>

                    <Section title="Pick a day" icon="calendar-outline">
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dayStrip}
                        >
                            {days.map((d) => {
                                const active = selectedDay?.key === d.key;
                                return (
                                    <TouchableOpacity
                                        key={d.key}
                                        disabled={!d.open}
                                        onPress={() => setDayKeySelected(d.key)}
                                        activeOpacity={0.85}
                                        style={[
                                            styles.dayCell,
                                            active && styles.dayCellActive,
                                            !d.open && styles.dayCellClosed,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active, disabled: !d.open }}
                                        accessibilityLabel={`${formatDayLong(d.date)}${d.open ? '' : ', closed'}`}
                                    >
                                        <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                                            {d.weekday}
                                        </Text>
                                        <Text style={[styles.dayNumber, active && styles.dayTextActive]}>
                                            {d.dayOfMonth}
                                        </Text>
                                        {/* The kit puts a dot under days that carry something.
                                            Ours can only mean one thing honestly: the person
                                            already has an appointment that day. */}
                                        <View
                                            style={[
                                                styles.dayDot,
                                                d.booked && styles.dayDotBooked,
                                                active && d.booked && styles.dayDotOnActive,
                                            ]}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        {selectedDay?.booked && (
                            <View style={styles.noteRow}>
                                <Ionicons name="information-circle-outline" size={15} color={Palette.info} />
                                <Text style={styles.noteText}>
                                    You already have an appointment on this day.
                                </Text>
                            </View>
                        )}
                    </Section>

                    <Section
                        title={selectedDay ? formatDayLong(selectedDay.date) : 'Pick a time'}
                        icon="time-outline"
                        trailing={`${openSlots} times`}
                    >
                        {openSlots === 0 ? (
                            <View style={styles.noSlots}>
                                <Ionicons name="moon-outline" size={22} color={Palette.textMuted} />
                                <Text style={styles.noSlotsText}>
                                    No times left today. Try tomorrow.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.slotGrid}>
                                {slots.map((s) => {
                                    const active = slotAt?.getTime() === s.at.getTime();
                                    return (
                                        <TouchableOpacity
                                            key={s.at.toISOString()}
                                            disabled={s.disabled}
                                            onPress={() => setSlotAt(s.at)}
                                            activeOpacity={0.85}
                                            style={[
                                                styles.slot,
                                                active && styles.slotActive,
                                                s.disabled && styles.slotDisabled,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active, disabled: s.disabled }}
                                            accessibilityHint={
                                                s.reason === 'taken' ? 'You already have an appointment then' : undefined
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.slotText,
                                                    active && styles.slotTextActive,
                                                    s.disabled && styles.slotTextDisabled,
                                                ]}
                                            >
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </Section>

                    {!rescheduling && (
                        <Section title="What is it about?" icon="document-text-outline" trailing="Optional">
                            <TextInput
                                style={styles.reasonInput}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="e.g. Reviewing my latest cholesterol results"
                                placeholderTextColor={Palette.textMuted}
                                multiline
                                maxLength={280}
                                textAlignVertical="top"
                            />
                            <Text style={styles.reasonHint}>
                                Shared with the specialist before the consultation, so the time is spent
                                on the answer rather than the question.
                            </Text>
                        </Section>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.footerSummary}>
                        <Text style={styles.footerLabel}>
                            {slotAt
                                ? `${formatDayLong(slotAt)} · ${slotAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                                : 'No time selected'}
                        </Text>
                        <Text style={styles.footerMeta}>
                            {DEFAULT_DURATION} min
                            {professional?.hourly_rate != null ? ` · £${professional.hourly_rate}/hr` : ''}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.cta, (!slotAt || submitting) && styles.ctaDisabled]}
                        onPress={submit}
                        disabled={!slotAt || submitting}
                        activeOpacity={0.85}
                    >
                        {submitting ? (
                            <ActivityIndicator color={Palette.white} />
                        ) : (
                            <>
                                <Text style={styles.ctaText}>
                                    {rescheduling ? 'Move appointment' : 'Request appointment'}
                                </Text>
                                <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.footerNote}>
                        {rescheduling
                            ? 'The specialist confirms the new time — the old one is released.'
                            : 'Sent as a request. You are booked once the specialist confirms.'}
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const DoctorSummary = ({ professional }: { professional: Professional }) => (
    <View style={styles.doctorCard}>
        {professional.profile_image ? (
            <Image source={{ uri: professional.profile_image }} style={styles.doctorAvatar} />
        ) : (
            <View style={[styles.doctorAvatar, styles.doctorAvatarFallback]}>
                <Text style={styles.doctorInitials}>{initialsOf(professional)}</Text>
            </View>
        )}
        <View style={styles.flex}>
            <Text style={styles.doctorName} numberOfLines={1}>
                Dr {professional.firstname} {professional.lastname}
            </Text>
            <Text style={styles.doctorSpeciality} numberOfLines={1}>
                {(professional.speciality ?? []).join(' · ') || 'Specialist'}
            </Text>
        </View>
        {professional.hourly_rate != null && (
            <View style={styles.ratePill}>
                <Text style={styles.rateText}>£{professional.hourly_rate}</Text>
                <Text style={styles.rateUnit}>/hr</Text>
            </View>
        )}
    </View>
);

const Section = ({ title, icon, trailing, children }: {
    title: string; icon: string; trailing?: string; children: React.ReactNode;
}) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Ionicons name={icon as any} size={17} color={Palette.primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
            {!!trailing && <Text style={styles.sectionTrailing}>{trailing}</Text>}
        </View>
        {children}
    </View>
);

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: Spacing.xxl },

    navBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        backgroundColor: Palette.canvas,
    },
    navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },

    doctorCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: Spacing.sm,
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.borderSlate,
        ...Shadow.card,
    },
    doctorAvatar: { width: 48, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.surface },
    doctorAvatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    doctorInitials: { fontSize: 16, color: Palette.primary, fontFamily: Fonts.bold },
    doctorName: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    doctorSpeciality: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 2 },
    ratePill: { flexDirection: 'row', alignItems: 'baseline' },
    rateText: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    rateUnit: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular },

    section: { marginTop: Spacing.xxl, paddingHorizontal: GUTTER, gap: Spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionTitle: { flex: 1, fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },
    sectionTrailing: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.medium },

    modeRow: { flexDirection: 'row', gap: Spacing.sm },
    modeCard: {
        flex: 1, alignItems: 'center', gap: 4,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1.5, borderColor: Palette.borderSlate,
    },
    modeCardActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    modeLabel: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    modeLabelActive: { color: Palette.primary },
    modeHint: { fontSize: 10, color: Palette.textMuted, fontFamily: Fonts.regular },

    dayStrip: { gap: Spacing.sm, paddingRight: GUTTER },
    dayCell: {
        width: 52, height: 74, alignItems: 'center', justifyContent: 'center', gap: 2,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    dayCellActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    dayCellClosed: { backgroundColor: Palette.borderLight, borderColor: Palette.borderLight, opacity: 0.55 },
    dayWeekday: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },
    dayNumber: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    dayTextActive: { color: Palette.white },
    dayDot: { width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: 'transparent' },
    dayDotBooked: { backgroundColor: Palette.success },
    dayDotOnActive: { backgroundColor: Palette.white },

    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    noteText: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },

    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    slot: {
        minWidth: 78, alignItems: 'center',
        paddingVertical: 11, paddingHorizontal: Spacing.md,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    slotActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    slotDisabled: { backgroundColor: Palette.borderLight, borderColor: Palette.borderLight },
    slotText: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    slotTextActive: { color: Palette.white },
    slotTextDisabled: { color: Palette.textMuted },

    noSlots: {
        alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    noSlotsText: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },

    reasonInput: {
        minHeight: 88, padding: Spacing.md,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
        fontSize: 14, lineHeight: 20, color: Palette.text, fontFamily: Fonts.regular,
    },
    reasonHint: { fontSize: 12, lineHeight: 17, color: Palette.textMuted, fontFamily: Fonts.regular },

    footer: {
        paddingHorizontal: GUTTER, paddingTop: Spacing.md, paddingBottom: Spacing.xl,
        gap: Spacing.sm, backgroundColor: Palette.white,
        borderTopWidth: 1, borderTopColor: Palette.borderSlate,
    },
    footerSummary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    footerLabel: { flex: 1, fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    footerMeta: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        height: 48, borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    ctaDisabled: { backgroundColor: Palette.textMuted, opacity: 0.6 },
    ctaText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.bold },
    footerNote: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, textAlign: 'center' },
});
