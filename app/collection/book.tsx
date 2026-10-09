/**
 * Choose a visit time — after paying, or to move a visit.
 *
 * Two entries, one screen:
 *
 *   - `?orderId=` books a visit for a paid order that has none: "choose a time later" at
 *     checkout, or after a visit was missed. It asks for the address too, since there is none.
 *   - `?visitId=` moves an existing visit, or gives a new time to one whose slot filled while
 *     its payment went through. The address stays as it was; only the time changes.
 *
 * Slots and their labels are the server's, in the market's own clock.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ApiError } from '@/lib/api';
import { getOrder } from '@/lib/orders';
import {
    bookVisit, cleanDetails, detailsComplete, EMPTY_DETAILS, getSlots, getVisit, rescheduleVisit,
    type MarketInfo, type SlotDay, type Visit, type VisitDetails,
} from '@/lib/collection';
import { asCurrency } from '@/lib/currency';
import { SlotPicker } from '@/components/collection/SlotPicker';
import { VisitDetailsForm } from '@/components/collection/VisitDetailsForm';

export default function BookVisitScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ orderId?: string; visitId?: string; returnTo?: string }>();
    const orderId = typeof params.orderId === 'string' ? params.orderId : null;
    const visitId = typeof params.visitId === 'string' ? params.visitId : null;

    const [market, setMarket] = useState<MarketInfo | null>(null);
    const [days, setDays] = useState<SlotDay[] | null>(null);
    const [visit, setVisit] = useState<Visit | null>(null);
    const [slotStart, setSlotStart] = useState<string | null>(null);
    const [details, setDetails] = useState<VisitDetails>(EMPTY_DETAILS);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            if (visitId) {
                const { visit: v } = await getVisit(visitId);
                setVisit(v);
                const r = await getSlots({ market: v.market });
                setMarket(r.market);
                setDays(r.days);
            } else if (orderId) {
                const { order } = await getOrder(orderId);
                const r = await getSlots({ currency: asCurrency(order.currency) ?? 'GBP' });
                setMarket(r.market);
                setDays(r.days);
            } else {
                setError('Nothing to book.');
            }
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'We could not load visit times.');
        }
    }, [orderId, visitId]);

    useEffect(() => { load(); }, [load]);

    const moving = Boolean(visitId);
    const ready = Boolean(slotStart) && (moving || detailsComplete(details));

    const save = async () => {
        if (!slotStart) return;
        setSaving(true);
        try {
            const { visit: v } = moving
                ? await rescheduleVisit(visitId!, slotStart)
                : await bookVisit(orderId!, slotStart, cleanDetails(details));
            Toast.show({ type: 'success', text1: moving ? 'Visit moved' : 'Visit booked', text2: v.label });
            const back = typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : null;
            if (back) router.dismissTo(back as Href);
            else router.replace(`/collection/${v._id}` as Href);
        } catch (e) {
            // A slot that went while they chose: refresh the times and say so.
            if (e instanceof ApiError && e.status === 409) {
                setSlotStart(null);
                load();
            }
            Toast.show({ type: 'error', text1: 'Not booked', text2: e instanceof ApiError ? e.message : 'Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{moving ? 'Change your visit' : 'Book your visit'}</Text>
                <View style={styles.headerBtn} />
            </View>

            {error ? (
                <View style={styles.centre}><Text style={styles.muted}>{error}</Text></View>
            ) : !days || !market ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        {visit ? (
                            <View style={styles.current}>
                                <Text style={styles.currentLabel}>{visit.status === 'needs_rebooking' ? 'The time you chose filled up' : 'Currently booked'}</Text>
                                <Text style={styles.currentValue}>{visit.label}</Text>
                            </View>
                        ) : (
                            <Text style={styles.lead}>
                                A technician comes to you, collects your samples, and brings anything else in your package.
                            </Text>
                        )}

                        <Text style={styles.section}>Choose a time</Text>
                        <SlotPicker days={days} value={slotStart} onChange={setSlotStart} clockLabel={`${market.name} time`} />

                        {!moving && market.visits ? (
                            <>
                                <Text style={styles.section}>Where should we visit?</Text>
                                <VisitDetailsForm value={details} onChange={setDetails} serviceAreas={market.visits.serviceAreas} market={market.code} />
                            </>
                        ) : null}
                    </ScrollView>
                    <SafeAreaView edges={['bottom']} style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.primary, (!ready || saving) && styles.primaryOff]}
                            disabled={!ready || saving}
                            onPress={save}
                            accessibilityRole="button"
                        >
                            {saving ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.primaryText}>{moving ? 'Move my visit' : 'Book my visit'}</Text>}
                        </TouchableOpacity>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
    muted: { fontSize: 15, ...BodyFont.regular, color: Palette.textSecondary, textAlign: 'center' },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
    lead: { fontSize: 15, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 22 },
    current: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md },
    currentLabel: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    currentValue: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 2 },
    section: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xl, marginBottom: Spacing.md },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Palette.canvas, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    primary: { backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingVertical: 15, alignItems: 'center' },
    primaryOff: { opacity: 0.45 },
    primaryText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
}));
