/**
 * Past and in-flight orders.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getOrders, ORDER_STATUS_META } from '@/lib/orders';
import type { Order } from '@/types/api';

const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function OrdersHistoryScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await getOrders();
            setOrders(data.orders || []);
        } catch {
            // The empty state covers a failed load adequately here
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    if (loading) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
                {!orders.length && (
                    <View style={styles.empty}>
                        <Ionicons name="receipt-outline" size={44} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>No orders yet</Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/orders')}>
                            <Text style={styles.primaryButtonText}>Browse tests</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {orders.map((order) => {
                    const meta = ORDER_STATUS_META[order.status];
                    return (
                        <TouchableOpacity
                            key={order._id}
                            style={styles.card}
                            onPress={() => router.push({ pathname: '/order-details', params: { orderId: order._id } })}
                        >
                            <View style={styles.cardTop}>
                                <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
                                <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
                            </View>
                            <Text style={styles.items} numberOfLines={2}>
                                {order.items.map((i) => i.name).join(', ')}
                            </Text>
                            <View style={styles.cardBottom}>
                                <Text style={styles.total}>£{order.total.toFixed(2)}</Text>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 20 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    status: { fontSize: 13, fontWeight: '700' },
    date: { fontSize: 12, color: '#9CA3AF' },
    items: { fontSize: 14, color: '#1F2937', marginTop: 8, lineHeight: 19 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    total: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    primaryButton: { backgroundColor: '#7C3AED', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
