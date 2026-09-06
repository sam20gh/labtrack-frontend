/**
 * The small pieces the prediction screens all share: the confidence chip, the horizon tabs,
 * the change badge, and the disclaimer line.
 *
 * One file rather than four, because each is a dozen lines and they are only ever used
 * together — the split that matters here is between *these* and the charts, not between one
 * chip and the next.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Radius, Spacing } from '@/constants/theme';
import {
    confidenceLabel, confidencePct, toneColour, toneSurface, DIRECTION_ICON,
    type Direction, type BetterWhen, type Horizon, type Band,
} from '@/lib/prediction';

/**
 * "98% confidence level", as the design prints it — and its wording changes below 0.6.
 *
 * The number is the forecast's own, computed from residual scatter, sample count, how far the
 * horizon reaches past the data and how stale the last reading is. Printing it without the
 * word that interprets it would leave "41%" on screen for somebody to read as a probability
 * of illness.
 */
export function ConfidenceChip({ value, compact = false }: { value: number; compact?: boolean }) {
    const { label, colour, weak } = confidenceLabel(value);
    return (
        <View style={[styles.confidence, { borderColor: weak ? Palette.warning : Palette.border }]}>
            <Ionicons name={weak ? 'alert-circle-outline' : 'shield-checkmark-outline'} size={13} color={colour} />
            <Text style={[styles.confidenceText, { color: colour }]}>
                {confidencePct(value)}{compact ? '' : ` · ${label.toLowerCase()}`}
            </Text>
        </View>
    );
}

/** The design's Next 1d / 1w / 1m / 1y selector. */
export function HorizonTabs({
    horizons, value, onChange,
}: {
    horizons: Horizon[];
    value: string;
    onChange: (id: string) => void;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabTrack}
        >
            {horizons.map((h) => {
                const active = h.id === value;
                return (
                    <Pressable
                        key={h.id}
                        onPress={() => onChange(h.id)}
                        style={[styles.tab, active && styles.tabActive]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                    >
                        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{h.label}</Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/**
 * The green ▲15% / red ▼2.3% badge from the details screen.
 *
 * Coloured by `betterWhen`, never by the sign. A 15% rise in resting heart rate is not good
 * news and must not be drawn in the same green as a 15% rise in a step count.
 */
export function ChangeBadge({
    changePct, direction, betterWhen,
}: {
    changePct: number | null;
    direction: Direction;
    betterWhen: BetterWhen;
}) {
    if (changePct === null || direction === 'flat') {
        return (
            <View style={[styles.badge, { backgroundColor: Palette.surface }]}>
                <Ionicons name="remove" size={12} color={Palette.textSecondary} />
                <Text style={[styles.badgeText, { color: Palette.textSecondary }]}>no change</Text>
            </View>
        );
    }

    const colour = toneColour(direction, betterWhen);
    return (
        <View style={[styles.badge, { backgroundColor: toneSurface(direction, betterWhen) }]}>
            <Ionicons name={DIRECTION_ICON[direction]} size={12} color={colour} />
            <Text style={[styles.badgeText, { color: colour }]}>{Math.abs(changePct)}%</Text>
        </View>
    );
}

/**
 * The clinical band of the predicted value.
 *
 * A crisis band is drawn with its own icon and never as one more warm shade — the rule
 * `bloodPressure.isCrisis` holds on the server and which would be lost here if this rendered
 * every band identically.
 */
export function BandChip({ band }: { band: Band | null }) {
    if (!band) return null;
    const colour = band.crisis ? Palette.danger : Palette.textSecondary;
    return (
        <View style={[styles.bandChip, band.crisis && styles.bandChipCrisis]}>
            {band.crisis ? <Ionicons name="warning" size={13} color={Palette.danger} /> : null}
            <Text style={[styles.bandChipText, { color: band.crisis ? Palette.danger : colour }]}>
                {band.label}
            </Text>
        </View>
    );
}

/**
 * The line that travels with every prediction, everywhere.
 *
 * The same call `SAFETY_FOOTER` makes in the medication checker: a projection shown without
 * it has claimed to be a measurement of the future.
 */
export function PredictionDisclaimer({ text, tone = 'quiet' }: { text: string; tone?: 'quiet' | 'card' }) {
    return (
        <View style={tone === 'card' ? styles.disclaimerCard : undefined}>
            <Text style={styles.disclaimer}>{text}</Text>
        </View>
    );
}

/** The design's "AI-Generated Prediction" pill on the details hero. */
export function GeneratedPill({ degraded }: { degraded?: boolean }) {
    return (
        <View style={styles.generated}>
            <Text style={styles.generatedText}>
                {degraded ? 'Statistical prediction' : 'AI-Generated Prediction'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    confidence: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.sm, borderWidth: 1, backgroundColor: Palette.white,
    },
    confidenceText: { fontSize: 12, fontFamily: Fonts.medium },

    tabTrack: { gap: 4, padding: 4, backgroundColor: Palette.borderLight, borderRadius: 12 },
    tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9 },
    tabActive: {
        backgroundColor: Palette.white,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    tabLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tabLabelActive: { fontFamily: Fonts.semibold, color: Palette.text },

    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm,
    },
    badgeText: { fontSize: 12, fontFamily: Fonts.semibold },

    bandChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4,
        borderRadius: Radius.pill, backgroundColor: Palette.surface,
    },
    bandChipCrisis: { backgroundColor: Palette.dangerSurface },
    bandChipText: { fontSize: 12, fontFamily: Fonts.semibold },

    disclaimer: {
        fontSize: 11, lineHeight: 16, fontFamily: Fonts.regular,
        color: Palette.textMuted, textAlign: 'center',
    },
    disclaimerCard: {
        backgroundColor: Palette.surface, borderRadius: Radius.lg,
        padding: Spacing.md, marginTop: Spacing.md,
    },

    generated: {
        alignSelf: 'flex-start', backgroundColor: Palette.white,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm,
    },
    generatedText: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.text },
});
