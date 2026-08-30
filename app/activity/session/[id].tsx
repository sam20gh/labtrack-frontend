/**
 * Activity detail — frame 8.
 *
 * Key Stats is built from what the session actually carries. The design's card lists mode,
 * start, end, elevation, cadence, speed, calories, distance and active minutes; a manually
 * logged walk has three of those. Rows for the rest are omitted rather than dashed, because
 * a table of em-dashes reads as a broken screen.
 *
 * The route map and the phase breakdown need GPS tracking (phase 11.6). The Insight and
 * Consult AI Assistant actions need the insight engine (phase 11.5). Neither is stubbed
 * with a dead button here — the app has removed two of those already.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import {
    getSession, updateSession, deleteSession,
    formatDuration, formatDistance, formatPace, formatType, type ActivitySession,
} from '@/lib/activity';
import { ApiError } from '@/lib/api';

const EFFORT_LABELS = ['', 'Very light', 'Light', 'Moderate', 'High effort', 'Maximum'];

export default function ActivityDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [session, setSession] = useState<ActivitySession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!id) return;
        try {
            setError(null);
            const result = await getSession(id);
            setSession(result.session);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load this activity.');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const setEffort = async (value: number) => {
        if (!session) return;
        const next = session.effort === value ? undefined : value;
        // Optimistic: the write is small and the failure path restores from the server
        setSession({ ...session, effort: next });
        try {
            await updateSession(session._id, { effort: next as number });
        } catch {
            load();
        }
    };

    const confirmDelete = () => {
        if (!session) return;
        const synced = session.source !== 'manual' && session.source !== 'live';
        Alert.alert(
            'Delete this activity?',
            synced
                // Saying so up front beats the row silently reappearing tomorrow
                ? 'This came from your health app, so it will come back the next time LabTrack syncs. To remove it for good, delete it there too.'
                : 'This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteSession(session._id);
                            router.back();
                        } catch (err) {
                            Alert.alert('Not deleted', err instanceof Error ? err.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (error || !session) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Text style={styles.error}>{error || 'Activity not found.'}</Text>
                    <Pressable onPress={() => router.back()} accessibilityRole="button">
                        <Text style={styles.link}>Go back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const started = new Date(session.startedAt);
    const ended = session.endedAt ? new Date(session.endedAt) : null;
    const time = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    /**
     * Built from what is actually present. See the note at the top of the file.
     *
     * Each row carries a glyph, as frame 8 of `Design/activity.svg` draws them — on a list
     * this long the icon is what lets someone find the one figure they came for without
     * reading nine labels.
     */
    const stats: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
    stats.push({ icon: 'flag-outline', label: 'Start', value: time(started) });
    if (ended) stats.push({ icon: 'flag', label: 'End', value: time(ended) });
    stats.push({ icon: 'stopwatch-outline', label: 'Active minutes', value: formatDuration(session.durationSec) });

    const distance = formatDistance(session.distanceM);
    if (distance) stats.push({ icon: 'location-outline', label: 'Total distance', value: distance });

    // Derived from distance and duration, not read from anywhere — see `formatPace`. The
    // kit's 80mph jog is the placeholder this replaces.
    const pace = formatPace(session.distanceM, session.durationSec);
    if (pace) {
        stats.push({
            icon: 'speedometer-outline',
            label: pace.endsWith('/km') ? 'Average pace' : 'Average speed',
            value: pace,
        });
    }
    if (Number.isFinite(session.activeKcal as number)) {
        stats.push({ icon: 'flame-outline', label: 'Calories burned', value: `${Math.round(session.activeKcal as number)} kcal` });
    }
    if (Number.isFinite(session.avgBpm as number)) {
        stats.push({ icon: 'heart-outline', label: 'Average heart rate', value: `${Math.round(session.avgBpm as number)} bpm` });
    }
    if (Number.isFinite(session.maxBpm as number)) {
        stats.push({ icon: 'pulse-outline', label: 'Peak heart rate', value: `${Math.round(session.maxBpm as number)} bpm` });
    }
    if (Number.isFinite(session.elevationM as number)) {
        stats.push({ icon: 'trending-up-outline', label: 'Elevation', value: `${Math.round(session.elevationM as number)} m` });
    }
    if (Number.isFinite(session.cadence as number)) {
        stats.push({ icon: 'footsteps-outline', label: 'Cadence', value: `${Math.round(session.cadence as number)} spm` });
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Activity</Text>
                <Pressable onPress={confirmDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete activity">
                    <Ionicons name="trash-outline" size={20} color={Palette.danger} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.head}>
                    <Text style={styles.title}>{formatType(session.type)}</Text>
                    <Text style={styles.subtitle}>
                        {started.toLocaleDateString(undefined, {
                            weekday: 'long', month: 'long', day: 'numeric',
                        })}
                    </Text>
                    {session.scoreDelta > 0 && (
                        <View style={styles.scorePill}>
                            <Ionicons name="add" size={13} color={Palette.primary} />
                            <Text style={styles.scorePillText}>{session.scoreDelta} score</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.sectionTitle}>Key stats</Text>
                <View style={styles.card}>
                    {stats.map((s, i) => (
                        <View key={s.label} style={[styles.row, i === stats.length - 1 && styles.rowLast]}>
                            <Ionicons name={s.icon} size={17} color={Palette.textMuted} />
                            <Text style={styles.rowLabel}>{s.label}</Text>
                            <Text style={styles.rowValue}>{s.value}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>How did it feel?</Text>
                <View style={styles.efforts}>
                    {[1, 2, 3, 4, 5].map((value) => {
                        const active = (session.effort || 0) >= value;
                        return (
                            <Pressable
                                key={value}
                                onPress={() => setEffort(value)}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`Set effort to ${EFFORT_LABELS[value]}`}
                            >
                                <Ionicons
                                    name="flame"
                                    size={28}
                                    color={active ? Palette.amber : Palette.borderLight}
                                />
                            </Pressable>
                        );
                    })}
                </View>
                {session.effort ? (
                    <Text style={styles.effortLabel}>{EFFORT_LABELS[session.effort]}</Text>
                ) : (
                    <Text style={styles.effortLabel}>Not rated</Text>
                )}

                {session.notes ? (
                    <>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <View style={styles.card}>
                            <Text style={styles.notes}>{session.notes}</Text>
                        </View>
                    </>
                ) : null}

                <View style={styles.provenance}>
                    <Ionicons
                        name={session.source === 'manual' ? 'create-outline' : 'watch-outline'}
                        size={14}
                        color={Palette.textMuted}
                    />
                    <Text style={styles.provenanceText}>
                        {session.source === 'manual'
                            ? 'Logged by you'
                            : `From ${session.sourceDevice?.name || 'your health app'}`}
                    </Text>
                </View>

                {session.source !== 'manual' && (
                    <Text style={styles.locked}>
                        Measured values on a synced activity can’t be edited here — only your effort
                        rating and notes.
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

    head: { alignItems: 'center', gap: 4, paddingVertical: Spacing.xl },
    title: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: Palette.primarySurface,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        marginTop: Spacing.sm,
    },
    scorePillText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.primary },

    sectionTitle: {
        fontSize: 15,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginTop: Spacing.xxl,
        marginBottom: Spacing.md,
    },
    card: { backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Palette.borderLight,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary },
    rowValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },

    efforts: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
    effortLabel: {
        fontSize: 13,
        fontFamily: Fonts.medium,
        color: Palette.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    notes: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.text,
        lineHeight: 21,
        paddingVertical: Spacing.lg,
    },

    provenance: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        marginTop: Spacing.xxl,
    },
    provenanceText: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    locked: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 18,
    },

    centre: { alignItems: 'center', gap: Spacing.md, padding: Spacing.xxxl },
    error: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.danger, textAlign: 'center' },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
});
