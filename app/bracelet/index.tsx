/**
 * Pair a health bracelet.
 *
 * The J-Style 2208A and V8 are the first devices LabTrack talks to directly rather than
 * through a phone health store, so this screen owns things no other source screen needs: a
 * live scan, a signal reading, and a model the person sometimes has to confirm by hand.
 *
 * Three things it is careful about:
 *
 * 1. **Nothing is drawn that cannot be backed.** Signal strength is real, because the radio
 *    reports it. Battery appears only once the bracelet has been asked and has answered.
 *    The design's always-90% battery bar is the dummy control `sources.tsx` already refuses
 *    to draw.
 * 2. **The model is confirmed, never guessed.** The vendor sells this hardware under many
 *    retail names, so a device whose advertised name matches neither pattern is offered as
 *    a choice rather than assumed. Picking the wrong SDK does not fail — it decodes every
 *    reading afterwards with the wrong table, which is a record full of plausible, wrong
 *    numbers.
 * 3. **Every way this fails names what to do about it.** Bluetooth off, permission
 *    declined, a build that predates the module, an empty scan. "Bluetooth error" leaves
 *    somebody toggling settings at random.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { JstyleVariant } from '@/modules/jstyle-ble';
import * as transport from '@/lib/health/jstyle/transport';
import { VARIANT_LABEL } from '@/lib/health/jstyle/reader';
import { getPaired, setPaired, clearPaired, type PairedBracelet } from '@/lib/health/jstyle/store';
import { runSync, resetSyncThrottle } from '@/lib/health/sync';

/**
 * How long a scan runs before it stops on its own.
 *
 * A scan left running is a measurable battery drain and Android throttles one that never
 * stops, so it ends rather than spinning forever — and a person who sees it stop with
 * nothing found gets the "can't find it" advice, which is more use than an endless spinner.
 */
const SCAN_MS = 15_000;

/** RSSI is in dBm and negative; closer to zero is nearer. */
const signalLabel = (rssi: number | null): string => {
    if (rssi === null) return '';
    if (rssi > -60) return 'Very close';
    if (rssi > -75) return 'Nearby';
    return 'Far away';
};

export default function BraceletPairingScreen() {
    const router = useRouter();

    const [paired, setPairedState] = useState<PairedBracelet | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [found, setFound] = useState<transport.DiscoveredBracelet[]>([]);
    const [blocked, setBlocked] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);

    const stopScan = useRef<(() => void) | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const endScan = useCallback(() => {
        stopScan.current?.();
        stopScan.current = null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setScanning(false);
    }, []);

    useEffect(() => {
        (async () => {
            setPairedState(await getPaired());
            setBlocked(await transport.scanBlockedReason());
            setLoading(false);
        })();
        // The scan must not outlive the screen: leaving one running holds the radio open
        // for a screen nobody is looking at.
        return endScan;
    }, [endScan]);

    const startScan = useCallback(async () => {
        const reason = await transport.scanBlockedReason();
        setBlocked(reason);
        if (reason) return;

        setFound([]);
        setScanning(true);

        stopScan.current = transport.scan(
            (device) => setFound((current) => {
                const next = current.filter((d) => d.id !== device.id);
                // Nearest first: the bracelet somebody is holding should be at the top.
                return [...next, device].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
            }),
            (message) => { setBlocked(message); endScan(); },
        );

        timer.current = setTimeout(endScan, SCAN_MS);
    }, [endScan]);

    /**
     * Pair, then prove it works before claiming it does.
     *
     * The bracelet is asked for its battery as a handshake. A device that connects but will
     * not answer is one that would be saved as paired and then fail on every sync, and this
     * is the only moment somebody is watching and can move it closer or charge it.
     */
    const pair = useCallback(async (
        device: transport.DiscoveredBracelet, variant: JstyleVariant,
    ) => {
        endScan();
        setConnecting(device.id);

        try {
            const session = await import('@/lib/health/jstyle/session');
            const map = await import('@/lib/health/jstyle/mapping');

            await transport.connect(device.id, session.makePacketHandler(variant));
            const reply = await session.ask(variant, 'getBattery');
            const battery = map.readBattery(reply.packets);

            if (!reply.packets.length) {
                throw new Error(
                    'Connected, but the bracelet did not answer. Move it closer and try again.',
                );
            }

            const record: PairedBracelet = {
                id: device.id,
                variant,
                label: device.name || VARIANT_LABEL[variant],
                pairedAt: new Date().toISOString(),
                lastBattery: battery ?? undefined,
            };
            await setPaired(record);
            setPairedState(record);

            // Pairing is the one moment a sync is the point, so the interval guard is not
            // wanted here — it would skip the first read and leave the screen looking
            // like nothing happened.
            resetSyncThrottle();
            runSync(true).catch(() => { /* the dashboard shows what it has */ });
        } catch (err) {
            Alert.alert(
                'Could not pair',
                err instanceof Error ? err.message : 'The bracelet did not respond.',
            );
        } finally {
            await transport.disconnect();
            setConnecting(null);
        }
    }, [endScan]);

    /** Ask which model, when the advertised name does not say. */
    const choose = useCallback((device: transport.DiscoveredBracelet) => {
        if (device.variant) return pair(device, device.variant);

        return Alert.alert(
            'Which bracelet is this?',
            'The two models speak slightly different languages, so picking the right one '
            + "matters. It is printed on the back of the bracelet or on its box.",
            [
                { text: VARIANT_LABEL.j2208a, onPress: () => pair(device, 'j2208a') },
                { text: VARIANT_LABEL.v8, onPress: () => pair(device, 'v8') },
                { text: 'Cancel', style: 'cancel' },
            ],
        );
    }, [pair]);

    const unpair = useCallback(() => {
        Alert.alert(
            'Forget this bracelet?',
            // Said explicitly because it is the question somebody actually has.
            'Everything it has already recorded stays in your health record. You can pair '
            + 'it again at any time.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Forget',
                    style: 'destructive',
                    onPress: async () => {
                        await transport.disconnect();
                        await clearPaired();
                        setPairedState(null);
                    },
                },
            ],
        );
    }, []);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.title}>Health bracelet</Text>
                <View style={styles.back} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                {loading ? (
                    <ActivityIndicator color={Palette.primary} style={styles.loader} />
                ) : paired ? (
                    <PairedCard device={paired} onForget={unpair} />
                ) : (
                    <>
                        <Text style={styles.lead}>
                            Pair your bracelet to bring its steps, sleep and heart readings
                            into LabTrack automatically.
                        </Text>

                        {blocked ? (
                            <View style={styles.notice}>
                                <Ionicons
                                    name="information-circle-outline"
                                    size={20}
                                    color={Palette.primary}
                                />
                                <Text style={styles.noticeText}>{blocked}</Text>
                            </View>
                        ) : null}

                        <Pressable
                            onPress={scanning ? endScan : startScan}
                            disabled={Boolean(blocked) || Boolean(connecting)}
                            style={[
                                styles.scanButton,
                                (blocked || connecting) && styles.scanButtonDisabled,
                            ]}
                        >
                            {scanning ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Ionicons name="bluetooth" size={18} color="#FFFFFF" />
                            )}
                            <Text style={styles.scanLabel}>
                                {scanning ? 'Searching…' : 'Find my bracelet'}
                            </Text>
                        </Pressable>

                        {found.map((device) => (
                            <Pressable
                                key={device.id}
                                onPress={() => choose(device)}
                                disabled={Boolean(connecting)}
                                style={styles.deviceRow}
                            >
                                <View style={styles.deviceIcon}>
                                    <Ionicons name="watch-outline" size={20} color={Palette.primary} />
                                </View>
                                <View style={styles.deviceText}>
                                    <Text style={styles.deviceName}>
                                        {device.name || 'Unnamed bracelet'}
                                    </Text>
                                    <Text style={styles.deviceMeta}>
                                        {[
                                            device.variant ? VARIANT_LABEL[device.variant] : 'Tap to choose model',
                                            signalLabel(device.rssi),
                                        ].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                {connecting === device.id ? (
                                    <ActivityIndicator color={Palette.primary} />
                                ) : (
                                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                )}
                            </Pressable>
                        ))}

                        {!scanning && !found.length && !blocked ? (
                            <Text style={styles.hint}>
                                Make sure the bracelet is charged and not already connected
                                to another phone — it can only talk to one at a time.
                            </Text>
                        ) : null}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const PairedCard = ({
    device, onForget,
}: { device: PairedBracelet; onForget: () => void }) => (
    <View style={styles.pairedCard}>
        <View style={styles.deviceIcon}>
            <Ionicons name="watch-outline" size={20} color={Palette.primary} />
        </View>
        <Text style={styles.pairedName}>{device.label}</Text>
        <Text style={styles.pairedMeta}>{VARIANT_LABEL[device.variant]}</Text>

        {/* Only ever drawn from a figure the bracelet actually reported. */}
        {typeof device.lastBattery === 'number' ? (
            <Text style={styles.pairedMeta}>Battery {device.lastBattery}%</Text>
        ) : null}

        <Text style={styles.pairedMeta}>
            {device.lastSyncAt
                ? `Last synced ${new Date(device.lastSyncAt).toLocaleString()}`
                : 'Not synced yet'}
        </Text>

        <Pressable onPress={onForget} style={styles.forget}>
            <Text style={styles.forgetLabel}>Forget this bracelet</Text>
        </Pressable>
    </View>
);

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    back: { width: 24 },
    // No `fontWeight` beside `fontFamily`: Android cannot synthesise a weight from a custom
    // face, so the pair renders regular on Android and a fake bold on iOS.
    title: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    body: { padding: Spacing.lg, gap: Spacing.md },
    loader: { marginTop: Spacing.xl },
    lead: { fontFamily: Fonts.regular, fontSize: 15, color: Palette.textMuted, lineHeight: 22 },
    notice: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surfaceWarm, borderRadius: Radius.md, padding: Spacing.md,
    },
    noticeText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Palette.text, lineHeight: 20 },
    scanButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.md, paddingVertical: Spacing.md,
    },
    scanButtonDisabled: { opacity: 0.5 },
    scanLabel: { fontFamily: Fonts.semibold, fontSize: 15, color: '#FFFFFF' },
    deviceRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface, borderRadius: Radius.md, padding: Spacing.md,
    },
    deviceIcon: {
        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.surfaceWarm,
    },
    deviceText: { flex: 1 },
    deviceName: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    deviceMeta: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted, marginTop: 2 },
    hint: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted,
        lineHeight: 19, textAlign: 'center', paddingHorizontal: Spacing.md,
    },
    pairedCard: {
        alignItems: 'center', gap: Spacing.xs,
        backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    },
    pairedName: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text, marginTop: Spacing.sm },
    pairedMeta: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textMuted },
    forget: { marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
    forgetLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.danger },
});
