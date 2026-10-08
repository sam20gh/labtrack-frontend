/**
 * Packages — the in-app storefront, and the way in for a kit bought on the website.
 *
 * The same rows the website sells (`GET /checkout/packages`), so a tier's price and bullets
 * cannot differ between where somebody saw it advertised and where they bought it. Buying
 * goes through the existing basket and PaymentSheet: a package is a product like any other
 * once it is in the basket, and the order snapshots what it ships.
 *
 * **The kit code is at the top, not at the bottom.** Somebody who bought on the website and
 * signed up with a different email — or was given the package — arrives here with a code in
 * their hand, and showing them three packages to buy first reads as "you have to pay again".
 * Most website buyers never see it: signing in with the address they paid with claims the
 * order on its own (`utils/claimOrders.js`).
 *
 * The bracelet is offered on its own below the packages, because the Basic package does not
 * include one and the plan was always that it can be added later from here.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { BodyFont, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { useBasket } from '@/lib/basket';
import { formatMoney, priceIn, useCurrency } from '@/lib/currency';
import { ApiError } from '@/lib/api';
import { claimKit, getStorefront, KIT_ICON, skipStep, type Storefront } from '@/lib/onboarding';
import type { ComponentKind } from '@/types/api';

const INCLUDES_LABEL: Record<ComponentKind, string> = {
    blood: 'Blood test kit',
    dna: 'DNA test kit',
    bracelet: 'Health bracelet',
};

type Item = Storefront['packages'][number];

export default function PackagesScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const returnTo = typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : null;
    const { add, has } = useBasket();
    const currency = useCurrency();

    const [store, setStore] = useState<Storefront | null>(null);
    const [failed, setFailed] = useState(false);
    const [code, setCode] = useState('');
    const [claiming, setClaiming] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setStore(await getStorefront());
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const leave = () => {
        if (returnTo) router.dismissTo(returnTo as Href);
        else router.back();
    };

    const submitCode = async () => {
        setClaiming(true);
        setCodeError(null);
        try {
            const result = await claimKit(code);
            Toast.show({
                type: 'success',
                text1: result.already ? 'Already on your account' : 'Order added',
                text2: result.order.items.map((i) => i.name).join(', '),
            });
            leave();
        } catch (e) {
            setCodeError(e instanceof ApiError ? e.message : 'Please try again.');
        } finally {
            setClaiming(false);
        }
    };

    const buy = async (item: Item) => {
        // A package is one of a kind in a basket: a second tap is checking it registered.
        if (!has(item._id)) await add(item as any);
        router.push((returnTo ? `/basket?returnTo=${encodeURIComponent(returnTo)}` : '/basket') as Href);
    };

    const Card = ({ item }: { item: Item }) => {
        const featured = Boolean(item.package?.featured);
        return (
            <View style={[styles.card, featured && styles.cardFeatured]}>
                {featured ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>RECOMMENDED</Text></View>
                ) : null}
                <Text style={styles.tier}>{item.package?.tier ?? item.name}</Text>
                {item.package?.tagline ? <Text style={styles.tagline}>{item.package.tagline}</Text> : null}
                <Text style={styles.price}>{formatMoney(priceIn(item, currency), currency)}</Text>

                <View style={styles.includes}>
                    {(item.includes ?? []).map((k) => (
                        <View key={k} style={styles.chip}>
                            <Ionicons name={KIT_ICON[k] as any} size={13} color={Palette.textSecondary} />
                            <Text style={styles.chipText}>{INCLUDES_LABEL[k]}</Text>
                        </View>
                    ))}
                </View>

                {(item.package?.highlights ?? []).map((h) => (
                    <View key={h} style={styles.bullet}>
                        <Ionicons name="checkmark" size={16} color={Palette.success} />
                        <Text style={styles.bulletText}>{h}</Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.choose, !featured && styles.chooseQuiet]}
                    onPress={() => buy(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${item.name}, ${formatMoney(priceIn(item, currency), currency)}`}
                >
                    <Text style={[styles.chooseText, !featured && styles.chooseTextQuiet]}>Choose {item.package?.tier ?? item.name}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your tests</Text>
                <View style={styles.headerBtn} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.codeCard}>
                        <Text style={styles.codeTitle}>Bought a package on our website?</Text>
                        <Text style={styles.codeBody}>
                            Signing in with the email you paid with adds it automatically. Used a different email,
                            or were given one? Enter the 8-character code from your confirmation or the box.
                        </Text>
                        <View style={styles.codeRow}>
                            <TextInput
                                value={code}
                                onChangeText={(t) => { setCode(t.toUpperCase()); setCodeError(null); }}
                                placeholder="e.g. 7KQ2 M9PX"
                                placeholderTextColor={Palette.textMuted}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={11}
                                style={styles.codeInput}
                                accessibilityLabel="Kit code"
                                onSubmitEditing={submitCode}
                                returnKeyType="done"
                            />
                            <TouchableOpacity
                                style={[styles.codeBtn, code.replace(/[\s-]/g, '').length !== 8 && styles.codeBtnOff]}
                                onPress={submitCode}
                                disabled={claiming || code.replace(/[\s-]/g, '').length !== 8}
                                accessibilityRole="button"
                            >
                                {claiming
                                    ? <ActivityIndicator color={Palette.white} size="small" />
                                    : <Text style={styles.codeBtnText}>Add</Text>}
                            </TouchableOpacity>
                        </View>
                        {codeError ? <Text style={styles.codeError}>{codeError}</Text> : null}
                    </View>

                    {!store ? (
                        failed ? (
                            <View style={styles.centre}>
                                <Text style={styles.muted}>We could not load the packages.</Text>
                                <TouchableOpacity onPress={load}><Text style={styles.link}>Try again</Text></TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
                        )
                    ) : store.packages.length === 0 ? (
                        <View style={styles.centre}>
                            <Text style={styles.muted}>Packages are not available yet.</Text>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                                <Text style={styles.link}>Browse individual tests</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>Choose a package</Text>
                            <Text style={styles.sectionBody}>
                                Everything is collected at home. Your kits are sent the day you order, and the
                                bracelet starts recording as soon as it is paired.
                            </Text>
                            {store.packages.map((p) => <Card key={p._id} item={p} />)}

                            {store.addons.length ? (
                                <>
                                    <Text style={[styles.sectionTitle, styles.sectionGap]}>Add the bracelet</Text>
                                    <Text style={styles.sectionBody}>
                                        Already have a package without one? The bracelet can be added any time.
                                    </Text>
                                    {store.addons.map((a) => (
                                        <TouchableOpacity key={a._id} style={styles.addon} onPress={() => buy(a)} accessibilityRole="button">
                                            <View style={styles.addonIcon}>
                                                <Ionicons name="watch-outline" size={22} color={Palette.textSecondary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.addonName}>{a.name}</Text>
                                                {a.description ? <Text style={styles.addonBody} numberOfLines={2}>{a.description}</Text> : null}
                                            </View>
                                            <Text style={styles.addonPrice}>{formatMoney(priceIn(a, currency), currency)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : null}

                            {store.payment.testMode ? (
                                <Text style={styles.testMode}>Test mode — no real payment is taken.</Text>
                            ) : null}
                        </>
                    )}

                    {returnTo ? (
                        <TouchableOpacity
                            // Recorded, so the hub and the home card show it as "not now"
                            // rather than as still waiting on them.
                            onPress={() => { skipStep('package').catch(() => {}).finally(leave); }}
                            style={styles.later}
                            accessibilityRole="button"
                        >
                            <Text style={styles.laterText}>Not now</Text>
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
    centre: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
    muted: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary },
    link: { fontSize: 14, ...BodyFont.medium, color: Palette.primary },

    codeCard: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginBottom: Spacing.xxl,
    },
    codeTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    codeBody: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19, marginTop: 4 },
    codeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    codeInput: {
        flex: 1, borderWidth: 1, borderColor: Palette.borderStrong, borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: 16, letterSpacing: 2,
        ...BodyFont.medium, color: Palette.text, backgroundColor: Palette.background,
    },
    codeBtn: { backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, justifyContent: 'center', minWidth: 72, alignItems: 'center' },
    codeBtnOff: { opacity: 0.45 },
    codeBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    codeError: { fontSize: 13, ...BodyFont.regular, color: Palette.alert, marginTop: Spacing.sm },

    sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    sectionGap: { marginTop: Spacing.xl },
    sectionBody: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 20, marginTop: 4, marginBottom: Spacing.lg },

    card: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card,
    },
    cardFeatured: { borderColor: Palette.primary, borderWidth: 1.5 },
    badge: { alignSelf: 'flex-start', backgroundColor: Palette.primarySurface, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginBottom: Spacing.sm },
    badgeText: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.primaryDark, letterSpacing: 0.8 },
    tier: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    tagline: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 20 },
    price: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.md },
    includes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.md, marginBottom: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.borderLight, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
    chipText: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    bullet: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginTop: 6 },
    bulletText: { flex: 1, fontSize: 14, ...BodyFont.regular, color: Palette.text, lineHeight: 20 },
    choose: { marginTop: Spacing.lg, backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingVertical: 13, alignItems: 'center' },
    chooseQuiet: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Palette.primary },
    chooseText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    chooseTextQuiet: { color: Palette.primary },

    addon: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Palette.background,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },
    addonIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.borderLight, alignItems: 'center', justifyContent: 'center' },
    addonName: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    addonBody: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 18 },
    addonPrice: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },

    testMode: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted, textAlign: 'center', marginTop: Spacing.xl },
    later: { alignItems: 'center', paddingVertical: Spacing.xl },
    laterText: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },
}));
