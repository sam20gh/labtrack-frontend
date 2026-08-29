/**
 * Connected sources — the screen that replaces the design's device sheet (frames 24, 26).
 *
 * The kit draws a list of watches with a battery percentage and a Connected badge. Neither
 * HealthKit nor Health Connect exposes a paired wearable's battery or its online state:
 * HealthKit attaches an `HKDevice` (name, model, manufacturer) to samples, Health Connect
 * attaches `metadata.device`, and that is all there is. So this screen shows what can
 * truthfully be said — which store is connected, what it was allowed to share, when it last
 * wrote data, and which devices have appeared in that data.
 *
 * It is also the honest home for every way this can not work: an Android phone with no
 * Health Connect installed, a declined prompt that the OS will not re-ask, and a build that
 * predates the native modules. Each gets a route forward rather than a dead Connect button.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { probe, requestPermissions, labelFor, platformFor, type HealthCapability } from '@/lib/health';
import { runSync, resetSyncThrottle } from '@/lib/health/sync';
import { getWearableStatus, disconnectSource, type WearableStatus } from '@/lib/activity';
import { ApiError } from '@/lib/api';

const SCOPE_LABELS: Record<string, string> = {
    activity: 'Workouts and steps',
    sleep: 'Sleep',
    heart: 'Heart rate',
};

const relativeTime = (iso: string | null): string => {
    if (!iso) return 'never';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

export default function SourcesScreen() {
    const router = useRouter();
    const platform = platformFor();

    const [capability, setCapability] = useState<HealthCapability | null>(null);
    const [status, setStatus] = useState<WearableStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [cap, st] = await Promise.all([probe(), getWearableStatus()]);
            setCapability(cap);
            setStatus(st);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const connect = async () => {
        setBusy('connect');
        setLastResult(null);
        try {
            const cap = await requestPermissions();
            setCapability(cap);

            if (!cap.granted) {
                setLastResult(cap.reason || 'No data types were shared.');
                return;
            }

            // Connecting and then waiting up to two minutes for the throttle would read as
            // a broken button, so the first sync after a grant always runs.
            resetSyncThrottle();
            const result = await runSync(true);
            setLastResult(
                result.ran
                    ? `Synced ${result.counts?.activities ?? 0} activities and ${result.counts?.sleep ?? 0} nights.`
                    : result.reason || 'Nothing to sync yet.'
            );
            await load();
        } catch (err) {
            setLastResult(err instanceof Error ? err.message : 'Could not connect.');
        } finally {
            setBusy(null);
        }
    };

    const syncNow = async () => {
        setBusy('sync');
        setLastResult(null);
        try {
            const result = await runSync(true);
            setLastResult(
                result.ran
                    ? (result.daysUpdated.length
                        ? `Updated ${result.daysUpdated.length} day${result.daysUpdated.length === 1 ? '' : 's'}.`
                        : 'Already up to date.')
                    : result.reason || 'Could not sync.'
            );
            await load();
        } finally {
            setBusy(null);
        }
    };

    const confirmDisconnect = (id: string, label: string) => {
        Alert.alert(
            `Disconnect ${label}?`,
            'LabTrack will stop reading new data. Everything already imported stays in your history.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await disconnectSource(id, false);
                            await load();
                        } catch (err) {
                            Alert.alert('Not disconnected', err instanceof Error ? err.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const connected = status?.sources.filter((s) => s.status === 'connected') || [];
    const label = platform ? labelFor(platform) : 'Health data';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Connected sources</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.intro}>
                        LabTrack reads workouts, sleep and heart rate from {label}. Anything your
                        watch or another app writes there comes through automatically.
                    </Text>

                    {connected.length > 0 ? (
                        connected.map((source) => (
                            <View key={source.id} style={styles.card}>
                                <View style={styles.cardHead}>
                                    <Ionicons name="heart-circle-outline" size={22} color={Palette.success} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>
                                            {source.providerLabel || labelFor(source.platform)}
                                        </Text>
                                        {/* Not a battery percentage — see the note at the top. */}
                                        <Text style={styles.cardMeta}>
                                            Last synced {relativeTime(source.lastSyncAt)}
                                        </Text>
                                    </View>
                                </View>

                                {source.permissions.length > 0 && (
                                    <View style={styles.chips}>
                                        {source.permissions.map((p) => (
                                            <View key={p} style={styles.chip}>
                                                <Text style={styles.chipText}>{SCOPE_LABELS[p] || p}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {source.devices.length > 0 && (
                                    <View style={styles.devices}>
                                        <Text style={styles.devicesLabel}>Devices seen in your data</Text>
                                        {source.devices.map((d, i) => (
                                            <Text key={`${d.name}-${i}`} style={styles.device}>
                                                • {d.name}{d.manufacturer ? ` (${d.manufacturer})` : ''}
                                            </Text>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.actions}>
                                    <Pressable onPress={syncNow} disabled={busy !== null} accessibilityRole="button">
                                        <Text style={[styles.action, busy && styles.actionDisabled]}>
                                            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => confirmDisconnect(source.id, source.providerLabel || labelFor(source.platform))}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[styles.action, styles.destructive]}>Disconnect</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.card}>
                            <View style={styles.cardHead}>
                                <Ionicons
                                    name={capability?.available ? 'watch-outline' : 'information-circle-outline'}
                                    size={22}
                                    color={capability?.available ? Palette.primary : Palette.textSecondary}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>
                                        {capability?.available ? `Connect ${label}` : `${label} isn’t available`}
                                    </Text>
                                    {capability?.reason && (
                                        <Text style={styles.cardMeta}>{capability.reason}</Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.actions}>
                                {capability?.available && (
                                    <Pressable onPress={connect} disabled={busy !== null} accessibilityRole="button">
                                        <Text style={[styles.action, busy && styles.actionDisabled]}>
                                            {busy === 'connect' ? 'Connecting…' : 'Connect'}
                                        </Text>
                                    </Pressable>
                                )}

                                {capability?.needsInstall && (
                                    <Pressable
                                        onPress={() => Linking.openURL(
                                            'market://details?id=com.google.android.apps.healthdata'
                                        ).catch(() => Linking.openURL(
                                            'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'
                                        ))}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.action}>Install Health Connect</Text>
                                    </Pressable>
                                )}

                                <Pressable onPress={() => router.push('/activity/log')} accessibilityRole="button">
                                    <Text style={styles.action}>Log activities by hand</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {lastResult && <Text style={styles.result}>{lastResult}</Text>}

                    <Text style={styles.footnote}>
                        {Platform.OS === 'ios'
                            // HealthKit refuses to report read-permission status at all, so
                            // the app genuinely cannot tell a refusal from an empty day.
                            ? 'iOS doesn’t tell apps which health data you shared. If something looks missing, check Health → Sharing → Apps.'
                            : 'Android syncs when you open LabTrack — Health Connect has no way to wake the app in the background.'}
                    </Text>
                </ScrollView>
            )}
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

    intro: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.xl,
    },

    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    cardHead: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    cardTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    cardMeta: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        backgroundColor: Palette.primarySurface,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: Radius.pill,
    },
    chipText: { fontSize: 11.5, fontFamily: Fonts.medium, color: Palette.primary },

    devices: { gap: 2 },
    devicesLabel: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.text },
    device: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary },

    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        paddingTop: Spacing.md,
    },
    action: { fontSize: 13.5, fontFamily: Fonts.semibold, color: Palette.primary },
    actionDisabled: { opacity: 0.5 },
    destructive: { color: Palette.danger },

    result: {
        fontSize: 13,
        fontFamily: Fonts.medium,
        color: Palette.text,
        marginTop: Spacing.sm,
    },
    footnote: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        lineHeight: 18,
        marginTop: Spacing.xl,
    },
});
