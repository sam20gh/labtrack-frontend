/**
 * Clinician review queue.
 *
 * Kept deliberately minimal — the full clinical workstation is a web portal decision, not
 * something to guess at here. This is enough for a professional to sign off interpretations
 * from their phone, which is what unblocks the "checked by a specialist" promise.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
    clinicianSignIn, getClinicianProfile, getReviewQueue, getClinicianToken,
    clearClinicianToken, type QueueEntry,
} from '@/lib/clinician';
import type { Professional } from '@/types/api';


import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';
const age = (dob?: string) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return a;
};

/**
 * What this interpretation read, in the queue's one line of room.
 *
 * The queue used to be genetic-only, so a lab name was enough. It now carries blood-only
 * and mixed cases, and which kind it is changes how a clinician approaches it.
 */
const describeSources = (entry: { sourceKinds?: string[]; sourceCount?: number }) => {
    const kinds = entry.sourceKinds || [];
    const genetic = kinds.includes('dna_report');
    const blood = kinds.includes('test_result');

    if (genetic && blood) return `genetic + ${entry.sourceCount ?? 0} sources`;
    if (genetic) return 'genetic report';
    if (blood) return entry.sourceCount === 1 ? '1 lab report' : `${entry.sourceCount ?? 0} lab reports`;
    return null;
};

const waitingFor = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return '1 day';
    return `${days} days`;
};

export default function ClinicianQueueScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [professional, setProfessional] = useState<Professional | null>(null);
    const [queue, setQueue] = useState<QueueEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });

    const load = useCallback(async () => {
        try {
            const token = await getClinicianToken();
            if (!token) { setProfessional(null); return; }

            const { professional: me } = await getClinicianProfile();
            setProfessional(me);
            const { interpretations } = await getReviewQueue();
            setQueue(interpretations);
        } catch {
            // An expired or rejected token means signing in again
            await clearClinicianToken();
            setProfessional(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleSignIn = async () => {
        setSigningIn(true);
        const result = await clinicianSignIn(form.username, form.password);
        setSigningIn(false);
        if (!result.ok) {
            Toast.show({ type: 'error', text1: 'Sign in failed', text2: result.error });
            return;
        }
        setLoading(true);
        await load();
    };

    if (loading) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View></SafeAreaView>;
    }

    if (!professional) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={24} color={Palette.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Clinician sign in</Text>
                        <View style={styles.backButton} />
                    </View>

                    <View style={styles.signInBody}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="medkit-outline" size={30} color={Palette.primary} />
                        </View>
                        <Text style={styles.title}>Review queue</Text>
                        <Text style={styles.body}>
                            Sign in with your clinician credentials to review AI interpretations before
                            they reach patients.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor={Palette.textMuted}
                            autoCapitalize="none"
                            value={form.username}
                            onChangeText={(t) => setForm((f) => ({ ...f, username: t }))}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={Palette.textMuted}
                            secureTextEntry
                            value={form.password}
                            onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
                        />

                        <TouchableOpacity
                            style={[styles.primaryButton, signingIn && styles.buttonDisabled]}
                            onPress={handleSignIn}
                            disabled={signingIn || !form.username || !form.password}
                        >
                            {signingIn ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
                <Toast />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Review queue</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={async () => { await clearClinicianToken(); setProfessional(null); }}
                >
                    <Ionicons name="log-out-outline" size={20} color={Palette.textMuted} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
                <Text style={styles.greeting}>Dr {professional.firstname} {professional.lastname}</Text>
                <Text style={styles.subtitle}>
                    {queue.length ? `${queue.length} awaiting review` : 'Nothing awaiting review'}
                </Text>

                {!queue.length && (
                    <View style={styles.empty}>
                        <Ionicons name="checkmark-circle-outline" size={44} color={tone('#D1D5DB')} />
                        <Text style={styles.emptyTitle}>Queue is clear</Text>
                    </View>
                )}

                {queue.map((entry) => {
                    const patientAge = age(entry.patient?.dob);
                    return (
                        <TouchableOpacity
                            key={entry._id}
                            style={[styles.card, (entry.pathogenicCount > 0 || entry.highRiskCount > 0) && styles.cardUrgent]}
                            onPress={() => router.push({ pathname: '/clinician/review', params: { reportId: entry._id } })}
                        >
                            <View style={styles.cardTop}>
                                <Text style={styles.patientName}>
                                    {[entry.patient?.firstName, entry.patient?.lastName].filter(Boolean).join(' ') || 'Patient'}
                                </Text>
                                <Text style={styles.waiting}>{waitingFor(entry.waitingSince)}</Text>
                            </View>

                            <Text style={styles.patientMeta}>
                                {[patientAge != null ? `${patientAge}y` : null, entry.patient?.gender, describeSources(entry)]
                                    .filter(Boolean).join(' · ')}
                            </Text>

                            {entry.pathogenicCount > 0 && (
                                <View style={styles.pathogenicBadge}>
                                    <Ionicons name="alert-circle" size={13} color={Palette.danger} />
                                    <Text style={styles.pathogenicText}>
                                        {entry.pathogenicCount} pathogenic {entry.pathogenicCount === 1 ? 'variant' : 'variants'}
                                    </Text>
                                </View>
                            )}

                            {entry.pathogenicCount === 0 && entry.highRiskCount > 0 && (
                                <View style={styles.pathogenicBadge}>
                                    <Ionicons name="alert-circle" size={13} color={Palette.danger} />
                                    <Text style={styles.pathogenicText}>
                                        {entry.highRiskCount} high {entry.highRiskCount === 1 ? 'risk' : 'risks'} flagged
                                    </Text>
                                </View>
                            )}

                            {entry.summary ? (
                                <Text style={styles.summary} numberOfLines={3}>{entry.summary}</Text>
                            ) : null}

                            <View style={styles.cardBottom}>
                                <Text style={styles.reviewCta}>Review</Text>
                                <Ionicons name="chevron-forward" size={18} color={Palette.primary} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    signInBody: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
    iconCircle: {
        width: 60, height: 60, borderRadius: 16, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    title: { fontSize: 24, fontWeight: '700', color: Palette.text, marginBottom: 8 },
    body: { fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginBottom: 24 },
    input: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Palette.text, marginBottom: 12,
    },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    greeting: { fontSize: 22, fontWeight: '700', color: Palette.text },
    subtitle: { fontSize: 14, color: Palette.textSecondary, marginTop: 4, marginBottom: 20 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: Palette.text },
    card: { borderWidth: 1, borderColor: Palette.border, borderRadius: 14, padding: 14, marginBottom: 10 },
    cardUrgent: { borderColor: tone('#FECACA'), backgroundColor: tone('#FFFBFB') },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    patientName: { fontSize: 16, fontWeight: '600', color: Palette.text },
    waiting: { fontSize: 12, color: Palette.textMuted },
    patientMeta: { fontSize: 13, color: Palette.textSecondary, marginTop: 3 },
    pathogenicBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: Palette.dangerSurface, alignSelf: 'flex-start',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8,
    },
    pathogenicText: { fontSize: 11, color: Palette.danger, fontWeight: '700' },
    summary: { fontSize: 13, color: Palette.textSecondary, lineHeight: 19, marginTop: 10 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12 },
    reviewCta: { fontSize: 14, color: Palette.primary, fontWeight: '600' },
    primaryButton: { backgroundColor: Palette.primaryFill, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '600' },
}));
