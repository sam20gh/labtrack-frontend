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
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { confirmReport, type ParseResult, type ParsedMeasurement } from '@/lib/reports';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';

type EditableRow = ParsedMeasurement & { include: boolean; editedValue: string };

export default function ReviewScreen() {
    const Palette = usePalette();
    const styles = useStyles();
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
                    // Send the name **the lab printed**, not the canonical form.
                    //
                    // `canonicalName` is a slug for anything the parser could not match —
                    // separators stripped — and the server re-resolves whatever it is sent.
                    // Sending the slug therefore destroyed the only string that could match:
                    // `resolveName` splits on parentheses and commas, so it resolves
                    // "Glycosylated Hemoglobin (HbA1c)" but not "glycosylatedhemoglobinhba1c".
                    // Live reports lost HbA1c and calculated LDL that way — stored raw,
                    // unconverted, and never range-checked.
                    //
                    // For an analyte the parser *did* recognise this changes nothing: the
                    // server runs the same `resolveName` over the same string and reaches the
                    // same canonical key, so the user is saved exactly what they reviewed.
                    name: r.name || r.canonicalName,
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
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
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
                            <Ionicons name="alert-circle-outline" size={18} color={tone('#92400E')} />
                            <Text style={styles.warningText}>
                                {stillNeedsReview} {stillNeedsReview === 1 ? 'value needs' : 'values need'} your
                                confirmation. These are stored without a range check until you verify them.
                            </Text>
                        </View>
                    )}

                    {parsed.report.unreadableRegions?.length > 0 && (
                        <View style={styles.notice}>
                            <Ionicons name="eye-off-outline" size={18} color={Palette.textSecondary} />
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
                                    color={row.include ? activePalette().primary : tone('#D1D5DB')}
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
                            ? <ActivityIndicator color={Palette.white} />
                            : <Text style={styles.primaryButtonText}>Save {included.length} results</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    lead: { fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '700', color: Palette.text, marginBottom: 20 },
    warning: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: tone('#FEF3C7'), borderRadius: 12, padding: 14, marginBottom: 12,
    },
    warningText: { flex: 1, fontSize: 13, color: tone('#92400E'), lineHeight: 19 },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: Palette.borderLight, borderRadius: 12, padding: 14, marginBottom: 12,
    },
    noticeText: { flex: 1, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 },
    row: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        borderWidth: 1, borderColor: Palette.border, borderRadius: 14,
        padding: 14, marginBottom: 10,
    },
    rowFlagged: { borderColor: tone('#FCD34D'), backgroundColor: Palette.warningSurface },
    rowExcluded: { opacity: 0.45 },
    checkbox: { paddingTop: 2 },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    rowName: { fontSize: 15, fontWeight: '600', color: Palette.text },
    badge: { backgroundColor: tone('#FCD34D'), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '700', color: tone('#78350F') },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    valueInput: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 16,
        color: Palette.text, minWidth: 110, backgroundColor: Palette.background,
    },
    unit: { fontSize: 14, color: Palette.textSecondary },
    note: { fontSize: 12, color: Palette.textMuted, marginTop: 6 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    primaryButton: {
        backgroundColor: Palette.primaryFill, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '600' },
}));
