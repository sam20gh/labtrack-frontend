/**
 * One specialist.
 *
 * Modernised alongside the list — a card list on the kit's tokens that opened onto centred
 * bootstrap-blue text was a visible seam in the same flow.
 *
 * The specialist arrives as a navigation param rather than being refetched: the list has
 * already loaded the full document, and `/professionals` returns no more detail per record.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import type { Professional } from '@/types/api';

const ProfessionalDetailsScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { professional } = (route.params ?? {}) as { professional?: Professional };

    if (!professional) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <Text style={styles.emptyTitle}>Specialist not found</Text>
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
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Specialist</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    {professional.profile_image ? (
                        <Image source={{ uri: professional.profile_image }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    )}

                    <Text style={styles.name}>
                        {professional.firstname} {professional.lastname}
                    </Text>

                    <View style={styles.rateRow}>
                        <Text style={styles.rate}>£{professional.hourly_rate}</Text>
                        <Text style={styles.rateUnit}>per hour</Text>
                    </View>
                </View>

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

                {!!professional.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>About</Text>
                        <Text style={styles.body}>{professional.description}</Text>
                    </View>
                )}

                {!!location && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Location</Text>
                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={16} color={Palette.textSecondary} />
                            <Text style={[styles.body, styles.flex]}>{location}</Text>
                        </View>
                    </View>
                )}

                {/* Booking runs through a plan item rather than from here — a consultation
                    needs the clinical reason attached, which this screen does not have. */}
                <View style={styles.bookingNote}>
                    <Ionicons name="calendar-outline" size={16} color={Palette.primary} />
                    <Text style={[styles.bookingText, styles.flex]}>
                        Consultations are booked from your health plan, so the reason for the referral
                        travels with the appointment.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    scroll: { paddingBottom: Spacing.xxxl },

    navBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },

    hero: { alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: Spacing.md, gap: Spacing.sm },
    avatar: { width: 96, height: 96, borderRadius: Radius.pill, backgroundColor: Palette.surface },
    avatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    avatarText: { fontSize: 30, color: Palette.primary, fontFamily: Fonts.bold },
    name: { fontSize: 22, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    rateRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
    rate: { fontSize: 20, color: Palette.primary, fontFamily: Fonts.bold },
    rateUnit: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },

    section: { paddingHorizontal: GUTTER, marginTop: Spacing.xxl, gap: Spacing.sm },
    sectionLabel: {
        fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
        color: Palette.textMuted, fontFamily: Fonts.bold,
    },
    body: { fontSize: 14, lineHeight: 21, color: Palette.text, fontFamily: Fonts.regular },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tag: {
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    tagText: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.semibold },

    locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },

    bookingNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
    },
    bookingText: { fontSize: 13, lineHeight: 19, color: Palette.text, fontFamily: Fonts.regular },

    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
});

export default ProfessionalDetailsScreen;
