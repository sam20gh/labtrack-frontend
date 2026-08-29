/**
 * Log an activity by hand — the type grid from frame 22, plus what frame 23 asks for.
 *
 * This is the screen that makes the whole feature usable before device sync exists, so it
 * is not a stopgap: someone who never connects a watch should still get a working tracker,
 * and every figure they enter here feeds the same rollups, score and plan adherence a
 * synced session does.
 *
 * The design's "1 of 2" step with a linked-device card and a route picker belongs to the
 * live-tracking flow (phase 11.6). This is the part that stands on its own.
 */
import React, { useState } from 'react';
import {
    View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { logActivity } from '@/lib/activity';
import { ApiError } from '@/lib/api';

/** The design's ten. `normaliseType` on the server maps these onto the same buckets a watch uses. */
const TYPES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'walking', label: 'Walking', icon: 'walk-outline' },
    { key: 'yoga', label: 'Yoga', icon: 'body-outline' },
    { key: 'jogging', label: 'Jogging', icon: 'walk-outline' },
    { key: 'meditation', label: 'Meditation', icon: 'leaf-outline' },
    { key: 'biking', label: 'Biking', icon: 'bicycle-outline' },
    { key: 'rowing', label: 'Rowing', icon: 'boat-outline' },
    { key: 'weightlifting', label: 'Weightlifting', icon: 'barbell-outline' },
    { key: 'hiking', label: 'Hiking', icon: 'trail-sign-outline' },
    { key: 'swimming', label: 'Swimming', icon: 'water-outline' },
    { key: 'soccer', label: 'Soccer', icon: 'football-outline' },
];

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];

/** The design's flame scale. Self-reported, and only ever set by the person. */
const EFFORTS = [
    { value: 1, label: 'Very light' },
    { value: 2, label: 'Light' },
    { value: 3, label: 'Moderate' },
    { value: 4, label: 'High effort' },
    { value: 5, label: 'Maximum' },
];

export default function LogActivityScreen() {
    const router = useRouter();

    const [type, setType] = useState<string | null>(null);
    const [minutes, setMinutes] = useState(30);
    const [effort, setEffort] = useState<number | null>(null);
    const [distanceKm, setDistanceKm] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!type || saving) return;
        setSaving(true);
        try {
            const now = new Date();
            const startedAt = new Date(now.getTime() - minutes * 60_000);
            const km = parseFloat(distanceKm);

            await logActivity({
                type,
                startedAt: startedAt.toISOString(),
                endedAt: now.toISOString(),
                durationSec: minutes * 60,
                // Only sent when it was actually entered. A distance of 0 on a yoga session
                // is a number we made up.
                distanceM: Number.isFinite(km) && km > 0 ? Math.round(km * 1000) : undefined,
                effort: effort ?? undefined,
                notes: notes.trim() || undefined,
            });

            router.back();
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : 'Could not save this activity. Please try again.';
            Alert.alert('Not saved', message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Log activity</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.question}>What activity did you do?</Text>

                <View style={styles.grid}>
                    {TYPES.map((t) => {
                        const active = type === t.key;
                        return (
                            <Pressable
                                key={t.key}
                                onPress={() => setType(t.key)}
                                style={[styles.tile, active && styles.tileActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                            >
                                <Ionicons
                                    name={t.icon}
                                    size={22}
                                    color={active ? Palette.primary : Palette.text}
                                />
                                <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>
                                    {t.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.label}>How long?</Text>
                <View style={styles.chips}>
                    {DURATIONS.map((m) => {
                        const active = m === minutes;
                        return (
                            <Pressable
                                key={m}
                                onPress={() => setMinutes(m)}
                                style={[styles.chip, active && styles.chipActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                    {m}m
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.label}>How hard did it feel?</Text>
                <Text style={styles.sublabel}>Optional. Only you set this — it is never inferred.</Text>
                <View style={styles.chips}>
                    {EFFORTS.map((e) => {
                        const active = effort === e.value;
                        return (
                            <Pressable
                                key={e.value}
                                onPress={() => setEffort(active ? null : e.value)}
                                style={[styles.chip, active && styles.chipActive]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                    {e.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.label}>Distance</Text>
                <Text style={styles.sublabel}>Optional — leave blank if it doesn’t apply.</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        value={distanceKm}
                        onChangeText={setDistanceKm}
                        keyboardType="decimal-pad"
                        placeholder="0.0"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.input}
                        accessibilityLabel="Distance in kilometres"
                    />
                    <Text style={styles.unit}>km</Text>
                </View>

                <Text style={styles.label}>Notes</Text>
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="How did it go?"
                    placeholderTextColor={Palette.textMuted}
                    multiline
                    style={[styles.input, styles.notes]}
                    accessibilityLabel="Notes"
                />
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    onPress={save}
                    disabled={!type || saving}
                    style={[styles.cta, (!type || saving) && styles.ctaDisabled]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !type || saving }}
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} />
                        : <Text style={styles.ctaText}>Save activity</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

    question: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text, marginBottom: Spacing.xl },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        width: '47.5%',
        gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        minHeight: 92,
        justifyContent: 'space-between',
    },
    tileActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    tileLabel: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    tileLabelActive: { fontFamily: Fonts.semibold, color: Palette.primary },

    label: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, marginTop: Spacing.xxl },
    sublabel: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    chipActive: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipTextActive: { fontFamily: Fonts.semibold, color: Palette.primary },

    inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: 15,
        fontFamily: Fonts.regular,
        color: Palette.text,
    },
    unit: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary },
    notes: { marginTop: Spacing.md, minHeight: 88, textAlignVertical: 'top' },

    footer: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        backgroundColor: Palette.background,
    },
    cta: {
        backgroundColor: Palette.primary,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
