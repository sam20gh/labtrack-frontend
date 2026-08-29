/**
 * The connect-your-device banner.
 *
 * This is the component that replaces the design's device card — the one showing
 * "Apple Watch Pro XR · 90% · Connected". Neither HealthKit nor Health Connect exposes a
 * paired wearable's battery level or an online state, so a battery bar here would be a
 * number we invented and then showed someone about their own hardware.
 *
 * What can be said truthfully is when a source last wrote data, and that is what it says.
 *
 * It also carries the unavailable states, because they are the common case today: the
 * native modules are not in this build yet (see `lib/health/index.ts`), so `probe()`
 * reports `needsAppUpdate` on every device. The banner explains that and points at manual
 * logging rather than showing a Connect button that cannot work.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { HealthCapability } from '@/lib/health';
import type { WearableStatus } from '@/lib/activity';

interface Props {
    capability: HealthCapability | null;
    sources: WearableStatus['sources'];
    onConnect?: () => void;
    /** Tapping a connected source opens the sources screen. */
    onManage?: () => void;
    onLogManually?: () => void;
}

const relativeTime = (iso: string | null): string => {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60_000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
};

export function SourceBanner({ capability, sources, onConnect, onManage, onLogManually }: Props) {
    const connected = sources.filter((s) => s.status === 'connected');

    if (connected.length > 0) {
        const source = connected[0];
        const device = source.devices?.[0];
        return (
            <Pressable
                onPress={onManage}
                style={[styles.card, styles.ok]}
                accessibilityRole={onManage ? 'button' : undefined}
                accessibilityLabel="Manage connected sources"
            >
                <Ionicons name="watch-outline" size={20} color={Palette.success} />
                <View style={styles.body}>
                    <Text style={styles.title}>
                        {device?.name || source.providerLabel || 'Health data'}
                    </Text>
                    {/* Not a battery percentage. See the note at the top of this file. */}
                    <Text style={styles.detail}>
                        Last synced {relativeTime(source.lastSyncAt)}
                    </Text>
                </View>
                {onManage && <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />}
            </Pressable>
        );
    }

    const unavailable = capability && !capability.available;

    return (
        <View style={[styles.card, unavailable ? styles.muted : styles.prompt]}>
            <Ionicons
                name={unavailable ? 'information-circle-outline' : 'watch-outline'}
                size={20}
                color={unavailable ? Palette.textSecondary : Palette.primary}
            />
            <View style={styles.body}>
                <Text style={styles.title}>
                    {unavailable ? 'Device sync isn’t available yet' : 'Connect your watch'}
                </Text>
                <Text style={styles.detail}>
                    {capability?.reason
                        || 'Bring in workouts, sleep and heart rate automatically.'}
                </Text>

                <View style={styles.actions}>
                    {!unavailable && onConnect && (
                        <Pressable onPress={onConnect} accessibilityRole="button">
                            <Text style={styles.action}>Connect</Text>
                        </Pressable>
                    )}
                    {onLogManually && (
                        <Pressable onPress={onLogManually} accessibilityRole="button">
                            <Text style={styles.action}>Log an activity</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        borderWidth: 1,
    },
    ok: { backgroundColor: Palette.successSurface, borderColor: Palette.successBand },
    prompt: { backgroundColor: Palette.primarySurface, borderColor: Palette.primaryLight },
    muted: { backgroundColor: Palette.surface, borderColor: Palette.border },
    body: { flex: 1, gap: 2 },
    title: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    detail: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
    action: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
});
