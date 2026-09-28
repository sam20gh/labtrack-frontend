/**
 * Add a night by hand.
 *
 * **This is the fallback, not the main path.** Sleep comes from Health Connect and HealthKit
 * through the sync; this screen exists for a phone with no health store, a watch that was on
 * charge, and the first days after somebody installs the app. The header says so, because a
 * manual-entry screen offered as the primary way in would suggest the device connection does
 * not work.
 *
 * Two things it deliberately does not ask for:
 *
 * 1. **Stage minutes are optional and default to nothing.** A person does not know how much
 *    REM they had, and a form that asks would collect guesses and then score them. A night
 *    with no stages is scored on duration alone, which is what `scoreNight` already does for
 *    a watch that reports only a total.
 * 2. **Efficiency is not asked for and not derived.** Deriving it from "asleep over in bed"
 *    when nobody said how long they were awake would report a tidy 100% for every hand-typed
 *    night — the flattery `utils/healthSync.js` refuses for a source that reports no awake
 *    time.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { logNight, formatMinutes } from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/** Last night, 23:00 to 07:00 — the pair somebody adding a night is most likely to want. */
const defaults = () => {
    const wake = new Date();
    wake.setHours(7, 0, 0, 0);
    // If it is still before 7am, the night being added ended this morning either way; if it
    // is later, 7am today is still the right guess.
    const bed = new Date(wake.getTime() - 8 * 3_600_000);
    return { bed, wake };
};

export default function LogSleepScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const initial = useMemo(defaults, []);

    const [bed, setBed] = useState(initial.bed);
    const [wake, setWake] = useState(initial.wake);
    const [picking, setPicking] = useState<'bed' | 'wake' | null>(null);
    const [saving, setSaving] = useState(false);

    const inBedMin = Math.round((wake.getTime() - bed.getTime()) / 60_000);
    const valid = inBedMin > 0 && inBedMin <= 24 * 60;

    const save = async () => {
        if (saving || !valid) return;
        setSaving(true);
        try {
            await logNight({
                startedAt: bed.toISOString(),
                endedAt: wake.toISOString(),
            });
            router.back();
        } catch (err) {
            Alert.alert(
                'Not saved',
                err instanceof ApiError ? err.message : 'Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    /**
     * Android has no combined date-and-time dialog. `mode="datetime"` there opens the date
     * dialog alone, and unmounting it afterwards calls `dismiss('datetime')` on a picker table
     * that holds only `date` and `time` — a TypeError, and a white screen. So Android asks
     * twice, date then time, imperatively; iOS keeps its inline spinner, which does support it.
     */
    const pick = (which: 'bed' | 'wake') => {
        if (Platform.OS === 'ios') {
            setPicking(picking === which ? null : which);
            return;
        }
        const current = which === 'bed' ? bed : wake;
        const set = which === 'bed' ? setBed : setWake;
        DateTimePickerAndroid.open({
            value: current,
            mode: 'date',
            onChange: (e, day) => {
                if (e.type !== 'set' || !day) return;
                DateTimePickerAndroid.open({
                    value: day,
                    mode: 'time',
                    onChange: (e2, time) => {
                        if (e2.type !== 'set' || !time) return;
                        const next = new Date(day);
                        next.setHours(time.getHours(), time.getMinutes(), 0, 0);
                        set(next);
                    },
                });
            },
        });
    };

    const label = (d: Date) => d.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Add a night</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.intro}>
                    Sleep normally arrives from your watch or your phone&apos;s health store. Use this
                    when it did not — a night your watch was charging, or before a device is connected.
                </Text>

                <Pressable style={styles.field} onPress={() => pick('bed')}>
                    <Ionicons name="moon-outline" size={18} color={Palette.textSecondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Went to bed</Text>
                        <Text style={styles.fieldValue}>{label(bed)}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={Palette.textMuted} />
                </Pressable>

                {Platform.OS === 'ios' && picking === 'bed' ? (
                    <DateTimePicker
                        value={bed}
                        mode="datetime"
                        display="spinner"
                        onChange={(_e, next) => { if (next) setBed(next); }}
                    />
                ) : null}

                <Pressable style={styles.field} onPress={() => pick('wake')}>
                    <Ionicons name="sunny-outline" size={18} color={Palette.textSecondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Woke up</Text>
                        <Text style={styles.fieldValue}>{label(wake)}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={Palette.textMuted} />
                </Pressable>

                {Platform.OS === 'ios' && picking === 'wake' ? (
                    <DateTimePicker
                        value={wake}
                        mode="datetime"
                        display="spinner"
                        onChange={(_e, next) => { if (next) setWake(next); }}
                    />
                ) : null}

                <View style={styles.summary}>
                    <Text style={styles.summaryValue}>
                        {valid ? formatMinutes(inBedMin) : '—'}
                    </Text>
                    <Text style={styles.summaryLabel}>
                        {valid
                            ? 'Time in bed. Your score is worked out from this against your goal.'
                            : 'Waking up has to come after going to bed, and a night cannot be longer than a day.'}
                    </Text>
                </View>

                {/* Said plainly: a hand-typed night carries less than a measured one, and the
                    screens downstream will show that rather than filling the gaps. */}
                <Text style={styles.note}>
                    A night added by hand has no stage breakdown, so it is scored on how long you
                    slept alone. It is filed under the day you woke up.
                </Text>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={[styles.save, !valid && styles.saveDisabled]}
                    onPress={save}
                    disabled={!valid || saving}
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : <Text style={styles.saveLabel}>Save night</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl },
    intro: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19 },

    field: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderSlate,
    },
    fieldLabel: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },
    fieldValue: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },

    summary: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.primarySurface, gap: 4, alignItems: 'center',
    },
    summaryValue: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    summaryLabel: {
        fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 18,
    },
    note: { fontSize: 11, ...BodyFont.regular, color: Palette.textMuted, lineHeight: 17 },

    footer: {
        padding: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    save: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primaryFill,
    },
    saveDisabled: { backgroundColor: Palette.borderStrong },
    saveLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
}));
