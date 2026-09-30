/**
 * One day's log — period, flow, symptoms, mood, a note.
 *
 * **Whether it was a period day is its own switch, and flow refines it.** A day marked from the
 * calendar's range edit is a period day with no flow recorded (`unspecified`). If deselecting a
 * flow cleared the day, then un-tapping "Medium" would silently un-log a period — so deselecting
 * a flow on a period day leaves it a period day with no flow, and only the switch removes it.
 * Spotting is the exception it should be: it is not a period day, so choosing it turns the
 * switch off.
 *
 * The chevrons walk day by day and stop at today; the future is predicted, never logged.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Switch,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState } from '@/components/errors';
import { FlowPicker, SymptomChips, MoodPicker } from '@/components/cycle/LogControls';
import {
    getCycleDay, saveCycleDay, today as localToday, addDays, formatDayLong,
    type Flow, type Symptom,
} from '@/lib/cycle';
import { ApiError } from '@/lib/api';

const BLEEDING: (Flow | null)[] = ['light', 'medium', 'heavy', 'unspecified'];

export default function CycleLogScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ day?: string }>();
    const todayDay = localToday();
    const initial = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) && params.day <= todayDay ? params.day : todayDay;

    const [day, setDay] = useState(initial);
    const [flow, setFlow] = useState<Flow | null>(null);
    const [symptoms, setSymptoms] = useState<Symptom[]>([]);
    const [mood, setMood] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async (d: string) => {
        setLoading(true);
        try {
            setError(null);
            const { entry } = await getCycleDay(d);
            setFlow(entry?.flow ?? null);
            setSymptoms(entry?.symptoms ?? []);
            setMood(entry?.mood ?? null);
            setNote(entry?.note ?? '');
            setDirty(false);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { load(day); }, [day, load]);

    const periodDay = BLEEDING.includes(flow);
    const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

    const onFlow = (f: Flow | null) => {
        setDirty(true);
        if (f === null) setFlow(flow === 'spotting' ? null : 'unspecified');
        else setFlow(f);
    };

    const save = async () => {
        setSaving(true);
        try {
            await saveCycleDay(day, { flow, symptoms, mood, note: note.trim() || null });
            setDirty(false);
            router.back();
        } catch (err) {
            Alert.alert('Not saved', err instanceof ApiError ? err.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    /** Walk to another day, asking first if this one has unsaved changes. */
    const go = (delta: number) => {
        const target = addDays(day, delta);
        if (target > todayDay) return;
        if (!dirty) { setDay(target); return; }
        Alert.alert('Discard changes?', 'This day has changes you have not saved.', [
            { text: 'Keep editing', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => setDay(target) },
        ]);
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
                <View style={styles.dayNav}>
                    <Pressable onPress={() => go(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous day">
                        <Ionicons name="chevron-back" size={20} color={Palette.textSecondary} />
                    </Pressable>
                    <Text style={styles.dayTitle} accessibilityRole="header">
                        {day === todayDay ? 'Today' : formatDayLong(day)}
                    </Text>
                    <Pressable
                        onPress={() => go(1)}
                        disabled={day >= todayDay}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Next day"
                        accessibilityState={{ disabled: day >= todayDay }}
                    >
                        <Ionicons name="chevron-forward" size={20} color={day >= todayDay ? Palette.border : Palette.textSecondary} />
                    </Pressable>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : error ? (
                <ErrorState error={error} subject="this day" onRetry={() => load(day)} />
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        <View style={styles.card}>
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>Period day</Text>
                                    <Text style={styles.cardHint}>
                                        {flow === 'unspecified' ? 'Pick the flow below if you know it.' : 'Were you on your period this day?'}
                                    </Text>
                                </View>
                                <Switch
                                    value={periodDay}
                                    onValueChange={(on) => { setDirty(true); setFlow(on ? 'unspecified' : null); }}
                                    trackColor={{ true: Palette.cycleFill, false: Palette.borderStrong }}
                                    thumbColor={Palette.white}
                                    accessibilityLabel="Period day"
                                />
                            </View>
                            <FlowPicker value={flow} onChange={onFlow} />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Symptoms</Text>
                            <SymptomChips value={symptoms} onChange={change(setSymptoms)} />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Mood</Text>
                            <MoodPicker value={mood} onChange={change(setMood)} />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Note</Text>
                            <TextInput
                                style={styles.note}
                                value={note}
                                onChangeText={change(setNote)}
                                placeholder="Anything worth remembering"
                                placeholderTextColor={Palette.textMuted}
                                multiline
                                maxLength={500}
                                accessibilityLabel="Note"
                            />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            <View style={styles.footer}>
                <Pressable style={[styles.cta, !dirty && styles.ctaIdle]} onPress={save} disabled={saving || !dirty} accessibilityRole="button">
                    {saving ? <ActivityIndicator color={Palette.white} size="small" /> : <Text style={styles.ctaLabel}>Save</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    dayNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    dayTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text, minWidth: 120, textAlign: 'center' },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl },
    card: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.md,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    cardTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    cardHint: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    note: {
        minHeight: 80, fontSize: 15, ...BodyFont.regular, color: Palette.text, textAlignVertical: 'top',
        padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Palette.surface,
    },
    footer: { padding: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Palette.borderLight, backgroundColor: Palette.background },
    cta: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primaryFill },
    ctaIdle: { opacity: 0.4 },
    ctaLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
}));
