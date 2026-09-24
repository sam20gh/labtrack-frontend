/**
 * Order tracker.
 *
 * Shows where a home-collection kit is in the fulfilment chain. Reaching `resulted` means
 * the lab returned a report, which is already in the person's biomarker history.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useStripe } from '@stripe/stripe-react-native';
import { getOrder, cancelOrder, ORDER_STAGES, ORDER_STATUS_META, isCancellable } from '@/lib/orders';
import { createPaymentIntent, confirmPayment, formatMoney } from '@/lib/payments';
import { ApiError } from '@/lib/api';
import type { Order } from '@/types/api';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { tone } from '@/constants/theme';

const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function OrderDetailsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { orderId } = useLocalSearchParams();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [paying, setPaying] = useState(false);

    const load = useCallback(async () => {
        if (!orderId) return;
        try {
            const data = await getOrder(String(orderId));
            setOrder(data.order);
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not load order',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleCancel = () => {
        Alert.alert('Cancel this order?', 'This cannot be undone.', [
            { text: 'Keep order', style: 'cancel' },
            {
                text: 'Cancel order',
                style: 'destructive',
                onPress: async () => {
                    setCancelling(true);
                    try {
                        await cancelOrder(String(orderId));
                        Toast.show({ type: 'success', text1: 'Order cancelled' });
                        await load();
                    } catch (error) {
                        Toast.show({
                            type: 'error',
                            text1: 'Could not cancel',
                            text2: error instanceof ApiError ? error.message : 'Please try again',
                        });
                    } finally {
                        setCancelling(false);
                    }
                },
            },
        ]);
    };

    /** Retry payment on an order that was left unpaid. */
    const payNow = async () => {
        setPaying(true);
        try {
            const bundle = await createPaymentIntent(String(orderId));

            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'Predyqt',
                customerId: bundle.customerId,
                customerEphemeralKeySecret: bundle.ephemeralKey,
                paymentIntentClientSecret: bundle.clientSecret,
                allowsDelayedPaymentMethods: false,
            });
            if (initError) throw new Error(initError.message);

            const { error: sheetError } = await presentPaymentSheet();
            if (sheetError) {
                if (sheetError.code !== 'Canceled') {
                    Toast.show({ type: 'error', text1: 'Payment failed', text2: sheetError.message });
                }
                return;
            }

            await confirmPayment(String(orderId)).catch(() => { /* webhook will settle it */ });
            Toast.show({ type: 'success', text1: 'Payment complete' });
            await load();
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not take payment',
                text2: error instanceof ApiError ? error.message : (error as Error).message,
            });
        } finally {
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><Text style={styles.emptyTitle}>Order not found</Text></View>
            </SafeAreaView>
        );
    }

    const meta = ORDER_STATUS_META[order.status];
    const terminal = ['cancelled', 'refunded'].includes(order.status);
    const currentStage = ORDER_STAGES.indexOf(order.status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your order</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={[styles.statusCard, { borderColor: meta.color }]}>
                    <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.statusDescription}>{meta.description}</Text>
                    <Text style={styles.orderRef}>Placed {formatDate(order.createdAt)}</Text>
                </View>

                {!terminal && (
                    <View style={styles.tracker}>
                        {ORDER_STAGES.map((stage, index) => {
                            const done = index <= currentStage;
                            const active = index === currentStage;
                            return (
                                <View key={stage} style={styles.stageRow}>
                                    <View style={styles.stageMarker}>
                                        <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                                            {done && <Ionicons name="checkmark" size={11} color={Palette.white} />}
                                        </View>
                                        {index < ORDER_STAGES.length - 1 && (
                                            <View style={[styles.connector, index < currentStage && styles.connectorDone]} />
                                        )}
                                    </View>
                                    <Text style={[styles.stageLabel, done && styles.stageLabelDone]}>
                                        {ORDER_STATUS_META[stage].label}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {order.payment?.status !== 'paid' && !terminal && order.payment?.provider === 'stripe' && (
                    <TouchableOpacity style={styles.payButton} onPress={payNow} disabled={paying}>
                        {paying
                            ? <ActivityIndicator color={Palette.white} />
                            : <Text style={styles.payButtonText}>Pay {formatMoney(order.total, order.currency)}</Text>}
                    </TouchableOpacity>
                )}

                {order.payment?.status === 'paid' && (
                    <View style={styles.paidRow}>
                        <Ionicons name="checkmark-circle" size={18} color={Palette.success} />
                        <Text style={styles.paidText}>Paid {formatDate(order.payment.paidAt)}</Text>
                    </View>
                )}

                {order.status === 'resulted' && (
                    <TouchableOpacity style={styles.resultBanner} onPress={() => router.push('/(tabs)/results')}>
                        <Ionicons name="analytics-outline" size={20} color={Palette.success} />
                        <Text style={styles.resultBannerText}>Your results are ready — view them</Text>
                        <Ionicons name="chevron-forward" size={18} color={Palette.success} />
                    </TouchableOpacity>
                )}

                <Text style={styles.sectionLabel}>Items</Text>
                {order.items.map((item) => (
                    <View key={item._id ?? item.productId} style={styles.itemRow}>
                        <View style={styles.flex}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            {item.quantity > 1 && <Text style={styles.itemQty}>Quantity {item.quantity}</Text>}
                        </View>
                        <Text style={styles.itemPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                ))}

                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>£{order.total.toFixed(2)}</Text>
                </View>

                {order.shippingAddress?.line1 ? (
                    <>
                        <Text style={styles.sectionLabel}>Delivery</Text>
                        <Text style={styles.address}>
                            {[order.shippingAddress.line1, order.shippingAddress.line2,
                              order.shippingAddress.city, order.shippingAddress.postcode,
                              order.shippingAddress.country].filter(Boolean).join('\n')}
                        </Text>
                    </>
                ) : null}

                {order.statusHistory?.length ? (
                    <>
                        <Text style={styles.sectionLabel}>History</Text>
                        {order.statusHistory.map((h, i) => (
                            <View key={i} style={styles.historyRow}>
                                <Text style={styles.historyStatus}>{ORDER_STATUS_META[h.status as keyof typeof ORDER_STATUS_META]?.label ?? h.status}</Text>
                                <Text style={styles.historyDate}>{formatDate(h.at)}</Text>
                            </View>
                        ))}
                    </>
                ) : null}

                {isCancellable(order.status) && (
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={cancelling}>
                        {cancelling
                            ? <ActivityIndicator size="small" color={Palette.danger} />
                            : <Text style={styles.cancelButtonText}>Cancel this order</Text>}
                    </TouchableOpacity>
                )}
            </ScrollView>
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
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    statusCard: { borderWidth: 1.5, borderRadius: 14, padding: 16, marginBottom: 20 },
    statusLabel: { fontSize: 17, fontWeight: '700' },
    statusDescription: { fontSize: 14, color: Palette.textSecondary, marginTop: 4 },
    orderRef: { fontSize: 12, color: Palette.textMuted, marginTop: 10 },
    tracker: { marginBottom: 20 },
    stageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stageMarker: { alignItems: 'center', width: 20 },
    dot: {
        width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    dotDone: { backgroundColor: Palette.primaryFill, borderColor: Palette.primary },
    dotActive: { borderColor: Palette.primary },
    connector: { width: 2, height: 26, backgroundColor: Palette.border },
    connectorDone: { backgroundColor: Palette.primaryFill },
    stageLabel: { fontSize: 14, color: Palette.textMuted, paddingBottom: 26 },
    stageLabelDone: { color: Palette.text, fontWeight: '500' },
    payButton: {
        backgroundColor: Palette.primaryFill, paddingVertical: 15, borderRadius: 12,
        alignItems: 'center', marginBottom: 16,
    },
    payButtonText: { color: Palette.white, fontSize: 15, fontWeight: '600' },
    paidRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    paidText: { fontSize: 13, color: Palette.success, fontWeight: '600' },
    resultBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: Palette.successSurface, borderRadius: 12, padding: 14, marginBottom: 20,
    },
    resultBannerText: { flex: 1, fontSize: 14, color: Palette.success, fontWeight: '600' },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: Palette.text, marginTop: 8, marginBottom: 10 },
    itemRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    itemName: { fontSize: 14, color: Palette.text, fontWeight: '500' },
    itemQty: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
    itemPrice: { fontSize: 14, fontWeight: '600', color: Palette.text },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
    totalLabel: { fontSize: 15, color: Palette.textSecondary },
    totalValue: { fontSize: 18, fontWeight: '700', color: Palette.text },
    address: { fontSize: 14, color: Palette.textSecondary, lineHeight: 21 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    historyStatus: { fontSize: 13, color: Palette.text },
    historyDate: { fontSize: 13, color: Palette.textMuted },
    cancelButton: {
        marginTop: 28, paddingVertical: 14, borderRadius: 12,
        borderWidth: 1, borderColor: tone('#FECACA'), alignItems: 'center',
    },
    cancelButtonText: { color: Palette.danger, fontSize: 15, fontWeight: '600' },
}));
