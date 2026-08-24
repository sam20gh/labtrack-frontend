/**
 * Basket and checkout.
 *
 * Payment is not wired: no provider has been chosen yet. Rather than fake a payment step,
 * orders are placed unpaid and the screen says so plainly — a checkout that pretends to
 * take money and does not would be worse than one that is honest about the gap.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Image, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useStripe } from '@stripe/stripe-react-native';
import { useBasket } from '@/lib/basket';
import { createOrder } from '@/lib/orders';
import { getPaymentStatus, createPaymentIntent, confirmPayment, formatMoney } from '@/lib/payments';
import { ApiError } from '@/lib/api';

export default function BasketScreen() {
    const router = useRouter();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const { lines, estimatedTotal, setQuantity, remove, clear, count } = useBasket();
    const [placing, setPlacing] = useState(false);
    const [payment, setPayment] = useState<{ available: boolean; testMode: boolean } | null>(null);
    const [address, setAddress] = useState({ line1: '', line2: '', city: '', postcode: '', country: 'United Kingdom' });

    useEffect(() => {
        getPaymentStatus()
            .then((s) => setPayment({ available: s.available, testMode: s.testMode }))
            .catch(() => setPayment({ available: false, testMode: false }));
    }, []);

    const addressComplete = address.line1.trim() && address.city.trim() && address.postcode.trim();

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
            Toast.show({ type: 'error', text1: 'Address needed', text2: 'We need somewhere to send your kit' });
            return;
        }

        setPlacing(true);
        try {
            const { order } = await createOrder(
                lines.map((l) => ({ productId: l.productId, quantity: l.quantity, planItemId: l.planItemId })),
                address,
            );
            await clear();

            if (!payment?.available) {
                Toast.show({
                    type: 'success',
                    text1: 'Order placed',
                    text2: `${formatMoney(order.total)} — we'll be in touch about payment`,
                });
                router.replace({ pathname: '/order-details', params: { orderId: order._id } });
                return;
            }

            const bundle = await createPaymentIntent(order._id);

            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'LabTrack',
                customerId: bundle.customerId,
                customerEphemeralKeySecret: bundle.ephemeralKey,
                paymentIntentClientSecret: bundle.clientSecret,
                allowsDelayedPaymentMethods: false,
                defaultBillingDetails: {
                    address: {
                        line1: address.line1,
                        line2: address.line2 || undefined,
                        city: address.city,
                        postalCode: address.postcode,
                        country: 'GB',
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
                text2: `${formatMoney(order.total)} — we'll send your kit shortly`,
            });
            router.replace({ pathname: '/order-details', params: { orderId: order._id } });
        } catch (error) {
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
                        <Ionicons name="chevron-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Basket</Text>
                    <View style={styles.backButton} />
                </View>
                <View style={styles.empty}>
                    <Ionicons name="bag-outline" size={48} color="#D1D5DB" />
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
                        <Ionicons name="chevron-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Basket</Text>
                    <TouchableOpacity onPress={() => Alert.alert('Empty basket?', 'This removes everything.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Empty', style: 'destructive', onPress: () => clear() },
                    ])} style={styles.backButton}>
                        <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {lines.map((line) => (
                        <View key={line.productId} style={styles.line}>
                            {line.image
                                ? <Image source={{ uri: line.image }} style={styles.thumb} />
                                : <View style={styles.thumbFallback}><Ionicons name="flask-outline" size={18} color="#7C3AED" /></View>}

                            <View style={styles.lineBody}>
                                <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
                                {line.planItemId ? (
                                    <Text style={styles.fromPlan}>
                                        <Ionicons name="calendar-outline" size={11} color="#7C3AED" /> From your health plan
                                    </Text>
                                ) : null}
                                <Text style={styles.linePrice}>£{(line.price * line.quantity).toFixed(2)}</Text>
                            </View>

                            <View style={styles.qty}>
                                <TouchableOpacity onPress={() => setQuantity(line.productId, line.quantity - 1)} style={styles.qtyButton}>
                                    <Ionicons name="remove" size={16} color="#6B7280" />
                                </TouchableOpacity>
                                <Text style={styles.qtyValue}>{line.quantity}</Text>
                                <TouchableOpacity onPress={() => setQuantity(line.productId, line.quantity + 1)} style={styles.qtyButton}>
                                    <Ionicons name="add" size={16} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <Text style={styles.sectionLabel}>Where should we send your kit?</Text>
                    {([
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
                            placeholderTextColor="#9CA3AF"
                            value={(address as any)[key]}
                            onChangeText={(t) => setAddress((a) => ({ ...a, [key]: t }))}
                        />
                    ))}

                    {payment && !payment.available && (
                        <View style={styles.notice}>
                            <Ionicons name="information-circle-outline" size={18} color="#92400E" />
                            <Text style={styles.noticeText}>
                                Card payment is unavailable right now. Your order will be placed unpaid and
                                our team will contact you to arrange payment before the kit is dispatched.
                            </Text>
                        </View>
                    )}

                    {payment?.testMode && (
                        <View style={styles.testNotice}>
                            <Ionicons name="construct-outline" size={18} color="#1D4ED8" />
                            <Text style={styles.testNoticeText}>
                                Test mode — use card 4242 4242 4242 4242, any future expiry and any CVC.
                                No real money moves.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>£{estimatedTotal.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.primaryButton, (!addressComplete || placing) && styles.buttonDisabled]}
                        onPress={placeOrder}
                        disabled={!addressComplete || placing}
                    >
                        {placing
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.primaryButtonText}>
                                {payment?.available ? `Pay ${formatMoney(estimatedTotal)}` : 'Place order'}
                              </Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937', marginTop: 8 },
    emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, marginBottom: 12 },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    line: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, marginBottom: 10,
    },
    thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6' },
    thumbFallback: {
        width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3E8FF',
        alignItems: 'center', justifyContent: 'center',
    },
    lineBody: { flex: 1 },
    lineName: { fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 19 },
    fromPlan: { fontSize: 11, color: '#7C3AED', marginTop: 4 },
    linePrice: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 4 },
    qty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyButton: {
        width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6',
        alignItems: 'center', justifyContent: 'center',
    },
    qtyValue: { fontSize: 14, fontWeight: '600', color: '#1F2937', minWidth: 18, textAlign: 'center' },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 22, marginBottom: 10 },
    input: {
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937', marginBottom: 10,
    },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 12,
    },
    noticeText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
    testNotice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginTop: 12,
    },
    testNoticeText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    totalLabel: { fontSize: 15, color: '#6B7280' },
    totalValue: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
    primaryButton: {
        backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: 12, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
