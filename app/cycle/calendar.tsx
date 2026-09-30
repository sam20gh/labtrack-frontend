/**
 * The cycle calendar — every logged period, every prediction, month by month.
 *
 * Two modes, because two things are done here and they want different taps:
 *
 *   - **Browsing**: tapping a day opens its log. Future days are inert; a prediction is not a
 *     day anybody can log.
 *   - **Editing period dates** (`?edit=1`, or the button): tapping a day toggles whether it was
 *     a period day, and nothing is written until Save. This is the whole reason periods are
 *     stored as days — fixing "it started Tuesday, not Wednesday" is two taps, not a form.
 *
 * Future months are reachable, because that is where the predictions are; the grid stops three
 * months out, which is as far as the forecast draws.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState } from '@/components/errors';
import { MonthGrid, shiftMonth } from '@/components/ui/MonthGrid';
import { DayDot } from '@/components/cycle/DayDot';
import { CycleLegend } from '@/components/cycle/Legend';
import {
    getCycleCalendar, editPeriodDays, today as localToday, formatRange, sourceLine,
    type CycleCalendar,
} from '@/lib/cycle';
import { ApiError } from '@/lib/api';

export default function CycleCalendarScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ edit?: string; month?: string }>();
    const todayDay = localToday();

    const [month, setMonth] = useState(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : todayDay.slice(0, 7));
    const [data, setData] = useState<CycleCalendar | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(params.edit === '1');
    const [pending, setPending] = useState<Map<string, 'add' | 'remove'>>(new Map());
    const [saving, setSaving] = useState(false);
    const current = useRef(month);

    const load = useCallback(async (m: string) => {
        current.current = m;
        setLoading(true);
        try {
            setError(null);
            const result = await getCycleCalendar(m);
            // A quick swipe through months must not let a slow response for March land on April.
            if (current.current === m) setData(result);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            if (current.current === m) setError(err);
        } finally {
            if (current.current === m) setLoading(false);
        }
    }, [router]);

    // Re-runs on focus and whenever the month changes while focused — one fetch either way.
    useFocusEffect(useCallback(() => { load(month); }, [load, month]));

    const toggle = (day: string, isPeriod: boolean) => {
        setPending((prev) => {
            const nextMap = new Map(prev);
            if (nextMap.has(day)) nextMap.delete(day);
            else nextMap.set(day, isPeriod ? 'remove' : 'add');
            return nextMap;
        });
    };

    const save = async () => {
        if (!pending.size) { setEditing(false); return; }
        setSaving(true);
        try {
            const add = [...pending].filter(([, v]) => v === 'add').map(([d]) => d);
            const remove = [...pending].filter(([, v]) => v === 'remove').map(([d]) => d);
            await editPeriodDays({ add, remove });
            setPending(new Map());
            setEditing(false);
            await load(month);
        } catch (err) {
            Alert.alert('Not saved', err instanceof ApiError ? err.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const cancel = () => { setPending(new Map()); setEditing(false); };
    const byDay = new Map((data?.days ?? []).map((d) => [d.day, d]));
    const maxMonth = shiftMonth(todayDay.slice(0, 7), 3);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => (editing ? cancel() : router.back())} hitSlop={10} accessibilityRole="button" accessibilityLabel={editing ? 'Cancel editing' : 'Back'}>
                    <Ionicons name={editing ? 'close' : 'chevron-back'} size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle} accessibilityRole="header">{editing ? 'Edit period dates' : 'Calendar'}</Text>
                {month !== todayDay.slice(0, 7) ? (
                    <Pressable onPress={() => setMonth(todayDay.slice(0, 7))} hitSlop={8} accessibilityRole="button">
                        <Text style={styles.todayLink}>Today</Text>
                    </Pressable>
                ) : null}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {editing ? (
                    <View style={styles.editHint}>
                        <Ionicons name="hand-left-outline" size={16} color={Palette.primary} />
                        <Text style={styles.editHintText}>Tap the days you had your period. Tap again to undo.</Text>
                    </View>
                ) : null}

                {error && !data ? (
                    <ErrorState error={error} subject="your calendar" variant="inline" onRetry={() => load(month)} />
                ) : (
                    <MonthGrid
                        month={month}
                        onChangeMonth={setMonth}
                        maxMonth={editing ? todayDay.slice(0, 7) : maxMonth}
                        loading={loading && Boolean(data)}
                        cellHeight={52}
                        renderDay={(day) => {
                            const mark = byDay.get(day);
                            if (!mark) return <ActivityIndicator size="small" color={Palette.border} />;
                            const futureDay = day > todayDay;
                            return (
                                <DayDot
                                    mark={mark}
                                    pending={pending.get(day) ?? null}
                                    disabled={futureDay}
                                    onPress={futureDay ? undefined : editing
                                        ? () => toggle(day, mark.period)
                                        : () => router.push(`/cycle/log?day=${day}`)}
                                />
                            );
                        }}
                        footer={<CycleLegend fertile={Boolean(data?.fertileShown)} />}
                    />
                )}

                {!editing && data?.prediction ? (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Next period likely</Text>
                        <Text style={styles.cardValue}>{formatRange(data.prediction.window)}</Text>
                        <Text style={styles.cardNote}>{`${sourceLine(data.prediction)}. Predicted days are outlined; logged days are filled.`}</Text>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                {editing ? (
                    <Pressable style={styles.cta} onPress={save} disabled={saving} accessibilityRole="button">
                        {saving ? <ActivityIndicator color={Palette.white} size="small" /> : (
                            <Text style={styles.ctaLabel}>{pending.size ? `Save ${pending.size} change${pending.size === 1 ? '' : 's'}` : 'Done'}</Text>
                        )}
                    </Pressable>
                ) : (
                    <Pressable
                        style={styles.secondary}
                        onPress={() => { setMonth(month > todayDay.slice(0, 7) ? todayDay.slice(0, 7) : month); setEditing(true); }}
                        accessibilityRole="button"
                    >
                        <Ionicons name="create-outline" size={18} color={Palette.primary} />
                        <Text style={styles.secondaryLabel}>Edit period dates</Text>
                    </Pressable>
                )}
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    todayLink: { fontSize: 14, ...BodyFont.medium, color: Palette.primary },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg },
    editHint: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.primaryTint,
    },
    editHintText: { flex: 1, fontSize: 13, ...BodyFont.regular, color: Palette.text },
    card: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: 4,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    cardLabel: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    cardValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    cardNote: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },
    footer: { padding: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Palette.borderLight, backgroundColor: Palette.background },
    cta: {
        alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg,
        borderRadius: Radius.pill, backgroundColor: Palette.primaryFill,
    },
    ctaLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
    secondary: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary,
    },
    secondaryLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.primary },
}));
