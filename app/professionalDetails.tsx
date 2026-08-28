/**
 * One specialist.
 *
 * The turing kit's doctor profile (Doctor Appointment, frame 5) is a photo panel with the
 * identity card floating over its lower edge and a single primary action pinned at the
 * bottom. This is that shape, minus the two things the kit shows that LabTrack has no data
 * for: a star rating (there is no review model for professionals) and a clinic map (there
 * are no coordinates on `Professional`). Drawing either would mean inventing it.
 *
 * The screen now fetches by id rather than receiving the whole document as a navigation
 * param — expo-router serialises params through the URL, so an object arrives as
 * `[object Object]`. `GET /professionals/:id` already exists for exactly this.
 *
 * Booking used to be routed via the health plan, on the grounds that a consultation needs a
 * clinical reason attached. The booking screen asks for that reason directly, so the detour
 * is gone and the button here does what it says.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import {
    getAppointments, bookableDays, isLive, professionalIdOf,
    formatDayShort, formatTime, MODE_LABEL, STATUS_META,
    type AppointmentMode, type BookableDay,
} from '@/lib/appointments';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Appointment, Professional } from '@/types/api';

export default function ProfessionalDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ professionalId?: string }>();

    const [professional, setProfessional] = useState<Professional | null>(null);
    const [diary, setDiary] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!params.professionalId) { setLoading(false); return; }
            try {
                const [prof, appointments] = await Promise.all([
                    api.get<Professional>(`/professionals/${params.professionalId}`),
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

    /** Live bookings with this specialist, soonest first. */
    const mine = useMemo(() => {
        if (!professional) return [];
        return diary
            .filter((a) => isLive(a) && professionalIdOf(a) === professional._id)
            .filter((a) => new Date(a.scheduledFor).getTime() >= Date.now())
            .sort((a, b) => +new Date(a.scheduledFor) - +new Date(b.scheduledFor));
    }, [diary, professional]);

    const days: BookableDay[] = useMemo(
        () => (professional ? bookableDays(diary, professional._id).filter((d) => d.open).slice(0, 6) : []),
        [diary, professional],
    );

    const book = (day?: BookableDay) => {
        if (!professional) return;
        router.push({
            pathname: '/appointments/book',
            params: { professionalId: professional._id, ...(day ? { day: day.key } : {}) },
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (!professional) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <Ionicons name="person-outline" size={34} color={Palette.textMuted} />
                <Text style={styles.emptyTitle}>Specialist not found</Text>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                    <Text style={styles.backLinkText}>Go back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const initials =
        `${professional.firstname?.[0] ?? ''}${professional.lastname?.[0] ?? ''}`.toUpperCase() || '?';
    const location = [professional.address, professional.postcode, professional.country]
        .filter(Boolean)
        .join(', ');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.navButton}>
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Specialist</Text>
                <TouchableOpacity
                    onPress={() => router.push('/appointments')}
                    hitSlop={12}
                    style={styles.navButton}
                    accessibilityLabel="My appointments"
                >
                    <Ionicons name="calendar-outline" size={20} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* The kit's photo panel, with the identity card overlapping its lower edge. */}
                <View style={styles.hero}>
                    <View style={styles.heroPanel} />
                    <View style={styles.identityCard}>
                        {professional.profile_image ? (
                            <Image source={{ uri: professional.profile_image }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                        )}

                        <Text style={styles.name}>
                            Dr {professional.firstname} {professional.lastname}
                        </Text>
                        <Text style={styles.speciality} numberOfLines={2}>
                            {(professional.speciality ?? []).join(' · ') || 'Specialist'}
                        </Text>

                        <View style={styles.statRow}>
                            <Stat value={`£${professional.hourly_rate}`} label="per hour" />
                            <View style={styles.statDivider} />
                            <Stat value="30 min" label="consultation" />
                            <View style={styles.statDivider} />
                            <Stat value={mine.length ? String(mine.length) : '—'} label="booked" />
                        </View>
                    </View>
                </View>

                {mine.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Your appointments</Text>
                        {mine.map((a) => {
                            const at = new Date(a.scheduledFor);
                            const meta = STATUS_META[a.status] ?? STATUS_META.requested;
                            return (
                                <TouchableOpacity
                                    key={a._id}
                                    style={styles.mineRow}
                                    onPress={() => router.push('/appointments')}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.mineDate}>
                                        <Text style={styles.mineDateText}>{formatDayShort(at)}</Text>
                                        <Text style={styles.mineTimeText}>{formatTime(at)}</Text>
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.mineMode}>
                                            {MODE_LABEL[(a.mode ?? 'video') as AppointmentMode]}
                                        </Text>
                                        <Text style={[styles.mineStatus, { color: meta.color }]}>
                                            {meta.label}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={17} color={Palette.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {!!professional.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>About</Text>
                        <Text style={styles.body}>{professional.description}</Text>
                    </View>
                )}

                {(professional.speciality ?? []).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Specialities</Text>
                        <View style={styles.tagRow}>
                            {professional.speciality.map((s) => (
                                <View key={s} style={styles.tag}>
                                    <Text style={styles.tagText}>{s}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {!!location && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Practice</Text>
                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={16} color={Palette.textSecondary} />
                            <Text style={[styles.body, styles.flex]}>{location}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Next available days</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.strip}
                    >
                        {days.map((d) => (
                            <TouchableOpacity
                                key={d.key}
                                style={styles.dayCell}
                                onPress={() => book(d)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={`Request a time on ${d.date.toDateString()}`}
                            >
                                <Text style={styles.dayWeekday}>
                                    {d.today ? 'Today' : d.date.toLocaleDateString(undefined, { weekday: 'short' })}
                                </Text>
                                <Text style={styles.dayNumber}>{d.dayOfMonth}</Text>
                                {d.booked && <View style={styles.dayDot} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <Text style={styles.stripNote}>
                        Times are requests until {professional.firstname} confirms them.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.cta} onPress={() => book()} activeOpacity={0.85}>
                    <Ionicons name="calendar-outline" size={18} color={Palette.white} />
                    <Text style={styles.ctaText}>Request a consultation</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const Stat = ({ value, label }: { value: string; label: string }) => (
    <View style={styles.stat}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    scroll: { paddingBottom: Spacing.xxxl },

    navBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },

    hero: { paddingHorizontal: GUTTER },
    heroPanel: {
        height: 96, borderRadius: Radius.lg,
        backgroundColor: Palette.primaryDeep,
    },
    identityCard: {
        marginTop: -56, alignItems: 'center', gap: 4,
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.borderSlate,
        ...Shadow.card,
    },
    avatar: {
        width: 76, height: 76, borderRadius: Radius.pill, marginTop: -50,
        backgroundColor: Palette.surface, borderWidth: 3, borderColor: Palette.white,
    },
    avatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    avatarText: { fontSize: 24, color: Palette.primary, fontFamily: Fonts.bold },
    name: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    speciality: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium, textAlign: 'center',
    },

    statRow: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
        marginTop: Spacing.md, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    stat: { flex: 1, alignItems: 'center', gap: 1 },
    statValue: { fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },
    statLabel: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular },
    statDivider: { width: 1, height: 26, backgroundColor: Palette.borderLight },

    section: { paddingHorizontal: GUTTER, marginTop: Spacing.xxl, gap: Spacing.sm },
    sectionLabel: {
        fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
        color: Palette.textMuted, fontFamily: Fonts.bold,
    },
    body: { fontSize: 14, lineHeight: 21, color: Palette.text, fontFamily: Fonts.regular },

    mineRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.md, borderRadius: Radius.md,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    mineDate: {
        alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 5,
        borderRadius: Radius.sm, backgroundColor: Palette.primarySurface, minWidth: 66,
    },
    mineDateText: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.bold },
    mineTimeText: { fontSize: 11, color: Palette.primary, fontFamily: Fonts.regular },
    mineMode: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    mineStatus: { fontSize: 11, fontFamily: Fonts.semibold },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tag: {
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    tagText: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.semibold },

    locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },

    strip: { gap: Spacing.sm, paddingRight: GUTTER },
    dayCell: {
        width: 58, height: 66, alignItems: 'center', justifyContent: 'center', gap: 2,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    dayWeekday: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },
    dayNumber: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    dayDot: { width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.success },
    stripNote: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.regular },

    footer: {
        paddingHorizontal: GUTTER, paddingTop: Spacing.md, paddingBottom: Spacing.xl,
        backgroundColor: Palette.white,
        borderTopWidth: 1, borderTopColor: Palette.borderSlate,
    },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        height: 48, borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    ctaText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.bold },

    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    backLink: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
    backLinkText: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.semibold },
});
