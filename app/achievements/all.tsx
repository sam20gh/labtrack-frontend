/**
 * "My Achievements" — the design's frame 3.
 *
 * A three-column grid of every badge in the catalogue, filtered by category. Two decisions:
 *
 * 1. **Locked badges are shown, not hidden.** The grid is a map of what there is to earn, and
 *    a badge you cannot see is one nobody works towards. What is hidden is the *mark* — a
 *    locked tile draws the padlock rather than a greyed version of its own glyph, so the grid
 *    tells you there is something there without spoiling what.
 * 2. **The filter strip is derived from the catalogue, not hardcoded.** A category added on
 *    the server appears here without an app release, which is the point of the server owning
 *    the catalogue at all.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import { getAchievements, type AchievementHub } from '@/lib/achievements';
import { AchievementTile } from '@/components/achievements/AchievementCards';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const ALL = '__all__';

export default function AllAchievementsScreen() {
    const router = useRouter();
    const [hub, setHub] = useState<AchievementHub | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>(ALL);

    const load = useCallback(async () => {
        try {
            setHub(await getAchievements());
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const chips = useMemo(() => {
        if (!hub) return [];
        // Only categories that actually hold a badge — an empty filter chip is a control
        // that does nothing, which is the dummy button this app keeps removing.
        const present = new Set(hub.achievements.map((a) => a.category));
        return Object.entries(hub.categories)
            .filter(([key]) => present.has(key as never))
            .map(([key, meta]) => ({ key, label: meta.label }));
    }, [hub]);

    const shown = useMemo(
        () => (hub?.achievements ?? []).filter((a) => filter === ALL || a.category === filter),
        [hub, filter],
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>My Achievements</Text>
                <Text style={styles.subtitle}>
                    {hub ? `${hub.summary.unlocked} of ${hub.summary.total} unlocked · ${hub.summary.points.toLocaleString()} points` : ''}
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    <Chip label="All" on={filter === ALL} onPress={() => setFilter(ALL)} />
                    {chips.map((c) => (
                        <Chip
                            key={c.key}
                            label={c.label}
                            on={filter === c.key}
                            onPress={() => setFilter(c.key)}
                        />
                    ))}
                </ScrollView>

                <View style={styles.grid}>
                    {shown.map((a) => (
                        <View key={a.key} style={styles.cell}>
                            <AchievementTile
                                achievement={a}
                                size={62}
                                onPress={() => router.push(`/achievements/${a.key}`)}
                            />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable
        style={[styles.chip, on && styles.chipOn]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
    >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    title: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        marginTop: 4, marginBottom: Spacing.lg,
    },
    chips: { gap: Spacing.sm, paddingBottom: Spacing.lg, paddingRight: Spacing.lg },
    chip: {
        paddingHorizontal: Spacing.lg, paddingVertical: 8,
        borderRadius: Radius.pill, backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.border,
    },
    chipOn: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipTextOn: { color: Palette.white, fontFamily: Fonts.semibold },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: '33.33%' },
});
