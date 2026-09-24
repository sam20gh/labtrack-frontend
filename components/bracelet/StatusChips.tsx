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
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Fonts, Spacing } from '@/constants/theme';

/** Amber under 30%, rose under 15%. Matches the platform ring on `DeviceStage`. */
const batteryTone = (pct: number): string => {
    if (pct < 15) return Palette.danger;
    if (pct < 30) return Palette.amber;
    return Palette.success;
};

const batteryIcon = (pct: number): keyof typeof Ionicons.glyphMap => {
    if (pct < 15) return 'battery-dead-outline';
    if (pct < 60) return 'battery-half-outline';
    return 'battery-full-outline';
};

interface Props {
    battery?: number;
    connected: boolean;
    /** Replaces the connection chip while a sync is mid-flight. */
    busy?: boolean;
}

export default function StatusChips({ battery, connected, busy }: Props) {
    return (
        <View style={styles.row}>
            {typeof battery === 'number' ? (
                <>
                    <View style={styles.chip}>
                        <Ionicons
                            name={batteryIcon(battery)}
                            size={16}
                            color={batteryTone(battery)}
                        />
                        <Text style={[styles.label, { color: batteryTone(battery) }]}>
                            {Math.round(battery)}%
                        </Text>
                    </View>
                    <View style={styles.dot} />
                </>
            ) : null}

            <View style={styles.chip}>
                <Ionicons
                    name={connected ? 'link' : 'unlink-outline'}
                    size={16}
                    color={connected ? Palette.success : Palette.textMuted}
                />
                <Text
                    style={[
                        styles.label,
                        { color: connected ? Palette.success : Palette.textMuted },
                    ]}
                >
                    {busy ? 'Syncing…' : connected ? 'Connected' : 'Not connected'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    // `fontFamily` without `fontWeight`: Android cannot synthesise a weight from a custom
    // face, so the pair renders regular on Android and a fake bold on iOS.
    label: { fontFamily: Fonts.semibold, fontSize: 14 },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Palette.textMuted },
});
