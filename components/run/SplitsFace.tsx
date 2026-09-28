/**
 * Face C — Splits. Each kilometre (or mile) lands as a bar with its pace, and the one in
 * progress fills live. Bar length is **speed relative to this run** — the fastest split is
 * the full width — and colour is the same Ember ramp as the trail, so a bright bar here is a
 * bright stretch on the map. No absolute "good" pace; see `lib/run/afterglow.ts`.
 *
 * Splits are per kilometre in the record; a mile runner sees miles computed from the same
 * accumulator's distance, so the two never disagree about where a boundary was.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { rampColor, type Ramp } from '@/lib/run/afterglow';
import type { Split } from '@/lib/run/trackMath';
import type { HudColours } from './FocusFace';

interface Props {
    hud: HudColours;
    ramp: Ramp;
    splits: Split[];
    current: { distanceM: number; durationSec: number };
    unitM: number;
    formatPace: (secPerKm: number | null) => string;
}

export default function SplitsFace({ hud, ramp, splits, current, unitM, formatPace }: Props) {
    const speeds = splits.map((s) => (s.pacePerKm ? 1000 / s.pacePerKm : 0));
    const fastest = Math.max(0.1, ...speeds);
    const slowest = Math.min(...speeds.filter((v) => v > 0), fastest);
    const span = fastest - slowest;

    return (
        <ScrollView style={{ backgroundColor: hud.background }} contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: hud.text }]}>Splits</Text>
            {!splits.length && (
                <Text style={[styles.empty, { color: hud.secondary }]}>
                    Your first {unitM === 1000 ? 'kilometre' : 'mile'} lands here when you finish it.
                </Text>
            )}
            {splits.map((s, i) => {
                const v = speeds[i];
                const t = span < 0.05 ? 0.5 : (v - slowest) / span;
                return (
                    <View key={s.order} style={styles.row} accessible accessibilityLabel={`${s.label}, ${formatPace(s.pacePerKm)}`}>
                        <Text style={[styles.index, { color: hud.secondary }]}>{s.order}</Text>
                        <View style={[styles.track, { backgroundColor: hud.track }]}>
                            <View style={[styles.bar, { width: `${Math.max(12, (v / fastest) * 100)}%`, backgroundColor: rampColor(t, ramp) }]} />
                        </View>
                        <Text style={[styles.pace, { color: hud.text }]}>{formatPace(s.pacePerKm)}</Text>
                    </View>
                );
            })}
            <View style={styles.row} accessible accessibilityLabel={`Current split, ${Math.round((current.distanceM / unitM) * 100)} percent`}>
                <Text style={[styles.index, { color: hud.secondary }]}>{splits.length + 1}</Text>
                <View style={[styles.track, { backgroundColor: hud.track }]}>
                    <View style={[styles.bar, styles.live, { width: `${Math.min(100, (current.distanceM / unitM) * 100)}%`, borderColor: hud.accent }]} />
                </View>
                <Text style={[styles.pace, { color: hud.secondary }]}>…</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: { padding: Spacing.xl, paddingTop: Spacing.xxxl * 2, gap: Spacing.md },
    title: { fontFamily: Fonts.bold, fontSize: 22, marginBottom: Spacing.sm },
    empty: { ...BodyFont.regular, fontSize: 15, lineHeight: 22 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    index: { fontFamily: Fonts.semibold, fontSize: 15, width: 22, textAlign: 'right' },
    track: { flex: 1, height: 22, borderRadius: Radius.sm, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: Radius.sm },
    live: { backgroundColor: 'transparent', borderWidth: 2 },
    pace: { ...BodyFont.semibold, fontSize: 15, width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
