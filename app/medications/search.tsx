/**
 * Browse the catalogue.
 *
 * The design's search screen with its "Medication Not found" state. The empty state is not
 * a failure here: the catalogue is a few dozen common drugs, not a formulary, and a miss
 * means "we don't hold this", not "this doesn't exist". So the not-found state routes
 * straight to entering it by hand — a medicine we cannot describe is still a medicine that
 * belongs on someone's list, and still one their interaction check needs to know about.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchCatalogue } from '@/lib/medications';
import { PillGlyph } from '@/components/medications/PillGlyph';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationCatalogueEntry } from '@/types/api';

const COMMON = ['ibuprofen', 'paracetamol', 'atorvastatin', 'metformin', 'levothyroxine', 'omeprazole'];

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MedicationCatalogueEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Debounced: the catalogue is small and served from memory, but a request per keystroke
    // is still a request per keystroke.
    useEffect(() => {
        const handle = setTimeout(() => {
            setLoading(true);
            searchCatalogue(query, 40)
                .then((r) => setResults(r.results))
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 220);
        return () => clearTimeout(handle);
    }, [query]);

    const addByName = (name: string) =>
        router.push({ pathname: '/medications/add', params: { prefill: JSON.stringify({ name }) } });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={17} color={Palette.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search medication…"
                        placeholderTextColor={Palette.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {query ? (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                            <Ionicons name="close-circle" size={17} color={Palette.textMuted} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {!query ? (
                    <View style={styles.commonSection}>
                        <Text style={styles.sectionTitle}>Most common</Text>
                        <View style={styles.chipRow}>
                            {COMMON.map((c) => (
                                <TouchableOpacity key={c} style={styles.chip} onPress={() => setQuery(c)} activeOpacity={0.75}>
                                    <Text style={styles.chipText}>{c}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
                ) : results.length === 0 ? (
                    /*
                      Not a dead end. The catalogue not holding something says nothing about
                      whether the person takes it, and their check needs it either way.
                    */
                    <View style={styles.notFound}>
                        <View style={styles.notFoundIcon}>
                            <Ionicons name="search-outline" size={30} color={Palette.textMuted} />
                        </View>
                        <Text style={styles.notFoundTitle}>Not in our catalogue</Text>
                        <Text style={styles.notFoundBody}>
                            We hold plain-language notes for a few dozen common medicines, and
                            "{query}" is not one of them. You can still add it — it will appear
                            on your schedule, and your check will say it could not be verified.
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => addByName(query.trim())}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryButtonText}>Add "{query.trim()}" anyway</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.results}>
                        <Text style={styles.resultCount}>
                            {results.length} {results.length === 1 ? 'result' : 'results'}
                        </Text>
                        {results.map((entry) => (
                            <TouchableOpacity
                                key={entry.key}
                                style={styles.row}
                                onPress={() => addByName(entry.key.replace(/_/g, ' '))}
                                activeOpacity={0.75}
                            >
                                <PillGlyph shape={entry.form === 'capsule' ? 'capsule' : 'round'} size={40} />
                                <View style={styles.rowBody}>
                                    <Text style={styles.rowName} numberOfLines={1}>
                                        {entry.key.replace(/_/g, ' ')}
                                    </Text>
                                    <Text style={styles.rowPlain} numberOfLines={1}>{entry.plainName}</Text>
                                    {entry.brandNames?.length ? (
                                        <Text style={styles.rowBrands} numberOfLines={1}>
                                            {entry.brandNames.join(', ')}
                                        </Text>
                                    ) : null}
                                </View>
                                {entry.prescriptionOnly ? (
                                    <View style={styles.rxChip}>
                                        <Text style={styles.rxText}>Rx</Text>
                                    </View>
                                ) : null}
                                <Ionicons name="add-circle-outline" size={20} color={Palette.primary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    searchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.white, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Palette.border,
        paddingHorizontal: Spacing.md,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Palette.text, fontFamily: Fonts.regular },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    commonSection: { gap: Spacing.sm },
    sectionTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
    },
    chipText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },

    results: { gap: Spacing.sm },
    resultCount: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.md,
    },
    rowBody: { flex: 1, gap: 1 },
    rowName: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    rowPlain: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    rowBrands: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular },
    rxChip: {
        backgroundColor: Palette.primarySurface, paddingHorizontal: 7, paddingVertical: 3,
        borderRadius: Radius.sm,
    },
    rxText: { fontSize: 10, color: Palette.primary, fontFamily: Fonts.bold },

    notFound: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl },
    notFoundIcon: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
    },
    notFoundTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    notFoundBody: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular,
        textAlign: 'center', lineHeight: 20, marginBottom: Spacing.md,
    },
    primaryButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 13, paddingHorizontal: Spacing.xxl,
    },
    primaryButtonText: { fontSize: 14, color: Palette.white, fontFamily: Fonts.semibold },
});
