/**
 * Health plan timeline.
 *
 * Rebuilt on `/api/plan-items`. The previous version rendered one embedded array of
 * age/year pairs with "Book" and "Add to Basket" buttons that had no handlers, and computed
 * urgency against a hardcoded date of birth.
 *
 * Now: overdue items first, then grouped by year, each individually orderable or bookable.
 *
 * Ordering adds to the shared basket rather than placing an order — see `addToBasket`.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { api, ApiError } from '@/lib/api';
import { useBasket } from '@/lib/basket';
import { getPlan, dismissPlanItem, STATUS_META, TYPE_ICON } from '@/lib/plan';
import { hasBeenAsked, registerForPushNotifications } from '@/lib/notifications';
import type { PlanItem, GroupedPlanItems, Product } from '@/types/api';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });



export default function MyPlansScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { add, has, count, estimatedTotal } = useBasket();
    const [grouped, setGrouped] = useState<GroupedPlanItems>({});
    const [products, setProducts] = useState<Record<string, Product>>({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ urgent: true });

    const load = useCallback(async () => {
        try {
            // The plan item carries a product id and a name but no price, and a card asking
            // someone to order a screening without saying what it costs asks them to commit
            // before they know the number. A catalogue that fails to load costs the price
            // line, never the plan.
            const [data, catalogue] = await Promise.all([
                getPlan(),
                api.get<Product[]>('/products').catch(() => [] as Product[]),
            ]);
            setProducts(Object.fromEntries((catalogue || []).map((p) => [p._id, p])));
            setGrouped(data.grouped || {});
            setTotal(data.items?.length ?? 0);
            // Open the soonest year alongside overdue, so the screen is never all-collapsed
            const years = Object.keys(data.grouped || {}).filter((k) => k !== 'urgent').sort();
            setExpanded((prev) => ({ ...prev, urgent: true, [years[0]]: true }));

            // Ask about notifications only once there is a plan worth reminding about.
            // Prompting on first launch, before the value is obvious, is the surest route
            // to a permanent denial — and on iOS a denial cannot be re-prompted.
            if ((data.items?.length ?? 0) > 0 && !(await hasBeenAsked())) {
                registerForPushNotifications().catch(() => { /* user can enable it in settings */ });
            }
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Could not load your plan';
            Toast.show({ type: 'error', text1: 'Error', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /**
     * Booking opens the appointment screen rather than posting a slot.
     *
     * This button used to request a fixed time — a week out at 10:00 — and report it as
     * done. Nobody's Tuesday morning is free by default, and the person had no way to see
     * what had been asked for, let alone change it. The plan item carries the professional
     * and the clinical reason across, so nothing is retyped.
     */
    const book = (item: PlanItem) =>
        router.push({
            pathname: '/appointments/book',
            params: {
                professionalId: String(item.professionalId),
                planItemId: item._id,
                ...(item.description ? { reason: item.description } : {}),
            },
        });

    /**
     * Ordering from the plan fills the basket; it does not place an order.
     *
     * This button used to POST /orders for that one item and report it as on its way.
     * Someone with three overdue screenings placed three separate orders, paid postage and
     * attention three times, and never saw a total before committing. The plan now feeds
     * the same basket the shop does, and the Order tab checks the whole lot out at once —
     * `createOrder` carries every `planItemId` across, so the timeline still closes off.
     */
    const addToBasket = async (item: PlanItem) => {
        if (!item.productId) return;
        setBusyId(item._id);
        try {
            // The catalogue may have failed to load, or the plan may name a product added
            // since it was fetched. Fetching the one product is cheaper than losing the tap.
            const product = products[item.productId]
                ?? await api.get<Product>(`/products/${item.productId}`);
            setProducts((prev) => ({ ...prev, [product._id]: product }));
            await add(product, item._id);
            Toast.show({
                type: 'success',
                text1: 'Added to basket',
                text2: `${product.name} — check out from the Order tab`,
            });
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not add that',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setBusyId(null);
        }
    };

    const dismiss = async (item: PlanItem) => {
        setBusyId(item._id);
        try {
            await dismissPlanItem(item._id);
            Toast.show({ type: 'success', text1: 'Dismissed' });
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
        const inBasket = Boolean(item.productId && has(item.productId));
        const price = item.productId ? products[item.productId]?.price : undefined;
        const canBook = actionable && Boolean(item.professionalId);
        // Dietary advice is the one lifestyle item the app can actually help with day to
        // day: the nutrition tracker derives its targets from this item and scores every
        // meal against it. Without this link the advice is a sentence nobody acts on.
        const canTrack = item.type === 'lifestyle' && item.condition === 'diet';

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
                        {typeof price === 'number' ? <Text style={styles.linkedPrice}>{`  £${price.toFixed(2)}`}</Text> : null}
                    </Text>
                ) : null}

                {/* A recommendation with nothing behind it says so, rather than showing a
                    button that cannot work */}
                {canTrack ? (
                    <TouchableOpacity style={styles.trackLink} onPress={() => router.push('/nutrition')}>
                        <Ionicons name="restaurant-outline" size={14} color="#7C3AED" />
                        <Text style={styles.trackLinkText}>Track this in your nutrition log</Text>
                        <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
                    </TouchableOpacity>
                ) : null}

                {actionable && item.type !== 'lifestyle' && !canOrder && !canBook ? (
                    <Text style={styles.unavailable}>
                        Not yet available to book through LabTrack — ask your clinician about this one.
                    </Text>
                ) : null}

                {(canOrder || canBook || actionable) && (
                    <View style={styles.actions}>
                        {canOrder && (inBasket ? (
                            <TouchableOpacity style={styles.inBasketAction} onPress={() => router.push('/basket')}>
                                <Ionicons name="checkmark" size={16} color="#059669" />
                                <Text style={styles.inBasketActionText}>In basket</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => addToBasket(item)} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.primaryActionText}>Add to basket</Text>}
                            </TouchableOpacity>
                        ))}
                        {canBook && (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => book(item)} disabled={busy}>
                                <Text style={styles.primaryActionText}>Book</Text>
                            </TouchableOpacity>
                        )}
                        {actionable && (
                            <TouchableOpacity style={styles.secondaryAction} onPress={() => dismiss(item)} disabled={busy}>
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

            {/* The basket is shared with the Order tab, so items added here are waiting there
                too. Saying so on this screen is what makes adding several before paying once
                a flow rather than a guess. */}
            {count > 0 && (
                <TouchableOpacity
                    style={[styles.viewBasket, { bottom: Math.max(insets.bottom, 16) }]}
                    onPress={() => router.push('/basket')}
                >
                    <Ionicons name="bag-outline" size={18} color="#fff" />
                    <Text style={styles.viewBasketText}>
                        View basket ({count} {count === 1 ? 'item' : 'items'})
                    </Text>
                    <Text style={styles.viewBasketTotal}>£{estimatedTotal.toFixed(2)}</Text>
                </TouchableOpacity>
            )}
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingBottom: 110 },
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
    linkedPrice: { color: '#7C3AED', fontWeight: '700' },
    unavailable: { fontSize: 12, color: '#9CA3AF', marginTop: 10, fontStyle: 'italic' },
    trackLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F5F3FF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 10,
    },
    trackLinkText: { flex: 1, fontSize: 13, color: '#7C3AED', fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    primaryAction: {
        backgroundColor: '#7C3AED', paddingVertical: 11, paddingHorizontal: 20,
        borderRadius: 10, alignItems: 'center', minWidth: 110,
    },
    primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    secondaryAction: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10 },
    secondaryActionText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
    inBasketAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
        paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 110,
    },
    inBasketActionText: { color: '#059669', fontSize: 14, fontWeight: '600' },
    viewBasket: {
        position: 'absolute', left: 20, right: 20,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14,
    },
    viewBasketText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
    viewBasketTotal: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
