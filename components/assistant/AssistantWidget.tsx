/**
 * The card an assistant reply carries.
 *
 * The kit ships 23 card variants — hydration, sleep, blood pressure, medications, route
 * map, and so on. They are not 23 layouts: nearly all of them are a titled shell holding
 * some combination of value tiles, list rows, and a progress bar, differing in accent and
 * icon. This renders that shell once and lets `kind` choose the trimmings, which is why the
 * backend schema can add a card type without a new component here.
 *
 * Clinical flags reuse `FlagColors` rather than local hex, so a value the assistant calls
 * high is the same colour as the same value on the results screen. Two different reds for
 * one measurement is how people stop trusting the colour.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts, FlagColors } from '@/constants/theme';
import type { AssistantWidget as Widget, WidgetKind, WidgetStat, WidgetRow, Flag } from '@/lib/assistant';

/** Icon per card kind. Purely decorative — the title carries the meaning. */
const ICONS: Record<WidgetKind, keyof typeof Ionicons.glyphMap> = {
    biomarker: 'water-outline',
    trend: 'trending-up-outline',
    health_score: 'shield-checkmark-outline',
    screenings: 'calendar-outline',
    professionals: 'people-outline',
    products: 'flask-outline',
    medications: 'medkit-outline',
    goal: 'flag-outline',
    summary: 'stats-chart-outline',
};

const flagStyle = (flag: Flag | null) => (flag ? FlagColors[flag] ?? FlagColors.unknown : null);

const StatTile = ({ label, value, unit, flag }: WidgetStat) => {
    const meta = flagStyle(flag);
    return (
        <View style={[styles.stat, meta ? { backgroundColor: meta.bg } : styles.statPlain]}>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.statValueRow}>
                <Text style={[styles.statValue, meta ? { color: meta.color } : null]} numberOfLines={1}>
                    {value}
                </Text>
                {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
            </View>
        </View>
    );
};

const Row = ({ title, subtitle, meta, flag }: WidgetRow) => {
    const tone = flagStyle(flag);
    return (
        <View style={styles.row}>
            {/* A flag on a row becomes a colour rail rather than a badge — rows are dense
                and a badge per line turns the card into confetti. */}
            <View style={[styles.rowRail, { backgroundColor: tone ? tone.color : Palette.border }]} />
            <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
    );
};

const ProgressBar = ({ label, value, max }: NonNullable<Widget['progress']>) => {
    // Guard the denominator and the overshoot: a model-supplied max of 0 would make this
    // NaN, and a value above max would draw a bar past the end of its track.
    const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    return (
        <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{label}</Text>
                <Text style={styles.progressValue}>
                    {value}
                    <Text style={styles.progressMax}> / {max}</Text>
                </Text>
            </View>
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
            </View>
        </View>
    );
};

export default function AssistantWidgetCard({ widget }: { widget: Widget }) {
    const stats = widget.stats ?? [];
    const rows = widget.rows ?? [];

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconBadge}>
                    <Ionicons name={ICONS[widget.kind] ?? 'sparkles-outline'} size={16} color={Palette.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={2}>{widget.title}</Text>
                    {widget.subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={2}>{widget.subtitle}</Text>
                    ) : null}
                </View>
            </View>

            {stats.length ? (
                <View style={styles.statGrid}>
                    {stats.map((s, i) => <StatTile key={`${s.label}-${i}`} {...s} />)}
                </View>
            ) : null}

            {widget.progress ? <ProgressBar {...widget.progress} /> : null}

            {rows.length ? (
                <View style={styles.rows}>
                    {rows.map((r, i) => <Row key={`${r.title}-${i}`} {...r} />)}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.white,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        marginTop: Spacing.sm,
        gap: Spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    iconBadge: {
        width: 30,
        height: 30,
        borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 17 },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    stat: {
        // Two per row at any phone width, with the gap accounted for. `flexBasis` rather
        // than a fixed width so a third short stat wraps instead of overflowing.
        flexGrow: 1,
        flexBasis: '46%',
        borderRadius: Radius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        gap: 2,
    },
    statPlain: { backgroundColor: Palette.surface },
    statLabel: { fontSize: 11, fontFamily: Fonts.medium, color: Palette.textSecondary },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    statValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    statUnit: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },

    rows: { gap: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowRail: { width: 3, alignSelf: 'stretch', minHeight: 28, borderRadius: 2 },
    rowBody: { flex: 1, gap: 1 },
    rowTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    rowSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    rowMeta: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },

    progressBlock: { gap: Spacing.sm },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    progressLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    progressValue: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    progressMax: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    progressTrack: {
        height: 8,
        borderRadius: Radius.pill,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Palette.primary },
});
