/**
 * Everything one day's rollup actually holds, as a tile grid.
 *
 * The dashboard used to draw two figures — active minutes and the range's average burn —
 * out of the eleven `DailyMetrics` stores, so a phone that had synced steps, distance,
 * floors and a full day of heart rate showed none of it. This renders what is there.
 *
 * **A missing figure is dropped, never zeroed.** Health Connect and HealthKit both report
 * per data type, and a partial grant is the ordinary case: someone who shared steps and
 * refused heart rate has no heart rate, which is not the same fact as a resting pulse of
 * zero. Tiles are built from what is present, and the grid disappears entirely on a day
 * nothing reported rather than drawing a wall of dashes.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { formatDistance, type DayMetrics } from '@/lib/activity';

interface Tile {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    label: string;
    value: string;
    unit?: string;
}

const num = (v: unknown): v is number => Number.isFinite(v as number);

/** Thousands separators, because a five-digit step count is unreadable without them. */
const grouped = (v: number) => Math.round(v).toLocaleString();

export const tilesFor = (metrics: DayMetrics | null): Tile[] => {
    if (!metrics) return [];

    const a = metrics.activity || ({} as DayMetrics['activity']);
    const h = metrics.heart || ({} as DayMetrics['heart']);
    const tiles: Tile[] = [];

    if (num(a.steps)) {
        tiles.push({ key: 'steps', icon: 'footsteps-outline', tint: Palette.primary, label: 'Steps', value: grouped(a.steps) });
    }

    const distance = formatDistance(a.distanceM);
    if (distance) {
        tiles.push({ key: 'distance', icon: 'navigate-outline', tint: Palette.indigo, label: 'Distance', value: distance });
    }

    if (num(a.activeKcal)) {
        tiles.push({ key: 'active', icon: 'flame-outline', tint: Palette.amber, label: 'Active burn', value: grouped(a.activeKcal), unit: 'kcal' });
    }

    if (num(a.restingKcal)) {
        tiles.push({ key: 'resting', icon: 'bed-outline', tint: Palette.textSecondary, label: 'Resting burn', value: grouped(a.restingKcal), unit: 'kcal' });
    }

    if (num(a.exerciseMin) && a.exerciseMin > 0) {
        tiles.push({ key: 'exercise', icon: 'stopwatch-outline', tint: Palette.success, label: 'Active minutes', value: String(Math.round(a.exerciseMin)), unit: 'min' });
    }

    if (num(a.floors) && a.floors > 0) {
        tiles.push({ key: 'floors', icon: 'trending-up-outline', tint: Palette.success, label: 'Floors', value: grouped(a.floors) });
    }

    if (num(h.restingBpm)) {
        tiles.push({ key: 'resting-hr', icon: 'heart-outline', tint: Palette.danger, label: 'Resting heart rate', value: String(Math.round(h.restingBpm)), unit: 'bpm' });
    }

    if (num(h.avgBpm)) {
        tiles.push({ key: 'avg-hr', icon: 'pulse-outline', tint: Palette.danger, label: 'Average heart rate', value: String(Math.round(h.avgBpm)), unit: 'bpm' });
    }

    // One tile, because a low and a high on their own read as two unrelated numbers where
    // the pair reads as the day's range.
    if (num(h.minBpm) && num(h.maxBpm)) {
        tiles.push({
            key: 'hr-range',
            icon: 'analytics-outline',
            tint: Palette.danger,
            label: 'Heart rate range',
            value: `${Math.round(h.minBpm)}–${Math.round(h.maxBpm)}`,
            unit: 'bpm',
        });
    }

    if (num(h.hrvMs)) {
        tiles.push({ key: 'hrv', icon: 'git-compare-outline', tint: Palette.info, label: 'Heart rate variability', value: String(Math.round(h.hrvMs)), unit: 'ms' });
    }

    return tiles;
};

interface Props {
    metrics: DayMetrics | null;
    /** Shown in place of the grid when nothing reported. Written to be read by a person. */
    emptyNote?: string;
}

export function DayStats({ metrics, emptyNote }: Props) {
    const tiles = tilesFor(metrics);

    if (tiles.length === 0) {
        if (!emptyNote) return null;
        return (
            <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={18} color={Palette.textMuted} />
                <Text style={styles.emptyText}>{emptyNote}</Text>
            </View>
        );
    }

    return (
        <View style={styles.grid}>
            {tiles.map((t) => (
                <View key={t.key} style={styles.tile}>
                    <Ionicons name={t.icon} size={16} color={t.tint} />
                    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {t.value}
                        {t.unit ? <Text style={styles.unit}> {t.unit}</Text> : null}
                    </Text>
                    <Text style={styles.label} numberOfLines={2}>{t.label}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    tile: {
        // Three to a row at phone widths, and the last row is left-aligned rather than
        // stretched — a lone stretched tile reads as a different kind of thing.
        flexGrow: 1,
        flexBasis: '30%',
        minWidth: 96,
        gap: 4,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    value: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    unit: { fontSize: 11, fontFamily: Fonts.medium, color: Palette.textSecondary },
    label: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },

    empty: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    emptyText: { flex: 1, fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
});
