/**
 * What this bracelet actually reads.
 *
 * Fills the space under the paired panel with the one fact that is otherwise invisible:
 * **the two models do not collect the same things.** The V8 has no axillary-temperature
 * command in either of its SDKs, and its Android SDK cannot read a manual SpO2 history at
 * all. Somebody comparing their band against the box, or against a friend's, has no way to
 * discover that from anywhere else in the app.
 *
 * Every row here is derived from `capabilities()` — the same table `session.readSeries`
 * guards every read with — rather than from a list typed out beside it. A hand-written list
 * would drift the first time a vendor SDK gains a command, and it would drift *silently*,
 * which is the failure mode this codebase keeps designing against: a screen promising a
 * measurement nothing collects.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { capabilities, type JstyleCommand, type JstyleVariant } from '@/modules/jstyle-ble';

/**
 * Commands grouped into the families a person recognises.
 *
 * A family appears when the bracelet can encode **any** of its commands, because
 * `getStaticHr` and `getDynamicHr` are both "heart rate" to everyone but the protocol.
 */
const FAMILIES: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    commands: JstyleCommand[];
}[] = [
    { label: 'Steps & activity', icon: 'walk-outline', commands: ['getTotalActivity', 'getDetailActivity'] },
    { label: 'Sleep stages', icon: 'moon-outline', commands: ['getDetailSleep'] },
    { label: 'Heart rate', icon: 'heart-outline', commands: ['getStaticHr', 'getDynamicHr'] },
    { label: 'HRV & blood pressure', icon: 'pulse-outline', commands: ['getHrv'] },
    { label: 'Blood oxygen', icon: 'water-outline', commands: ['getAutoSpo2', 'getManualSpo2'] },
    { label: 'Skin temperature', icon: 'thermometer-outline', commands: ['getTemperature'] },
    { label: 'Body temperature', icon: 'thermometer', commands: ['getAxillaryTemperature'] },
    { label: 'ECG', icon: 'analytics-outline', commands: ['ppg'] },
];

export default function ReadsList({ variant }: { variant: JstyleVariant }) {
    const Palette = usePalette();
    const styles = useStyles();
    const available = useMemo(() => {
        try {
            const set = new Set(capabilities(variant).commands);
            return FAMILIES.filter((f) => f.commands.some((c) => set.has(c)));
        } catch {
            // No native module in this build — the same state every screen here already
            // handles. A list of nothing is better than a list that might be wrong.
            return [];
        }
    }, [variant]);

    if (!available.length) return null;

    return (
        <View style={styles.wrap}>
            <Text style={styles.head}>What this bracelet reads</Text>
            <View style={styles.grid}>
                {available.map((family) => (
                    <View key={family.label} style={styles.pill}>
                        <Ionicons name={family.icon} size={15} color={Palette.textSecondary} />
                        <Text style={styles.label}>{family.label}</Text>
                    </View>
                ))}
            </View>
            {/*
              * The ECG caveat travels with the list, because the list is where somebody
              * learns the bracelet takes one. `EcgRecording` stores the device's own
              * numbers and nothing in Predyqt interprets a trace — the line the symptom
              * checker holds when it refuses to name a condition.
              */}
            <Text style={styles.footnote}>
                Readings come from the bracelet&apos;s own sensors. Predyqt stores them and
                shows them; it does not diagnose.
            </Text>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    wrap: { width: '100%', marginTop: Spacing.xl },
    head: {
        fontFamily: Fonts.semibold, fontSize: 14, color: Palette.textSecondary,
        marginBottom: Spacing.sm,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.borderLight,
        borderRadius: Radius.pill,
        paddingVertical: 8, paddingHorizontal: 12,
    },
    // `fontFamily` without `fontWeight`: Android renders the pair as regular.
    label: { ...BodyFont.medium, fontSize: 13, color: Palette.text },
    footnote: {
        ...BodyFont.regular, fontSize: 12, color: Palette.textMuted,
        lineHeight: 18, marginTop: Spacing.md,
    },
}));
