/**
 * Browse by body area — the flat stand-in for the kit's 3D anatomy model.
 *
 * Two steps in one sheet, as the kit has them: a grid of areas ("Browse Body Areas"), then
 * the checklist for the one that was tapped ("Browse Leg Symtoms"). Both end in a single
 * Apply, and nothing is committed to the page until it is pressed — someone opening the
 * sheet to look at what "Whole body" covers should be able to back out having changed
 * nothing.
 *
 * The working set is seeded from the page every time the sheet opens, so the checkboxes
 * agree with the chips behind them and Apply replaces rather than appends.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import { BODY_AREAS, areaById, symptomsInArea } from '@/lib/symptoms';

interface Props {
    visible: boolean;
    /** Currently selected symptom ids on the page. */
    selected: string[];
    onApply: (ids: string[]) => void;
    onDismiss: () => void;
}

export default function BodyAreaSheet({ visible, selected, onApply, onDismiss }: Props) {
    const [areaId, setAreaId] = useState<string | null>(null);
    const [working, setWorking] = useState<string[]>(selected);

    // Reopening always starts at the grid, holding whatever the page holds.
    useEffect(() => {
        if (!visible) return;
        setAreaId(null);
        setWorking(selected);
    }, [visible, selected]);

    const area = areaId ? areaById(areaId) : null;
    const symptoms = useMemo(() => (areaId ? symptomsInArea(areaId) : []), [areaId]);

    const toggle = (id: string) =>
        setWorking((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

    /** How many of an area's symptoms are already picked — shown on the grid tile. */
    const countIn = (id: string) =>
        symptomsInArea(id).filter((s) => working.includes(s.id)).length;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <Pressable style={styles.backdrop} onPress={onDismiss}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.grabber} />

                    <View style={styles.header}>
                        {area && (
                            <TouchableOpacity onPress={() => setAreaId(null)} hitSlop={12}>
                                <Ionicons name="chevron-back" size={22} color={Palette.text} />
                            </TouchableOpacity>
                        )}
                        <Text style={styles.title}>
                            {area ? `Browse ${area.label.toLowerCase()}` : 'Browse body areas'}
                        </Text>
                        <TouchableOpacity onPress={onDismiss} hitSlop={12}>
                            <Ionicons name="close" size={22} color={Palette.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={styles.bodyContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {area ? (
                            symptoms.map((symptom) => {
                                const on = working.includes(symptom.id);
                                return (
                                    <TouchableOpacity
                                        key={symptom.id}
                                        style={[styles.row, on && styles.rowOn]}
                                        onPress={() => toggle(symptom.id)}
                                        activeOpacity={0.8}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: on }}
                                    >
                                        <View style={[styles.box, on && styles.boxOn]}>
                                            {on && <Ionicons name="checkmark" size={14} color={Palette.white} />}
                                        </View>
                                        <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{symptom.label}</Text>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <View style={styles.grid}>
                                {BODY_AREAS.map((item) => {
                                    const count = countIn(item.id);
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.tile, count > 0 && styles.tileOn]}
                                            onPress={() => setAreaId(item.id)}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons
                                                name={item.icon}
                                                size={26}
                                                color={count > 0 ? Palette.primary : Palette.textSecondary}
                                            />
                                            <Text style={[styles.tileLabel, count > 0 && styles.tileLabelOn]}>
                                                {item.label}
                                            </Text>
                                            {count > 0 && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>{count}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.apply}
                        onPress={() => onApply(working)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.applyText}>
                            {working.length
                                ? `Apply ${working.length} symptom${working.length === 1 ? '' : 's'}`
                                : 'Apply'}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
    sheet: {
        maxHeight: '86%',
        backgroundColor: Palette.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, paddingTop: Spacing.md,
    },
    grabber: {
        alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.pill,
        backgroundColor: Palette.border, marginBottom: Spacing.lg,
    },

    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    title: { flex: 1, fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },

    body: { flexGrow: 0 },
    bodyContent: { paddingBottom: Spacing.lg, gap: Spacing.sm },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        width: '31%', aspectRatio: 1, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.sm,
    },
    tileOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    tileLabel: {
        fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary, textAlign: 'center',
    },
    tileLabelOn: { color: Palette.primary },
    badge: {
        position: 'absolute', top: 6, right: 6,
        minWidth: 18, height: 18, borderRadius: Radius.pill, paddingHorizontal: 5,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primary,
    },
    badgeText: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.white },

    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
        borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent',
    },
    rowOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    box: {
        width: 22, height: 22, borderRadius: Radius.sm,
        borderWidth: 1.5, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    boxOn: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text },
    rowLabelOn: { fontFamily: Fonts.medium, color: Palette.primary },

    apply: {
        height: 54, borderRadius: Radius.xl, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
    },
    applyText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
});
