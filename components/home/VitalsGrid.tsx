/**
 * Vitals — what the Today readout does not cover, as a two-column grid.
 *
 * It replaced the Health Metrics carousel. Heart rate, HRV, temperature, sleep and steps moved
 * into the readout's rings; what is left are readings with their own time scale (a weigh-in,
 * a cuff reading, a day's water), and each says how it compares rather than standing as a
 * bare number. `status` is the server's own wording from `/metrics/overview`, so a tile and
 * the metric's screen cannot disagree.
 *
 * Two rules the carousel broke:
 *
 * 1. **Each tile opens its own metric** (`metricRoute`), not the list. Tapping 118/76 and
 *    arriving on a page of ten cards is a tap that did not do what it said.
 * 2. **Earned by a reading.** A tile with no value is not drawn — the metrics page is where
 *    an unmeasured metric invites a first entry. An odd tile out spans the full width rather
 *    than sitting alone in half a row.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, Radius, Fonts, BodyFont, tone } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { metricIcon, metricTint, type MetricCard } from '@/lib/metrics';
import { presentMetric, useUnits } from '@/lib/units';
import { VITAL_KEYS } from '@/lib/readout';


interface Props {
    cards: MetricCard[];
    onOpen: (card: MetricCard) => void;
}

/** The cards this grid would draw, so the caller can decide whether to draw a section at all. */
export const vitalCards = (cards: MetricCard[]) => VITAL_KEYS
    .map((key) => cards.find((c) => c.key === key))
    .filter((c): c is MetricCard => Boolean(c) && c!.value !== null);

export default function VitalsGrid({ cards, onOpen }: Props) {
    const styles = useStyles();
    useUnits(); // redraw when the unit preference changes
    const shown = vitalCards(cards);
    if (!shown.length) return null;

    return (
        <View style={styles.grid}>
            {shown.map((card, i) => (
                <VitalTile
                    key={card.key}
                    card={card}
                    wide={shown.length % 2 === 1 && i === shown.length - 1}
                    onPress={() => onOpen(card)}
                />
            ))}
        </View>
    );
}

const VitalTile = ({ card, wide, onPress }: { card: MetricCard; wide: boolean; onPress: () => void }) => {
    const Palette = usePalette();
    const styles = useStyles();
    const tint = metricTint(card.key, Palette);
    const shown = presentMetric(card.key, card.value, card.unit);
    const value = typeof shown.value === 'number' ? Math.round(shown.value * 10) / 10 : shown.value;

    return (
        <TouchableOpacity
            style={[styles.tile, wide && styles.wide]}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${card.label} ${value ?? ''} ${shown.unit}, ${card.status}`}
        >
            <View style={styles.head}>
                <Ionicons name={metricIcon(card.key) as any} size={15} color={tint} />
                <Text style={styles.label} numberOfLines={1}>{card.label}</Text>
            </View>
            <Text style={styles.value} numberOfLines={1}>
                {value}<Text style={styles.unit}> {shown.unit}</Text>
            </Text>
            {card.urgent ? (
                <Text style={[styles.status, { color: Palette.danger }]} numberOfLines={1}>Crisis reading</Text>
            ) : (
                <Text
                    style={[styles.status, card.statusColour ? { color: tone(card.statusColour) } : null]}
                    numberOfLines={1}
                >
                    {card.status}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const useStyles = makeStyles((Palette) => ({
    grid: { marginHorizontal: Spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tile: {
        // Two per row with one gap between them.
        width: '48.5%',
        flexGrow: 1,
        padding: Spacing.md,
        gap: 3,
        borderRadius: Radius.lg,
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.borderLight,
    },
    wide: { width: '100%' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { flex: 1, fontSize: 12, color: Palette.textSecondary, ...BodyFont.medium },
    value: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
    unit: { fontSize: 12, color: Palette.textSecondary, ...BodyFont.regular },
    status: { fontSize: 12, color: Palette.textSecondary, ...BodyFont.regular },
}));
