/**
 * One bracelet the scan has found.
 *
 * The kit's list card (frame 0) with the thumbnail replaced by a signal meter, because the
 * two screens are answering different questions. A *linked* device is identified by what it
 * is, so a product shot is the right thing in the slot. A *discovered* device is being
 * chosen between several, and every one of them is the same anonymous band — three
 * identical thumbnails would tell nobody which is theirs.
 *
 * What does tell them is proximity. RSSI is the only thing that distinguishes the bracelet
 * in somebody's hand from their flatmate's in the next room, so it gets the slot.
 */
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { JstyleVariant } from '@/modules/jstyle-ble';

/**
 * RSSI in dBm, as bars.
 *
 * Thresholds are the usual BLE rules of thumb: better than −60 is arm's length, −75 is the
 * same room, below that is through a wall. Shown as bars rather than the raw figure —
 * "−67 dBm" is precise and means nothing to the person holding the bracelet.
 */
const bars = (rssi: number | null): number => {
    if (rssi === null) return 0;
    if (rssi > -60) return 3;
    if (rssi > -75) return 2;
    return 1;
};

const proximity = (rssi: number | null): string => {
    switch (bars(rssi)) {
        case 3: return 'Right here';
        case 2: return 'Nearby';
        case 1: return 'Far away';
        default: return 'Signal unknown';
    }
};

interface Props {
    name: string | null;
    rssi: number | null;
    variant: JstyleVariant | null;
    variantLabel: string | null;
    busy?: boolean;
    onPress: () => void;
}

export default function DiscoveredRow({
    name, rssi, variant, variantLabel, busy, onPress,
}: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const strength = bars(rssi);

    return (
        <Pressable
            onPress={onPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${name || 'Unnamed bracelet'}, ${proximity(rssi)}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
            <View style={styles.meter}>
                {[0, 1, 2].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.bar,
                            { height: 9 + i * 6 },
                            i < strength ? styles.barOn : styles.barOff,
                        ]}
                    />
                ))}
            </View>

            <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                    {name || 'Unnamed bracelet'}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {/*
                      * When the advertisement does not name a model, this says so rather
                      * than guessing. Picking the wrong variant does not fail — it decodes
                      * every reading afterwards with the wrong table.
                      */}
                    {!variant
                        ? `Tap to choose model · ${proximity(rssi)}`
                        // Same duplication guard the paired panel makes: most of these
                        // bracelets advertise their model as their name, so printing the
                        // model again under it says the same thing twice.
                        : name === variantLabel
                            ? proximity(rssi)
                            : `${variantLabel} · ${proximity(rssi)}`}
                </Text>
            </View>

            {busy
                ? <ActivityIndicator color={Palette.primary} />
                : <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />}
        </Pressable>
    );
}

const useStyles = makeStyles((Palette) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderLight,
        padding: Spacing.md,
    },
    pressed: { backgroundColor: Palette.surfaceWarm },
    meter: {
        width: 44, height: 44, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
        gap: 3, paddingBottom: 13,
    },
    bar: { width: 4, borderRadius: 2 },
    barOn: { backgroundColor: Palette.primaryFill },
    barOff: { backgroundColor: Palette.primaryPale },
    text: { flex: 1 },
    name: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    meta: { ...BodyFont.regular, fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
}));
