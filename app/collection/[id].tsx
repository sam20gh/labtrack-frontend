/**
 * One collection visit — when, where, what will happen, and the way to change it.
 *
 * Opened from every visit notification (`/collection/:id`), from the journey card and from
 * the order. It leads with the time in the market's clock and, when a blood test needs it, the
 * fasting instruction: the single thing most likely to waste a technician's trip. "Change" and
 * "Cancel" are offered only while the server says the visit can still be changed — inside the
 * cut-off the screen says to call instead of offering a button that would be refused.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ApiError } from '@/lib/api';
import { SvgXml } from 'react-native-svg';
import { cancelVisit, getVisit, getVisitPass, TASK_LABEL, VISIT_STATUS_LABEL, type Visit } from '@/lib/collection';

export default function VisitScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [data, setData] = useState<{ visit: Visit; canChange: boolean; cutoffHours: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [pass, setPass] = useState<{ code: string; svg: string; checked: boolean } | null>(null);

    const load = useCallback(() => {
        getVisit(String(id))
            .then((d) => {
                setData(d);
                setError(null);
                // The pass, while a technician is still coming. Its failure costs the card, never the screen.
                if (['booked', 'assigned', 'en_route', 'arrived'].includes(d.visit.status)) {
                    getVisitPass(String(id)).then(setPass).catch(() => setPass(null));
                } else {
                    setPass(null);
                }
            })
            .catch((e) => {
                if (e instanceof ApiError && e.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
                setError(e instanceof ApiError && e.status === 404 ? 'This visit could not be found.' : 'We could not load this visit.');
            });
    }, [id, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const confirmCancel = () => Alert.alert(
        'Cancel this visit?',
        'Your order stays. You can book a new time whenever you are ready.',
        [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel visit', style: 'destructive', onPress: async () => {
                    setBusy(true);
                    try {
                        await cancelVisit(String(id));
                        Toast.show({ type: 'success', text1: 'Visit cancelled' });
                        load();
                    } catch (e) {
                        Toast.show({ type: 'error', text1: 'Not cancelled', text2: e instanceof ApiError ? e.message : 'Please try again.' });
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ],
    );

    const header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.headerBtn} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your visit</Text>
            <View style={styles.headerBtn} />
        </View>
    );

    if (!data) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <View style={styles.centre}>
                    {error ? <Text style={styles.muted}>{error}</Text> : <ActivityIndicator color={Palette.primary} />}
                </View>
            </SafeAreaView>
        );
    }

    const { visit, canChange, cutoffHours } = data;
    const a = visit.address;
    const live = ['booked', 'assigned', 'en_route', 'arrived'].includes(visit.status);
    const rebook = visit.status === 'needs_rebooking';
    const over = ['missed', 'cancelled'].includes(visit.status);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <Text style={styles.status}>{VISIT_STATUS_LABEL[visit.status]}</Text>
                    <Text style={styles.when}>{visit.label}</Text>
                    {visit.assignee ? <Text style={styles.who}>Your technician: {visit.assignee.name}</Text> : null}
                </View>

                {/*
                  The visit pass. The technician scans it at the door, which proves they are with
                  the right person before a single tube is labelled. The characters are the same
                  code, for reading aloud if the scan will not take.
                */}
                {pass && live ? (
                    <View style={styles.pass} accessible accessibilityLabel={`Visit pass. Code ${pass.code.split('').join(' ')}`}>
                        <Text style={styles.cardTitle}>{pass.checked ? 'Pass checked' : 'Your visit pass'}</Text>
                        <Text style={styles.sub}>
                            {pass.checked
                                ? 'Your technician has checked this visit in.'
                                : 'Show this to your technician when they arrive. It confirms they are with the right person.'}
                        </Text>
                        {!pass.checked ? (
                            <View style={styles.qr}>
                                <SvgXml xml={pass.svg} width={196} height={196} />
                            </View>
                        ) : null}
                        <Text style={styles.passCode}>{pass.code}</Text>
                    </View>
                ) : null}

                {visit.requiresFasting && live ? (
                    <View style={styles.fasting}>
                        <Ionicons name="water-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.fastingText}>
                            Please fast for 8 hours before your visit. Water is fine. A blood test taken after eating may need to be repeated.
                        </Text>
                    </View>
                ) : null}

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Where</Text>
                    <Text style={styles.line}>{a.building}</Text>
                    {a.street ? <Text style={styles.line}>{a.street}</Text> : null}
                    <Text style={styles.line}>{[a.area, a.city].filter(Boolean).join(', ')}</Text>
                    {a.landmark ? <Text style={styles.sub}>{a.landmark}</Text> : null}
                    {a.makani ? <Text style={styles.sub}>Makani {a.makani}</Text> : null}
                    <Text style={styles.sub}>{visit.phone}</Text>
                    {visit.accessNotes ? <Text style={styles.sub}>{visit.accessNotes}</Text> : null}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>At the visit</Text>
                    {visit.tasks.map((t) => (
                        <View key={t._id} style={styles.task}>
                            <Ionicons
                                name={t.status === 'done' ? 'checkmark-circle' : t.status === 'not_done' ? 'close-circle-outline' : 'ellipse-outline'}
                                size={18}
                                color={t.status === 'done' ? Palette.success : Palette.textMuted}
                            />
                            <Text style={styles.taskText}>{TASK_LABEL[t.kind]}</Text>
                        </View>
                    ))}
                    {live ? <Text style={styles.sub}>Each sample is labelled with a barcode in front of you, so it can only ever be matched to you.</Text> : null}
                </View>

                {rebook || (over && visit.status === 'missed') ? (
                    <TouchableOpacity
                        style={styles.primary}
                        onPress={() => router.push((rebook
                            ? `/collection/book?visitId=${visit._id}`
                            : `/collection/book?orderId=${visit.orderIds[0]}`) as Href)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryText}>Choose a new time</Text>
                    </TouchableOpacity>
                ) : null}

                {live ? (canChange ? (
                    <>
                        <TouchableOpacity style={styles.primary} onPress={() => router.push(`/collection/book?visitId=${visit._id}` as Href)} accessibilityRole="button">
                            <Text style={styles.primaryText}>Change time</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondary} onPress={confirmCancel} disabled={busy} accessibilityRole="button">
                            <Text style={styles.secondaryText}>Cancel visit</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.cutoff}>
                        Visits can be changed up to {cutoffHours} hours before. To change this one, please contact us from Help.
                    </Text>
                )) : null}
            </ScrollView>
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
    hero: { paddingVertical: Spacing.md },
    status: { fontSize: 13, ...BodyFont.medium, color: Palette.textSecondary },
    when: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, marginTop: 4 },
    who: { fontSize: 14, ...BodyFont.regular, color: Palette.text, marginTop: 6 },
    fasting: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
    fastingText: { flex: 1, fontSize: 14, ...BodyFont.regular, color: Palette.text, lineHeight: 20 },
    pass: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Palette.primary,
        padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
    },
    // White behind the code in both schemes: a QR on a dark card does not scan.
    qr: { backgroundColor: Palettes.light.white, padding: Spacing.sm, borderRadius: Radius.md, marginTop: Spacing.md },
    passCode: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text, letterSpacing: 4, marginTop: Spacing.md },
    card: { backgroundColor: Palette.background, borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg, marginBottom: Spacing.md },
    cardTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, marginBottom: Spacing.sm },
    line: { fontSize: 15, ...BodyFont.regular, color: Palette.text, lineHeight: 21 },
    sub: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19, marginTop: 4 },
    task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    taskText: { fontSize: 15, ...BodyFont.regular, color: Palette.text },
    cutoff: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19, marginTop: Spacing.md },
    primary: { marginTop: Spacing.lg, backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
    primaryText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    secondary: { alignItems: 'center', paddingVertical: Spacing.lg },
    secondaryText: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },
}));
