/**
 * Your library — what you saved, and what you started but have not finished.
 *
 * Not in the kit. It is here because every card in the kit carries a save affordance and a
 * player stores progress, and a save that has nowhere to be seen again is a control that
 * does nothing a person can observe.
 *
 * "Continue" is anything with real progress and no completion. A finished course sitting at
 * the top of a resume rail is a row nobody can clear, so the server drops it — see
 * `getContinue` in the resource controller.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import { getSaved, getContinue, routeFor, formatDuration, type ResourceCard } from '@/lib/resources';
import { AutoCard } from '@/components/resources/ResourceCards';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function SavedResourcesScreen() {
    const router = useRouter();
    const [saved, setSaved] = useState<ResourceCard[]>([]);
    const [inProgress, setInProgress] = useState<ResourceCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [savedResult, continueResult] = await Promise.all([getSaved(), getContinue()]);
            setSaved(savedResult.items);
            setInProgress(continueResult.items);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const open = (card: ResourceCard) => {
        const { pathname, params } = routeFor(card);
        router.push({ pathname: pathname as any, params });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <Text style={styles.title}>Your Library</Text>
                <Text style={styles.subtitle}>Everything you saved and started</Text>

                {inProgress.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Continue</Text>
                        <View style={styles.stack}>
                            {inProgress.map((card) => {
                                const done = card.stats.progressSeconds ?? 0;
                                const total = card.durationSeconds ?? 0;
                                return (
                                    <View key={card.id}>
                                        <AutoCard card={card} variant="row" onPress={() => open(card)} />
                                        {total > 0 && (
                                            <View style={styles.progressWrap}>
                                                <View style={styles.progressTrack}>
                                                    <View style={[
                                                        styles.progressFill,
                                                        { width: `${Math.min(100, (done / total) * 100)}%` },
                                                    ]} />
                                                </View>
                                                <Text style={styles.progressText}>
                                                    {formatDuration(done)} of {formatDuration(total)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>Saved</Text>
                {saved.length ? (
                    <View style={styles.stack}>
                        {saved.map((card) => (
                            <AutoCard key={card.id} card={card} variant="row" onPress={() => open(card)} />
                        ))}
                    </View>
                ) : (
                    <View style={styles.empty}>
                        <Ionicons name="bookmark-outline" size={36} color={Palette.textMuted} />
                        <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                        <Text style={styles.emptyBody}>
                            Tap the bookmark on any article, course or workshop to keep it here.
                        </Text>
                        <TouchableOpacity onPress={() => router.push('/resources')}>
                            <Text style={styles.emptyAction}>Browse resources</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },

    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 4 },
    sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    stack: { gap: Spacing.md },

    progressWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 4 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: Palette.border, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2, backgroundColor: Palette.primary },
    progressText: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },

    empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.sm },
    emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.xl,
    },
    emptyAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary, marginTop: Spacing.sm },
});
