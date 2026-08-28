/**
 * Request sent.
 *
 * The kit's success screen (Doctor Appointment, frames 13 and 17) is a mark, a sentence and
 * one primary action. The sentence is where this differs: the kit's reads "Your appointment
 * has been rescheduled to Jun 23 at 10:00 AM", stated as settled. Ours cannot claim that —
 * the row is `requested` until the professional confirms it — so the screen names the time
 * that was asked for and says who has to agree to it.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MODE_LABEL, formatDayLong, formatTime, type AppointmentMode } from '@/lib/appointments';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AppointmentConfirmedScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        at?: string; mode?: string; doctor?: string; rescheduled?: string;
    }>();

    const at = params.at ? new Date(params.at) : null;
    const rescheduled = params.rescheduled === '1';
    const mode = (params.mode as AppointmentMode) ?? 'video';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.body}>
                <View style={styles.mark}>
                    <Ionicons name="checkmark" size={34} color={Palette.white} />
                </View>

                <Text style={styles.title}>
                    {rescheduled ? 'New time requested' : 'Request sent'}
                </Text>
                <Text style={styles.subtitle}>
                    {params.doctor ?? 'Your specialist'} will confirm
                    {rescheduled ? ' the new time' : ''}. You will get a notification either way — nothing
                    is in your diary until then.
                </Text>

                {at && (
                    <View style={styles.slipCard}>
                        <Row icon="calendar-outline" label="Requested for" value={formatDayLong(at)} />
                        <View style={styles.divider} />
                        <Row icon="time-outline" label="Time" value={formatTime(at)} />
                        <View style={styles.divider} />
                        <Row icon="hourglass-outline" label="Status" value="Awaiting confirmation" pending />
                        <View style={styles.divider} />
                        <Row
                            icon={mode === 'in_person' ? 'walk-outline' : mode === 'phone' ? 'call-outline' : 'videocam-outline'}
                            label="Format"
                            value={MODE_LABEL[mode] ?? 'Video call'}
                        />
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.cta}
                    onPress={() => router.replace('/appointments')}
                    activeOpacity={0.85}
                >
                    <Text style={styles.ctaText}>View my appointments</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.replace('/(tabs)/professionals')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.linkText}>Back to specialists</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const Row = ({ icon, label, value, pending }: {
    icon: string; label: string; value: string; pending?: boolean;
}) => (
    <View style={styles.row}>
        <Ionicons name={icon as any} size={17} color={Palette.textSecondary} />
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, pending && styles.rowValuePending]} numberOfLines={1}>
            {value}
        </Text>
    </View>
);

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: GUTTER, gap: Spacing.md },

    mark: {
        width: 72, height: 72, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.success, marginBottom: Spacing.sm,
    },
    title: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    subtitle: {
        fontSize: 14, lineHeight: 21, color: Palette.textSecondary,
        fontFamily: Fonts.regular, textAlign: 'center',
    },

    slipCard: {
        alignSelf: 'stretch', marginTop: Spacing.xl,
        borderRadius: Radius.lg, backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.borderSlate,
        paddingHorizontal: Spacing.lg,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
    rowLabel: { flex: 1, fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    rowValue: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold, maxWidth: '55%' },
    rowValuePending: { color: Palette.warning },
    divider: { height: 1, backgroundColor: Palette.borderLight },

    footer: { paddingHorizontal: GUTTER, paddingBottom: Spacing.xl, gap: Spacing.sm },
    cta: {
        height: 48, alignItems: 'center', justifyContent: 'center',
        borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    ctaText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.bold },
    linkButton: { height: 40, alignItems: 'center', justifyContent: 'center' },
    linkText: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.semibold },
});
