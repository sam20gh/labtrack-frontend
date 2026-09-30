/**
 * Cycle settings — the switch, the status, the fertile window, reminders, and the way out.
 *
 * Every control saves as it changes, optimistically, and puts itself back if the save fails:
 * a switch that waits on a round trip before it moves feels broken. The one exception is
 * deleting everything, which asks first and cannot be undone — `DELETE /cycle/data` removes
 * every logged day, and the confirmation says exactly that.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState } from '@/components/errors';
import {
    getCyclePlan, updateCyclePlan, deleteAllCycleData, deleteImportedDays, STATUSES, FERTILE_DISCLAIMER,
    type CyclePlan, type CyclePlanUpdate,
} from '@/lib/cycle';
import {
    isCycleImportOn, enableCycleImport, disableCycleImport, importSourceLabel, importSource,
} from '@/lib/health/cycleImport';
import { runSync, resetSyncThrottle } from '@/lib/health/sync';
import { ApiError } from '@/lib/api';

function Row({ title, body, value, onChange, disabled }: {
    title: string; body?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={[styles.row, disabled && { opacity: 0.45 }]}>
            <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>{title}</Text>
                {body ? <Text style={styles.rowBody}>{body}</Text> : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                disabled={disabled}
                trackColor={{ true: Palette.primaryFill, false: Palette.borderStrong }}
                thumbColor={Palette.white}
                accessibilityLabel={title}
            />
        </View>
    );
}

function Length({ label, value, min, max, onChange }: {
    label: string; value: number | null; min: number; max: number; onChange: (v: number | null) => void;
}) {
    const Palette = usePalette();
    const styles = useStyles();
    const shown = value ?? null;
    return (
        <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
            <Pressable
                onPress={() => onChange(shown === null ? null : Math.max(min, shown - 1))}
                disabled={shown === null || shown <= min}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${label}`}
            >
                <Ionicons name="remove-circle-outline" size={26} color={shown === null ? Palette.border : Palette.primary} />
            </Pressable>
            <Pressable
                onPress={() => onChange(shown === null ? Math.round((min + max) / 2) : null)}
                accessibilityRole="button"
                accessibilityLabel={shown === null ? `Set ${label}` : `${label} ${shown} days. Tap to clear`}
            >
                <Text style={styles.lengthValue}>{shown === null ? 'Not set' : `${shown} days`}</Text>
            </Pressable>
            <Pressable
                onPress={() => onChange(shown === null ? null : Math.min(max, shown + 1))}
                disabled={shown === null || shown >= max}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${label}`}
            >
                <Ionicons name="add-circle-outline" size={26} color={shown === null ? Palette.border : Palette.primary} />
            </Pressable>
        </View>
    );
}

export default function CycleSettingsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [plan, setPlan] = useState<CyclePlan | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [deleting, setDeleting] = useState(false);
    const [importOn, setImportOn] = useState(false);
    const [importing, setImporting] = useState(false);
    const [imported, setImported] = useState<number>(0);
    const storeLabel = importSourceLabel();
    const storeSource = importSource();

    const load = useCallback(async () => {
        try {
            setError(null);
            const [res, on] = await Promise.all([getCyclePlan(), isCycleImportOn()]);
            setPlan(res.plan);
            setImportOn(on);
            setImported(storeSource ? res.imported?.[storeSource] ?? 0 : 0);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            setError(err);
        }
    }, [router, storeSource]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /**
     * Switching the import on asks the store for the cycle types — the only place that prompt
     * appears — then syncs straight away so the history it holds arrives while the person is
     * still looking at this screen.
     */
    const toggleImport = async (on: boolean) => {
        if (!on) {
            await disableCycleImport();
            setImportOn(false);
            return;
        }
        setImporting(true);
        try {
            const granted = await enableCycleImport();
            if (!granted) {
                Alert.alert(
                    'Not shared',
                    Platform.OS === 'android'
                        ? 'Health Connect did not share period data. It will not ask again, so allow it under Health Connect → App permissions → Predyqt.'
                        : 'Apple Health did not share period data. You can allow it under Settings → Health → Data Access & Devices → Predyqt.',
                );
                return;
            }
            setImportOn(true);
            resetSyncThrottle();
            await runSync(true);
            await load();
        } finally {
            setImporting(false);
        }
    };

    const confirmRemoveImported = () => {
        if (!storeSource) return;
        Alert.alert(
            `Remove days from ${storeLabel}?`,
            `The ${imported} period day${imported === 1 ? '' : 's'} brought in from ${storeLabel} are removed here. Anything you logged in Predyqt stays, and ${storeLabel} keeps its own copy.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive',
                    onPress: async () => {
                        try {
                            await disableCycleImport();
                            setImportOn(false);
                            await deleteImportedDays(storeSource);
                            await load();
                        } catch (err) {
                            Alert.alert('Not removed', err instanceof ApiError ? err.message : 'Please try again.');
                        }
                    },
                },
            ],
        );
    };

    const save = async (update: CyclePlanUpdate, optimistic: Partial<CyclePlan>) => {
        const before = plan;
        setPlan((p) => (p ? { ...p, ...optimistic } : p));
        try {
            setPlan((await updateCyclePlan(update)).plan);
        } catch (err) {
            setPlan(before);
            Alert.alert('Not saved', err instanceof ApiError ? err.message : 'Please try again.');
        }
    };

    const confirmDelete = () => {
        Alert.alert(
            'Delete all cycle data?',
            'Every period, symptom, mood and note you have logged, and these settings, will be permanently deleted. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete everything', style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await deleteAllCycleData();
                            router.dismissAll();
                            router.replace('/profile');
                        } catch (err) {
                            Alert.alert('Not deleted', err instanceof ApiError ? err.message : 'Please try again.');
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ],
        );
    };

    const header = (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">Cycle settings</Text>
        </View>
    );

    if (!plan) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                {error ? <ErrorState error={error} subject="your cycle settings" onRetry={load} /> : (
                    <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
                )}
            </SafeAreaView>
        );
    }

    const fertileOffered = plan.status === 'none' || plan.status === 'perimenopause';
    const paused = plan.status === 'pregnant' || plan.status === 'breastfeeding';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.group}>
                    <Row
                        title="Cycle tracking"
                        body={plan.enabled ? 'Predictions and reminders are on.' : 'Off. Your logged days are kept.'}
                        value={plan.enabled}
                        onChange={(v) => save({ enabled: v }, { enabled: v })}
                    />
                </View>

                <Text style={styles.groupTitle}>Does any of these apply?</Text>
                <View style={styles.group} accessibilityRole="radiogroup">
                    {STATUSES.map((s) => {
                        const on = plan.status === s.key;
                        return (
                            <Pressable
                                key={s.key}
                                style={styles.row}
                                onPress={() => save({ status: s.key }, { status: s.key })}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                            >
                                <View style={{ flex: 1, gap: 2 }}>
                                    <Text style={styles.rowTitle}>{s.label}</Text>
                                    <Text style={styles.rowBody}>{s.body}</Text>
                                </View>
                                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? Palette.primary : Palette.textMuted} />
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.groupTitle}>What is usual for you</Text>
                <View style={styles.group}>
                    <Length
                        label="Period length" value={plan.seed.periodLength} min={2} max={10}
                        onChange={(v) => save({ seed: { periodLength: v } }, { seed: { ...plan.seed, periodLength: v } })}
                    />
                    <Length
                        label="Cycle length" value={plan.seed.cycleLength} min={21} max={45}
                        onChange={(v) => save({ seed: { cycleLength: v } }, { seed: { ...plan.seed, cycleLength: v } })}
                    />
                </View>
                <Text style={styles.footnote}>Only used until you have logged two cycles.</Text>

                {fertileOffered ? (
                    <View style={styles.group}>
                        <Row
                            title="Show my fertile window"
                            body={FERTILE_DISCLAIMER}
                            value={plan.showFertileWindow}
                            onChange={(v) => save({ showFertileWindow: v }, { showFertileWindow: v, fertileAllowed: v })}
                        />
                    </View>
                ) : null}

                <Text style={styles.groupTitle}>Reminders</Text>
                <View style={styles.group}>
                    <Row
                        title="Before my period"
                        body="A couple of days before it is likely to start."
                        value={plan.reminders.periodSoon}
                        disabled={paused}
                        onChange={(v) => save({ reminders: { periodSoon: v } }, { reminders: { ...plan.reminders, periodSoon: v } })}
                    />
                    <Row
                        title="If my period is late"
                        body="Once, not every morning."
                        value={plan.reminders.late}
                        disabled={paused}
                        onChange={(v) => save({ reminders: { late: v } }, { reminders: { ...plan.reminders, late: v } })}
                    />
                    <Row
                        title="Discreet on the lock screen"
                        body={'Shows "A reminder from Predyqt" rather than what it is about.'}
                        value={plan.discreetPush}
                        onChange={(v) => save({ discreetPush: v }, { discreetPush: v })}
                    />
                </View>
                {paused ? <Text style={styles.footnote}>Reminders are paused while you are pregnant or breastfeeding.</Text> : null}

                {storeLabel ? (
                    <>
                        <Text style={styles.groupTitle}>{`From ${storeLabel}`}</Text>
                        <View style={styles.group}>
                            <Row
                                title={`Import periods from ${storeLabel}`}
                                body={importing
                                    ? 'Importing…'
                                    : importOn
                                        ? `On. ${imported} day${imported === 1 ? '' : 's'} imported so far; new ones arrive whenever the app syncs.`
                                        : `Brings in the periods ${storeLabel} already has${Platform.OS === 'ios' ? ', and Apple Watch sleeping wrist temperature' : ''}. Only asked for when you switch this on.`}
                                value={importOn}
                                disabled={importing}
                                onChange={toggleImport}
                            />
                            {imported > 0 ? (
                                <Pressable style={styles.row} onPress={confirmRemoveImported} accessibilityRole="button">
                                    <Text style={[styles.rowTitle, { flex: 1 }]}>Remove imported days</Text>
                                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                </Pressable>
                            ) : null}
                        </View>
                        <Text style={styles.footnote}>
                            Anything you log here wins over what was imported for the same day.
                        </Text>
                    </>
                ) : null}

                <View style={styles.privacy}>
                    <Ionicons name="lock-closed-outline" size={16} color={Palette.textSecondary} />
                    <Text style={styles.privacyText}>
                        Your cycle is private to you. Clinicians reviewing your results do not see it, and it is never
                        shared. The assistant can read a summary so it can answer your questions about it.
                    </Text>
                </View>

                <Pressable style={styles.danger} onPress={confirmDelete} disabled={deleting} accessibilityRole="button">
                    {deleting ? <ActivityIndicator color={Palette.danger} /> : (
                        <>
                            <Ionicons name="trash-outline" size={18} color={Palette.danger} />
                            <Text style={styles.dangerLabel}>Delete all cycle data</Text>
                        </>
                    )}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.xxxl },
    groupTitle: { fontSize: 13, ...BodyFont.semibold, color: Palette.textSecondary, marginTop: Spacing.md },
    group: { borderRadius: Radius.lg, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight, overflow: 'hidden' },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    rowTitle: { fontSize: 15, ...BodyFont.medium, color: Palette.text },
    rowBody: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },
    lengthValue: { fontSize: 14, ...BodyFont.semibold, color: Palette.text, minWidth: 64, textAlign: 'center' },
    footnote: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted },
    privacy: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Palette.borderLight, marginTop: Spacing.md },
    privacyText: { flex: 1, fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },
    danger: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center',
        padding: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border,
    },
    dangerLabel: { fontSize: 15, ...BodyFont.semibold, color: Palette.danger },
}));
