/**
 * Test and scan shop.
 *
 * Grouped by category with an inline basket, replacing the flat card list that had no way
 * to actually order anything.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '@/lib/api';
import { useBasket } from '@/lib/basket';
import type { Product } from '@/types/api';

const TYPE_ORDER = ['Blood Test', 'DNA Test', 'Scan', 'Procedure', 'Examination', 'Urine Test'];

const TYPE_ICON: Record<string, string> = {
    'Blood Test': 'water-outline',
    'DNA Test': 'git-branch-outline',
    'Scan': 'scan-outline',
    'Procedure': 'medkit-outline',
    'Examination': 'person-outline',
    'Urine Test': 'flask-outline',
};

export default function OrdersScreen() {
    const router = useRouter();
    const { add, has, count } = useBasket();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await api.get<Product[]>('/products');
            setProducts(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load the catalogue');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const types = useMemo(() => {
        const present = [...new Set(products.map((p) => p.type).filter(Boolean))] as string[];
        return present.sort((a, b) => {
            const ai = TYPE_ORDER.indexOf(a); const bi = TYPE_ORDER.indexOf(b);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
    }, [products]);

    const visible = activeType ? products.filter((p) => p.type === activeType) : products;

    const grouped = useMemo(() => {
        const map: Record<string, Product[]> = {};
        for (const p of visible) {
            const key = p.type || 'Other';
            (map[key] = map[key] || []).push(p);
        }
        for (const key of Object.keys(map)) map[key].sort((a, b) => a.price - b.price);
        return map;
    }, [visible]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Order a test</Text>
                    <Text style={styles.pageSubtitle}>{products.length} available</Text>
                </View>
                <TouchableOpacity style={styles.basketButton} onPress={() => router.push('/basket')}>
                    <Ionicons name="bag-outline" size={22} color="#7C3AED" />
                    {count > 0 && (
                        <View style={styles.basketBadge}>
                            <Text style={styles.basketBadgeText}>{count}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
                style={styles.filterStrip}
            >
                <TouchableOpacity
                    style={[styles.chip, !activeType && styles.chipActive]}
                    onPress={() => setActiveType(null)}
                >
                    <Text style={[styles.chipText, !activeType && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {types.map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.chip, activeType === t && styles.chipActive]}
                        onPress={() => setActiveType(activeType === t ? null : t)}
                    >
                        <Text style={[styles.chipText, activeType === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {Object.keys(grouped).sort((a, b) => {
                    const ai = TYPE_ORDER.indexOf(a); const bi = TYPE_ORDER.indexOf(b);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                }).map((type) => (
                    <View key={type} style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name={(TYPE_ICON[type] ?? 'ellipse-outline') as any} size={16} color="#7C3AED" />
                            <Text style={styles.sectionTitle}>{type}</Text>
                            <Text style={styles.sectionCount}>{grouped[type].length}</Text>
                        </View>

                        {grouped[type].map((product) => (
                            <TouchableOpacity
                                key={product._id}
                                style={styles.card}
                                onPress={() => router.push({ pathname: '/ProductDetails', params: { productId: product._id } })}
                            >
                                {product.image
                                    ? <Image source={{ uri: product.image }} style={styles.thumb} />
                                    : (
                                        <View style={styles.thumbFallback}>
                                            <Ionicons name={(TYPE_ICON[type] ?? 'ellipse-outline') as any} size={20} color="#7C3AED" />
                                        </View>
                                    )}

                                <View style={styles.cardBody}>
                                    <Text style={styles.cardTitle} numberOfLines={2}>{product.name}</Text>
                                    {product.description ? (
                                        <Text style={styles.cardDescription} numberOfLines={2}>{product.description}</Text>
                                    ) : null}
                                    <Text style={styles.price}>£{product.price.toFixed(2)}</Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.addButton, has(product._id) && styles.addButtonAdded]}
                                    onPress={() => add(product)}
                                >
                                    <Ionicons
                                        name={has(product._id) ? 'checkmark' : 'add'}
                                        size={18}
                                        color={has(product._id) ? '#059669' : '#fff'}
                                    />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>

            {count > 0 && (
                <TouchableOpacity style={styles.viewBasket} onPress={() => router.push('/basket')}>
                    <Text style={styles.viewBasketText}>
                        View basket ({count} {count === 1 ? 'item' : 'items'})
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    },
    pageTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937' },
    pageSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
    basketButton: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3E8FF',
        alignItems: 'center', justifyContent: 'center',
    },
    basketBadge: {
        position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
    },
    basketBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    filterStrip: { maxHeight: 46, flexGrow: 0 },
    filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    chipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    chipTextActive: { color: '#fff' },
    scroll: { paddingHorizontal: 20, paddingBottom: 100 },
    errorBox: {
        flexDirection: 'row', gap: 8, alignItems: 'center',
        backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 6 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', flex: 1 },
    sectionCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
        padding: 12, marginBottom: 10,
    },
    thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#F3F4F6' },
    thumbFallback: {
        width: 48, height: 48, borderRadius: 10, backgroundColor: '#F3E8FF',
        alignItems: 'center', justifyContent: 'center',
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 19 },
    cardDescription: { fontSize: 12, color: '#9CA3AF', marginTop: 3, lineHeight: 17 },
    price: { fontSize: 15, fontWeight: '700', color: '#7C3AED', marginTop: 6 },
    addButton: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: '#7C3AED',
        alignItems: 'center', justifyContent: 'center',
    },
    addButtonAdded: { backgroundColor: '#ECFDF5' },
    viewBasket: {
        position: 'absolute', left: 20, right: 20, bottom: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14,
    },
    viewBasketText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
