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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { JstyleVariant } from '@/modules/jstyle-ble';
import * as transport from '@/lib/health/jstyle/transport';
import { VARIANT_LABEL, describeSync, lastReadReport } from '@/lib/health/jstyle/reader';
import { setPaired, clearPaired, type PairedBracelet } from '@/lib/health/jstyle/store';
import { braceletStatus, ago, type BraceletStatus } from '@/lib/health/jstyle/status';
import { lookFor, UNREACHABLE } from '@/lib/health/jstyle/presence';
import { isLive } from '@/lib/health/jstyle/live';
import { ensureBackgroundSync } from '@/lib/health/backgroundSync';
import { runSync, resetSyncThrottle, isSyncing } from '@/lib/health/sync';
import { useBracelet } from '@/hooks/useBracelet';

import DeviceStage, { type StageState } from '@/components/bracelet/DeviceStage';
import BraceletArt from '@/components/bracelet/BraceletArt';
import DevicePhoto, { hasPhoto } from '@/components/bracelet/DevicePhoto';
import StatusChips from '@/components/bracelet/StatusChips';
import DiscoveredRow from '@/components/bracelet/DiscoveredRow';
import ReadsList from '@/components/bracelet/ReadsList';
import LatestReadings from '@/components/bracelet/LatestReadings';
import LivePanel from '@/components/bracelet/LivePanel';

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
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();

    // From the store, and redrawn whenever anything writes it — a sync `autoSync.ts` started,
    // the background task, a failed connection. See `hooks/useBracelet.ts`.
    const { paired: stored, syncing: syncingElsewhere } = useBracelet();
    const paired = stored ?? null;
    const [blockedLoaded, setBlockedLoaded] = useState(false);
    const loading = stored === undefined || !blockedLoaded;
    const [scanning, setScanning] = useState(false);
    const [found, setFound] = useState<transport.DiscoveredBracelet[]>([]);
    const [blocked, setBlocked] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const [liveOn, setLiveOn] = useState(false);
    const [linked, setLinked] = useState(transport.isConnected());
    /** Heard advertising on this visit: true, false, or not listened yet. */
    const [nearby, setNearby] = useState<boolean | undefined>(undefined);
    const [checking, setChecking] = useState(false);

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
            setBlocked(await transport.scanBlockedReason());
            setBlockedLoaded(true);
        })();
        const off = transport.onLinkChange(setLinked);
        // A scan must not outlive the screen — it holds the radio open for a page nobody
        // is looking at.
        return () => { off(); endScan(); };
    }, [endScan]);

    const busy = syncing || syncingElsewhere;

    /**
     * Listen for it on every visit, so the status is something heard rather than remembered.
     * Not while a sync or live view holds it — a connected band does not advertise, and a scan
     * then would report it missing while it sits in a conversation with this phone.
     */
    const pairedId = paired?.id;
    useFocusEffect(useCallback(() => {
        if (!pairedId) return undefined;
        let live = true;
        (async () => {
            const reason = await transport.scanBlockedReason();
            if (!live) return;
            setBlocked(reason);
            if (reason || isSyncing() || isLive() || transport.isConnected()) return;
            setChecking(true);
            try {
                const seen = await lookFor();
                if (live) setNearby(seen);
            } finally {
                if (live) setChecking(false);
            }
        })().catch(() => undefined);
        return () => { live = false; };
    }, [pairedId]));

    // What a scan heard is overtaken by what a sync found: after one, its outcome is the truth.
    useEffect(() => { if (busy) setNearby(undefined); }, [busy]);

    const status = useMemo(
        () => (paired ? braceletStatus(paired, {
            syncing: busy, checking, connected: linked && !busy, nearby, bluetoothBlocked: blocked,
        }) : null),
        [paired, busy, checking, linked, nearby, blocked],
    );

    const startScan = useCallback(async () => {
        if (!(await transport.requestScanPermission())) {
            // An alert rather than `blocked`, which disables the button: once the person has
            // allowed it in Settings they need that button to try again.
            Alert.alert(
                'Allow Nearby devices',
                'Predyqt needs the Nearby devices permission to find your bracelet.',
                [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
                ],
            );
            return;
        }

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

            // An unanswered connection is already the notice above the button, with the
            // battery it last reported — repeating it here as one grey line said less, twice.
            setNote(
                bracelet?.ran
                    ? describeSync(bracelet.days, lastReadReport())
                    : bracelet?.reason === UNREACHABLE
                        ? null
                        : bracelet?.reason ?? UNREACHABLE,
            );
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

            // Through `reach` for its wording: a band that never answers should say so, not
            // "Operation timed out". Nothing is recorded — there is no pairing yet to record on.
            const presence = await import('@/lib/health/jstyle/presence');
            await presence.reach(device.id, session.makePacketHandler(variant));
            const reply = await session.ask(variant, 'getBattery');

            if (!reply.packets.length) {
                throw new Error(
                    'It connected but did not answer. Move it closer to your phone and try again.',
                );
            }

            const now = new Date().toISOString();
            const battery = map.readBattery(reply.packets);
            const record: PairedBracelet = {
                id: device.id,
                variant,
                // A V8 is ours whatever it is advertising; the first sync renames the band too.
                label: variant === 'v8' ? VARIANT_LABEL.v8 : device.name || VARIANT_LABEL[variant],
                pairedAt: now,
                lastSeenAt: now,
                lastAttempt: { at: now, outcome: 'ok' },
                ...(battery !== null ? { lastBattery: battery, batteryAt: now } : {}),
            };
            await setPaired(record);
            void ensureBackgroundSync();
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
                // The back of the band says V8, not our name.
                { text: `${VARIANT_LABEL.v8} (V8)`, onPress: () => pair(device, 'v8') },
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
                        setNote(null);
                        setNearby(undefined);
                        // Nothing left to sync in the background.
                        void ensureBackgroundSync();
                    },
                },
            ],
        );
    }, []);

    /**
     * The stage tells the same story as the chips. Sonar only while the radio really listens
     * (pairing scan, or the visit's check); the bracelet floats only while it is answering;
     * a bracelet that is not stands still on a dimmed floor.
     */
    const stage: StageState = !paired
        ? (scanning ? 'scanning' : 'idle')
        : checking ? 'scanning'
            : status && ['unreachable', 'not_seen', 'bluetooth'].includes(status.reach) ? 'idle'
                : 'connected';

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
                    <DeviceStage state={stage} battery={status?.battery?.pct}>
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

                    {paired && status
                        ? <Paired
                            device={paired}
                            status={status}
                            checking={checking}
                            syncing={busy}
                            liveOn={liveOn}
                            note={note}
                            onSync={() => sync()}
                            onForget={forget}
                            onLiveChange={setLiveOn}
                            // Closing live view is the moment to bring over whatever the
                            // bracelet recorded meanwhile, and to refresh the tiles.
                            onLiveStopped={() => { void sync(true); }}
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

const lastSynced = (iso?: string): string => (iso ? `Last synced ${ago(iso)}` : 'Not synced yet');

/**
 * The background task's last run, so somebody can see it working — or see that their phone is
 * not letting it run, which on Xiaomi, Huawei and Samsung is the default. A failure says what
 * failed in words; the library's own error ("Operation timed out") is not something anybody
 * can act on.
 */
const backgroundLine = (last?: PairedBracelet['lastBackgroundSync']): string => {
    if (!last) return 'Background sync: waiting for its first run (about hourly).';
    const when = ago(last.at);
    if (last.ran) return `Background sync ${when} — ${last.days ? `${last.days} day${last.days === 1 ? '' : 's'} updated` : 'nothing new'}.`;
    const reason = !last.reason || /timed out/i.test(last.reason) ? UNREACHABLE : last.reason;
    return `Background sync ${when} didn't finish. ${reason}`;
};

const ADVICE_ICON = (status: BraceletStatus): keyof typeof Ionicons.glyphMap => {
    if (status.reach === 'bluetooth') return 'bluetooth';
    if (status.likelyFlat) return 'battery-charging-outline';
    if (status.reach === 'unreachable') return 'alert-circle-outline';
    return 'battery-dead-outline';
};

const Paired = ({
    device, status, checking, syncing, liveOn, note, onSync, onForget, onLiveChange, onLiveStopped,
}: {
    device: PairedBracelet;
    status: BraceletStatus;
    checking: boolean;
    syncing: boolean;
    liveOn: boolean;
    note: string | null;
    onSync: () => void;
    onForget: () => void;
    onLiveChange: (on: boolean) => void;
    onLiveStopped: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
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

            <StatusChips
                battery={status.battery}
                reach={status.reach}
                reachLabel={status.reachLabel}
                checking={checking}
            />

            {status.advice ? (
                <View
                    style={[styles.advice, status.chip.tone === 'alert' && styles.adviceAlert]}
                    accessibilityRole="alert"
                >
                    <Ionicons
                        name={ADVICE_ICON(status)}
                        size={22}
                        color={status.chip.tone === 'alert' ? Palette.alert
                            : status.reach === 'bluetooth' ? Palette.textSecondary : Palette.amber}
                    />
                    <View style={styles.adviceText}>
                        <Text style={styles.adviceTitle}>{status.advice.title}</Text>
                        <Text style={styles.adviceBody}>{status.advice.body}</Text>
                    </View>
                </View>
            ) : null}

            <Text style={styles.timestamp}>{lastSynced(device.lastSyncAt)}</Text>
            <Text style={styles.timestamp}>{backgroundLine(device.lastBackgroundSync)}</Text>

            {note ? <Text style={styles.note}>{note}</Text> : null}

            <Pressable
                onPress={onSync}
                disabled={syncing || liveOn}
                accessibilityRole="button"
                style={({ pressed }) => [
                    styles.primary,
                    pressed && styles.primaryPressed,
                    (syncing || liveOn) && styles.disabled,
                ]}
            >
                {syncing
                    ? <ActivityIndicator color={Palette.white} />
                    : <Ionicons name="sync" size={18} color={Palette.white} />}
                <Text style={styles.primaryLabel}>
                    {syncing ? 'Syncing…' : status.reach === 'unreachable' ? 'Try again' : 'Sync now'}
                </Text>
            </Pressable>

            <LatestReadings latest={device.latest} />

            <LivePanel busy={syncing} onLiveChange={onLiveChange} onStopped={onLiveStopped} />

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
};

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
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    const [showOthers, setShowOthers] = useState(false);

    // Earbuds, TVs and a neighbour's phone are all named devices too. They stay one tap away
    // rather than hidden, because a bracelet sold under a name nobody has seen yet is exactly
    // what would otherwise be unreachable.
    const recognised = found.filter((d) => d.recognised);
    const others = found.filter((d) => !d.recognised);
    const listed = showOthers ? [...recognised, ...others] : recognised;

    return (
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
                    <Ionicons name="information-circle" size={20} color={Palette.textSecondary} />
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
                    color={Palette.white}
                />
                <Text style={styles.primaryLabel}>
                    {scanning ? 'Stop searching' : 'Find my bracelet'}
                </Text>
            </Pressable>

            {listed.length ? (
                <View style={styles.results}>
                    <Text style={styles.resultsHead}>
                        {listed.length} found · nearest first
                    </Text>
                    {listed.map((device) => (
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

            {others.length ? (
                <Pressable
                    onPress={() => setShowOthers((v) => !v)}
                    accessibilityRole="button"
                    style={styles.othersToggle}
                >
                    <Text style={styles.othersLabel}>
                        {showOthers
                            ? 'Hide other nearby devices'
                            : `Not listed? Show ${others.length} other nearby device${others.length === 1 ? '' : 's'}`}
                    </Text>
                </Pressable>
            ) : null}

            {!scanning && !recognised.length && !blocked ? (
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
};

const Tip = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.tip}>
            <Ionicons name={icon} size={16} color={Palette.textMuted} />
            <Text style={styles.tipText}>{text}</Text>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
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
    timestamp: { ...BodyFont.regular, fontSize: 13, color: Palette.textMuted, textAlign: 'center' },

    advice: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        backgroundColor: Palette.background, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Palette.borderLight,
        padding: Spacing.md, marginVertical: Spacing.sm, width: '100%',
    },
    // The kit's rose, never `danger`: a bracelet that will not answer is the app's problem to
    // report, not a verdict on anybody's health.
    adviceAlert: { backgroundColor: Palette.alertSurface, borderColor: Palette.alertSurface },
    adviceText: { flex: 1, gap: 2 },
    adviceTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    adviceBody: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, color: Palette.textSecondary },
    note: {
        ...BodyFont.medium, fontSize: 13, color: Palette.textSecondary,
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
        gap: Spacing.sm, backgroundColor: Palette.primaryFill,
        borderRadius: Radius.lg, paddingVertical: 16,
        width: '100%', marginTop: Spacing.md,
    },
    primaryPressed: { backgroundColor: Palette.primaryDarkFill },
    disabled: { opacity: 0.5 },
    primaryLabel: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.white },

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

    othersToggle: { alignSelf: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
    othersLabel: { ...BodyFont.medium, fontSize: 14, color: Palette.primary },

    tips: { width: '100%', gap: Spacing.sm, marginTop: Spacing.xl },
    tip: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    tipText: {
        flex: 1, ...BodyFont.regular, fontSize: 13,
        color: Palette.textMuted, lineHeight: 19,
    },
}));
