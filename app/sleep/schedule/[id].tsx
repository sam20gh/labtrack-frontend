/**
 * New / Edit Sleep Schedule — `Design/sleep.svg` frames 15, 16 and 17.
 *
 * `new` is handled as an id rather than as a second route, the way
 * `labtrack-web`'s resource editor does: creating and editing a schedule are the same form
 * against the same shape, and two files would be two copies of it drifting apart.
 *
 * **The alarm half of the kit's form is not here, and its absence is the point.** Frames 15
 * and 16 draw an alarm sound picker, a repeat mode, a vibration toggle and a volume slider.
 * A ringing alarm has to fire with the app closed and the phone locked, which needs a
 * foreground service on Android and a critical-alert entitlement on iOS — neither of which
 * this build has. Drawing those controls would produce an alarm that silently does not go
 * off on the one morning somebody depended on it, which is the class of dummy control this
 * app keeps removing. What is here instead is a bedtime reminder, delivered by the same push
 * path medication doses use, and the screen says exactly that.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, TextInput, Pressable, Switch, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { TimeDial } from '@/components/sleep/TimeDial';
import {
    listSchedules, createSchedule, updateSchedule, deleteSchedule,
    formatClock, formatMinutes, type SleepSchedule,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

const WEEKDAYS = [
    { index: 1, letter: 'M' }, { index: 2, letter: 'T' }, { index: 3, letter: 'W' },
    { index: 4, letter: 'T' }, { index: 5, letter: 'F' }, { index: 6, letter: 'S' },
    { index: 0, letter: 'S' },
];

/** The lead times the reminder offers. 0 is "at bedtime", which is a real choice. */
const LEADS = [0, 15, 30, 45, 60];

export default function SleepScheduleEditor() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const isNew = !id || id === 'new';

    const [name, setName] = useState('Daily sleep');
    const [bedtimeMin, setBedtime] = useState(22 * 60 + 30);
    const [wakeMin, setWake] = useState(6 * 60 + 30);
    const [days, setDays] = useState<number[]>([]);
    const [remind, setRemind] = useState(30);
    const [enabled, setEnabled] = useState(true);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (isNew) return;
        try {
            // The list is one small request and there is no per-schedule read on the API;
            // adding one for a collection this size would be an endpoint with no bug behind it.
            const { schedules } = await listSchedules();
            const found = schedules.find((s) => s._id === id);
            if (!found) { router.back(); return; }
            setName(found.name);
            setBedtime(found.bedtimeMin);
            setWake(found.wakeMin);
            setDays(found.days || []);
            setRemind(found.remindMinutesBefore);
            setEnabled(found.enabled);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Alert.alert('Not loaded', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [id, isNew, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const span = useMemo(
        () => ((wakeMin - bedtimeMin) % 1440 + 1440) % 1440,
        [bedtimeMin, wakeMin]
    );

    const toggleDay = (index: number) => {
        setDays((prev) => (prev.includes(index)
            ? prev.filter((d) => d !== index)
            : [...prev, index].sort((a, b) => a - b)));
    };

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const body: Partial<SleepSchedule> = {
                name: name.trim() || 'Sleep schedule',
                bedtimeMin, wakeMin, days, enabled, remindMinutesBefore: remind,
            };
            if (isNew) await createSchedule(body);
            else await updateSchedule(String(id), body);
            router.back();
        } catch (err) {
            Alert.alert('Not saved', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        Alert.alert('Delete this schedule?', 'Its reminders will stop.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteSchedule(String(id));
                        router.back();
                    } catch (err) {
                        Alert.alert('Not deleted', err instanceof Error ? err.message : 'Please try again.');
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle}>
                    {isNew ? 'New sleep schedule' : 'Edit sleep schedule'}
                </Text>
                {isNew ? (
                    <View style={{ width: 22 }} />
                ) : (
                    <Pressable onPress={remove} hitSlop={10}>
                        <Ionicons name="trash-outline" size={20} color={Palette.textSecondary} />
                    </Pressable>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Schedule name</Text>
                    <View style={styles.inputBox}>
                        <Ionicons name="bookmark-outline" size={18} color={Palette.textMuted} />
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Daily sleep"
                            placeholderTextColor={Palette.textMuted}
                            maxLength={60}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Bedtime and wake up</Text>
                    <TimeDial
                        bedtimeMin={bedtimeMin}
                        wakeMin={wakeMin}
                        onChange={({ bedtimeMin: b, wakeMin: w }) => { setBedtime(b); setWake(w); }}
                    />
                    <View style={styles.times}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.timeHead}>
                                <View style={[styles.dot, { backgroundColor: Palette.text }]} />
                                <Text style={styles.timeLabel}>Bedtime</Text>
                            </View>
                            <Text style={styles.timeValue}>{formatClock(bedtimeMin)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.timeHead}>
                                <View style={[styles.dot, { backgroundColor: Palette.primary }]} />
                                <Text style={styles.timeLabel}>Wake up</Text>
                            </View>
                            <Text style={styles.timeValue}>{formatClock(wakeMin)}</Text>
                        </View>
                    </View>
                    <Text style={styles.hint}>{`That is ${formatMinutes(span)} in bed.`}</Text>
                </View>

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Active on</Text>
                    <View style={styles.dayRow}>
                        {WEEKDAYS.map((day) => {
                            // An empty selection means every day, so nothing selected draws
                            // as everything selected rather than as a schedule that never runs.
                            const on = days.length === 0 || days.includes(day.index);
                            return (
                                <Pressable
                                    key={day.index}
                                    style={[styles.day, on && styles.dayOn]}
                                    onPress={() => toggleDay(day.index)}
                                >
                                    <Text style={[styles.dayLetter, on && styles.dayLetterOn]}>
                                        {day.letter}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Text style={styles.hint}>
                        {days.length === 0 ? 'Every day' : 'Only the days you picked'}
                    </Text>
                </View>

                <View style={styles.field}>
                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Bedtime reminder</Text>
                            <Text style={styles.hint}>
                                A push notification before bedtime. Not an alarm — it will not wake you up.
                            </Text>
                        </View>
                        <Switch
                            value={enabled}
                            onValueChange={setEnabled}
                            trackColor={{ false: Palette.borderSlate, true: Palette.primary }}
                            thumbColor={Palette.white}
                        />
                    </View>

                    {enabled ? (
                        <View style={styles.chips}>
                            {LEADS.map((lead) => (
                                <Pressable
                                    key={lead}
                                    style={[styles.chip, remind === lead && styles.chipActive]}
                                    onPress={() => setRemind(lead)}
                                >
                                    <Text style={[styles.chipLabel, remind === lead && styles.chipLabelActive]}>
                                        {lead === 0 ? 'At bedtime' : `${lead}m before`}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable style={styles.save} onPress={save} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : (
                            <>
                                <Text style={styles.saveLabel}>
                                    {isNew ? 'Create schedule' : 'Save changes'}
                                </Text>
                                <Ionicons name={isNew ? 'add' : 'checkmark'} size={18} color={Palette.white} />
                            </>
                        )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.xxl, paddingBottom: Spacing.xxxl },

    field: { gap: Spacing.sm },
    fieldLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    hint: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },

    inputBox: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    input: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Palette.text, padding: 0 },

    times: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.md },
    timeHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    timeLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    timeValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },

    dayRow: { flexDirection: 'row', gap: Spacing.sm },
    day: {
        flex: 1, aspectRatio: 1, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    dayOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    dayLetter: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    dayLetterOn: { color: Palette.primary },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    chipActive: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    chipLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipLabelActive: { color: Palette.primary },

    footer: {
        padding: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    save: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    saveLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
