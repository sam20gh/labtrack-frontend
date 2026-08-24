/**
 * Review one AI interpretation.
 *
 * The clinician sees exactly what the model produced, can amend the summary and follow-up
 * in place, add a clinical note, order a follow-up, and sign off. Amendments preserve the
 * original — the audit trail is the point, not a side effect.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
    TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getReportForReview, submitReview, addFollowUp } from '@/lib/clinician';

export default function ReviewScreen() {
    const router = useRouter();
    const { reportId } = useLocalSearchParams();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [summary, setSummary] = useState('');
    const [followUp, setFollowUp] = useState('');
    const [notes, setNotes] = useState('');
    const [showFollowUpForm, setShowFollowUpForm] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', description: '', frequency: 'annually' });

    const load = useCallback(async () => {
        try {
            const { report: r } = await getReportForReview(String(reportId));
            setReport(r);
            const raw = r.aiInterpretation?.raw ?? {};
            setSummary(raw.summary ?? r.aiInterpretation?.summary ?? '');
            setFollowUp(raw.follow_up ?? '');
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not load', text2: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [reportId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const sign = async (approved: boolean) => {
        const raw = report?.aiInterpretation?.raw ?? {};
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
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View></SafeAreaView>;
    }
    if (!report) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><Text>Report not found</Text></View></SafeAreaView>;
    }

    const raw = report.aiInterpretation?.raw ?? {};
    const patient = report.userId ?? {};
    const alreadyReviewed = report.status === 'specialist_reviewed';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Review</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.patientName}>
                        {[patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient'}
                    </Text>
                    <Text style={styles.patientMeta}>
                        {[patient.gender, patient.dob ? `DOB ${String(patient.dob).slice(0, 10)}` : null, report.labName]
                            .filter(Boolean).join(' · ')}
                    </Text>

                    {alreadyReviewed && (
                        <View style={styles.reviewedBanner}>
                            <Ionicons name="checkmark-circle" size={16} color="#059669" />
                            <Text style={styles.reviewedText}>Already reviewed — submitting again adds a further amendment</Text>
                        </View>
                    )}

                    <Text style={styles.sectionLabel}>Genetic findings</Text>
                    {(report.mutations ?? []).map((m: any, i: number) => (
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
                        placeholderTextColor="#9CA3AF"
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
                        placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.sectionLabel}>Your clinical note</Text>
                    <TextInput
                        style={[styles.input, styles.multiline]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholder="Visible to the patient alongside your name"
                        placeholderTextColor="#9CA3AF"
                    />

                    {showFollowUpForm ? (
                        <View style={styles.followUpForm}>
                            <Text style={styles.sectionLabel}>Order a follow-up</Text>
                            <TextInput
                                style={styles.input}
                                value={newItem.title}
                                onChangeText={(t) => setNewItem((n) => ({ ...n, title: t }))}
                                placeholder="e.g. Transvaginal ultrasound"
                                placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                                style={styles.input}
                                value={newItem.description}
                                onChangeText={(t) => setNewItem((n) => ({ ...n, description: t }))}
                                placeholder="Why (shown to the patient)"
                                placeholderTextColor="#9CA3AF"
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
                            <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
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
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Approve</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    scroll: { paddingHorizontal: 20, paddingBottom: 30 },
    patientName: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
    patientMeta: { fontSize: 13, color: '#6B7280', marginTop: 3 },
    reviewedBanner: {
        flexDirection: 'row', gap: 8, alignItems: 'center',
        backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginTop: 14,
    },
    reviewedText: { flex: 1, fontSize: 12, color: '#059669' },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 22, marginBottom: 8 },
    mutation: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 11, marginBottom: 8 },
    mutationPathogenic: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
    gene: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
    significance: { fontSize: 12, color: '#6B7280', marginTop: 3, textTransform: 'capitalize' },
    input: {
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
        paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: '#1F2937', marginBottom: 10,
    },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    listRow: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 9 },
    listTitle: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
    listMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    limitation: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 5 },
    addFollowUp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 6 },
    addFollowUpText: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
    followUpForm: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginTop: 12 },
    chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    chipText: { fontSize: 12, color: '#6B7280' },
    chipTextActive: { color: '#fff' },
    formActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    concernButton: {
        flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center',
        borderWidth: 1, borderColor: '#FCD34D',
    },
    concernButtonText: { color: '#92400E', fontSize: 15, fontWeight: '600' },
    primaryButton: { flex: 1, backgroundColor: '#7C3AED', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    primaryButtonSmall: { backgroundColor: '#7C3AED', paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10 },
    secondaryButton: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
    secondaryButtonText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
