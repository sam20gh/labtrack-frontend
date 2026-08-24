/**
 * Health plan timeline.
 *
 * Rebuilt on `/api/plan-items`. The previous version rendered one embedded array of
 * age/year pairs with "Book" and "Add to Basket" buttons that had no handlers, and computed
 * urgency against a hardcoded date of birth.
 *
 * Now: overdue items first, then grouped by year, each individually orderable or bookable.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { ApiError } from '@/lib/api';
import { getPlan, orderPlanItem, bookPlanItem, dismissPlanItem, STATUS_META, TYPE_ICON } from '@/lib/plan';
import type { PlanItem, GroupedPlanItems } from '@/types/api';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Default booking slot: a week out, mid-morning. Users adjust from the appointment screen. */
const defaultSlot = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(10, 0, 0, 0);
    return d;
};

export default function MyPlansScreen() {
    const router = useRouter();
    const [grouped, setGrouped] = useState<GroupedPlanItems>({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ urgent: true });

    const load = useCallback(async () => {
        try {
            const data = await getPlan();
            setGrouped(data.grouped || {});
            setTotal(data.items?.length ?? 0);
            // Open the soonest year alongside overdue, so the screen is never all-collapsed
            const years = Object.keys(data.grouped || {}).filter((k) => k !== 'urgent').sort();
            setExpanded((prev) => ({ ...prev, urgent: true, [years[0]]: true }));
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Could not load your plan';
            Toast.show({ type: 'error', text1: 'Error', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const act = async (item: PlanItem, action: 'order' | 'book' | 'dismiss') => {
        setBusyId(item._id);
        try {
            if (action === 'order') {
                await orderPlanItem(item);
                Toast.show({ type: 'success', text1: 'Ordered', text2: `${item.productName} is on its way` });
            } else if (action === 'book') {
                await bookPlanItem(item, defaultSlot());
                Toast.show({ type: 'success', text1: 'Requested', text2: `Appointment with ${item.professionalName}` });
            } else {
                await dismissPlanItem(item._id);
                Toast.show({ type: 'success', text1: 'Dismissed' });
            }
            await load();
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not complete that',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setBusyId(null);
        }
    };

    const renderItem = (item: PlanItem) => {
        const meta = STATUS_META[item.status] ?? STATUS_META.upcoming;
        const busy = busyId === item._id;
        const actionable = ['urgent', 'due', 'upcoming'].includes(item.status);
        const canOrder = actionable && Boolean(item.productId);
        const canBook = actionable && Boolean(item.professionalId);

        return (
            <View key={item._id} style={[styles.card, item.status === 'urgent' && styles.cardUrgent]}>
                <View style={styles.cardHeader}>
                    {item.image
                        ? <Image source={{ uri: item.image }} style={styles.thumb} />
                        : (
                            <View style={styles.thumbFallback}>
                                <Ionicons name={(TYPE_ICON[item.type] ?? 'ellipse-outline') as any} size={20} color="#7C3AED" />
                            </View>
                        )}

                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={styles.metaRow}>
                            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                            </View>
                            <Text style={styles.dueText}>{formatDate(item.dueDate)}</Text>
                        </View>
                    </View>
                </View>

                {item.description ? (
                    <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                ) : null}

                {item.professionalName ? (
                    <Text style={styles.linked}>
                        <Ionicons name="person-circle-outline" size={13} color="#6B7280" /> {item.professionalName}
                    </Text>
                ) : null}
                {item.productName ? (
                    <Text style={styles.linked}>
                        <Ionicons name="cube-outline" size={13} color="#6B7280" /> {item.productName}
                    </Text>
                ) : null}

                {/* A recommendation with nothing behind it says so, rather than showing a
                    button that cannot work */}
                {actionable && item.type !== 'lifestyle' && !canOrder && !canBook ? (
                    <Text style={styles.unavailable}>
                        Not yet available to book through LabTrack — ask your clinician about this one.
                    </Text>
                ) : null}

                {(canOrder || canBook || actionable) && (
                    <View style={styles.actions}>
                        {canOrder && (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => act(item, 'order')} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.primaryActionText}>Order test</Text>}
                            </TouchableOpacity>
                        )}
                        {canBook && (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => act(item, 'book')} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.primaryActionText}>Book</Text>}
                            </TouchableOpacity>
                        )}
                        {actionable && (
                            <TouchableOpacity style={styles.secondaryAction} onPress={() => act(item, 'dismiss')} disabled={busy}>
                                <Text style={styles.secondaryActionText}>Dismiss</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const sections = Object.keys(grouped).sort((a, b) =>
        a === 'urgent' ? -1 : b === 'urgent' ? 1 : Number(a) - Number(b));

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                <Text style={styles.pageTitle}>Your health plan</Text>
                <Text style={styles.pageSubtitle}>
                    {total > 0
                        ? `${total} items based on your results and genetics`
                        : 'Nothing scheduled yet'}
                </Text>

                {total === 0 && (
                    <View style={styles.empty}>
                        <Ionicons name="calendar-outline" size={44} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>No plan yet</Text>
                        <Text style={styles.emptyBody}>
                            Add a test result or genetic report, then generate an interpretation to build your plan.
                        </Text>
                        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/add-result')}>
                            <Text style={styles.primaryActionText}>Add a result</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {sections.map((key) => {
                    const items = grouped[key] ?? [];
                    const isUrgent = key === 'urgent';
                    const open = expanded[key];
                    return (
                        <View key={key} style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                            >
                                <Text style={[styles.sectionTitle, isUrgent && styles.sectionTitleUrgent]}>
                                    {isUrgent ? 'Needs attention' : key}
                                </Text>
                                <View style={styles.sectionRight}>
                                    <Text style={styles.sectionCount}>{items.length}</Text>
                                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                                </View>
                            </TouchableOpacity>
                            {open && items.map(renderItem)}
                        </View>
                    );
                })}
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    pageTitle: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginTop: 8 },
    pageSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 20 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, marginBottom: 12 },
    section: { marginBottom: 18 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    sectionTitleUrgent: { color: '#DC2626' },
    sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionCount: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
    card: {
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
        padding: 14, marginBottom: 10, backgroundColor: '#fff',
    },
    cardUrgent: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
    cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6' },
    thumbFallback: {
        width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3E8FF',
        alignItems: 'center', justifyContent: 'center',
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    dueText: { fontSize: 12, color: '#9CA3AF' },
    description: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: 10 },
    linked: { fontSize: 12, color: '#6B7280', marginTop: 8 },
    unavailable: { fontSize: 12, color: '#9CA3AF', marginTop: 10, fontStyle: 'italic' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    primaryAction: {
        backgroundColor: '#7C3AED', paddingVertical: 11, paddingHorizontal: 20,
        borderRadius: 10, alignItems: 'center', minWidth: 110,
    },
    primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    secondaryAction: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10 },
    secondaryActionText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
});
