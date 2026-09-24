/**
 * Pair a health bracelet.
 *
 * Built from `Design/device.svg`, which puts every device on a one-point-perspective grid
 * with a dashed platform under it. Two deliberate departures from the kit:
 *
 * **The stage is a state, not a photograph.** The kit draws one frame per device, each with
 * a product shot standing on the plinth — a picture of a finished outcome. This screen
 * spends most of its life *before* that outcome, so the plinth is empty until something is
 * found, pulses while the radio is listening, and only then holds a bracelet. An idle
 * animation that looked like searching would be a progress bar that lies.
 *
 * **The battery and link chips are finally honest.** `app/activity/sources.tsx` refuses to
 * draw the kit's battery bar and says why: no phone health store reports a paired watch's
 * charge or its online state, so that control could only ever have been a decoration. A
 * bracelet is a BLE peer this app talks to directly — `getBattery` is a real command, and
 * connection is something the radio knows right now. Same composition, real data.
 *
 * Everything else the kit implies and cannot back is still absent. There is no "Linked
 * Devices" list, because the codec keeps decode state in static fields and this app talks
 * to exactly one bracelet at a time (`modules/jstyle-ble/README.md`). A list of one is a
 * screen pretending to be a manager.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Palette, Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import type { JstyleVariant } from '@/modules/jstyle-ble';
import * as transport from '@/lib/health/jstyle/transport';
import { VARIANT_LABEL } from '@/lib/health/jstyle/reader';
import { getPaired, setPaired, clearPaired, type PairedBracelet } from '@/lib/health/jstyle/store';
import { runSync, resetSyncThrottle } from '@/lib/health/sync';

import DeviceStage, { type StageState } from '@/components/bracelet/DeviceStage';
import BraceletArt from '@/components/bracelet/BraceletArt';
import DevicePhoto, { hasPhoto } from '@/components/bracelet/DevicePhoto';
import StatusChips from '@/components/bracelet/StatusChips';
import DiscoveredRow from '@/components/bracelet/DiscoveredRow';
import ReadsList from '@/components/bracelet/ReadsList';

/**
 * How long a scan runs before stopping on its own.
 *
 * A scan left running is a measurable battery drain and Android throttles one that never
 * stops. Ending it also gives the "can't find it" advice somewhere to appear, which an
 * endless spinner never does.
 */
const SCAN_MS = 15_000;

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    // Silent on a device without a taptic engine, and never worth failing a flow over.
    Haptics.impactAsync(style).catch(() => undefined);
};

export default function BraceletScreen() {
    const router = useRouter();

    const [paired, setPairedState] = useState<PairedBracelet | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [found, setFound] = useState<transport.DiscoveredBracelet[]>([]);
    const [blocked, setBlocked] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    const stopScan = useRef<(() => void) | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const announced = useRef(new Set<string>());

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
        // A scan must not outlive the screen — it holds the radio open for a page nobody
        // is looking at.
        return endScan;
    }, [endScan]);

    const startScan = useCallback(async () => {
        const reason = await transport.scanBlockedReason();
        setBlocked(reason);
        if (reason) return;

        tap();
        announced.current.clear();
        setFound([]);
        setNote(null);
        setScanning(true);

        stopScan.current = transport.scan(
            (device) => {
                // One tap the first time each bracelet appears, never on its RSSI updates —
                // the scanner reports the same device continuously and buzzing on every
                // frame would be a vibrating phone, not feedback.
                if (!announced.current.has(device.id)) {
                    announced.current.add(device.id);
                    tap();
                }
                setFound((current) => {
                    const next = current.filter((d) => d.id !== device.id);
                    // Nearest first: the one in somebody's hand belongs at the top.
                    return [...next, device].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
                });
            },
            (message) => { setBlocked(message); endScan(); },
        );

        timer.current = setTimeout(endScan, SCAN_MS);
    }, [endScan]);

    const sync = useCallback(async (quiet = false) => {
        setSyncing(true);
        if (!quiet) tap();
        try {
            const result = await runSync(true);
            const bracelet = result.perSource?.find((s) => s.platform === 'jstyle_bracelet');

            setNote(
                bracelet?.ran
                    ? bracelet.days
                        ? `Synced — ${bracelet.days} day${bracelet.days === 1 ? '' : 's'} updated.`
                        : 'Synced — nothing new to bring over.'
                    : bracelet?.reason ?? 'Could not reach the bracelet.',
            );
            setPairedState(await getPaired());
        } finally {
            setSyncing(false);
        }
    }, []);

    /**
     * Pair, then prove it before claiming it.
     *
     * The bracelet is asked for its battery as a handshake. A device that connects but will
     * not answer would otherwise be saved as paired and fail on every sync afterwards, and
     * this is the only moment somebody is watching and can move it closer or charge it.
     */
    const pair = useCallback(async (
        device: transport.DiscoveredBracelet, variant: JstyleVariant,
    ) => {
        endScan();
        setConnecting(device.id);
        setNote(null);

        try {
            const session = await import('@/lib/health/jstyle/session');
            const map = await import('@/lib/health/jstyle/mapping');

            await transport.connect(device.id, session.makePacketHandler(variant));
            const reply = await session.ask(variant, 'getBattery');

            if (!reply.packets.length) {
                throw new Error(
                    'It connected but did not answer. Move it closer to your phone and try again.',
                );
            }

            const record: PairedBracelet = {
                id: device.id,
                variant,
                label: device.name || VARIANT_LABEL[variant],
                pairedAt: new Date().toISOString(),
                lastBattery: map.readBattery(reply.packets) ?? undefined,
            };
            await setPaired(record);
            setPairedState(record);
            setFound([]);
            tap(Haptics.ImpactFeedbackStyle.Medium);

            // Pairing is the one moment a sync is the point, so the interval guard is not
            // wanted — it would skip the first read and leave the screen looking inert.
            resetSyncThrottle();
            void sync(true);
        } catch (err) {
            Alert.alert(
                'Could not pair',
                err instanceof Error ? err.message : 'The bracelet did not respond.',
            );
        } finally {
            await transport.disconnect();
            setConnecting(null);
        }
    }, [endScan, sync]);

    /** Ask which model, when the advertisement does not say. */
    const choose = useCallback((device: transport.DiscoveredBracelet) => {
        if (device.variant) return pair(device, device.variant);

        return Alert.alert(
            'Which bracelet is this?',
            'The two models speak slightly different languages, so this matters. The model '
            + 'is printed on the back of the bracelet or on its box.',
            [
                { text: VARIANT_LABEL.j2208a, onPress: () => pair(device, 'j2208a') },
                { text: VARIANT_LABEL.v8, onPress: () => pair(device, 'v8') },
                { text: 'Cancel', style: 'cancel' },
            ],
        );
    }, [pair]);

    const forget = useCallback(() => {
        Alert.alert(
            'Forget this bracelet?',
            // The question somebody actually has, answered before they ask it.
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
                        setNote(null);
                    },
                },
            ],
        );
    }, []);

    const stage: StageState = paired ? 'connected' : scanning ? 'scanning' : 'idle';

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.bar}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Health bracelet</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} color={Palette.primary} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <DeviceStage state={stage} battery={paired?.lastBattery}>
                        {/*
                          * The device is on the plinth in every state, so the screen shows
                          * what it is for before anything is paired. The V8 is drawn from
                          * its product photograph; a paired 2208A has no photograph and
                          * falls back to the drawn bracelet rather than showing somebody a
                          * device they do not own.
                          */}
                        {paired && !hasPhoto(paired.variant) ? (
                            <BraceletArt mood="live" width={172} />
                        ) : (
                            <DevicePhoto variant={paired?.variant ?? 'v8'} width={196} />
                        )}
                    </DeviceStage>

                    {paired
                        ? <Paired
                            device={paired}
                            syncing={syncing}
                            note={note}
                            onSync={() => sync()}
                            onForget={forget}
                        />
                        : <Unpaired
                            scanning={scanning}
                            blocked={blocked}
                            found={found}
                            connecting={connecting}
                            onScan={startScan}
                            onStop={endScan}
                            onPick={choose}
                        />}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── paired ──────────────────────────────────────────────────────────────────

const relative = (iso?: string): string => {
    if (!iso) return 'Not synced yet';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 2) return 'Synced just now';
    if (mins < 60) return `Synced ${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Synced ${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `Synced ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} ago`;
};

const Paired = ({
    device, syncing, note, onSync, onForget,
}: {
    device: PairedBracelet;
    syncing: boolean;
    note: string | null;
    onSync: () => void;
    onForget: () => void;
}) => (
    <View style={styles.panel}>
        <Text style={styles.deviceName}>{device.label}</Text>
        {/*
          * Only when it adds something. `PairedBracelet.label` falls back to the model
          * name when the bracelet advertises none of its own, and most of them do not — so
          * printing both unconditionally renders "J-Style V8" twice, one line apart.
          */}
        {device.label !== VARIANT_LABEL[device.variant] ? (
            <Text style={styles.deviceSub}>{VARIANT_LABEL[device.variant]}</Text>
        ) : null}

        <StatusChips battery={device.lastBattery} connected busy={syncing} />

        <Text style={styles.timestamp}>{relative(device.lastSyncAt)}</Text>

        {note ? <Text style={styles.note}>{note}</Text> : null}

        <Pressable
            onPress={onSync}
            disabled={syncing}
            accessibilityRole="button"
            style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                syncing && styles.disabled,
            ]}
        >
            {syncing
                ? <ActivityIndicator color="#FFFFFF" />
                : <Ionicons name="sync" size={18} color="#FFFFFF" />}
            <Text style={styles.primaryLabel}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
        </Pressable>

        {/*
          * Destructive as a text link rather than a second filled button, exactly as the
          * kit draws it. Two full-width buttons of equal weight make forgetting the device
          * as prominent as using it.
          */}
        <Pressable onPress={onForget} accessibilityRole="button" style={styles.destructive}>
            <Text style={styles.destructiveLabel}>Forget this bracelet</Text>
            <Ionicons name="trash-outline" size={16} color={Palette.danger} />
        </Pressable>

        <ReadsList variant={device.variant} />
    </View>
);

// ── unpaired ────────────────────────────────────────────────────────────────

const Unpaired = ({
    scanning, blocked, found, connecting, onScan, onStop, onPick,
}: {
    scanning: boolean;
    blocked: string | null;
    found: transport.DiscoveredBracelet[];
    connecting: string | null;
    onScan: () => void;
    onStop: () => void;
    onPick: (device: transport.DiscoveredBracelet) => void;
}) => (
    <View style={styles.panel}>
        <Text style={styles.deviceName}>
            {scanning ? 'Listening…' : 'No bracelet paired'}
        </Text>
        <Text style={styles.deviceSub}>
            {scanning
                ? 'Keep it close and awake'
                : 'Sync steps, sleep, heart rate and more, automatically'}
        </Text>

        {blocked ? (
            <View style={styles.notice}>
                <Ionicons name="information-circle" size={20} color={Palette.primary} />
                <Text style={styles.noticeText}>{blocked}</Text>
            </View>
        ) : null}

        <Pressable
            onPress={scanning ? onStop : onScan}
            disabled={Boolean(blocked) || Boolean(connecting)}
            accessibilityRole="button"
            style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                (blocked || connecting) && styles.disabled,
            ]}
        >
            <Ionicons
                name={scanning ? 'stop-circle-outline' : 'bluetooth'}
                size={18}
                color="#FFFFFF"
            />
            <Text style={styles.primaryLabel}>
                {scanning ? 'Stop searching' : 'Find my bracelet'}
            </Text>
        </Pressable>

        {found.length ? (
            <View style={styles.results}>
                <Text style={styles.resultsHead}>
                    {found.length} found · nearest first
                </Text>
                {found.map((device) => (
                    <DiscoveredRow
                        key={device.id}
                        name={device.name}
                        rssi={device.rssi}
                        variant={device.variant}
                        variantLabel={device.variant ? VARIANT_LABEL[device.variant] : null}
                        busy={connecting === device.id}
                        onPress={() => onPick(device)}
                    />
                ))}
            </View>
        ) : null}

        {!scanning && !found.length && !blocked ? (
            <View style={styles.tips}>
                <Tip icon="battery-charging-outline" text="Make sure it is charged and awake." />
                <Tip
                    icon="phone-portrait-outline"
                    text="Close the maker's own app — a bracelet talks to one phone at a time."
                />
                <Tip icon="resize-outline" text="Hold it within arm's reach of your phone." />
            </View>
        ) : null}
    </View>
);

const Tip = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
    <View style={styles.tip}>
        <Ionicons name={icon} size={16} color={Palette.textMuted} />
        <Text style={styles.tipText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Palette.canvas },
    bar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    barTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    loader: { marginTop: Spacing.xxxl },
    // `flexGrow` rather than a fixed height: the idle state is short and should sit as a
    // centred composition, while the scanning state grows a list and must still scroll.
    content: { flexGrow: 1, paddingBottom: Spacing.xxxl },

    panel: { paddingHorizontal: Spacing.lg, alignItems: 'center', gap: Spacing.sm },
    deviceName: {
        fontFamily: Fonts.bold, fontSize: 24, color: Palette.text,
        textAlign: 'center', marginTop: Spacing.xs,
    },
    deviceSub: {
        ...BodyFont.regular, fontSize: 15, color: Palette.textSecondary,
        textAlign: 'center', marginBottom: Spacing.xs,
    },
    timestamp: { ...BodyFont.regular, fontSize: 13, color: Palette.textMuted },
    note: {
        ...BodyFont.medium, fontSize: 13, color: Palette.primary,
        textAlign: 'center', marginTop: 2,
    },

    notice: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.primarySurface, borderRadius: Radius.md,
        padding: Spacing.md, marginTop: Spacing.sm, width: '100%',
    },
    noticeText: {
        flex: 1, ...BodyFont.regular, fontSize: 14,
        color: Palette.text, lineHeight: 20,
    },

    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, backgroundColor: Palette.primary,
        borderRadius: Radius.lg, paddingVertical: 16,
        width: '100%', marginTop: Spacing.md,
    },
    primaryPressed: { backgroundColor: Palette.primaryDark },
    disabled: { opacity: 0.5 },
    primaryLabel: { fontFamily: Fonts.semibold, fontSize: 16, color: '#FFFFFF' },

    destructive: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: Spacing.md, marginTop: Spacing.xs,
    },
    destructiveLabel: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.danger },

    results: { width: '100%', gap: Spacing.sm, marginTop: Spacing.lg },
    resultsHead: {
        ...BodyFont.medium, fontSize: 13, color: Palette.textMuted,
        marginBottom: 2,
    },

    tips: { width: '100%', gap: Spacing.sm, marginTop: Spacing.xl },
    tip: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    tipText: {
        flex: 1, ...BodyFont.regular, fontSize: 13,
        color: Palette.textMuted, lineHeight: 19,
    },
});
