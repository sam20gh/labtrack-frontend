/**
 * Find a specialist.
 *
 * Rebuilt onto the turing kit's Doctor Card (Doctor Appointment, frame 4): avatar, name,
 * speciality, then a strip of days along the bottom of the card so booking starts from the
 * list instead of two screens later. That strip is the whole point of the kit's layout — a
 * directory you can only browse is a directory nobody finishes.
 *
 * The kit labels those days "Available" / "Unavailable" against a doctor's diary. LabTrack
 * has no availability model, so the days here say what the API can actually back: which
 * days are open to a *request*, and which days the person already has something booked with
 * that specialist. See `lib/appointments.ts` for why that distinction is load-bearing.
 *
 * The filter chips are derived from the specialities actually present in the roster rather
 * than the 48-value enum: offering a filter that returns nothing is worse than not offering
 * it, and the list is short enough today that a static taxonomy would be mostly dead ends.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, FlatList, Image, StyleSheet, ActivityIndicator,
    TouchableOpacity, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import {
    getAppointments, bookableDays, splitByTime, professionalIdOf, isLive,
    formatRelativeDay, type BookableDay,
} from '@/lib/appointments';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Appointment, Professional } from '@/types/api';

const ALL = '__all__';

/** Days shown on a card. Five fits the width without the strip becoming a second list. */
const CARD_DAYS = 5;

const initialsOf = (p: Professional) =>
    `${p.firstname?.[0] ?? ''}${p.lastname?.[0] ?? ''}`.toUpperCase() || '?';

const ProfessionalsScreen = () => {
    const router = useRouter();

    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [speciality, setSpeciality] = useState<string>(ALL);

    const load = useCallback(async () => {
        try {
            // The diary rides along so each card's strip can mark the days this person
            // already has booked with that specialist.
            const [roster, diary] = await Promise.all([
                api.get<Professional[]>('/professionals'),
                getAppointments().catch(() => [] as Appointment[]),
            ]);
            setProfessionals(Array.isArray(roster) ? roster : []);
            setAppointments(diary);
        } catch (error) {
            // The old version logged to the console and showed an endless spinner.
            const message = error instanceof ApiError ? error.message : 'Could not load specialists';
            Toast.show({ type: 'error', text1: 'Could not load specialists', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Refetch when the tab regains focus; pull-to-refresh covers manual updates
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

    /** Specialities present in the roster, commonest first, with their counts. */
    const specialities = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of professionals) {
            for (const s of p.speciality ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([name, count]) => ({ name, count }));
    }, [professionals]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return professionals.filter((p) => {
            if (speciality !== ALL && !(p.speciality ?? []).includes(speciality)) return false;
            if (!q) return true;
            // Name or speciality — someone types either "Patel" or "cardiology"
            const haystack = `${p.firstname} ${p.lastname} ${(p.speciality ?? []).join(' ')}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [professionals, query, speciality]);

    /** Live bookings per specialist, so a card can say "you have one booked". */
    const bookedWith = useMemo(() => {
        const counts = new Map<string, number>();
        for (const a of appointments) {
            if (!isLive(a) || new Date(a.scheduledFor).getTime() < Date.now()) continue;
            const id = professionalIdOf(a);
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        return counts;
    }, [appointments]);

    const upcoming = useMemo(() => splitByTime(appointments).upcoming, [appointments]);

    const filtered = query.trim().length > 0 || speciality !== ALL;
    const clearFilters = () => { setQuery(''); setSpeciality(ALL); };

    const openBooking = (p: Professional, day?: BookableDay) =>
        router.push({
            pathname: '/appointments/book',
            params: { professionalId: p._id, ...(day ? { day: day.key } : {}) },
        });

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    // Passed as an element rather than a function: an inline arrow would be a new component
    // type on every keystroke, remounting the search field and dropping the keyboard.
    const header = (
        <View style={styles.header}>
            <View style={styles.titleRow}>
                <View style={styles.flex}>
                    <Text style={styles.pageTitle}>Find a specialist</Text>
                    <Text style={styles.pageSubtitle}>
                        {professionals.length === 0
                            ? 'No specialists listed yet'
                            : `${professionals.length} available${filtered ? ` · ${results.length} matching` : ''}`}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.diaryButton}
                    onPress={() => router.push('/appointments')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="My appointments"
                >
                    <Ionicons name="calendar-outline" size={20} color={Palette.primary} />
                    {upcoming.length > 0 && (
                        <View style={styles.diaryBadge}>
                            <Text style={styles.diaryBadgeText}>{upcoming.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {upcoming.length > 0 && (
                <TouchableOpacity
                    style={styles.nextUp}
                    onPress={() => router.push('/appointments')}
                    activeOpacity={0.85}
                >
                    <Ionicons name="time-outline" size={16} color={Palette.primary} />
                    <Text style={styles.nextUpText} numberOfLines={1}>
                        Next appointment {formatRelativeDay(new Date(upcoming[0].scheduledFor)).toLowerCase()}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                </TouchableOpacity>
            )}

            <View style={styles.searchRow}>
                <Ionicons name="search" size={17} color={Palette.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by name or speciality"
                    placeholderTextColor={Palette.textMuted}
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>

            {specialities.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                    keyboardShouldPersistTaps="handled"
                >
                    <Chip
                        label="All"
                        count={professionals.length}
                        active={speciality === ALL}
                        onPress={() => setSpeciality(ALL)}
                    />
                    {specialities.map((s) => (
                        <Chip
                            key={s.name}
                            label={s.name}
                            count={s.count}
                            active={speciality === s.name}
                            onPress={() => setSpeciality(speciality === s.name ? ALL : s.name)}
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={results}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={header}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons
                            name={filtered ? 'search-outline' : 'people-outline'}
                            size={38}
                            color={Palette.primaryLight}
                        />
                        <Text style={styles.emptyTitle}>
                            {filtered ? 'No specialists match' : 'No specialists yet'}
                        </Text>
                        <Text style={styles.emptyBody}>
                            {filtered
                                ? 'Try a different speciality, or clear the filters to see everyone.'
                                : 'Specialists appear here once they join LabTrack.'}
                        </Text>
                        {filtered && (
                            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                                <Text style={styles.clearButtonText}>Clear filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <DoctorCard
                        professional={item}
                        appointments={appointments}
                        booked={bookedWith.get(item._id) ?? 0}
                        onOpen={() =>
                            router.push({
                                pathname: '/professionalDetails',
                                params: { professionalId: item._id },
                            })
                        }
                        onPickDay={(day) => openBooking(item, day)}
                        onBook={() => openBooking(item)}
                    />
                )}
            />
        </SafeAreaView>
    );
};

const Chip = ({ label, count, active, onPress }: {
    label: string; count: number; active: boolean; onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
    </TouchableOpacity>
);

/**
 * The kit's Doctor Card, 343 wide: identity on top, then the day strip.
 *
 * Tapping a day opens the booking screen with that day already chosen, which is the
 * shortcut the strip exists to provide. Tapping anywhere else opens the profile.
 */
const DoctorCard = ({ professional, appointments, booked, onOpen, onPickDay, onBook }: {
    professional: Professional;
    appointments: Appointment[];
    booked: number;
    onOpen: () => void;
    onPickDay: (day: BookableDay) => void;
    onBook: () => void;
}) => {
    const specialities = professional.speciality ?? [];
    // Two chips plus an overflow count: a practitioner with six specialities would
    // otherwise push the rate off the card.
    const shown = specialities.slice(0, 2);
    const overflow = specialities.length - shown.length;

    const location = [professional.postcode, professional.country].filter(Boolean).join(' · ');

    const days = useMemo(
        () => bookableDays(appointments, professional._id).filter((d) => d.open).slice(0, CARD_DAYS),
        [appointments, professional._id],
    );

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardTop} onPress={onOpen} activeOpacity={0.85}>
                <View>
                    {professional.profile_image ? (
                        <Image source={{ uri: professional.profile_image }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarText}>{initialsOf(professional)}</Text>
                        </View>
                    )}
                    {booked > 0 && (
                        <View style={styles.bookedDot}>
                            <Ionicons name="checkmark" size={10} color={Palette.white} />
                        </View>
                    )}
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.name} numberOfLines={1}>
                        Dr {professional.firstname} {professional.lastname}
                    </Text>

                    <View style={styles.tagRow}>
                        {shown.map((s) => (
                            <View key={s} style={styles.tag}>
                                <Text style={styles.tagText} numberOfLines={1}>{s}</Text>
                            </View>
                        ))}
                        {overflow > 0 && (
                            <View style={[styles.tag, styles.tagMuted]}>
                                <Text style={[styles.tagText, styles.tagTextMuted]}>+{overflow}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.metaRow}>
                        <Text style={styles.rate}>£{professional.hourly_rate}</Text>
                        <Text style={styles.rateUnit}>/hr</Text>
                        {!!location && (
                            <>
                                <View style={styles.dot} />
                                <Text style={styles.country} numberOfLines={1}>{location}</Text>
                            </>
                        )}
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </TouchableOpacity>

            {booked > 0 && (
                <View style={styles.bookedNote}>
                    <Ionicons name="calendar" size={13} color={Palette.success} />
                    <Text style={styles.bookedNoteText}>
                        You have {booked === 1 ? 'an appointment' : `${booked} appointments`} with this specialist
                    </Text>
                </View>
            )}

            <View style={styles.stripBlock}>
                <Text style={styles.stripLabel}>Request a time</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.strip}
                >
                    {days.map((d) => (
                        <TouchableOpacity
                            key={d.key}
                            style={styles.slotCell}
                            onPress={() => onPickDay(d)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Request a time on ${d.date.toDateString()}`}
                        >
                            <Text style={styles.slotDay}>
                                {d.today ? 'Today' : d.date.toLocaleDateString(undefined, { weekday: 'short' })}
                            </Text>
                            <Text style={styles.slotDate}>
                                {d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </Text>
                            {d.booked && <View style={styles.slotBookedDot} />}
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={styles.slotMore} onPress={onBook} activeOpacity={0.85}>
                        <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
                        <Text style={styles.slotMoreText}>More</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    );
};

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    list: { paddingBottom: Spacing.xxxl },

    header: { paddingHorizontal: GUTTER, paddingTop: Spacing.lg, gap: Spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    pageTitle: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold },
    pageSubtitle: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: -2,
    },

    diaryButton: {
        width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
        borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
    },
    diaryBadge: {
        position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18,
        paddingHorizontal: 4, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary, borderWidth: 2, borderColor: Palette.canvas,
    },
    diaryBadgeText: { fontSize: 9, color: Palette.white, fontFamily: Fonts.bold },

    nextUp: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, height: 40,
        borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
    },
    nextUpText: { flex: 1, fontSize: 13, color: Palette.primary, fontFamily: Fonts.semibold },

    searchRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.white, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.md, height: 46,
    },
    searchInput: {
        flex: 1, fontSize: 14, color: Palette.text, fontFamily: Fonts.regular, padding: 0,
    },

    chipRow: { gap: Spacing.sm, paddingBottom: Spacing.xs, paddingRight: GUTTER },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: 7,
        borderRadius: Radius.pill, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.semibold },
    chipTextActive: { color: Palette.white },
    chipCount: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.semibold },
    chipCountActive: { color: 'rgba(255,255,255,0.8)' },

    card: {
        marginHorizontal: GUTTER, marginTop: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
        overflow: 'hidden', ...Shadow.card,
    },
    cardTop: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.lg, paddingBottom: Spacing.md,
    },
    avatar: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.surface },
    avatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    avatarText: { fontSize: 16, color: Palette.primary, fontFamily: Fonts.bold },
    bookedDot: {
        position: 'absolute', right: -2, bottom: -2, width: 18, height: 18,
        borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.success, borderWidth: 2, borderColor: Palette.white,
    },
    cardBody: { flex: 1, gap: 5 },
    name: { fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    tag: {
        paddingHorizontal: Spacing.sm, paddingVertical: 2,
        borderRadius: Radius.sm, backgroundColor: Palette.primarySurface, maxWidth: 150,
    },
    tagMuted: { backgroundColor: Palette.borderLight },
    tagText: { fontSize: 11, color: Palette.primary, fontFamily: Fonts.semibold },
    tagTextMuted: { color: Palette.textSecondary },

    metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 1 },
    rate: { fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },
    rateUnit: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.regular },
    dot: {
        width: 3, height: 3, borderRadius: Radius.pill,
        backgroundColor: Palette.textMuted, marginHorizontal: Spacing.xs, alignSelf: 'center',
    },
    country: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },

    bookedNote: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.sm, paddingVertical: 5,
        borderRadius: Radius.sm, backgroundColor: Palette.successSurface,
    },
    bookedNoteText: { flex: 1, fontSize: 11, color: Palette.success, fontFamily: Fonts.semibold },

    stripBlock: {
        paddingTop: Spacing.md, paddingBottom: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
        backgroundColor: Palette.canvas, gap: Spacing.sm,
    },
    stripLabel: {
        paddingHorizontal: Spacing.lg,
        fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase',
        color: Palette.textMuted, fontFamily: Fonts.bold,
    },
    strip: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    slotCell: {
        minWidth: 76, alignItems: 'center', justifyContent: 'center', gap: 1,
        paddingVertical: 7, paddingHorizontal: Spacing.md,
        borderRadius: Radius.md, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    slotDay: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },
    slotDate: { fontSize: 13, color: Palette.text, fontFamily: Fonts.bold },
    slotBookedDot: {
        position: 'absolute', top: 6, right: 6,
        width: 5, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.success,
    },
    slotMore: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingVertical: 7, paddingHorizontal: Spacing.md,
        borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
    },
    slotMoreText: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.bold },

    empty: {
        alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    emptyBody: {
        fontSize: 13, lineHeight: 19, color: Palette.textSecondary,
        textAlign: 'center', fontFamily: Fonts.regular,
    },
    clearButton: {
        marginTop: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.xl,
        borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    clearButtonText: { color: Palette.white, fontSize: 14, fontFamily: Fonts.semibold },
});

export default ProfessionalsScreen;
