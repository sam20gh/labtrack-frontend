/**
 * The two facts under a device's name.
 *
 * `Design/device.svg` draws a lightning bolt with a percentage and a link glyph with
 * Connected / Not Connected, and this is the first screen in Predyqt where **both are
 * true**.
 *
 * That is worth stating plainly, because `app/activity/sources.tsx` refuses to draw either
 * of them and says why: neither HealthKit nor Health Connect exposes a paired watch's
 * battery or its online state, so the kit's device card was a battery bar that would read
 * 90% forever — the dummy control this codebase keeps removing.
 *
 * A bracelet is different in kind. It is a BLE peer this app connects to itself, so
 * `getBattery` is a real command with a real answer, and connection state is something the
 * radio knows this instant. The kit's composition finally has data behind it.
 *
 * Which is exactly why `battery` is optional here and renders **nothing** when absent,
 * rather than falling back to a placeholder. Before the first handshake there is no figure,
 * and a chip reading "—%" is the same lie in punctuation.
 *
 * **Both chips carry their evidence** (since 2026-10-12, `lib/health/jstyle/status.ts`). The
 * link chip used to be passed `connected` whenever a bracelet was paired, and read "Connected"
 * over a bracelet that had been flat for a day. It now says what is known — Connected only
 * while a link is open, Nearby when heard just now, Can't reach when the last attempt went
 * unanswered — and the battery carries its age once it is more than a few hours old.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Fonts, Spacing, activePalette } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import {
    CRITICAL_BATTERY, LOW_BATTERY, shortAgo, type BatteryFact, type Reach,
} from '@/lib/health/jstyle/status';

/** Amber under 30%, rose under 15%. Matches the platform ring on `DeviceStage`. */
const batteryTone = (pct: number): string => {
    if (pct < CRITICAL_BATTERY) return activePalette().danger;
    if (pct < LOW_BATTERY) return activePalette().amber;
    return activePalette().success;
};

const batteryIcon = (pct: number): keyof typeof Ionicons.glyphMap => {
    if (pct < CRITICAL_BATTERY) return 'battery-dead-outline';
    if (pct < 60) return 'battery-half-outline';
    return 'battery-full-outline';
};

const REACH_ICON: Record<Reach, keyof typeof Ionicons.glyphMap> = {
    bluetooth: 'bluetooth',
    syncing: 'sync',
    connected: 'link',
    checking: 'search',
    nearby: 'radio-outline',
    unreachable: 'unlink-outline',
    not_seen: 'unlink-outline',
    seen: 'time-outline',
    unknown: 'time-outline',
};

const reachTone = (reach: Reach, checking: boolean): string => {
    const P = activePalette();
    if (checking || reach === 'syncing' || reach === 'checking') return P.primary;
    if (reach === 'connected' || reach === 'nearby') return P.success;
    if (reach === 'unreachable') return P.alert;
    if (reach === 'seen') return P.textSecondary;
    return P.textMuted;
};

interface Props {
    battery: BatteryFact | null;
    reach: Reach;
    /** What `braceletStatus` calls it — may say "Looking for it…" over a stale failure. */
    reachLabel: string;
    /** The screen is listening for it right now. */
    checking?: boolean;
}

export default function StatusChips({ battery, reach, reachLabel, checking = false }: Props) {
    const styles = useStyles();
    const tone = reachTone(reach, checking);
    return (
        <View style={styles.row}>
            {battery ? (
                <>
                    <View
                        style={styles.chip}
                        accessible
                        accessibilityLabel={`Battery ${battery.pct}%${battery.stale && battery.at ? `, read ${shortAgo(battery.at)}` : ''}`}
                    >
                        <Ionicons
                            name={batteryIcon(battery.pct)}
                            size={16}
                            // A stale figure keeps its colour — a low one is still the reason
                            // to charge — and says its age beside it.
                            color={batteryTone(battery.pct)}
                        />
                        <Text style={[styles.label, { color: batteryTone(battery.pct) }]}>
                            {battery.pct}%
                        </Text>
                        {battery.stale && battery.at ? (
                            <Text style={styles.age}>· {shortAgo(battery.at)}</Text>
                        ) : null}
                    </View>
                    <View style={styles.dot} />
                </>
            ) : null}

            <View style={styles.chip} accessible accessibilityLabel={reachLabel}>
                <Ionicons
                    name={checking ? REACH_ICON.checking : REACH_ICON[reach]}
                    size={16}
                    color={tone}
                />
                <Text style={[styles.label, { color: tone }]}>{reachLabel}</Text>
            </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    // `fontFamily` without `fontWeight`: Android cannot synthesise a weight from a custom
    // face, so the pair renders regular on Android and a fake bold on iOS.
    label: { fontFamily: Fonts.semibold, fontSize: 14 },
    age: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.textMuted },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Palette.textMuted },
}));
