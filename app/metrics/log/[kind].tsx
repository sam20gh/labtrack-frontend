/**
 * Logging a metric by hand.
 *
 * One route for the three loggable kinds, because the chrome is identical and the inputs are
 * not: weight is one number, water is a container picker, blood pressure is a pair that has to
 * be validated together. Three near-identical screens differing only in their middle would
 * drift apart on the parts that are the same.
 *
 * Two things this screen does that the kit's does not:
 *
 * - **Blood pressure is classified on the way back and shown before you leave.** The design
 *   logs and returns to the dashboard. A reading in the crisis range has to say so at the
 *   moment it is entered, with what to do about it — putting that on a card the person may
 *   not scroll to is the whole failure this feature exists to avoid.
 * - **The server is the validator.** These inputs check enough to keep the keyboard sane, but
 *   the refusals that matter — a transposed blood pressure, a weight in pounds — come back
 *   from `utils/bloodPressure.js`, so the rule lives in one place and the app cannot let
 *   through something the record should not hold.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import {
    logWeight, logWater, logBloodPressure, getReference,
    type MetricsReference, type BpCategory,
} from '@/lib/metrics';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const TITLES: Record<string, { title: string; blurb: string }> = {
    weight: { title: 'Log Your Weight', blurb: 'Log your weight here.' },
    water: { title: 'Log Water', blurb: 'Log your water intake here.' },
    'blood-pressure': { title: 'Log Blood Pressure', blurb: 'Enter your blood pressure below.' },
};

export default function LogMetricScreen() {
    const router = useRouter();
    const { kind } = useLocalSearchParams<{ kind: string }>();
    const meta = TITLES[kind ?? ''] ?? null;

    const [reference, setReference] = useState<MetricsReference | null>(null);
    const [saving, setSaving] = useState(false);

    // weight
    const [weightKg, setWeightKg] = useState('');
    // water
    const [container, setContainer] = useState<string | null>('medium');
    const [customMl, setCustomMl] = useState('');
    const [drinkType, setDrinkType] = useState('water');
    // blood pressure
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [pulse, setPulse] = useState('');
    const [result, setResult] = useState<{ category: BpCategory; urgentNote: string | null; note: string } | null>(null);

    useEffect(() => { getReference().then(setReference).catch(() => {}); }, []);

    const save = useCallback(async () => {
        setSaving(true);
        try {
            if (kind === 'weight') {
                const res = await logWeight({ weightKg: Number(weightKg) });
                Toast.show({
                    type: 'success',
                    text1: 'Weight logged',
                    text2: res.changeKg !== null
                        ? `${res.changeKg > 0 ? '+' : ''}${res.changeKg} kg since last time`
                        : res.bmi ? `BMI ${res.bmi}` : undefined,
                });
                router.back();
                return;
            }

            if (kind === 'water') {
                const ml = customMl ? Number(customMl) : undefined;
                const res = await logWater({ ml, container: ml ? undefined : container ?? undefined, drinkType });
                Toast.show({
                    type: 'success',
                    text1: 'Water logged',
                    text2: res.day.remainingMl
                        ? `${res.day.remainingMl} ml to go today`
                        : 'You have met your target today',
                });
                router.back();
                return;
            }

            const res = await logBloodPressure({
                systolic: Number(systolic),
                diastolic: Number(diastolic),
                pulse: pulse ? Number(pulse) : null,
            });

            // Held on the screen rather than toasted away. A stage or a crisis is the point of
            // taking the reading, and a toast is gone before it has been read.
            setResult(res);
        } catch (err) {
            Toast.show({
                type: 'error',
                text1: 'Could not save',
                text2: err instanceof ApiError ? err.message : 'Try again in a moment.',
            });
        } finally {
            setSaving(false);
        }
    }, [kind, weightKg, customMl, container, drinkType, systolic, diastolic, pulse, router]);

    if (!meta) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><Text style={styles.blurb}>Unknown metric.</Text></View>
            </SafeAreaView>
        );
    }

    const canSave = kind === 'weight' ? Number(weightKg) > 0
        : kind === 'water' ? Boolean(container || Number(customMl) > 0)
            : Number(systolic) > 0 && Number(diastolic) > 0;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.title}>{meta.title}</Text>
                    <Text style={styles.blurb}>{meta.blurb}</Text>

                    {kind === 'weight' && (
                        <View style={styles.card}>
                            <Text style={styles.fieldLabel}>Weight</Text>
                            <View style={styles.bigInputRow}>
                                <TextInput
                                    style={styles.bigInput}
                                    value={weightKg}
                                    onChangeText={setWeightKg}
                                    keyboardType="decimal-pad"
                                    placeholder="0.0"
                                    placeholderTextColor={Palette.textMuted}
                                    autoFocus
                                />
                                <Text style={styles.bigUnit}>kg</Text>
                            </View>
                            <Text style={styles.hint}>
                                Weigh yourself at the same time of day for a trend that means something —
                                first thing in the morning is the usual advice.
                            </Text>
                        </View>
                    )}

                    {kind === 'water' && reference && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.fieldLabel}>Container</Text>
                                <View style={styles.chipRow}>
                                    {reference.hydration.containers.map((c) => (
                                        <TouchableOpacity
                                            key={c.key}
                                            style={[styles.container, container === c.key && !customMl && styles.containerActive]}
                                            onPress={() => { setContainer(c.key); setCustomMl(''); }}
                                        >
                                            <Ionicons
                                                name="water"
                                                size={22}
                                                color={container === c.key && !customMl ? Palette.primary : Palette.textMuted}
                                            />
                                            <Text style={[styles.containerLabel, container === c.key && !customMl && styles.containerLabelActive]}>
                                                {c.label}
                                            </Text>
                                            <Text style={styles.containerMl}>{c.ml} ml</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.fieldLabel}>Or enter an amount</Text>
                                <View style={styles.inlineInputRow}>
                                    <TextInput
                                        style={styles.input}
                                        value={customMl}
                                        onChangeText={(t) => { setCustomMl(t); if (t) setContainer(null); }}
                                        keyboardType="number-pad"
                                        placeholder="250"
                                        placeholderTextColor={Palette.textMuted}
                                    />
                                    <Text style={styles.inlineUnit}>ml</Text>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.fieldLabel}>Drink</Text>
                                <View style={styles.chipRow}>
                                    {reference.hydration.drinkTypes.map((d) => (
                                        <TouchableOpacity
                                            key={d.key}
                                            style={[styles.chip, drinkType === d.key && styles.chipActive]}
                                            onPress={() => setDrinkType(d.key)}
                                        >
                                            <Text style={[styles.chipText, drinkType === d.key && styles.chipTextActive]}>
                                                {d.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {/*
                                  * Stated because people expect coffee to be discounted. It is
                                  * not, and a tracker that silently subtracted it would
                                  * disagree with every current guideline.
                                  */}
                                <Text style={styles.hint}>Tea and coffee count towards your fluid intake.</Text>
                            </View>
                        </>
                    )}

                    {kind === 'blood-pressure' && (
                        <>
                            <View style={styles.card}>
                                <View style={styles.bpRow}>
                                    <View style={styles.bpField}>
                                        <Text style={styles.fieldLabel}>Systolic</Text>
                                        <TextInput
                                            style={styles.bpInput}
                                            value={systolic}
                                            onChangeText={(t) => { setSystolic(t); setResult(null); }}
                                            keyboardType="number-pad"
                                            placeholder="120"
                                            placeholderTextColor={Palette.textMuted}
                                            maxLength={3}
                                        />
                                        <Text style={styles.bpHint}>the higher number</Text>
                                    </View>
                                    <Text style={styles.bpSlash}>/</Text>
                                    <View style={styles.bpField}>
                                        <Text style={styles.fieldLabel}>Diastolic</Text>
                                        <TextInput
                                            style={styles.bpInput}
                                            value={diastolic}
                                            onChangeText={(t) => { setDiastolic(t); setResult(null); }}
                                            keyboardType="number-pad"
                                            placeholder="80"
                                            placeholderTextColor={Palette.textMuted}
                                            maxLength={3}
                                        />
                                        <Text style={styles.bpHint}>the lower number</Text>
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Pulse (optional)</Text>
                                <View style={styles.inlineInputRow}>
                                    <TextInput
                                        style={styles.input}
                                        value={pulse}
                                        onChangeText={setPulse}
                                        keyboardType="number-pad"
                                        placeholder="72"
                                        placeholderTextColor={Palette.textMuted}
                                        maxLength={3}
                                    />
                                    <Text style={styles.inlineUnit}>bpm</Text>
                                </View>
                            </View>

                            {result && <BpResult result={result} onDone={() => router.back()} />}

                            {reference && !result && (
                                <View style={styles.card}>
                                    <Text style={styles.fieldLabel}>What the numbers mean</Text>
                                    {reference.bloodPressure.categories
                                        .filter((c) => c.key !== 'low')
                                        .map((c) => (
                                            <View key={c.key} style={styles.legendRow}>
                                                <View style={[styles.legendDot, { backgroundColor: c.colour }]} />
                                                <Text style={styles.legendLabel}>{c.label}</Text>
                                                <Text style={styles.legendRange}>
                                                    {c.key === 'crisis' ? 'over 180/120'
                                                        : c.key === 'normal' ? 'under 120/80'
                                                            : `${c.systolic}+ or ${c.diastolic}+`}
                                                </Text>
                                            </View>
                                        ))}
                                    <Text style={styles.hint}>{reference.bloodPressure.note}</Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>

                {!result && (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.primary, (!canSave || saving) && styles.primaryDisabled]}
                            onPress={save}
                            disabled={!canSave || saving}
                        >
                            {saving
                                ? <ActivityIndicator color="#FFFFFF" />
                                : <Text style={styles.primaryText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/**
 * What the reading was.
 *
 * A crisis gets its own treatment — the escalation text from the server, not a coloured chip.
 * `utils/bloodPressure.js` keeps `isCrisis` separate from the category for exactly this: so a
 * screen cannot accidentally render "seek care now" as one more band on a ladder.
 */
const BpResult = ({ result, onDone }: {
    result: { category: BpCategory; urgentNote: string | null; note: string }; onDone: () => void;
}) => (
    <View style={[styles.card, result.category.isCrisis && styles.crisisCard]}>
        <View style={styles.resultTop}>
            <View style={[styles.legendDot, { backgroundColor: result.category.colour, width: 12, height: 12, borderRadius: 6 }]} />
            <Text style={[styles.resultLabel, result.category.isCrisis && styles.crisisText]}>
                {result.category.label}
            </Text>
        </View>

        <Text style={styles.resultSummary}>{result.category.summary}</Text>

        {result.category.driver && result.category.driver !== 'both' && (
            <Text style={styles.hint}>
                It is your {result.category.driver} number that puts this reading in that range.
            </Text>
        )}

        {result.urgentNote && (
            <View style={styles.crisisBox}>
                <Ionicons name="warning" size={18} color="#FFFFFF" />
                <Text style={styles.crisisBoxText}>{result.urgentNote}</Text>
            </View>
        )}

        <Text style={styles.hint}>{result.note}</Text>

        <TouchableOpacity style={styles.primary} onPress={onDone}>
            <Text style={styles.primaryText}>Done</Text>
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    flex: { flex: 1 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xl },

    title: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text },
    blurb: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary, marginBottom: Spacing.xs },

    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    fieldLabel: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
    hint: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textSecondary, lineHeight: 16 },

    bigInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    bigInput: { fontFamily: Fonts.bold, fontSize: 44, color: Palette.text, minWidth: 120, padding: 0 },
    bigUnit: { fontFamily: Fonts.medium, fontSize: 18, color: Palette.textMuted, paddingBottom: 8 },

    inlineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
        flex: 1, fontFamily: Fonts.medium, fontSize: 16, color: Palette.text,
        backgroundColor: Palette.borderLight, borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm, paddingVertical: 10,
    },
    inlineUnit: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.textMuted },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Palette.borderLight },
    chipActive: { backgroundColor: Palette.primary },
    chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },
    chipTextActive: { color: '#FFFFFF' },

    container: {
        flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spacing.sm,
        borderRadius: Radius.md, borderWidth: 1.5, borderColor: Palette.border,
    },
    containerActive: { borderColor: Palette.primary, backgroundColor: '#F5F3FF' },
    containerLabel: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.textSecondary },
    containerLabelActive: { color: Palette.primary },
    containerMl: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },

    bpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    bpField: { flex: 1, gap: 4 },
    bpInput: {
        fontFamily: Fonts.bold, fontSize: 34, color: Palette.text, textAlign: 'center',
        backgroundColor: Palette.borderLight, borderRadius: Radius.md, paddingVertical: 8,
    },
    bpHint: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted, textAlign: 'center' },
    bpSlash: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.textMuted, marginTop: 18 },

    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.text, flex: 1 },
    legendRange: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted },

    resultTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resultLabel: { fontFamily: Fonts.bold, fontSize: 19, color: Palette.text },
    resultSummary: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 },
    crisisCard: { borderWidth: 2, borderColor: '#DC2626' },
    crisisText: { color: '#DC2626' },
    crisisBox: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: '#DC2626', borderRadius: Radius.md, padding: Spacing.sm,
    },
    crisisBoxText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: '#FFFFFF', lineHeight: 17 },

    footer: { padding: Spacing.lg, paddingTop: Spacing.sm },
    primary: { backgroundColor: Palette.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
    primaryDisabled: { opacity: 0.4 },
    primaryText: { fontFamily: Fonts.semibold, fontSize: 15, color: '#FFFFFF' },
});
