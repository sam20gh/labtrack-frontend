/**
 * The newest reading of each kind the bracelet has handed over.
 *
 * Read from `PairedBracelet.latest`, which the reader writes from every sync, so this draws
 * instantly and without the network — the same reason the battery chip reads `lastBattery`.
 *
 * Three rules:
 *
 * 1. **A family with no reading is not drawn.** A tile reading "—" for SpO2 on a band that
 *    has not measured any yet says less than no tile, and says it in the space of a real one.
 * 2. **Every value carries its age.** A heart rate from nine hours ago in the same type as
 *    one from nine seconds ago reads as the current one.
 * 3. **The blood pressure says it is an estimate.** It comes off the pulse wave, not a cuff —
 *    `MetricLog.method` records that on every row, and the screen has to say it too.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { LatestReadings as Latest, Stamped } from '@/lib/health/jstyle/store';

const ago = (at: string): string => {
    // Day-level figures (HRV, steps) are stamped with a date, not an instant.
    if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        return at === key ? 'Today' : new Date(`${at}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }
    const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

interface Tile {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    unit: string;
    at: string;
}

const tiles = (latest: Latest): Tile[] => {
    const out: Tile[] = [];
    const add = <T,>(
        key: string, label: string, icon: Tile['icon'], reading: Stamped<T> | undefined,
        format: (v: T) => string, unit: string,
    ) => {
        if (reading) out.push({ key, label, icon, value: format(reading.value), unit, at: reading.at });
    };

    add('hr', 'Heart rate', 'heart-outline', latest.heartRate, (v) => String(Math.round(v)), 'bpm');
    add('spo2', 'Blood oxygen', 'water', latest.spo2, (v) => String(Math.round(v)), '%');
    add('temp', 'Skin temperature', 'thermometer-outline', latest.temperature, (v) => v.toFixed(1), '°C');
    add('hrv', 'HRV', 'pulse-outline', latest.hrv, (v) => String(Math.round(v)), 'ms');
    // The bracelet's own score, uncoloured here: the colour needs the person's usual, which only
    // the server holds. The Stress screen draws it.
    add('stress', 'Stress', 'flash-outline', latest.stress, (v) => String(Math.round(v)), '');
    add('bp', 'Blood pressure (estimate)', 'speedometer-outline', latest.bloodPressure,
        (v) => `${v.systolic}/${v.diastolic}`, 'mmHg');
    add('steps', 'Steps', 'walk-outline', latest.steps, (v) => v.toLocaleString(), '');
    return out;
};

export default function LatestReadings({ latest }: { latest?: Latest }) {
    const Palette = usePalette();
    const styles = useStyles();
    const list = latest ? tiles(latest) : [];

    return (
        <View style={styles.wrap}>
            <Text style={styles.head}>Latest from your bracelet</Text>
            {list.length ? (
                <View style={styles.grid}>
                    {list.map((t) => (
                        <View key={t.key} style={styles.tile} accessible accessibilityLabel={`${t.label} ${t.value} ${t.unit}, ${ago(t.at)}`}>
                            <View style={styles.tileHead}>
                                <Ionicons name={t.icon} size={15} color={Palette.textSecondary} />
                                <Text style={styles.label} numberOfLines={1}>{t.label}</Text>
                            </View>
                            <Text style={styles.value}>
                                {t.value}
                                {t.unit ? <Text style={styles.unit}> {t.unit}</Text> : null}
                            </Text>
                            <Text style={styles.at}>{ago(t.at)}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={styles.empty}>
                    Nothing yet. Sync, or open live view to take a reading now.
                </Text>
            )}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    wrap: { width: '100%', marginTop: Spacing.lg, gap: Spacing.sm },
    head: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tile: {
        // Two per row with the gap between them.
        flexBasis: '48%', flexGrow: 1,
        backgroundColor: Palette.background, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Palette.borderLight,
        padding: Spacing.md, gap: 4,
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { flex: 1, ...BodyFont.medium, fontSize: 12, color: Palette.textSecondary },
    value: { fontFamily: Fonts.bold, fontSize: 22, color: Palette.text },
    unit: { ...BodyFont.regular, fontSize: 13, color: Palette.textSecondary },
    at: { ...BodyFont.regular, fontSize: 12, color: Palette.textMuted },
    empty: { ...BodyFont.regular, fontSize: 14, color: Palette.textMuted, lineHeight: 20 },
}));
