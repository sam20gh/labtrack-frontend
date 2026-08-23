/**
 * Review extracted measurements before they enter the record.
 *
 * This screen is the reason parsing does not write directly: a misread digit is caught here
 * or not at all. Rows the server flagged as low-confidence or unrecognised are surfaced
 * first and visually marked, and every value stays editable.
 *
 * The value shown is the NORMALISED one (what will actually be stored), with the original
 * reading noted underneath when a unit was converted — so the user confirms the stored
 * value, not a reading that silently changes on save.
 */
import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { confirmReport, type ParseResult, type ParsedMeasurement } from '@/lib/reports';

type EditableRow = ParsedMeasurement & { include: boolean; editedValue: string };

export default function ReviewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [saving, setSaving] = useState(false);

    const parsed = useMemo<ParseResult | null>(() => {
        try {
            return params.payload ? JSON.parse(String(params.payload)) : null;
        } catch {
            return null;
        }
    }, [params.payload]);

    const [rows, setRows] = useState<EditableRow[]>(() =>
        (parsed?.measurements ?? [])
            // Rows needing attention first — the user should not have to hunt for them
            .slice()
            .sort((a, b) => Number(b.needsReview) - Number(a.needsReview))
            .map((m) => ({ ...m, include: true, editedValue: String(m.normalisedValue ?? m.value) }))
    );

    if (!parsed) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Text style={styles.title}>Nothing to review</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
                        <Text style={styles.primaryButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const update = (index: number, patch: Partial<EditableRow>) =>
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

    const included = rows.filter((r) => r.include);
    const stillNeedsReview = included.filter((r) => r.needsReview).length;

    const handleSave = async () => {
        if (!included.length) {
            Alert.alert('Nothing selected', 'Include at least one measurement to save.');
            return;
        }

        setSaving(true);
        try {
            const result = await confirmReport({
                labName: parsed.report.labName ?? undefined,
                testType: parsed.report.testType ?? undefined,
                collectionDate: parsed.report.collectionDate ?? undefined,
                measurements: included.map((r) => ({
                    // Send the canonical name and normalised unit: the user confirmed those
                    name: r.canonicalName || r.name,
                    value: Number(r.editedValue),
                    unit: r.normalisedUnit || r.unit,
                    reportedRange: r.reportedRange,
                    extractionConfidence: r.extractionConfidence,
                })),
            });

            const flaggedCount = result.flagged.length;
            Toast.show({
                type: 'success',
                text1: `${result.biomarkers.length} results saved`,
                text2: flaggedCount ? `${flaggedCount} outside your range` : 'All within your range',
            });
            router.replace('/(tabs)/results');
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not save',
                text2: error instanceof Error ? error.message : 'Please try again',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flex}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Check your results</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.lead}>
                        We read {parsed.measurements.length} values
                        {parsed.report.labName ? ` from ${parsed.report.labName}` : ''}. Check them before saving —
                        anything uncertain is marked.
                    </Text>

                    {stillNeedsReview > 0 && (
                        <View style={styles.warning}>
                            <Ionicons name="alert-circle-outline" size={18} color="#92400E" />
                            <Text style={styles.warningText}>
                                {stillNeedsReview} {stillNeedsReview === 1 ? 'value needs' : 'values need'} your
                                confirmation. These are stored without a range check until you verify them.
                            </Text>
                        </View>
                    )}

                    {parsed.report.unreadableRegions?.length > 0 && (
                        <View style={styles.notice}>
                            <Ionicons name="eye-off-outline" size={18} color="#6B7280" />
                            <Text style={styles.noticeText}>
                                Some parts could not be read: {parsed.report.unreadableRegions.join('; ')}
                            </Text>
                        </View>
                    )}

                    {rows.map((row, index) => (
                        <View
                            key={`${row.canonicalName}-${index}`}
                            style={[styles.row, row.needsReview && styles.rowFlagged, !row.include && styles.rowExcluded]}
                        >
                            <TouchableOpacity
                                onPress={() => update(index, { include: !row.include })}
                                style={styles.checkbox}
                            >
                                <Ionicons
                                    name={row.include ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={row.include ? '#7C3AED' : '#D1D5DB'}
                                />
                            </TouchableOpacity>

                            <View style={styles.rowBody}>
                                <View style={styles.rowTop}>
                                    <Text style={styles.rowName}>{row.displayName || row.name}</Text>
                                    {row.needsReview && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>Check</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.valueRow}>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={row.editedValue}
                                        onChangeText={(t) => update(index, { editedValue: t })}
                                        keyboardType="decimal-pad"
                                        editable={row.include}
                                    />
                                    <Text style={styles.unit}>{row.normalisedUnit || row.unit || ''}</Text>
                                </View>

                                {row.normalisationNote && (
                                    <Text style={styles.note}>{row.normalisationNote}</Text>
                                )}
                                {row.reportedRange?.raw && (
                                    <Text style={styles.note}>Lab reference: {row.reportedRange.raw}</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.primaryButton, saving && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.primaryButtonText}>Save {included.length} results</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    lead: { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
    warning: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 12,
    },
    warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 12,
    },
    noticeText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 19 },
    row: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
        padding: 14, marginBottom: 10,
    },
    rowFlagged: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
    rowExcluded: { opacity: 0.45 },
    checkbox: { paddingTop: 2 },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    rowName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
    badge: { backgroundColor: '#FCD34D', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#78350F' },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    valueInput: {
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 16,
        color: '#1F2937', minWidth: 110, backgroundColor: '#fff',
    },
    unit: { fontSize: 14, color: '#6B7280' },
    note: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    primaryButton: {
        backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
