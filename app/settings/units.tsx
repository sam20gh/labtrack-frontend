/**
 * Units & Metrics — `Design/profile.svg`, frame 5.
 *
 * The kit draws six tiles in a two-column grid, each a label over the unit in force. This
 * builds that grid from `UNIT_OPTIONS` in `lib/units.ts` and makes a tile a real control:
 * tapping cycles to the next choice and every screen that formats that quantity redraws,
 * because the preference store notifies its subscribers.
 *
 * **Blood pressure is a tile with no switch, and that is deliberate.** The kit shows it as
 * "mmHg" alongside the rest, which reads as a sixth choice. `utils/bloodPressure.js`
 * classifies in mmHg and `MetricLog.category` stores the band *as classified at the time*,
 * so a kPa display would print a number beside a band that was never computed for it —
 * exactly the reclassify-on-read the metrics feature is documented as never doing. It is
 * drawn as a fixed row with the reason attached rather than left off the screen, because
 * someone looking for it should find the answer rather than assume the app forgot.
 *
 * The footer says the record is stored metric. That is not trivia: it is why switching to
 * pounds cannot corrupt a weight history, and it is the sentence that stops the next
 * person from "fixing" the conversion at the API boundary.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { UNIT_OPTIONS, setUnit, useUnits, type UnitKey } from '@/lib/units';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

export default function UnitsScreen() {
    const prefs = useUnits();

    /**
     * Tap cycles rather than opening a picker. Every quantity here has exactly two
     * choices, and a two-item sheet is more taps than the thing it is choosing between.
     */
    const cycle = useCallback((key: UnitKey) => {
        const option = UNIT_OPTIONS.find((o) => o.key === key);
        if (!option) return;
        const index = option.choices.findIndex((c) => c.value === prefs[key]);
        const next = option.choices[(index + 1) % option.choices.length];
        Haptics.selectionAsync().catch(() => { });
        setUnit(key, next.value as never);
    }, [prefs]);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <ScreenHeader title="Units & Metrics" subtitle="Edit your units & metrics here" />

                <View style={styles.body}>
                    <Text style={styles.groupLabel}>General</Text>

                    <View style={styles.grid}>
                        {UNIT_OPTIONS.map((option) => {
                            const active = option.choices.find((c) => c.value === prefs[option.key]);
                            return (
                                <Pressable
                                    key={option.key}
                                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                                    onPress={() => cycle(option.key)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${option.label}, currently ${active?.hint}. Double tap to change.`}
                                >
                                    <View style={styles.tileHead}>
                                        <Ionicons name={option.icon as never} size={20} color={Palette.primary} />
                                        <Ionicons name="swap-horizontal" size={14} color={Palette.textMuted} />
                                    </View>
                                    <Text style={styles.tileLabel}>{option.label}</Text>
                                    <Text style={styles.tileUnit}>{active?.label}</Text>
                                </Pressable>
                            );
                        })}

                        {/* The fixed tile. Same geometry, no affordance — see the file header. */}
                        <View style={[styles.tile, styles.tileFixed]}>
                            <View style={styles.tileHead}>
                                <Ionicons name="pulse-outline" size={20} color={Palette.textMuted} />
                                <Ionicons name="lock-closed-outline" size={13} color={Palette.textMuted} />
                            </View>
                            <Text style={[styles.tileLabel, styles.tileLabelFixed]}>Blood Pressure</Text>
                            <Text style={[styles.tileUnit, styles.tileUnitFixed]}>mmHg</Text>
                        </View>
                    </View>

                    <View style={styles.note}>
                        <Ionicons name="information-circle-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.noteText}>
                            Blood pressure stays in mmHg. Each reading is filed under the category it was
                            classified as at the time, and those categories are defined in mmHg — showing
                            another unit would put a number next to a band that was never worked out for it.
                        </Text>
                    </View>

                    <Text style={styles.footer}>
                        Your records are always stored in metric. Changing a unit here changes what you see
                        and what a number you type is converted from — it never rewrites anything you have
                        already logged, and it applies to this device only.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.lg },

    groupLabel: {
        fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        // Two columns inside a 20pt gutter with a 12pt gap. Written as a percentage so the
        // grid holds on a 320pt phone and on a tablet without a measured layout.
        width: '48%',
        flexGrow: 1,
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        gap: 6,
    },
    tilePressed: { backgroundColor: Palette.primarySurface, borderColor: Palette.primaryLight },
    tileFixed: { backgroundColor: Palette.background, borderStyle: 'dashed' },
    tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    tileLabel: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    tileLabelFixed: { color: Palette.textSecondary },
    tileUnit: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    tileUnitFixed: { color: Palette.textMuted },

    note: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surface, borderRadius: Radius.xl, padding: Spacing.lg,
        marginTop: Spacing.sm,
    },
    noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },

    footer: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: Spacing.sm,
    },
});
