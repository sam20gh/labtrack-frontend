/**
 * Review one AI interpretation.
 *
 * The clinician sees exactly what the model produced, can amend the summary and follow-up
 * in place, add a clinical note, order a follow-up, and sign off. Amendments preserve the
 * original — the audit trail is the point, not a side effect.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getReportForReview, submitReview, addFollowUp } from '@/lib/clinician';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

export default function ReviewScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { reportId } = useLocalSearchParams();
    const [report, setReport] = useState<any>(null);
    const [sources, setSources] = useState<{ dnaReports: any[]; testResults: any[] }>({ dnaReports: [], testResults: [] });
    const [previous, setPrevious] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [summary, setSummary] = useState('');
    const [followUp, setFollowUp] = useState('');
    const [notes, setNotes] = useState('');
    const [showFollowUpForm, setShowFollowUpForm] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', description: '', frequency: 'annually' });

    const load = useCallback(async () => {
        try {
            const { interpretation, sources: s, previous: p } = await getReportForReview(String(reportId));
            setReport(interpretation);
            setSources(s);
            setPrevious(p);
            // Edit whatever is current: re-reviewing must build on the previous clinician's
            // amendment rather than silently reverting to the AI text.
            const current: any = interpretation.amended?.content ?? interpretation.content ?? {};
            setSummary(current.summary ?? '');
            setFollowUp(current.follow_up ?? '');
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not load', text2: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [reportId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const sign = async (approved: boolean) => {
        const raw: any = report?.amended?.content ?? report?.content ?? {};
        const amendments: Record<string, unknown> = {};
        if (summary.trim() && summary !== (raw.summary ?? '')) amendments.summary = summary.trim();
        if (followUp.trim() && followUp !== (raw.follow_up ?? '')) amendments.follow_up = followUp.trim();

        setSaving(true);
        try {
            const result = await submitReview(String(reportId), { approved, notes: notes.trim() || undefined, amendments });
            Toast.show({
                type: 'success',
                text1: result.message,
                text2: result.amendmentCount ? `${result.amendmentCount} amendment(s) recorded` : 'No changes made',
            });
            router.back();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not submit', text2: (error as Error).message });
        } finally {
            setSaving(false);
        }
    };

    const orderFollowUp = async () => {
        if (!newItem.title.trim()) return;
        try {
            const { item } = await addFollowUp(String(reportId), {
                type: 'test',
                title: newItem.title.trim(),
                description: newItem.description.trim() || undefined,
                frequency: newItem.frequency,
                urgency: 'moderate',
            });
            Toast.show({ type: 'success', text1: 'Added to patient plan', text2: item.title });
            setNewItem({ title: '', description: '', frequency: 'annually' });
            setShowFollowUpForm(false);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not add', text2: (error as Error).message });
        }
    };

    if (loading) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View></SafeAreaView>;
    }
    if (!report) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><Text>Report not found</Text></View></SafeAreaView>;
    }

    const raw = report.amended?.content ?? report.content ?? {};
    const patient = report.userId ?? {};
    const alreadyReviewed = ['approved', 'amended'].includes(report.review?.status);
    // Every variant across every genetic report this interpretation read.
    const mutations = (sources.dnaReports ?? []).flatMap((d: any) => d.mutations ?? []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Review</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.patientName}>
                        {[patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient'}
                    </Text>
                    <Text style={styles.patientMeta}>
                        {[
                            patient.gender,
                            patient.dob ? `DOB ${String(patient.dob).slice(0, 10)}` : null,
                            `${(report.covers ?? []).length} source${(report.covers ?? []).length === 1 ? '' : 's'}`,
                        ].filter(Boolean).join(' · ')}
                    </Text>

                    {alreadyReviewed && (
                        <View style={styles.reviewedBanner}>
                            <Ionicons name="checkmark-circle" size={16} color={Palette.success} />
                            <Text style={styles.reviewedText}>Already reviewed — submitting again adds a further amendment</Text>
                        </View>
                    )}

                    {/* What the interpretation read, so a clinician is not signing off prose
                        they cannot check against a source. */}
                    <Text style={styles.sectionLabel}>Sources</Text>
                    {(sources.testResults ?? []).map((t: any) => (
                        <View key={t._id} style={styles.mutation}>
                            <Text style={styles.gene}>{t.patient?.test_type || 'Lab report'}</Text>
                            <Text style={styles.significance}>
                                {[t.patient?.lab_name, t.patient?.date_of_test ? String(t.patient.date_of_test).slice(0, 10) : null]
                                    .filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                    ))}
                    {(sources.dnaReports ?? []).map((d: any) => (
                        <View key={d._id} style={styles.mutation}>
                            <Text style={styles.gene}>{d.labName || 'Genetic report'}</Text>
                            <Text style={styles.significance}>
                                {(d.mutations ?? []).length} variant{(d.mutations ?? []).length === 1 ? '' : 's'}
                            </Text>
                        </View>
                    ))}
                    {(sources.testResults ?? []).length === 0 && (sources.dnaReports ?? []).length === 0 && (
                        <Text style={styles.significance}>No source documents recorded.</Text>
                    )}

                    {previous?.content?.summary ? (
                        <>
                            <Text style={styles.sectionLabel}>Previous interpretation</Text>
                            <View style={styles.mutation}>
                                <Text style={styles.significance}>
                                    {String(previous.generatedAt).slice(0, 10)} — {previous.content.summary}
                                </Text>
                            </View>
                        </>
                    ) : null}

                    {mutations.length > 0 && <Text style={styles.sectionLabel}>Genetic findings</Text>}
                    {mutations.map((m: any, i: number) => (
                        <View key={i} style={[styles.mutation, ['pathogenic', 'likely_pathogenic'].includes(m.significance) && styles.mutationPathogenic]}>
                            <Text style={styles.gene}>{m.gene} {m.variant}</Text>
                            <Text style={styles.significance}>{m.significance.replace(/_/g, ' ')}{m.condition ? ` · ${m.condition}` : ''}</Text>
                        </View>
                    ))}

                    <Text style={styles.sectionLabel}>Summary (editable)</Text>
                    <TextInput
                        style={[styles.input, styles.multiline]}
                        value={summary}
                        onChangeText={setSummary}
                        multiline
                        placeholder="AI summary"
                        placeholderTextColor={Palette.textMuted}
                    />

                    {(raw.recommended_screenings ?? []).length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>Recommended screenings</Text>
                            {raw.recommended_screenings.map((s: any, i: number) => (
                                <View key={i} style={styles.listRow}>
                                    <Text style={styles.listTitle}>{s.test}</Text>
                                    <Text style={styles.listMeta}>
                                        from age {s.starting_age} · {String(s.frequency).replace(/_/g, ' ')} · {s.urgency}
                                    </Text>
                                </View>
                            ))}
                        </>
                    )}

                    {(raw.specialist_consultations ?? []).length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>Referrals</Text>
                            {raw.specialist_consultations.map((c: any, i: number) => (
                                <View key={i} style={styles.listRow}>
                                    <Text style={styles.listTitle}>{c.speciality}</Text>
                                    <Text style={styles.listMeta} numberOfLines={2}>{c.reason}</Text>
                                </View>
                            ))}
                        </>
                    )}

                    {(raw.limitations ?? []).length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>Stated limitations</Text>
                            {raw.limitations.map((l: string, i: number) => (
                                <Text key={i} style={styles.limitation}>• {l}</Text>
                            ))}
                        </>
                    )}

                    <Text style={styles.sectionLabel}>Follow-up (editable)</Text>
                    <TextInput
                        style={[styles.input, styles.multiline]}
                        value={followUp}
                        onChangeText={setFollowUp}
                        multiline
                        placeholder="When should this patient be seen again?"
                        placeholderTextColor={Palette.textMuted}
                    />

                    <Text style={styles.sectionLabel}>Your clinical note</Text>
                    <TextInput
                        style={[styles.input, styles.multiline]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholder="Visible to the patient alongside your name"
                        placeholderTextColor={Palette.textMuted}
                    />

                    {showFollowUpForm ? (
                        <View style={styles.followUpForm}>
                            <Text style={styles.sectionLabel}>Order a follow-up</Text>
                            <TextInput
                                style={styles.input}
                                value={newItem.title}
                                onChangeText={(t) => setNewItem((n) => ({ ...n, title: t }))}
                                placeholder="e.g. Transvaginal ultrasound"
                                placeholderTextColor={Palette.textMuted}
                            />
                            <TextInput
                                style={styles.input}
                                value={newItem.description}
                                onChangeText={(t) => setNewItem((n) => ({ ...n, description: t }))}
                                placeholder="Why (shown to the patient)"
                                placeholderTextColor={Palette.textMuted}
                            />
                            <View style={styles.chipRow}>
                                {['once', 'every_6_months', 'annually'].map((f) => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.chip, newItem.frequency === f && styles.chipActive]}
                                        onPress={() => setNewItem((n) => ({ ...n, frequency: f }))}
                                    >
                                        <Text style={[styles.chipText, newItem.frequency === f && styles.chipTextActive]}>
                                            {f.replace(/_/g, ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.formActions}>
                                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowFollowUpForm(false)}>
                                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.primaryButtonSmall} onPress={orderFollowUp}>
                                    <Text style={styles.primaryButtonText}>Add to plan</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.addFollowUp} onPress={() => setShowFollowUpForm(true)}>
                            <Ionicons name="add-circle-outline" size={20} color={Palette.primary} />
                            <Text style={styles.addFollowUpText}>Order a follow-up</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.concernButton}
                        onPress={() => Alert.alert(
                            'Sign off with concerns?',
                            'The patient sees this as reviewed, with your note explaining the concern.',
                            [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => sign(false) }],
                        )}
                        disabled={saving}
                    >
                        <Text style={styles.concernButtonText}>With concerns</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, saving && styles.buttonDisabled]}
                        onPress={() => sign(true)}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.primaryButtonText}>Approve</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    scroll: { paddingHorizontal: 20, paddingBottom: 30 },
    patientName: { fontSize: 22, fontWeight: '700', color: Palette.text },
    patientMeta: { fontSize: 13, color: Palette.textSecondary, marginTop: 3 },
    reviewedBanner: {
        flexDirection: 'row', gap: 8, alignItems: 'center',
        backgroundColor: Palette.successSurface, borderRadius: 10, padding: 12, marginTop: 14,
    },
    reviewedText: { flex: 1, fontSize: 12, color: Palette.success },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: Palette.text, marginTop: 22, marginBottom: 8 },
    mutation: { borderWidth: 1, borderColor: Palette.border, borderRadius: 10, padding: 11, marginBottom: 8 },
    mutationPathogenic: { borderColor: tone('#FECACA'), backgroundColor: tone('#FFFBFB') },
    gene: { fontSize: 14, fontWeight: '700', color: Palette.text },
    significance: { fontSize: 12, color: Palette.textSecondary, marginTop: 3, textTransform: 'capitalize' },
    input: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 10,
        paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Palette.text, marginBottom: 10,
    },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    listRow: { borderBottomWidth: 1, borderBottomColor: Palette.borderLight, paddingVertical: 9 },
    listTitle: { fontSize: 14, color: Palette.text, fontWeight: '500' },
    listMeta: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
    limitation: { fontSize: 12, color: Palette.textSecondary, lineHeight: 18, marginBottom: 5 },
    addFollowUp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 6 },
    addFollowUpText: { fontSize: 14, color: Palette.primary, fontWeight: '600' },
    followUpForm: { backgroundColor: Palette.surface, borderRadius: 12, padding: 12, marginTop: 12 },
    chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: Palette.border },
    chipActive: { backgroundColor: Palette.primaryFill, borderColor: Palette.primary },
    chipText: { fontSize: 12, color: Palette.textSecondary },
    chipTextActive: { color: Palette.white },
    formActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    concernButton: {
        flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center',
        borderWidth: 1, borderColor: tone('#FCD34D'),
    },
    concernButtonText: { color: tone('#92400E'), fontSize: 15, fontWeight: '600' },
    primaryButton: { flex: 1, backgroundColor: Palette.primaryFill, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    primaryButtonSmall: { backgroundColor: Palette.primaryFill, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10 },
    secondaryButton: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
    secondaryButtonText: { color: Palette.textMuted, fontSize: 14, fontWeight: '500' },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: Palette.white, fontSize: 15, fontWeight: '600' },
}));
