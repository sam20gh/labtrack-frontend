/**
 * Add a medication.
 *
 * The design's form, with one behavioural rule that is not visible in the frames: the
 * schedule fields shown depend on the frequency chosen. "On chosen days" reveals a weekday
 * strip, "When needed" hides the time picker entirely — an as-needed medicine has no dose
 * times, and offering them produces reminders for a schedule nobody meant to set.
 *
 * Accepts a `prefill` param from the scan flow. The scan deliberately does not save; it
 * hands the identified fields here, because a medication with no schedule generates no doses
 * and no reminders, and a "saved" medication that does nothing looks broken.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createMedication, today, FREQUENCY_LABEL, FORM_LABEL, WEEKDAYS, formatTime } from '@/lib/medications';
import { PillGlyph } from '@/components/medications/PillGlyph';
import { ensureRemindersReady } from '@/lib/notifications';
import { warnRemindersUnavailable } from '@/lib/medicationReminders';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationFrequency, MedicationForm, MedicationShape } from '@/types/api';

/** The design's swatch row. */
const COLOURS = ['#7C3AED', '#1F2937', '#E5E7EB', '#F43F5E', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const SHAPES: MedicationShape[] = [
    'oblong', 'diamond', 'square', 'triangle', 'hexagon', 'round',
    'rectangle', 'teardrop', 'pentagon', 'trapezoid', 'shield', 'oval',
];

const FREQUENCIES: MedicationFrequency[] = [
    'daily', 'twice_daily', 'three_times_daily', 'weekly', 'specific_days', 'once', 'as_needed',
];

const FORMS: MedicationForm[] = ['tablet', 'capsule', 'liquid', 'inhaler', 'injection', 'drops', 'patch', 'cream'];

/** Sensible defaults per frequency, matching `medicationSchedule.DEFAULT_TIMES`. */
const DEFAULT_TIMES: Record<string, string[]> = {
    daily: ['09:00'],
    twice_daily: ['09:00', '21:00'],
    three_times_daily: ['08:00', '14:00', '20:00'],
    weekly: ['09:00'],
    specific_days: ['09:00'],
    once: ['09:00'],
    as_needed: [],
};

export default function AddMedicationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ prefill?: string; imageUri?: string }>();

    const [name, setName] = useState('');
    const [brandName, setBrandName] = useState('');
    const [strength, setStrength] = useState('');
    const [dose, setDose] = useState('');
    const [form, setForm] = useState<MedicationForm>('tablet');
    const [shape, setShape] = useState<MedicationShape | null>(null);
    const [colour, setColour] = useState<string | null>(COLOURS[0]);

    const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
    const [times, setTimes] = useState<string[]>(['09:00']);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [startDay] = useState(today());
    const [endDay, setEndDay] = useState('');

    const [reminders, setReminders] = useState(true);
    const [trackSupply, setTrackSupply] = useState(false);
    const [remainingDoses, setRemainingDoses] = useState('30');
    const [refillThreshold, setRefillThreshold] = useState('12');

    const [notes, setNotes] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [identification, setIdentification] = useState<any>(undefined);
    const [saving, setSaving] = useState(false);

    // Carried over from the scan
    useEffect(() => {
        if (!params.prefill) return;
        try {
            const d = JSON.parse(params.prefill);
            if (d.name) setName(d.name);
            if (d.brandName) setBrandName(d.brandName);
            if (d.strength) setStrength(d.strength);
            if (d.form) setForm(d.form);
            if (d.shape) setShape(d.shape);
            if (d.imageUrl) setImageUrl(d.imageUrl);
            if (d.identification) setIdentification(d.identification);
        } catch {
            // A malformed param is not worth an error dialog — the form still works empty
        }
    }, [params.prefill]);

    /** Changing frequency resets the times to that frequency's sensible spread. */
    const chooseFrequency = (f: MedicationFrequency) => {
        setFrequency(f);
        setTimes(DEFAULT_TIMES[f] ?? ['09:00']);
    };

    const toggleDay = (d: number) =>
        setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

    const setTimeAt = (index: number, value: string) =>
        setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));

    const save = async () => {
        if (!name.trim()) {
            Alert.alert('What is it called?', 'A medication needs a name before it can be added.');
            return;
        }
        if (frequency === 'specific_days' && !daysOfWeek.length) {
            Alert.alert(
                'Which days?',
                'Choose the days you take this, or the schedule will produce no doses at all.'
            );
            return;
        }

        setSaving(true);
        try {
            await createMedication({
                name: name.trim().toLowerCase(),
                brandName: brandName.trim() || null,
                strength: strength.trim() || null,
                dose: dose.trim() || null,
                form,
                shape,
                colour,
                frequency,
                times,
                daysOfWeek,
                startDay,
                endDay: endDay.trim() || null,
                remindersEnabled: reminders,
                refillReminder: trackSupply,
                remainingDoses: trackSupply ? Number(remainingDoses) || null : null,
                refillThreshold: Number(refillThreshold) || 12,
                notes: notes.trim() || null,
                imageUrl,
                source: identification ? 'scan' : 'manual',
                ...(identification ? { identification } : {}),
            } as any);

            /**
             * A reminder is a server push, and the server can only send one to a device it
             * knows about. Ask here rather than at first launch: this is the moment the app
             * has actually promised to remind them, which is the moment the permission
             * prompt makes sense — and asking before that is how a permanent iOS denial
             * happens. Never blocks the save; the medication is already stored.
             */
            if (reminders && frequency !== 'as_needed') {
                const state = await ensureRemindersReady();
                if (!state.ready) {
                    warnRemindersUnavailable(state, () => Linking.openSettings());
                }
            }

            // Back to the hub, which refetches on focus and will show the new medication
            // and a stale interaction check prompting a re-run.
            router.replace('/medications');
        } catch (error) {
            Alert.alert('Could not add it', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const showTimes = frequency !== 'as_needed';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add medication</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {/* The glyph updates live as shape and colour are chosen */}
                    <View style={styles.preview}>
                        <PillGlyph shape={shape} colour={colour} size={72} />
                        <Text style={styles.previewName}>{name.trim() || 'New medication'}</Text>
                        {strength ? <Text style={styles.previewMeta}>{strength}</Text> : null}
                    </View>

                    <Section title="What it is">
                        <Field label="Name" hint="The name on the box — generic or brand">
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. atorvastatin"
                                placeholderTextColor={Palette.textMuted}
                                autoCapitalize="none"
                            />
                        </Field>

                        <View style={styles.row}>
                            <Field label="Strength" flex hint="As printed">
                                <TextInput
                                    style={styles.input}
                                    value={strength}
                                    onChangeText={setStrength}
                                    placeholder="20mg"
                                    placeholderTextColor={Palette.textMuted}
                                />
                            </Field>
                            <Field label="Each time" flex hint="How much you take">
                                <TextInput
                                    style={styles.input}
                                    value={dose}
                                    onChangeText={setDose}
                                    placeholder="1 tablet"
                                    placeholderTextColor={Palette.textMuted}
                                />
                            </Field>
                        </View>

                        <Field label="Form">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                                {FORMS.map((f) => (
                                    <Chip key={f} label={FORM_LABEL[f]} selected={form === f} onPress={() => setForm(f)} />
                                ))}
                            </ScrollView>
                        </Field>
                    </Section>

                    <Section title="When you take it">
                        <Field label="How often">
                            <View style={styles.wrapRow}>
                                {FREQUENCIES.map((f) => (
                                    <Chip
                                        key={f}
                                        label={FREQUENCY_LABEL[f]}
                                        selected={frequency === f}
                                        onPress={() => chooseFrequency(f)}
                                    />
                                ))}
                            </View>
                        </Field>

                        {frequency === 'specific_days' ? (
                            <Field label="Which days" hint="Tap the days you take it">
                                <View style={styles.dayStrip}>
                                    {WEEKDAYS.map((d, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={[styles.day, daysOfWeek.includes(i) && styles.daySelected]}
                                            onPress={() => toggleDay(i)}
                                            activeOpacity={0.75}
                                        >
                                            <Text style={[styles.dayText, daysOfWeek.includes(i) && styles.dayTextSelected]}>
                                                {d}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </Field>
                        ) : null}

                        {showTimes ? (
                            <Field label="At what time" hint="24-hour, e.g. 08:00 or 21:30">
                                <View style={styles.timeList}>
                                    {times.map((t, i) => (
                                        <View key={i} style={styles.timeRow}>
                                            <Ionicons name="time-outline" size={16} color={Palette.textSecondary} />
                                            <TextInput
                                                style={styles.timeInput}
                                                value={t}
                                                onChangeText={(v) => setTimeAt(i, v)}
                                                placeholder="09:00"
                                                placeholderTextColor={Palette.textMuted}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                            />
                                            <Text style={styles.timePretty}>{formatTime(t)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Field>
                        ) : (
                            <View style={styles.noteCard}>
                                <Ionicons name="information-circle-outline" size={15} color={Palette.textSecondary} />
                                <Text style={styles.note}>
                                    A when-needed medicine has no scheduled doses and no reminders.
                                    It still counts in your interaction check.
                                </Text>
                            </View>
                        )}

                        <Field label="Until" hint="Leave empty if you take it ongoing">
                            <TextInput
                                style={styles.input}
                                value={endDay}
                                onChangeText={setEndDay}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={Palette.textMuted}
                                autoCapitalize="none"
                            />
                        </Field>
                    </Section>

                    <Section title="How it looks" subtitle="So you can pick it out of a list at a glance">
                        <Field label="Colour">
                            <View style={styles.wrapRow}>
                                {COLOURS.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[
                                            styles.swatch,
                                            { backgroundColor: c },
                                            colour === c && styles.swatchSelected,
                                        ]}
                                        onPress={() => setColour(c)}
                                        activeOpacity={0.8}
                                    />
                                ))}
                            </View>
                        </Field>

                        <Field label="Shape">
                            <View style={styles.shapeGrid}>
                                {SHAPES.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.shapeCell, shape === s && styles.shapeCellSelected]}
                                        onPress={() => setShape(s)}
                                        activeOpacity={0.75}
                                    >
                                        <PillGlyph shape={s} colour={colour} size={38} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Field>
                    </Section>

                    <Section title="Reminders and supply">
                        <ToggleRow
                            label="Remind me"
                            hint={showTimes ? 'A notification at each dose time' : 'Not available for when-needed medicines'}
                            value={reminders && showTimes}
                            disabled={!showTimes}
                            onChange={setReminders}
                        />
                        <ToggleRow
                            label="Track what's left"
                            hint="Counts down as you take doses, and tells you when to reorder"
                            value={trackSupply}
                            onChange={setTrackSupply}
                        />
                        {trackSupply ? (
                            <View style={styles.row}>
                                <Field label="Doses in the packet" flex>
                                    <TextInput
                                        style={styles.input}
                                        value={remainingDoses}
                                        onChangeText={setRemainingDoses}
                                        keyboardType="number-pad"
                                        placeholderTextColor={Palette.textMuted}
                                    />
                                </Field>
                                <Field label="Tell me at" flex hint="Doses left">
                                    <TextInput
                                        style={styles.input}
                                        value={refillThreshold}
                                        onChangeText={setRefillThreshold}
                                        keyboardType="number-pad"
                                        placeholderTextColor={Palette.textMuted}
                                    />
                                </Field>
                            </View>
                        ) : null}
                    </Section>

                    <Section title="Anything else">
                        <Field label="Notes" hint="Why you take it, or anything you want to remember">
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Optional"
                                placeholderTextColor={Palette.textMuted}
                                multiline
                            />
                        </Field>
                    </Section>

                    <TouchableOpacity
                        style={[styles.saveButton, saving && styles.saveButtonBusy]}
                        onPress={save}
                        disabled={saving}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator color={Palette.white} size="small" />
                        ) : (
                            <Ionicons name="add" size={18} color={Palette.white} />
                        )}
                        <Text style={styles.saveButtonText}>{saving ? 'Adding…' : 'Add medication'}</Text>
                    </TouchableOpacity>

                    <Text style={styles.footer}>
                        Adding a medicine updates your interaction check. Include anything you
                        buy over the counter — those account for many of the interactions that
                        matter.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const Section = ({ title, subtitle, children }: {
    title: string; subtitle?: string; children: React.ReactNode;
}) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        <View style={styles.sectionBody}>{children}</View>
    </View>
);

const Field = ({ label, hint, flex, children }: {
    label: string; hint?: string; flex?: boolean; children: React.ReactNode;
}) => (
    <View style={[styles.field, flex && { flex: 1 }]}>
        <Text style={styles.label}>{label}</Text>
        {children}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
);

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        activeOpacity={0.75}
    >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
);

const ToggleRow = ({ label, hint, value, disabled, onChange }: {
    label: string; hint?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) => (
    <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, disabled && { color: Palette.textMuted }]}>{label}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Switch
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            trackColor={{ true: Palette.primary, false: Palette.border }}
            thumbColor={Palette.white}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xxl, paddingBottom: Spacing.xxxl * 2 },

    preview: { alignItems: 'center', gap: Spacing.sm },
    previewName: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold, textTransform: 'capitalize' },
    previewMeta: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },

    section: { gap: Spacing.sm },
    sectionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    sectionSubtitle: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: -4 },
    sectionBody: {
        gap: Spacing.lg, marginTop: Spacing.xs,
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },

    field: { gap: 6 },
    row: { flexDirection: 'row', gap: Spacing.md },
    label: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },
    hint: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 15 },
    input: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md, paddingVertical: 11,
        fontSize: 14, color: Palette.text, fontFamily: Fonts.regular,
        backgroundColor: Palette.white,
    },
    textArea: { minHeight: 72, textAlignVertical: 'top' },

    chipRow: { gap: 6, paddingRight: Spacing.lg },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    chipSelected: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },
    chipTextSelected: { color: Palette.white, fontFamily: Fonts.semibold },

    dayStrip: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
    day: {
        width: 38, height: 38, borderRadius: 19,
        borderWidth: 1, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center',
    },
    daySelected: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    dayText: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium },
    dayTextSelected: { color: Palette.primary, fontFamily: Fonts.bold },

    timeList: { gap: 6 },
    timeRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
    },
    timeInput: { width: 64, paddingVertical: 11, fontSize: 14, color: Palette.text, fontFamily: Fonts.regular },
    timePretty: { flex: 1, textAlign: 'right', fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.regular },

    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
    swatchSelected: { borderColor: Palette.text },

    shapeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    shapeCell: {
        padding: 4, borderRadius: Radius.md,
        borderWidth: 2, borderColor: 'transparent',
    },
    shapeCellSelected: { borderColor: Palette.primary },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    toggleLabel: { fontSize: 14, color: Palette.text, fontFamily: Fonts.medium },

    noteCard: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surface, borderRadius: Radius.md, padding: Spacing.md,
    },
    note: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },

    saveButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary, borderRadius: Radius.md, paddingVertical: 15,
    },
    saveButtonBusy: { opacity: 0.7 },
    saveButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    footer: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 17 },
});
