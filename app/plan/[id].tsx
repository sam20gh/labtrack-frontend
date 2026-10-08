/**
 * One plan item, in full.
 *
 * The timeline clamps every card to two lines of title and three of reasoning, which is
 * right for a list and wrong for advice like "ask your prescriber whether 25 mg of zinc…",
 * where the part that was cut off is the part that says what to do. This page is where
 * that sentence is read, alongside why it is on the plan, who put it there, and the one
 * action that moves it.
 *
 * A page rather than an expanding card: an item carries up to seven facts and three
 * buttons, and expanding that inline shoves every card below it off screen while the
 * buttons on the list compete with the ones inside. Every other feature here (a night, a
 * meal, a medicine, a prediction) already opens its record this way.
 *
 * There is no `GET /plan-items/:id`. The list is one indexed query of a few dozen rows and
 * the timeline has just fetched it, so the page reads it and picks its item rather than
 * adding a route that returns a subset of the same thing.
 */
import { formatMoney } from '@/lib/currency';
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { api, ApiError } from '@/lib/api';
import { ErrorState } from '@/components/errors';
import {
    getPlan, STATUS_META, TYPE_ICON, AREA_LABEL, adviceHomeFor, dismissConsequenceFor, isAdvice,
} from '@/lib/plan';
import { usePlanItemActions } from '@/hooks/usePlanItemActions';
import { Fonts, BodyFont, Spacing, Radius } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { PlanItem, Product } from '@/types/api';

const TYPE_LABEL: Record<string, string> = {
    test: 'Test',
    scan: 'Scan',
    consultation: 'Consultation',
    assessment: 'Assessment',
    lifestyle: 'Advice',
};

const FREQUENCY_LABEL: Record<string, string> = {
    once: 'Once',
    annually: 'Every year',
    every_6_months: 'Every 6 months',
    every_2_years: 'Every 2 years',
    every_3_years: 'Every 3 years',
    every_5_years: 'Every 5 years',
    as_advised: 'As your clinician advises',
};

const SOURCE_LABEL: Record<string, string> = {
    ai: 'Your latest analysis',
    specialist: 'Your clinician',
    user: 'You',
    system: 'Predyqt',
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function PlanItemScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [item, setItem] = useState<PlanItem | null>(null);
    const [products, setProducts] = useState<Record<string, Product>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const [plan, catalogue] = await Promise.all([
                getPlan(),
                // A price is worth showing before someone commits; a catalogue that fails
                // costs the price line, never the page.
                api.get<Product[]>('/products').catch(() => [] as Product[]),
            ]);
            setProducts(Object.fromEntries((catalogue || []).map((p) => [p._id, p])));
            const found = plan.items?.find((i) => i._id === id) ?? null;
            setItem(found);
            if (!found) setError(new ApiError('Plan item not found', 404));
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const actions = usePlanItemActions(products, setProducts, load);

    const header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Health plan</Text>
            <View style={{ width: 24 }} />
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {header}
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (!item) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {header}
                <ErrorState
                    error={error}
                    subject="this plan item"
                    onRetry={() => { setLoading(true); load(); }}
                />
            </SafeAreaView>
        );
    }

    const advice = isAdvice(item);
    const meta = STATUS_META[item.status] ?? STATUS_META.upcoming;
    const home = adviceHomeFor(item);
    const consequence = dismissConsequenceFor(item);
    const { actionable, canOrder, canBook, inBasket, price, currency } = actions.capabilities(item);
    const busy = actions.busyId === item._id;
    const kicker = advice
        ? `Advice · ${AREA_LABEL[item.condition ?? ''] ?? 'General'}`
        : TYPE_LABEL[item.type] ?? 'Plan item';

    // Every row is a fact the record holds; a row with nothing behind it is not drawn.
    const facts: { icon: string; label: string; value: string }[] = [
        !advice && item.condition ? { icon: 'medical-outline', label: 'Reason', value: item.condition } : null,
        item.frequency ? { icon: 'repeat-outline', label: 'How often', value: FREQUENCY_LABEL[item.frequency] ?? item.frequency } : null,
        item.professionalName ? { icon: 'person-circle-outline', label: 'Professional', value: item.professionalName } : null,
        item.productName ? {
            icon: 'cube-outline',
            label: 'Test',
            value: typeof price === 'number' ? `${item.productName} · ${formatMoney(price, currency)}` : item.productName,
        } : null,
        {
            icon: 'sparkles-outline',
            label: 'Recommended by',
            value: `${SOURCE_LABEL[item.source ?? 'ai'] ?? 'Predyqt'}${item.createdAt ? `, ${formatDate(item.createdAt)}` : ''}`,
        },
    ].filter(Boolean) as { icon: string; label: string; value: string }[];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.kickerRow}>
                    <View style={styles.kickerIcon}>
                        <Ionicons name={(TYPE_ICON[item.type] ?? 'ellipse-outline') as any} size={16} color={Palette.textSecondary} />
                    </View>
                    <Text style={styles.kicker}>{kicker}</Text>
                </View>

                <Text style={styles.title} accessibilityRole="header">{item.title}</Text>

                {/* Advice has no deadline, so it wears no status and no date. A sentence
                    about zinc reading "Overdue" was the fault this page was built beside. */}
                <View style={styles.statusRow}>
                    {advice ? (
                        <View style={[styles.badge, { backgroundColor: item.status === 'completed' ? meta.bg : Palette.borderLight }]}>
                            <Text style={[styles.badgeText, { color: item.status === 'completed' ? meta.color : Palette.textSecondary }]}>
                                {actionable ? 'Ongoing advice' : meta.label}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                            </View>
                            <Text style={styles.due}>
                                {actionable ? `Due ${formatDate(item.dueDate)}` : formatDate(item.completedAt ?? item.dueDate)}
                            </Text>
                        </>
                    )}
                </View>

                {item.description ? (
                    <View style={styles.block}>
                        <Text style={styles.blockTitle}>{advice ? 'Why this matters for you' : 'Why this is on your plan'}</Text>
                        <Text style={styles.body}>{item.description}</Text>
                    </View>
                ) : null}

                <View style={styles.facts}>
                    {facts.map((f, i) => (
                        <View key={f.label} style={[styles.factRow, i > 0 && styles.factDivider]}>
                            <Ionicons name={f.icon as any} size={17} color={Palette.textSecondary} />
                            <Text style={styles.factLabel}>{f.label}</Text>
                            <Text style={styles.factValue}>{f.value}</Text>
                        </View>
                    ))}
                </View>

                {home ? (
                    <TouchableOpacity style={styles.trackLink} onPress={() => router.push(home.route as never)} activeOpacity={0.8}>
                        <Ionicons name={home.icon as any} size={17} color={Palette.primary} />
                        <Text style={styles.trackLinkText}>{home.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                    </TouchableOpacity>
                ) : null}

                {actionable && !advice && !canOrder && !canBook ? (
                    <Text style={styles.unavailable}>
                        Not yet available to book through Predyqt — ask your clinician about this one.
                    </Text>
                ) : null}

                {actionable ? (
                    <View style={styles.actions}>
                        {canOrder && (inBasket ? (
                            <TouchableOpacity style={styles.inBasket} onPress={() => router.push('/basket')}>
                                <Ionicons name="checkmark" size={17} color={Palette.success} />
                                <Text style={styles.inBasketText}>In basket</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.primary} onPress={() => actions.addToBasket(item)} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color={Palette.white} />
                                    : <Text style={styles.primaryText}>Add to basket</Text>}
                            </TouchableOpacity>
                        ))}
                        {canBook ? (
                            <TouchableOpacity style={styles.primary} onPress={() => actions.book(item)} disabled={busy}>
                                <Text style={styles.primaryText}>Book</Text>
                            </TouchableOpacity>
                        ) : null}
                        {/* Only one-off advice can be finished. Diet, exercise and sleep advice
                            feed their tracker's targets while open, so "done" would quietly
                            move a calorie target — and "eat more fibre" is never done. */}
                        {advice && !home ? (
                            <TouchableOpacity style={styles.primary} onPress={() => actions.complete(item)} disabled={busy}>
                                {busy ? <ActivityIndicator size="small" color={Palette.white} />
                                    : <Text style={styles.primaryText}>Mark as done</Text>}
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.secondary} onPress={() => actions.dismiss(item)} disabled={busy}>
                            <Text style={styles.secondaryText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* The way back from a dismissal. Without it, one mis-tap on diet advice
                    switched off every meal's plan verdict for good. */}
                {item.status === 'dismissed' ? (
                    <View style={styles.actions}>
                        {consequence ? <Text style={styles.restoreNote}>{consequence.after}</Text> : null}
                        <TouchableOpacity style={styles.primary} onPress={() => actions.restore(item)} disabled={busy}>
                            {busy ? <ActivityIndicator size="small" color={Palette.white} />
                                : <Text style={styles.primaryText}>Restore to my plan</Text>}
                        </TouchableOpacity>
                    </View>
                ) : null}

                {advice ? (
                    <Text style={styles.footnote}>
                        Generated from your results and records. Talk to your clinician before
                        changing any medicine or supplement.
                    </Text>
                ) : null}
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    kickerIcon: {
        width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { fontSize: 13, color: Palette.textSecondary, ...BodyFont.medium },
    // A sentence of advice is read, not scanned — the body face, not the display face
    title: { fontSize: 21, lineHeight: 28, color: Palette.text, ...BodyFont.semibold },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: -Spacing.xs },
    badge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontFamily: Fonts.bold },
    due: { fontSize: 13, color: Palette.textMuted, ...BodyFont.regular },

    block: { gap: Spacing.sm },
    blockTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    body: { fontSize: 15, lineHeight: 23, color: Palette.textSecondary, ...BodyFont.regular },

    facts: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl,
        paddingHorizontal: Spacing.lg,
    },
    factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
    factDivider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    factLabel: { width: 110, fontSize: 13, color: Palette.textMuted, ...BodyFont.regular },
    factValue: { flex: 1, fontSize: 14, color: Palette.text, ...BodyFont.medium },

    trackLink: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primaryTint, borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    trackLinkText: { flex: 1, fontSize: 14, color: Palette.primary, ...BodyFont.semibold },
    unavailable: { fontSize: 13, color: Palette.textMuted, fontStyle: 'italic', ...BodyFont.regular },
    restoreNote: { fontSize: 13, lineHeight: 19, color: Palette.textSecondary, ...BodyFont.regular },

    actions: { gap: Spacing.sm },
    primary: {
        backgroundColor: Palette.primaryFill, paddingVertical: 14, borderRadius: Radius.md,
        alignItems: 'center',
    },
    primaryText: { color: Palette.white, fontSize: 15, fontFamily: Fonts.semibold },
    secondary: { paddingVertical: 12, alignItems: 'center' },
    secondaryText: { color: Palette.textMuted, fontSize: 14, ...BodyFont.medium },
    inBasket: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: Palette.successSurface, paddingVertical: 13, borderRadius: Radius.md,
    },
    inBasketText: { color: Palette.success, fontSize: 15, fontFamily: Fonts.semibold },
    footnote: { fontSize: 12, lineHeight: 17, color: Palette.textMuted, ...BodyFont.regular },
}));
