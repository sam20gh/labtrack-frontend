/**
 * Basket and checkout.
 *
 * Payment is not wired: no provider has been chosen yet. Rather than fake a payment step,
 * orders are placed unpaid and the screen says so plainly — a checkout that pretends to
 * take money and does not would be worse than one that is honest about the gap.
 *
 * **Post or a technician visit.** The market the currency belongs to decides what is offered
 * (`GET /collection/market`); in the UAE that is home collection by default. Choosing it swaps
 * the postal address for a slot and a visit address shaped for the UAE, and adds the market's
 * visit price to the total. The slot is held on the server while the payment sheet is open,
 * and becomes a booking when the payment lands. "Choose a time later" is allowed: the order is
 * paid now and the journey asks for the visit. See `utils/collectionCentre.js`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useStripe } from '@stripe/stripe-react-native';
import { useBasket } from '@/lib/basket';
import { createOrder } from '@/lib/orders';
import { getPaymentStatus, createPaymentIntent, confirmPayment, formatMoney } from '@/lib/payments';
import { ApiError } from '@/lib/api';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/currency';
import {
    cleanDetails, detailsComplete, EMPTY_DETAILS, getMarket, getSlots,
    type FulfilmentMethod, type MarketInfo, type SlotDay, type VisitDetails,
} from '@/lib/collection';
import { SlotPicker } from '@/components/collection/SlotPicker';
import { VisitDetailsForm } from '@/components/collection/VisitDetailsForm';


import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';
/**
 * Where a currency's prices deliver, as a starting address — the API ships each currency only
 * to its own region (`CURRENCIES[].shipTo`). Eurozone has 21 countries, so it starts blank.
 */
const REGION: Record<CurrencyCode, { name: string; iso: string | undefined }> = {
    GBP: { name: 'United Kingdom', iso: 'GB' },
    AED: { name: 'United Arab Emirates', iso: 'AE' },
    SAR: { name: 'Saudi Arabia', iso: 'SA' },
    EUR: { name: '', iso: undefined },
};

export default function BasketScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    // Set when the basket was reached from the journey (welcome hub → packages). A paid
    // order goes back there, where the new parcels already show on the tracker; anything
    // short of paid still goes to the order, which is where it can be paid.
    const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
    const returnTo = typeof rawReturnTo === 'string' && rawReturnTo.startsWith('/') ? rawReturnTo : null;
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const { lines, estimatedTotal, linePrice, currency, setQuantity, remove, clear, count } = useBasket();
    const [placing, setPlacing] = useState(false);
    const [payment, setPayment] = useState<{ available: boolean; testMode: boolean } | null>(null);
    const [address, setAddress] = useState({ line1: '', line2: '', city: '', postcode: '', country: REGION[currency].name });
    const deliversTo = CURRENCY_OPTIONS.find((o) => o.code === currency)?.deliversTo;

    const [market, setMarket] = useState<MarketInfo | null>(null);
    const [method, setMethod] = useState<FulfilmentMethod>('post');
    const [days, setDays] = useState<SlotDay[] | null>(null);
    const [slotStart, setSlotStart] = useState<string | null>(null);
    const [later, setLater] = useState(false);
    const [details, setDetails] = useState<VisitDetails>(EMPTY_DETAILS);

    useEffect(() => {
        getPaymentStatus()
            .then((s) => setPayment({ available: s.available, testMode: s.testMode }))
            .catch(() => setPayment({ available: false, testMode: false }));
    }, []);

    // What this currency's market offers. A failure leaves post, which every market offers
    // today — a checkout that cannot load its options must still be able to send a kit.
    useEffect(() => {
        let live = true;
        getMarket(currency)
            .then((m) => {
                if (!live) return;
                setMarket(m);
                setMethod(m.options.find((o) => o.default)?.method ?? m.options[0]?.method ?? 'post');
            })
            .catch(() => { if (live) { setMarket(null); setMethod('post'); } });
        return () => { live = false; };
    }, [currency]);

    const loadSlots = useCallback(() => {
        getSlots({ currency }).then((r) => setDays(r.days)).catch(() => setDays([]));
    }, [currency]);
    useEffect(() => { if (method === 'home_collection') loadSlots(); }, [method, loadSlots]);

    const collecting = method === 'home_collection';
    const option = market?.options.find((o) => o.method === method);
    const fee = collecting ? option?.price ?? 0 : 0;
    const total = estimatedTotal === null ? null : estimatedTotal + fee;
    const chosenSlot = days?.flatMap((d) => d.slots.map((sl) => ({ ...sl, day: d.label }))).find((sl) => sl.start === slotStart);

    const postReady = Boolean(address.line1.trim() && address.city.trim() && address.postcode.trim());
    const addressComplete = collecting ? later || Boolean(slotStart && detailsComplete(details)) : postReady;

    /**
     * Place the order, then take payment if Stripe is configured.
     *
     * The order is created first so a payment can never exist without something to attach
     * it to. If payment is then cancelled or fails, the order survives as
     * `pending_payment` and can be paid from the order screen — losing a completed basket
     * because a card was declined would be needless.
     */
    const placeOrder = async () => {
        if (!addressComplete) {
            Toast.show(collecting
                ? { type: 'error', text1: 'Visit details needed', text2: 'Choose a time and tell us where to come' }
                : { type: 'error', text1: 'Address needed', text2: 'We need somewhere to send your kit' });
            return;
        }

        setPlacing(true);
        try {
            const { order } = await createOrder(
                lines.map((l) => ({ productId: l.productId, quantity: l.quantity, planItemId: l.planItemId })),
                collecting ? undefined : address,
                currency,
                collecting
                    ? (later ? { method: 'home_collection' } : { method: 'home_collection', slotStart: slotStart!, ...cleanDetails(details) })
                    : { method: 'post' },
            );
            await clear();

            if (!payment?.available) {
                Toast.show({
                    type: 'success',
                    text1: 'Order placed',
                    text2: `${formatMoney(order.total, order.currency)} — we'll be in touch about payment`,
                });
                router.replace({ pathname: '/order-details', params: { orderId: order._id } });
                return;
            }

            const bundle = await createPaymentIntent(order._id);

            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'Predyqt',
                customerId: bundle.customerId,
                customerEphemeralKeySecret: bundle.ephemeralKey,
                paymentIntentClientSecret: bundle.clientSecret,
                allowsDelayedPaymentMethods: false,
                defaultBillingDetails: {
                    address: collecting && !later
                        ? { line1: details.address.building, city: details.address.city, country: REGION[currency].iso }
                        : {
                            line1: address.line1,
                            line2: address.line2 || undefined,
                            city: address.city,
                            postalCode: address.postcode,
                            country: REGION[currency].iso,
                        },
                },
            });

            if (initError) throw new Error(initError.message);

            const { error: sheetError } = await presentPaymentSheet();

            if (sheetError) {
                // Cancelling is a choice, not a failure — the order is still there to pay
                Toast.show({
                    type: sheetError.code === 'Canceled' ? 'info' : 'error',
                    text1: sheetError.code === 'Canceled' ? 'Payment cancelled' : 'Payment failed',
                    text2: 'Your order is saved — you can pay from your orders',
                });
                router.replace({ pathname: '/order-details', params: { orderId: order._id } });
                return;
            }

            // Server re-checks with Stripe; the webhook stays authoritative
            await confirmPayment(order._id).catch(() => { /* webhook will settle it */ });

            Toast.show({
                type: 'success',
                text1: 'Payment complete',
                text2: collecting
                    ? chosenSlot && !later ? `Your visit is booked: ${chosenSlot.day}, ${chosenSlot.label}` : 'Now choose a time for your visit'
                    : `${formatMoney(order.total, order.currency)} — we'll send your kit shortly`,
            });
            if (returnTo) router.dismissTo(returnTo as Href);
            else router.replace({ pathname: '/order-details', params: { orderId: order._id } });
        } catch (error) {
            // The slot went in the moments since it was chosen: show the fresh times.
            if (error instanceof ApiError && error.status === 409 && collecting) {
                setSlotStart(null);
                loadSlots();
            }
            Toast.show({
                type: 'error',
                text1: 'Could not complete your order',
                text2: error instanceof ApiError ? error.message : (error as Error).message || 'Please try again',
            });
        } finally {
            setPlacing(false);
        }
    };

    if (!count) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Basket</Text>
                    <View style={styles.backButton} />
                </View>
                <View style={styles.empty}>
                    <Ionicons name="bag-outline" size={48} color={tone('#D1D5DB')} />
                    <Text style={styles.emptyTitle}>Your basket is empty</Text>
                    <Text style={styles.emptyBody}>Browse tests and scans, or order straight from your health plan.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/orders')}>
                        <Text style={styles.primaryButtonText}>Browse tests</Text>
                    </TouchableOpacity>
                </View>
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
                    <Text style={styles.headerTitle}>Basket</Text>
                    <TouchableOpacity onPress={() => Alert.alert('Empty basket?', 'This removes everything.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Empty', style: 'destructive', onPress: () => clear() },
                    ])} style={styles.backButton}>
                        <Ionicons name="trash-outline" size={20} color={Palette.textMuted} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {lines.map((line) => (
                        <View key={line.productId} style={styles.line}>
                            {line.image
                                ? <Image source={{ uri: line.image }} style={styles.thumb} />
                                : <View style={styles.thumbFallback}><Ionicons name="flask-outline" size={18} color={Palette.primary} /></View>}

                            <View style={styles.lineBody}>
                                <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
                                {line.planItemId ? (
                                    <Text style={styles.fromPlan}>
                                        <Ionicons name="calendar-outline" size={11} color={Palette.primary} /> From your health plan
                                    </Text>
                                ) : null}
                                <Text style={styles.linePrice}>
                                    {formatMoney(linePrice(line) === null ? null : (linePrice(line) as number) * line.quantity, currency)}
                                </Text>
                            </View>

                            <View style={styles.qty}>
                                <TouchableOpacity onPress={() => setQuantity(line.productId, line.quantity - 1)} style={styles.qtyButton}>
                                    <Ionicons name="remove" size={16} color={Palette.textSecondary} />
                                </TouchableOpacity>
                                <Text style={styles.qtyValue}>{line.quantity}</Text>
                                <TouchableOpacity onPress={() => setQuantity(line.productId, line.quantity + 1)} style={styles.qtyButton}>
                                    <Ionicons name="add" size={16} color={Palette.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.currencyRow}
                        onPress={() => router.push('/settings/units')}
                        accessibilityRole="button"
                        accessibilityLabel={`Paying in ${currency}. Change currency`}
                    >
                        <Ionicons name="cash-outline" size={16} color={Palette.textSecondary} />
                        <Text style={styles.currencyText}>
                            Paying in {currency} · delivers to {deliversTo}
                        </Text>
                        <Text style={styles.currencyChange}>Change</Text>
                    </TouchableOpacity>

                    {market && market.options.length > 1 ? (
                        <>
                            <Text style={styles.sectionLabel}>How would you like your tests?</Text>
                            {market.options.map((o) => {
                                const on = o.method === method;
                                return (
                                    <TouchableOpacity
                                        key={o.method}
                                        style={[styles.option, on && styles.optionOn]}
                                        onPress={() => setMethod(o.method)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: on }}
                                    >
                                        <Ionicons
                                            name={on ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={on ? Palette.primary : Palette.textMuted}
                                        />
                                        <View style={styles.flex}>
                                            <View style={styles.optionHead}>
                                                <Text style={styles.optionTitle}>{o.label}</Text>
                                                <Text style={styles.optionPrice}>{o.price ? formatMoney(o.price, currency) : 'Free'}</Text>
                                            </View>
                                            <Text style={styles.optionBody}>{o.description}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    ) : null}

                    {collecting && market?.visits ? (
                        <>
                            <Text style={styles.sectionLabel}>When should we visit?</Text>
                            {later ? (
                                <Text style={styles.laterText}>
                                    You will choose a time after paying. We will remind you on your home screen.
                                </Text>
                            ) : days === null ? (
                                <ActivityIndicator color={Palette.primary} style={{ marginVertical: 16 }} />
                            ) : (
                                <SlotPicker days={days} value={slotStart} onChange={setSlotStart} clockLabel={`${market.name} time`} />
                            )}
                            <TouchableOpacity onPress={() => setLater((v) => !v)} style={styles.laterToggle} accessibilityRole="button">
                                <Text style={styles.laterLink}>{later ? 'Choose a time now' : 'Choose a time later'}</Text>
                            </TouchableOpacity>

                            {!later ? (
                                <>
                                    <Text style={styles.sectionLabel}>Where should we visit?</Text>
                                    <VisitDetailsForm
                                        value={details}
                                        onChange={setDetails}
                                        serviceAreas={market.visits.serviceAreas}
                                        market={market.code}
                                    />
                                </>
                            ) : null}
                        </>
                    ) : null}

                    {!collecting ? <Text style={styles.sectionLabel}>Where should we send your kit?</Text> : null}
                    {!collecting && ([
                        ['line1', 'Address line 1'],
                        ['line2', 'Address line 2 (optional)'],
                        ['city', 'City'],
                        ['postcode', 'Postcode'],
                        ['country', 'Country'],
                    ] as const).map(([key, placeholder]) => (
                        <TextInput
                            key={key}
                            style={styles.input}
                            placeholder={placeholder}
                            placeholderTextColor={Palette.textMuted}
                            value={(address as any)[key]}
                            onChangeText={(t) => setAddress((a) => ({ ...a, [key]: t }))}
                        />
                    ))}

                    {payment && !payment.available && (
                        <View style={styles.notice}>
                            <Ionicons name="information-circle-outline" size={18} color={tone('#92400E')} />
                            <Text style={styles.noticeText}>
                                Card payment is unavailable right now. Your order will be placed unpaid and
                                our team will contact you to arrange payment before the kit is dispatched.
                            </Text>
                        </View>
                    )}

                    {payment?.testMode && (
                        <View style={styles.testNotice}>
                            <Ionicons name="construct-outline" size={18} color={Palette.info} />
                            <Text style={styles.testNoticeText}>
                                Test mode — use card 4242 4242 4242 4242, any future expiry and any CVC.
                                No real money moves.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    {fee ? (
                        <View style={styles.feeRow}>
                            <Text style={styles.feeLabel}>Home collection</Text>
                            <Text style={styles.feeLabel}>{formatMoney(fee, currency)}</Text>
                        </View>
                    ) : null}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.primaryButton, (!addressComplete || placing) && styles.buttonDisabled]}
                        onPress={placeOrder}
                        disabled={!addressComplete || placing}
                    >
                        {placing
                            ? <ActivityIndicator color={Palette.white} />
                            : <Text style={styles.primaryButtonText}>
                                {payment?.available && total !== null ? `Pay ${formatMoney(total, currency)}` : payment?.available ? 'Pay' : 'Place order'}
                            </Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Palette.text, marginTop: 8 },
    emptyBody: { fontSize: 14, color: Palette.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 12 },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    line: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: Palette.border, borderRadius: 14, padding: 12, marginBottom: 10,
    },
    thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.borderLight },
    thumbFallback: {
        width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    lineBody: { flex: 1 },
    lineName: { fontSize: 14, fontWeight: '600', color: Palette.text, lineHeight: 19 },
    fromPlan: { fontSize: 11, color: Palette.textSecondary, marginTop: 4 },
    linePrice: { fontSize: 14, fontWeight: '700', color: Palette.text, marginTop: 4 },
    qty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyButton: {
        width: 28, height: 28, borderRadius: 8, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    qtyValue: { fontSize: 14, fontWeight: '600', color: Palette.text, minWidth: 18, textAlign: 'center' },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: Palette.text, marginTop: 22, marginBottom: 10 },
    option: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        borderWidth: 1, borderColor: Palette.border, borderRadius: 14, padding: 14, marginBottom: 10,
    },
    optionOn: { borderColor: Palette.primary, borderWidth: 1.5 },
    optionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: Palette.text },
    optionPrice: { fontSize: 14, fontWeight: '700', color: Palette.text },
    optionBody: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18, marginTop: 3 },
    laterToggle: { paddingVertical: 10, alignSelf: 'flex-start' },
    laterLink: { fontSize: 14, fontWeight: '600', color: Palette.primary },
    laterText: { fontSize: 14, color: Palette.textSecondary, lineHeight: 20 },
    feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    feeLabel: { fontSize: 13, color: Palette.textSecondary },
    currencyRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
        paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Palette.surface,
    },
    currencyText: { flex: 1, fontSize: 13, color: Palette.textSecondary },
    currencyChange: { fontSize: 13, fontWeight: '600', color: Palette.primary },
    input: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Palette.text, marginBottom: 10,
    },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: tone('#FEF3C7'), borderRadius: 12, padding: 14, marginTop: 12,
    },
    noticeText: { flex: 1, fontSize: 12, color: tone('#92400E'), lineHeight: 18 },
    testNotice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: Palette.infoSurface, borderRadius: 12, padding: 14, marginTop: 12,
    },
    testNoticeText: { flex: 1, fontSize: 12, color: Palette.info, lineHeight: 18 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    totalLabel: { fontSize: 15, color: Palette.textSecondary },
    totalValue: { fontSize: 22, fontWeight: '700', color: Palette.text },
    primaryButton: {
        backgroundColor: Palette.primaryFill, paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: 12, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '600' },
}));
