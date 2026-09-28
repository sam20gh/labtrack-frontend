/**
 * Doctor Appointment — `Design/drAppoitment.svg`, and the same card in `Design/index.svg`.
 *
 * The next booking drawn large — avatar, name, when, what and how — and the two after it as
 * dated rows under a full-width rule. The export is the kit's dark frame and `index.svg` its
 * light one; they differ only in colour, so this reads the live palette throughout.
 *
 * The kit's facts about the doctor are replaced one for one by facts about the booking, because
 * the kit's are not modelled — there is no verification record, no review model and no
 * availability (see `lib/appointments.ts`) — and "Available" is the one word a person acts on:
 *
 *     kit                          here
 *     blue "verified" seal         a seal once the clinician has confirmed the slot, and not before
 *     ★ 4.7 (225)                   how it happens — video, phone or in person
 *     ● Available Remotely         ● Confirmed / ● Awaiting confirmation
 *     upcoming row: speciality     upcoming row: time · speciality — the chip already says the day
 *
 * The "Book another" footer the card used to carry is gone, as the kit draws none: the diary
 * behind "See All" books, and so does Consult in the quick actions. A card whose job is "what is
 * next" does not also need to sell the one after.
 *
 * The caller draws this only when there is a live appointment; with none the section is
 * `ExploreDoctorsCard` instead. The guard below keeps the component honest on its own terms.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import {
    professionalOf, nameOf, initialsOf, formatTime, formatRelativeDay,
    MODE_ICON, MODE_LABEL, STATUS_META, DEFAULT_DURATION,
} from '@/lib/appointments';
import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { Appointment, Professional } from '@/types/api';

/** As many rows under the rule as the kit draws. The diary holds the rest. */
const MAX_UPCOMING = 2;

/** Inside a week the chip names the weekday; past it, the month, so "2 Tue" is never a guess. */
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** The first speciality, in the enum's own words, or a neutral noun when none is recorded. */
const specialityOf = (p: Partial<Professional> | null) => p?.speciality?.[0] || 'Consultation';

/**
 * The kit's seal, lifted from the export with its own 21pt box. Drawn only for a confirmed
 * booking — the one thing about this appointment somebody else has vouched for.
 */
const ConfirmedSeal = ({ fill, tick }: { fill: string; tick: string }) => (
    <Svg width={21} height={21} viewBox="61.5 95.5 21 21">
        <Path
            d="M81.1744 103.639C80.8209 103.27 80.4553 102.889 80.3175 102.555C80.19 102.248 80.1825 101.74 80.175 101.248C80.1609 100.333 80.1459 99.2959 79.425 98.575C78.7041 97.8541 77.6672 97.8391 76.7522 97.825C76.26 97.8175 75.7519 97.81 75.4453 97.6825C75.1116 97.5447 74.73 97.1791 74.3606 96.8256C73.7137 96.2041 72.9788 95.5 72 95.5C71.0212 95.5 70.2872 96.2041 69.6394 96.8256C69.27 97.1791 68.8894 97.5447 68.5547 97.6825C68.25 97.81 67.74 97.8175 67.2478 97.825C66.3328 97.8391 65.2959 97.8541 64.575 98.575C63.8541 99.2959 63.8437 100.333 63.825 101.248C63.8175 101.74 63.81 102.248 63.6825 102.555C63.5447 102.888 63.1791 103.27 62.8256 103.639C62.2041 104.286 61.5 105.021 61.5 106C61.5 106.979 62.2041 107.713 62.8256 108.361C63.1791 108.73 63.5447 109.111 63.6825 109.445C63.81 109.752 63.8175 110.26 63.825 110.752C63.8391 111.667 63.8541 112.704 64.575 113.425C65.2959 114.146 66.3328 114.161 67.2478 114.175C67.74 114.182 68.2481 114.19 68.5547 114.318C68.8884 114.455 69.27 114.821 69.6394 115.174C70.2863 115.796 71.0212 116.5 72 116.5C72.9788 116.5 73.7128 115.796 74.3606 115.174C74.73 114.821 75.1106 114.455 75.4453 114.318C75.7519 114.19 76.26 114.182 76.7522 114.175C77.6672 114.161 78.7041 114.146 79.425 113.425C80.1459 112.704 80.1609 111.667 80.175 110.752C80.1825 110.26 80.19 109.752 80.3175 109.445C80.4553 109.112 80.8209 108.73 81.1744 108.361C81.7959 107.714 82.5 106.979 82.5 106C82.5 105.021 81.7959 104.287 81.1744 103.639Z"
            fill={fill}
        />
        <Path
            d="M76.5459 102.954C76.6508 103.058 76.734 103.183 76.7908 103.319C76.8476 103.456 76.8768 103.603 76.8768 103.751C76.8768 103.899 76.8476 104.045 76.7908 104.182C76.734 104.319 76.6508 104.443 76.5459 104.548L71.2959 109.798C71.1914 109.903 71.0672 109.986 70.9304 110.043C70.7937 110.099 70.6471 110.129 70.499 110.129C70.351 110.129 70.2043 110.099 70.0676 110.043C69.9309 109.986 69.8067 109.903 69.7021 109.798L67.4521 107.548C67.3475 107.443 67.2645 107.319 67.2079 107.182C67.1512 107.045 67.1221 106.899 67.1221 106.751C67.1221 106.603 67.1512 106.456 67.2079 106.32C67.2645 106.183 67.3475 106.059 67.4521 105.954C67.5568 105.849 67.681 105.766 67.8178 105.71C67.9545 105.653 68.101 105.624 68.249 105.624C68.397 105.624 68.5436 105.653 68.6803 105.71C68.817 105.766 68.9412 105.849 69.0459 105.954L70.5 107.406L74.954 102.951C75.0587 102.847 75.1829 102.764 75.3196 102.708C75.4563 102.651 75.6027 102.622 75.7505 102.623C75.8984 102.623 76.0447 102.652 76.1812 102.709C76.3177 102.766 76.4416 102.849 76.5459 102.954Z"
            fill={tick}
        />
    </Svg>
);

interface Props {
    /** Live appointments, soonest first — the home screen's `liveAppointments`. */
    appointments: Appointment[];
    onOpen: () => void;
}

export default function AppointmentCard({ appointments, onOpen }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    if (appointments.length === 0) return null;

    const [next, ...rest] = appointments;
    const professional = professionalOf(next);
    const when = new Date(next.scheduledFor);
    const status = STATUS_META[next.status];
    const confirmed = next.status === 'confirmed';
    const speciality = specialityOf(professional);
    const whenLabel = `${formatRelativeDay(when)}, ${formatTime(when)}`;

    return (
        <View style={styles.card}>
            <TouchableOpacity
                style={styles.next}
                onPress={onOpen}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={[
                    `Next appointment: ${nameOf(professional)}`,
                    whenLabel,
                    speciality,
                    next.mode ? MODE_LABEL[next.mode] : null,
                    status.label,
                ].filter(Boolean).join(', ')}
            >
                <View style={styles.avatarWrap}>
                    <Avatar
                        uri={professional?.profile_image ?? null}
                        initials={initialsOf(professional)}
                        size={48}
                    />
                    {confirmed && (
                        <View style={styles.seal}>
                            <ConfirmedSeal fill={Palette.successFill} tick={Palette.white} />
                        </View>
                    )}
                </View>

                <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>{nameOf(professional)}</Text>
                    <Text style={styles.when} numberOfLines={1}>{whenLabel}</Text>

                    {/* The kit leads this line with a glyph for the speciality — a bone for
                        orthopaedics. Nothing draws forty-eight of those, and one generic mark
                        beside every speciality says nothing, so the words stand alone. */}
                    <View style={styles.metaRow}>
                        <Text style={styles.meta} numberOfLines={1}>{speciality}</Text>
                        {next.mode && (
                            <>
                                <View style={styles.metaDot} />
                                <Ionicons name={MODE_ICON[next.mode] as never} size={16} color={Palette.textMuted} />
                                <Text style={styles.meta} numberOfLines={1}>{MODE_LABEL[next.mode]}</Text>
                            </>
                        )}
                    </View>

                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {rest.length > 0 && (
                <>
                    <View style={styles.rule} />
                    <View style={styles.upcoming}>
                        <Text style={styles.upcomingTitle}>Upcoming Appointments</Text>
                        {rest.slice(0, MAX_UPCOMING).map((appointment) => {
                            const p = professionalOf(appointment);
                            const at = new Date(appointment.scheduledFor);
                            const withinWeek = at.getTime() - Date.now() < WEEK;
                            const minutes = appointment.durationMinutes ?? DEFAULT_DURATION;
                            return (
                                <TouchableOpacity
                                    key={appointment._id}
                                    style={styles.row}
                                    onPress={onOpen}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${nameOf(p)}, ${formatRelativeDay(at)} at ${formatTime(at)}, ${minutes} minutes`}
                                >
                                    <View style={styles.chip}>
                                        <Text style={styles.chipDay}>{at.getDate()}</Text>
                                        <Text style={styles.chipSub}>
                                            {at.toLocaleDateString(undefined, withinWeek ? { weekday: 'short' } : { month: 'short' })}
                                        </Text>
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.rowName} numberOfLines={1}>{nameOf(p)}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={1}>
                                            {formatTime(at)} · {specialityOf(p)}
                                        </Text>
                                    </View>
                                    <Text style={styles.duration}>{minutes}m</Text>
                                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
}

// Measured off the export: 16pt padding, a 48pt avatar with text 13pt to its right, the seal
// overhanging the avatar's corner by 2.5pt, a full-bleed rule, and upcoming rows on a 60pt
// pitch behind 39×41 chips.
const useStyles = makeStyles((Palette) => ({
    flex: { flex: 1 },
    card: {
        marginHorizontal: Spacing.lg,
        borderRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.borderLight,
    },

    next: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: Spacing.lg },
    avatarWrap: { width: 48, height: 48 },
    seal: { position: 'absolute', right: -2.5, bottom: -2.5 },
    name: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    when: { fontSize: 14, color: Palette.textSecondary, ...BodyFont.regular, marginTop: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    meta: { flexShrink: 1, fontSize: 14, color: Palette.text, ...BodyFont.regular },
    metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Palette.border, marginHorizontal: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    status: { fontSize: 14, ...BodyFont.medium },

    rule: { height: 1, backgroundColor: Palette.border },
    upcoming: { paddingHorizontal: Spacing.lg, paddingTop: 14, paddingBottom: Spacing.lg, gap: 19 },
    upcomingTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    chip: {
        width: 39, height: 41, borderRadius: 8,
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.background,
        alignItems: 'center', justifyContent: 'center',
    },
    chipDay: { fontSize: 16, lineHeight: 19, color: Palette.text, fontFamily: Fonts.bold },
    chipSub: { fontSize: 11, color: Palette.textSecondary, ...BodyFont.regular },
    rowName: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    rowMeta: { fontSize: 14, color: Palette.textSecondary, ...BodyFont.regular, marginTop: 2 },
    duration: { fontSize: 14, color: Palette.textSecondary, ...BodyFont.regular, fontVariant: ['tabular-nums'] },
}));
