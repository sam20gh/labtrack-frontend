/**
 * My Sleep Schedule — `Design/sleep.svg` frame 14.
 *
 * A list of bedtime routines with a switch on each. **The switch controls a bedtime
 * reminder, not an alarm** — see the note at the top of `models/SleepSchedule.js` for why
 * the kit's alarm clock is not reproduced. A switch that looks like an alarm and does not
 * ring is worse than not offering one, so nothing here says "alarm".
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { ScheduleCard } from '@/components/sleep/ScheduleCard';
import { BedIllustration } from '@/components/sleep/BedIllustration';
import { listSchedules, updateSchedule, type SleepSchedule } from '@/lib/sleep';
import { ApiError } from '@/lib/api';

export default function SleepScheduleListScreen() {
    const router = useRouter();

    const [schedules, setSchedules] = useState<SleepSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const result = await listSchedules();
            setSchedules(result.schedules);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your schedules.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const toggle = async (id: string, enabled: boolean) => {
        // Optimistic: a round trip before the switch moves makes it feel broken. A failure
        // reloads, which puts it back where it was.
        setSchedules((prev) => prev.map((s) => (s._id === id ? { ...s, enabled } : s)));
        try {
            await updateSchedule(id, { enabled });
        } catch {
            load();
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
            </View>

            <View style={styles.titleBlock}>
                <Text style={styles.title}>My sleep schedule</Text>
                <Text style={styles.subtitle}>Manage your sleep schedule here</Text>
            </View>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
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
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {!schedules.length && !error ? (
                        <View style={styles.empty}>
                            <BedIllustration width={200} />
                            <Text style={styles.emptyTitle}>You have no sleep schedule</Text>
                            <Text style={styles.emptyBody}>
                                Set a bedtime and a wake time and we will remind you to wind down.
                            </Text>
                        </View>
                    ) : null}

                    {schedules.map((schedule) => (
                        <ScheduleCard
                            key={schedule._id}
                            schedule={schedule}
                            onPress={() => router.push(`/sleep/schedule/${schedule._id}`)}
                            onToggle={(enabled) => toggle(schedule._id, enabled)}
                        />
                    ))}

                    {/* Said once, on the screen that would otherwise imply otherwise. */}
                    <Text style={styles.note}>
                        A schedule sends a reminder before bedtime. It is not an alarm and will not
                        wake you up — use your phone&apos;s clock for that.
                    </Text>
                </ScrollView>
            )}

            <View style={styles.footer}>
                <Pressable style={styles.add} onPress={() => router.push('/sleep/schedule/new')}>
                    <Text style={styles.addLabel}>Add new schedule</Text>
                    <Ionicons name="add" size={20} color={Palette.white} />
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    titleBlock: { paddingHorizontal: Spacing.xl, gap: 2 },
    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    content: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
    error: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.danger },
    note: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 17, marginTop: Spacing.md },

    empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingHorizontal: Spacing.lg, lineHeight: 19,
    },

    footer: {
        padding: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    add: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    addLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
