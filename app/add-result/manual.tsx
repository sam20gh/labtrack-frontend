/**
 * Manual result entry.
 *
 * Always available, and the fallback whenever scanning is unavailable or gets something
 * wrong. The analyte picker is driven by the server catalogue, so the names and units
 * offered are exactly the ones the backend can normalise and range-check — typing a free-
 * text analyte would store a value that never gets evaluated.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { confirmReport, getBiomarkerCatalogue, type CatalogueEntry } from '@/lib/reports';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

interface Entry {
    catalogue: CatalogueEntry | null;
    value: string;
    unit: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ManualEntryScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [labName, setLabName] = useState('');
    const [collectionDate, setCollectionDate] = useState(today());
    const [entries, setEntries] = useState<Entry[]>([{ catalogue: null, value: '', unit: '' }]);
    const [pickerIndex, setPickerIndex] = useState<number | null>(null);

    useEffect(() => {
        getBiomarkerCatalogue()
            .then(setCatalogue)
            .catch(() => Toast.show({ type: 'error', text1: 'Could not load the biomarker list' }))
            .finally(() => setLoading(false));
    }, []);

    const update = (index: number, patch: Partial<Entry>) =>
        setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));

    const addRow = () => setEntries((prev) => [...prev, { catalogue: null, value: '', unit: '' }]);
    const removeRow = (index: number) =>
        setEntries((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

    const complete = entries.filter((e) => e.catalogue && e.value.trim() && !Number.isNaN(Number(e.value)));

    const handleSave = async () => {
        if (!complete.length) {
            Toast.show({ type: 'error', text1: 'Add at least one result' });
            return;
        }

        setSaving(true);
        try {
            const result = await confirmReport({
                labName: labName.trim() || undefined,
                testType: 'Manual entry',
                collectionDate,
                measurements: complete.map((e) => ({
                    name: e.catalogue!.name,
                    value: Number(e.value),
                    unit: e.unit || e.catalogue!.unit,
                })),
            });
            Toast.show({
                type: 'success',
                text1: `${result.biomarkers.length} results saved`,
                text2: result.flagged.length
                    ? `${result.flagged.length} outside your range`
                    : 'All within your range',
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

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Enter results</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>Laboratory (optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Quest Diagnostics"
                        placeholderTextColor={Palette.textMuted}
                        value={labName}
                        onChangeText={setLabName}
                    />

                    <Text style={styles.label}>Date of test</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={Palette.textMuted}
                        value={collectionDate}
                        onChangeText={setCollectionDate}
                        autoCapitalize="none"
                    />

                    <Text style={[styles.label, styles.sectionLabel]}>Results</Text>

                    {entries.map((entry, index) => (
                        <View key={index} style={styles.entry}>
                            <TouchableOpacity style={styles.picker} onPress={() => setPickerIndex(index)}>
                                <Text style={entry.catalogue ? styles.pickerValue : styles.pickerPlaceholder}>
                                    {entry.catalogue?.displayName ?? 'Choose a biomarker'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={Palette.textMuted} />
                            </TouchableOpacity>

                            <View style={styles.entryRow}>
                                <TextInput
                                    style={[styles.input, styles.valueInput]}
                                    placeholder="Value"
                                    placeholderTextColor={Palette.textMuted}
                                    value={entry.value}
                                    onChangeText={(t) => update(index, { value: t })}
                                    keyboardType="decimal-pad"
                                />
                                <TextInput
                                    style={[styles.input, styles.unitInput]}
                                    placeholder={entry.catalogue?.unit ?? 'Unit'}
                                    placeholderTextColor={Palette.textMuted}
                                    value={entry.unit}
                                    onChangeText={(t) => update(index, { unit: t })}
                                    autoCapitalize="none"
                                />
                                {entries.length > 1 && (
                                    <TouchableOpacity onPress={() => removeRow(index)} style={styles.remove}>
                                        <Ionicons name="close-circle" size={22} color={tone('#D1D5DB')} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {entry.catalogue && (
                                <Text style={styles.hint}>
                                    Accepted units: {entry.catalogue.acceptedUnits.join(', ')} · stored as {entry.catalogue.unit}
                                </Text>
                            )}
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addRow} onPress={addRow}>
                        <Ionicons name="add-circle-outline" size={20} color={Palette.primary} />
                        <Text style={styles.addRowText}>Add another result</Text>
                    </TouchableOpacity>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.primaryButton, (saving || !complete.length) && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={saving || !complete.length}
                    >
                        {saving
                            ? <ActivityIndicator color={Palette.white} />
                            : <Text style={styles.primaryButtonText}>
                                Save {complete.length || ''} {complete.length === 1 ? 'result' : 'results'}
                            </Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={pickerIndex !== null} animationType="slide" onRequestClose={() => setPickerIndex(null)}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setPickerIndex(null)} style={styles.backButton}>
                            <Ionicons name="close" size={24} color={Palette.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Choose a biomarker</Text>
                        <View style={styles.backButton} />
                    </View>
                    <ScrollView contentContainerStyle={styles.scroll}>
                        {catalogue.map((item) => (
                            <TouchableOpacity
                                key={item.name}
                                style={styles.catalogueRow}
                                onPress={() => {
                                    if (pickerIndex !== null) {
                                        update(pickerIndex, { catalogue: item, unit: item.unit });
                                    }
                                    setPickerIndex(null);
                                }}
                            >
                                <View style={styles.flex}>
                                    <Text style={styles.catalogueName}>{item.displayName}</Text>
                                    <Text style={styles.catalogueUnit}>Stored in {item.unit}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={tone('#D1D5DB')} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
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
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    label: { fontSize: 13, fontWeight: '600', color: tone('#374151'), marginBottom: 6, marginTop: 12 },
    sectionLabel: { marginTop: 24, fontSize: 15 },
    input: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Palette.text,
    },
    entry: {
        borderWidth: 1, borderColor: Palette.borderLight, borderRadius: 14,
        padding: 12, marginBottom: 12, backgroundColor: Palette.surface,
    },
    picker: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderColor: Palette.border, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Palette.background, marginBottom: 10,
    },
    pickerValue: { fontSize: 15, color: Palette.text, fontWeight: '500' },
    pickerPlaceholder: { fontSize: 15, color: Palette.textMuted },
    entryRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    valueInput: { flex: 1, backgroundColor: Palette.background },
    unitInput: { width: 110, backgroundColor: Palette.background },
    remove: { padding: 4 },
    hint: { fontSize: 11, color: Palette.textMuted, marginTop: 8 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    addRowText: { fontSize: 14, color: Palette.primary, fontWeight: '500' },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    primaryButton: {
        backgroundColor: Palette.primaryFill, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '600' },
    catalogueRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    catalogueName: { fontSize: 15, color: Palette.text, fontWeight: '500' },
    catalogueUnit: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
}));
