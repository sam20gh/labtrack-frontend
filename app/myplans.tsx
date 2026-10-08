/**
 * Health plan timeline.
 *
 * Rebuilt on `/api/plan-items`. The previous version rendered one embedded array of
 * age/year pairs with "Book" and "Add to Basket" buttons that had no handlers, and computed
 * urgency against a hardcoded date of birth.
 *
 * Now: overdue items first, then the advice to follow, then grouped by year, each
 * individually orderable or bookable. Tapping a card opens the item in full at
 * `app/plan/[id].tsx` — the card clamps its text, and the part cut off is often the part
 * that says what to do.
 *
 * Ordering adds to the shared basket rather than placing an order — see `addToBasket`.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/errors';
import { useBasket } from '@/lib/basket';
import { formatMoney } from '@/lib/currency';
import {
    getPlan, STATUS_META, TYPE_ICON, AREA_LABEL, adviceHomeFor, isAdvice, isOpen, needsAction,
} from '@/lib/plan';
import { usePlanItemActions } from '@/hooks/usePlanItemActions';
import { hasBeenAsked, registerForPushNotifications } from '@/lib/notifications';
import type { PlanItem, GroupedPlanItems, Product } from '@/types/api';


import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';
const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The timeline's sections, worked out here rather than taken from the server's `grouped`.
 *
 * The server files anything `urgent` or `due` under "Needs attention", and advice was
 * written with `dueDate: today` and swept to `urgent` the next morning — so "ask your
 * prescriber about zinc" sat among the overdue screenings wearing an "Overdue" badge, or,
 * once dismissed from there, under a year at the bottom. Advice has no deadline; it gets a
 * section of its own, directly under what is actually overdue.
 */
const ADVICE_KEY = 'advice';
const groupItems = (items: PlanItem[]): GroupedPlanItems =>
    items.reduce<GroupedPlanItems>((acc, item) => {
        const key = needsAction(item)
            ? 'urgent'
            : isAdvice(item) && isOpen(item)
                ? ADVICE_KEY
                : String(new Date(item.dueDate).getFullYear());
        (acc[key] = acc[key] || []).push(item);
        return acc;
    }, {});

const SECTION_RANK = (key: string) => (key === 'urgent' ? 0 : key === ADVICE_KEY ? 1 : 2);



export default function MyPlansScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { count, estimatedTotal, currency } = useBasket();
    const [grouped, setGrouped] = useState<GroupedPlanItems>({});
    const [products, setProducts] = useState<Record<string, Product>>({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ urgent: true, [ADVICE_KEY]: true });

    const load = useCallback(async () => {
        try {
            setError(null);
            // The plan item carries a product id and a name but no price, and a card asking
            // someone to order a screening without saying what it costs asks them to commit
            // before they know the number. A catalogue that fails to load costs the price
            // line, never the plan.
            const [data, catalogue] = await Promise.all([
                getPlan(),
                api.get<Product[]>('/products').catch(() => [] as Product[]),
            ]);
            setProducts(Object.fromEntries((catalogue || []).map((p) => [p._id, p])));
            const groups = groupItems(data.items || []);
            setGrouped(groups);
            setTotal(data.items?.length ?? 0);
            // Open the soonest year alongside overdue, so the screen is never all-collapsed
            const years = Object.keys(groups).filter((k) => SECTION_RANK(k) === 2).sort();
            setExpanded((prev) => ({ ...prev, urgent: true, [ADVICE_KEY]: true, [years[0]]: true }));

            // Ask about notifications only once there is a plan worth reminding about.
            // Prompting on first launch, before the value is obvious, is the surest route
            // to a permanent denial — and on iOS a denial cannot be re-prompted.
            if ((data.items?.length ?? 0) > 0 && !(await hasBeenAsked())) {
                registerForPushNotifications().catch(() => { /* user can enable it in settings */ });
            }
        } catch (error) {
            // Held rather than toasted: the fallback below this is "No plan yet", and
            // telling somebody their health plan is empty because a request timed out is
            // the one failure on this screen that could change what they do next.
            setError(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const actions = usePlanItemActions(products, setProducts, load);

    const renderItem = (item: PlanItem) => {
        const meta = STATUS_META[item.status] ?? STATUS_META.upcoming;
        const busy = actions.busyId === item._id;
        const { actionable, canOrder, canBook, inBasket, price, currency: priceCurrency } = actions.capabilities(item);
        const advice = isAdvice(item);
        // Advice the app can help with day to day links to the tracker that acts on it —
        // the nutrition tracker derives its targets from diet advice and scores every meal
        // against it. Without the link the advice is a sentence nobody acts on.
        const home = actionable ? adviceHomeFor(item) : null;
        const open = () => router.push({ pathname: '/plan/[id]', params: { id: item._id } });

        return (
            <TouchableOpacity
                key={item._id}
                style={[styles.card, needsAction(item) && item.status === 'urgent' && styles.cardUrgent]}
                onPress={open}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityHint="Opens the full details"
            >
                <View style={styles.cardHeader}>
                    {item.image
                        ? <Image source={{ uri: item.image }} style={styles.thumb} />
                        : (
                            <View style={styles.thumbFallback}>
                                <Ionicons name={(TYPE_ICON[item.type] ?? 'ellipse-outline') as any} size={20} color={Palette.primary} />
                            </View>
                        )}

                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={styles.metaRow}>
                            {/* Advice has no deadline, so it shows its area, not a date */}
                            {advice && actionable ? (
                                <View style={[styles.badge, { backgroundColor: Palette.borderLight }]}>
                                    <Text style={[styles.badgeText, { color: Palette.textSecondary }]}>
                                        {AREA_LABEL[item.condition ?? ''] ?? 'Advice'}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                                    </View>
                                    <Text style={styles.dueText}>{formatDate(item.dueDate)}</Text>
                                </>
                            )}
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} style={styles.cardChevron} />
                </View>

                {item.description ? (
                    <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                ) : null}

                {item.professionalName ? (
                    <Text style={styles.linked}>
                        <Ionicons name="person-circle-outline" size={13} color={Palette.textSecondary} /> {item.professionalName}
                    </Text>
                ) : null}
                {item.productName ? (
                    <Text style={styles.linked}>
                        <Ionicons name="cube-outline" size={13} color={Palette.textSecondary} /> {item.productName}
                        {typeof price === 'number' ? <Text style={styles.linkedPrice}>{`  ${formatMoney(price, priceCurrency)}`}</Text> : null}
                    </Text>
                ) : null}

                {/* A recommendation with nothing behind it says so, rather than showing a
                    button that cannot work */}
                {home ? (
                    <TouchableOpacity style={styles.trackLink} onPress={() => router.push(home.route as never)}>
                        <Ionicons name={home.icon as any} size={14} color={Palette.primary} />
                        <Text style={styles.trackLinkText}>{home.label}</Text>
                        <Ionicons name="chevron-forward" size={14} color={Palette.primary} />
                    </TouchableOpacity>
                ) : null}

                {actionable && !advice && !canOrder && !canBook ? (
                    <Text style={styles.unavailable}>
                        Not yet available to book through Predyqt — ask your clinician about this one.
                    </Text>
                ) : null}

                {/* Advice is acted on from its page ("Mark as done"), so its card stays a
                    sentence and a link rather than a row of buttons */}
                {actionable && !advice && (
                    <View style={styles.actions}>
                        {canOrder && (inBasket ? (
                            <TouchableOpacity style={styles.inBasketAction} onPress={() => router.push('/basket')}>
                                <Ionicons name="checkmark" size={16} color={Palette.success} />
                                <Text style={styles.inBasketActionText}>In basket</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => actions.addToBasket(item)} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color={Palette.white} />
                                    : <Text style={styles.primaryActionText}>Add to basket</Text>}
                            </TouchableOpacity>
                        ))}
                        {canBook && (
                            <TouchableOpacity style={styles.primaryAction} onPress={() => actions.book(item)} disabled={busy}>
                                <Text style={styles.primaryActionText}>Book</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.secondaryAction} onPress={() => actions.dismiss(item)} disabled={busy}>
                            <Text style={styles.secondaryActionText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const sections = Object.keys(grouped).sort((a, b) =>
        SECTION_RANK(a) - SECTION_RANK(b) || Number(a) - Number(b));

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
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

                {total === 0 && error ? (
                    <ErrorState
                        error={error}
                        subject="your plan"
                        onRetry={() => { setRefreshing(true); load(); }}
                        variant="inline"
                    />
                ) : null}

                {total === 0 && !error && (
                    <View style={styles.empty}>
                        <Ionicons name="calendar-outline" size={44} color={tone('#D1D5DB')} />
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
                                    {isUrgent ? 'Needs attention' : key === ADVICE_KEY ? 'Advice to follow' : key}
                                </Text>
                                <View style={styles.sectionRight}>
                                    <Text style={styles.sectionCount}>{items.length}</Text>
                                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Palette.textMuted} />
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
                    <Ionicons name="bag-outline" size={18} color={Palette.white} />
                    <Text style={styles.viewBasketText}>
                        View basket ({count} {count === 1 ? 'item' : 'items'})
                    </Text>
                    <Text style={styles.viewBasketTotal}>{formatMoney(estimatedTotal, currency)}</Text>
                </TouchableOpacity>
            )}
            <Toast />
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingBottom: 110 },
    pageTitle: { fontSize: 26, fontWeight: '700', color: Palette.text, marginTop: 8 },
    pageSubtitle: { fontSize: 14, color: Palette.textSecondary, marginTop: 4, marginBottom: 20 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    emptyBody: { fontSize: 14, color: Palette.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 12 },
    section: { marginBottom: 18 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.text },
    sectionTitleUrgent: { color: Palette.danger },
    sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionCount: { fontSize: 13, color: Palette.textMuted, fontWeight: '600' },
    card: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 14,
        padding: 14, marginBottom: 10, backgroundColor: Palette.background,
    },
    cardUrgent: { borderColor: tone('#FECACA'), backgroundColor: tone('#FFFBFB') },
    cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.borderLight },
    thumbFallback: {
        width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    cardBody: { flex: 1 },
    cardChevron: { marginTop: 2 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: Palette.text, lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    dueText: { fontSize: 12, color: Palette.textMuted },
    description: { fontSize: 13, color: Palette.textSecondary, lineHeight: 19, marginTop: 10 },
    linked: { fontSize: 12, color: Palette.textSecondary, marginTop: 8 },
    linkedPrice: { color: Palette.textSecondary, fontWeight: '700' },
    unavailable: { fontSize: 12, color: Palette.textMuted, marginTop: 10, fontStyle: 'italic' },
    trackLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Palette.primaryTint,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 10,
    },
    trackLinkText: { flex: 1, fontSize: 13, color: Palette.primary, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    primaryAction: {
        backgroundColor: Palette.primaryFill, paddingVertical: 11, paddingHorizontal: 20,
        borderRadius: 10, alignItems: 'center', minWidth: 110,
    },
    primaryActionText: { color: Palette.white, fontSize: 14, fontWeight: '600' },
    secondaryAction: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10 },
    secondaryActionText: { color: Palette.textMuted, fontSize: 14, fontWeight: '500' },
    inBasketAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: Palette.successSurface, borderWidth: 1, borderColor: tone('#A7F3D0'),
        paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 110,
    },
    inBasketActionText: { color: Palette.success, fontSize: 14, fontWeight: '600' },
    viewBasket: {
        position: 'absolute', left: 20, right: 20,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Palette.primaryFill, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14,
    },
    viewBasketText: { flex: 1, color: Palette.white, fontSize: 15, fontWeight: '600' },
    viewBasketTotal: { color: Palette.white, fontSize: 15, fontWeight: '700' },
}));
