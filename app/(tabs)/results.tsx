/**
 * Results — biomarker grid.
 *
 * Replaces the list of raw test-result cards. A person does not think in reports; they
 * think "how is my iron doing". Out-of-range values sort to the top, each row carries its
 * movement since the previous measurement, and tapping opens the trend.
 *
 * Uploaded reports remain reachable underneath, since the documents themselves still
 * matter for provenance.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { api, ApiError } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { getLatestBiomarkers, FLAG_META, byClinicalPriority, describeMovement, formatValue } from '@/lib/biomarkers';
import type { BiomarkerSummary, TestResult } from '@/types/api';

export default function ResultsScreen() {
    const router = useRouter();
    const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
    const [reports, setReports] = useState<TestResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showReports, setShowReports] = useState(false);

    const load = useCallback(async () => {
        try {
            // /test-results is scoped by user_id and rejects anything but the caller's own
            const userId = await getUserId();
            const [{ biomarkers: bs }, reportData] = await Promise.all([
                getLatestBiomarkers(),
                userId
                    ? api.get<TestResult[]>(`/test-results?user_id=${userId}`).catch(() => [])
                    : Promise.resolve([] as TestResult[]),
            ]);
            setBiomarkers(bs || []);
            setReports(Array.isArray(reportData) ? reportData : []);
        } catch (error) {
            if (error instanceof ApiError && !error.isAuthError) {
                Toast.show({ type: 'error', text1: 'Error', text2: error.message });
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const sorted = useMemo(() => [...biomarkers].sort(byClinicalPriority), [biomarkers]);
    const outOfRange = sorted.filter((b) => !['normal', 'unknown'].includes(b.flag));

    if (loading) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
                <Text style={styles.pageTitle}>Your results</Text>
                <Text style={styles.pageSubtitle}>
                    {biomarkers.length
                        ? outOfRange.length
                            ? `${outOfRange.length} of ${biomarkers.length} outside your range`
                            : `All ${biomarkers.length} within your range`
                        : 'Nothing recorded yet'}
                </Text>

                {!biomarkers.length && (
                    <View style={styles.empty}>
                        <Ionicons name="analytics-outline" size={44} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>No results yet</Text>
                        <Text style={styles.emptyBody}>
                            Scan a lab report or enter values manually, and we'll track them over time
                            against your personal range.
                        </Text>
                    </View>
                )}

                {sorted.map((b) => {
                    const meta = FLAG_META[b.flag];
                    const movement = describeMovement(b);
                    return (
                        <TouchableOpacity
                            key={b._id}
                            style={styles.row}
                            onPress={() => router.push({ pathname: '/biomarker/[name]', params: { name: b.name } })}
                        >
                            <View style={styles.rowMain}>
                                <Text style={styles.name}>{b.displayName || b.name}</Text>
                                <View style={styles.valueRow}>
                                    <Text style={styles.value}>{formatValue(b.value)}</Text>
                                    <Text style={styles.unit}>{b.unit}</Text>
                                    {movement && (
                                        <Text style={[
                                            styles.movement,
                                            movement.tone === 'good' && styles.movementGood,
                                            movement.tone === 'bad' && styles.movementBad,
                                        ]}>
                                            {movement.text}
                                        </Text>
                                    )}
                                </View>
                                {b.measurementCount > 1 && (
                                    <Text style={styles.count}>{b.measurementCount} measurements</Text>
                                )}
                            </View>

                            <View style={styles.rowRight}>
                                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                                </View>
                                {b.appliedRange?.geneAdjusted && (
                                    <Text style={styles.geneNote}>gene-adjusted</Text>
                                )}
                                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {reports.length > 0 && (
                    <View style={styles.reportsSection}>
                        <TouchableOpacity style={styles.reportsHeader} onPress={() => setShowReports(!showReports)}>
                            <Text style={styles.reportsTitle}>Uploaded reports ({reports.length})</Text>
                            <Ionicons name={showReports ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                        {showReports && reports.map((r) => (
                            <View key={r._id} style={styles.reportRow}>
                                <View style={styles.flex}>
                                    <Text style={styles.reportLab}>{r.patient?.lab_name}</Text>
                                    <Text style={styles.reportMeta}>
                                        {r.patient?.test_type} · {new Date(r.patient?.date_of_test).toLocaleDateString()}
                                        {r.biomarkerCount ? ` · ${r.biomarkerCount} values` : ''}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-result')}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add a result</Text>
                </TouchableOpacity>
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    pageTitle: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginTop: 8 },
    pageSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 20 },
    empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
    row: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
        padding: 14, marginBottom: 10,
    },
    rowMain: { flex: 1 },
    name: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 5 },
    value: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
    unit: { fontSize: 12, color: '#9CA3AF' },
    movement: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginLeft: 4 },
    movementGood: { color: '#059669' },
    movementBad: { color: '#B45309' },
    count: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
    rowRight: { alignItems: 'flex-end', gap: 4 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    geneNote: { fontSize: 9, color: '#7C3AED', fontWeight: '600' },
    reportsSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
    reportsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    reportsTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    reportRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    reportLab: { fontSize: 13, color: '#1F2937', fontWeight: '500' },
    reportMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    addButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, marginTop: 24,
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
