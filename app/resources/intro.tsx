/**
 * The resources value-prop screen — the kit's frame 0.
 *
 * Shown once, from the home screen's Resources tile, the first time someone opens the
 * library. `resourcesIntroSeen` in AsyncStorage is what stops it appearing again; a splash a
 * person has to dismiss on every visit is a tax on the feature it is advertising.
 *
 * The counts are real. They come from `GET /resources/categories`, summed — the kit's
 * "21,125 articles" is a placeholder, and a hard-coded figure on a library with fourteen
 * pieces in it is the kind of small lie that costs trust in everything around it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCategories, RESOURCES_INTRO_KEY } from '@/lib/resources';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function ResourcesIntroScreen() {
    const router = useRouter();
    const [total, setTotal] = useState<number | null>(null);
    const [categoryCount, setCategoryCount] = useState(0);

    useEffect(() => {
        getCategories()
            .then(({ groups }) => {
                const categories = groups.flatMap((g) => g.categories);
                setCategoryCount(categories.length);
                setTotal(categories.reduce((sum, c) => sum + (c.resourceCount ?? 0), 0));
            })
            .catch(() => setTotal(null));
    }, []);

    const explore = async () => {
        await AsyncStorage.setItem(RESOURCES_INTRO_KEY, 'true').catch(() => { });
        router.replace('/resources');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="close" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                <View style={styles.illustration}>
                    <Ionicons name="library-outline" size={72} color={Palette.primary} />
                    <View style={styles.playPip}>
                        <Ionicons name="play" size={18} color={Palette.white} />
                    </View>
                </View>

                <Text style={styles.title}>Wellness resources{'\n'}in one place.</Text>
                <Text style={styles.subtitle}>
                    Articles, short videos, courses and live workshops that explain your health
                    in plain language — written and presented by clinicians.
                </Text>

                <View style={styles.statRow}>
                    <View style={styles.stat}>
                        <Ionicons name="documents-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.statText}>
                            {total === null ? <ActivityIndicator size="small" color={Palette.primary} />
                                : `${total.toLocaleString()} resource${total === 1 ? '' : 's'}`}
                        </Text>
                    </View>
                    <View style={styles.stat}>
                        <Ionicons name="grid-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.statText}>{categoryCount} categories</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.cta} onPress={explore} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Explore</Text>
                <Ionicons name="search" size={18} color={Palette.white} />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    topBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg },

    illustration: {
        width: 140, height: 140, borderRadius: 70, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
    },
    playPip: {
        position: 'absolute', right: 8, bottom: 12,
        width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },

    title: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center', lineHeight: 36 },
    subtitle: {
        fontSize: 15, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 23,
    },
    statRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.lg },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.textSecondary },

    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.xl, marginBottom: Spacing.xl,
        paddingVertical: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    ctaText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
});
