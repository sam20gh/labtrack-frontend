/**
 * Medications — the hub.
 *
 * The design's home frame leads with an adherence header and a row of quick actions. The
 * one departure: the interaction check sits directly under the header rather than as a
 * fourth icon in that row, because it is the thing that makes this a *checker* rather than
 * a pill reminder, and an icon among four is not where someone finds a serious finding.
 *
 * Refetched with `useFocusEffect`: adding a medication, taking a dose and running a check
 * all push on top of this screen and return, and a stale adherence figure after logging a
 * dose is the first thing anyone would notice.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '@/lib/api';
import {
    listMedications, getSchedule, getCheck, updateDose,
    interactionVerdict, SEVERITY_META, scheduleSummary, today,
} from '@/lib/medications';
import { ensureRemindersReady, reminderState, type ReminderState } from '@/lib/notifications';
import { DoseRow } from '@/components/medications/DoseRow';
import { PillGlyph } from '@/components/medications/PillGlyph';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import type {
    TrackedMedication, MedicationScheduleDay, MedicationCheckResponse,
} from '@/types/api';

export default function MedicationsScreen() {
    const router = useRouter();
    const [medications, setMedications] = useState<TrackedMedication[]>([]);
    const [day, setDay] = useState<MedicationScheduleDay | null>(null);
    const [check, setCheck] = useState<MedicationCheckResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyDose, setBusyDose] = useState<string | null>(null);
    const [reminders, setReminders] = useState<ReminderState | null>(null);

    const load = useCallback(async () => {
        try {
            // Settled rather than all: a failing check must not blank the dose list, which
            // is the part someone opened the screen to act on.
            const [medsRes, dayRes, checkRes] = await Promise.allSettled([
                listMedications(),
                getSchedule(),
                getCheck(),
            ]);

            if (medsRes.status === 'fulfilled') setMedications(medsRes.value.medications);

            // Whether a dose reminder can actually be delivered. Checked here rather than
            // assumed, because a schedule that quietly notifies nobody is the one failure
            // this screen cannot show any other way.
            reminderState().then(setReminders).catch(() => setReminders(null));
            if (dayRes.status === 'fulfilled') setDay(dayRes.value);
            if (checkRes.status === 'fulfilled') setCheck(checkRes.value);

            const authFailure = [medsRes, dayRes, checkRes].find(
                (r) => r.status === 'rejected' && r.reason instanceof ApiError && r.reason.isAuthError
            );
            if (authFailure) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const act = async (id: string, action: 'take' | 'skip' | 'undo') => {
        setBusyDose(id);
        try {
            const result = await updateDose(id, action);
            if (result.needsRefill) {
                Alert.alert(
                    'Running low',
                    `You have ${result.remainingDoses} left. Worth ordering a repeat.`
                );
            }
            await load();
        } catch (error) {
            Alert.alert('Could not update', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setBusyDose(null);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const doses = day?.doses || [];
    const wantsReminders = medications.some((m) => m.active !== false && m.remindersEnabled);
    const needsReminderSetup = wantsReminders && reminders !== null && reminders !== 'ready';

    const enableReminders = async () => {
        if (reminders === 'unsupported') return;
        if (reminders === 'denied') { Linking.openSettings(); return; }
        const result = await ensureRemindersReady();
        setReminders(result.state);
        if (!result.ready && result.state === 'denied') Linking.openSettings();
    };

    const pending = doses.filter((d) => d.status === 'scheduled');
    const adherence = day?.adherence;
    const verdict = interactionVerdict(check?.check || null);

    // Nothing set up yet — the design's first frame
    if (!medications.length) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Header router={router} />
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="medkit-outline" size={38} color={Palette.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Track medications that matter</Text>
                    <Text style={styles.emptyBody}>
                        Add what you take and LabTrack will remind you, keep the record, and
                        check how your medicines sit together — against your own results and
                        conditions.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.push('/medications/add')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryButtonText}>Add a medication</Text>
                        <Ionicons name="add" size={18} color={Palette.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push('/medications/scan')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="scan-outline" size={17} color={Palette.primary} />
                        <Text style={styles.secondaryButtonText}>Scan a pill or packet</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header router={router} />

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                {/* Adherence header, from the design's home frame */}
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <Text style={styles.heroLabel}>
                        {pending.length
                            ? `You have ${pending.length} ${pending.length === 1 ? 'dose' : 'doses'} left today`
                            : doses.length
                                ? "That's everything for today"
                                : 'Nothing scheduled today'}
                    </Text>

                    {/*
                      Three shares of the doses that have already come due. A dose scheduled
                      for tonight is neither taken nor missed, and counting it as missed
                      would show a failing score every morning.
                    */}
                    <View style={styles.statRow}>
                        <Stat value={adherence?.onTimeRate} label="On time" />
                        <Stat value={adherence?.lateRate} label="Late" />
                        <Stat value={adherence?.missedRate} label="Missed" />
                    </View>
                    {adherence?.score === null ? (
                        <Text style={styles.heroNote}>
                            Nothing has come due yet today, so there is nothing to score.
                        </Text>
                    ) : null}
                </LinearGradient>

                {/*
                  The interaction check. Above the dose list on purpose: a serious finding is
                  the most important thing this screen can tell someone, and it must not sit
                  below a scroll.
                */}
                <TouchableOpacity
                    style={[
                        styles.checkCard,
                        verdict.tone !== 'neutral' && {
                            backgroundColor: SEVERITY_META[verdict.tone].bg,
                            borderColor: SEVERITY_META[verdict.tone].border,
                        },
                    ]}
                    onPress={() => router.push('/medications/interactions')}
                    activeOpacity={0.85}
                >
                    <View style={[
                        styles.checkIcon,
                        verdict.tone !== 'neutral' && { backgroundColor: SEVERITY_META[verdict.tone].color },
                    ]}>
                        <Ionicons
                            name={verdict.tone === 'neutral' ? 'shield-outline' : SEVERITY_META[verdict.tone].icon as any}
                            size={19}
                            color={Palette.white}
                        />
                    </View>
                    <View style={styles.checkBody}>
                        <Text style={styles.checkTitle}>{verdict.title}</Text>
                        <Text style={styles.checkDetail}>{verdict.detail}</Text>
                        {check?.stale ? (
                            <Text style={styles.checkStale}>
                                Your list has changed since this ran — tap to check again.
                            </Text>
                        ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                </TouchableOpacity>

                {/*
                  Reminders that cannot arrive.
                  A dose reminder is a server push, so a medication with "Remind me" on and
                  no registered device is a schedule that will never make a sound. Saying so
                  is the same call the assistant's greyed-out microphone makes: a control
                  that silently does nothing is worse than one that explains itself.
                */}
                {needsReminderSetup ? (
                    <TouchableOpacity
                        style={styles.reminderBanner}
                        onPress={enableReminders}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="notifications-off-outline" size={19} color="#B45309" />
                        <View style={styles.reminderBody}>
                            <Text style={styles.reminderTitle}>Dose reminders are not arriving</Text>
                            <Text style={styles.reminderDetail}>
                                {reminders === 'denied'
                                    ? 'Notifications are turned off for LabTrack. Tap to open your device settings.'
                                    : reminders === 'unsupported'
                                        ? 'Push notifications do not work on a simulator.'
                                        : 'This device is not set up to receive them yet. Tap to turn them on.'}
                            </Text>
                        </View>
                        {reminders !== 'unsupported' ? (
                            <Ionicons name="chevron-forward" size={18} color="#B45309" />
                        ) : null}
                    </TouchableOpacity>
                ) : null}

                {/* Quick actions, from the design's icon row */}
                <View style={styles.actionRow}>
                    <QuickAction icon="add" label="Add" onPress={() => router.push('/medications/add')} />
                    <QuickAction icon="scan-outline" label="Scan" onPress={() => router.push('/medications/scan')} />
                    <QuickAction icon="search-outline" label="Browse" onPress={() => router.push('/medications/search')} />
                    <QuickAction icon="calendar-outline" label="Schedule" onPress={() => router.push('/medications/schedule')} />
                </View>

                {/* Today's doses */}
                <SectionHeader
                    title="Today"
                    action={doses.length ? 'Full schedule' : undefined}
                    onAction={() => router.push('/medications/schedule')}
                />

                {doses.length === 0 ? (
                    <View style={styles.quietCard}>
                        <Ionicons name="cafe-outline" size={20} color={Palette.textMuted} />
                        <Text style={styles.quietText}>
                            Nothing is due today. Medicines you take only when needed do not
                            appear here.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.doseList}>
                        {doses.map((dose) => (
                            <DoseRow
                                key={dose._id}
                                dose={dose}
                                busy={busyDose === dose._id}
                                onTake={() => act(dose._id, 'take')}
                                onSkip={() => act(dose._id, 'skip')}
                                onUndo={() => act(dose._id, 'undo')}
                                onPress={() => dose.medication && router.push(`/medications/${dose.medication._id}`)}
                            />
                        ))}
                    </View>
                )}

                {/* The full list */}
                <SectionHeader
                    title={`Your medicines (${medications.length})`}
                    action="Insight"
                    onAction={() => router.push('/medications/insight')}
                />

                <View style={styles.medList}>
                    {medications.map((m) => (
                        <TouchableOpacity
                            key={m._id}
                            style={styles.medRow}
                            onPress={() => router.push(`/medications/${m._id}`)}
                            activeOpacity={0.75}
                        >
                            <PillGlyph shape={m.shape} colour={m.colour} size={40} />
                            <View style={styles.medBody}>
                                <Text style={styles.medName} numberOfLines={1}>
                                    {m.name}
                                    {m.strength ? <Text style={styles.medStrength}> {m.strength}</Text> : null}
                                </Text>
                                <Text style={styles.medSub} numberOfLines={1}>
                                    {m.catalogue?.plainName || scheduleSummary(m)}
                                </Text>
                            </View>
                            {m.needsRefill ? (
                                <View style={styles.refillChip}>
                                    <Text style={styles.refillText}>Low</Text>
                                </View>
                            ) : null}
                            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/*
                  The standing caveat. Present on the hub, not only on the check screen —
                  someone who never opens the checker still needs to know what this is and
                  is not.
                */}
                <Text style={styles.footer}>{check?.safetyNote}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const Header = ({ router }: { router: ReturnType<typeof useRouter> }) => (
    <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medications</Text>
        <TouchableOpacity onPress={() => router.push('/medications/insight')} hitSlop={8}>
            <Ionicons name="stats-chart-outline" size={20} color={Palette.textSecondary} />
        </TouchableOpacity>
    </View>
);

/** A percentage that reads as "not yet" rather than as zero when nothing has come due. */
const Stat = ({ value, label }: { value: number | null | undefined; label: string }) => (
    <View style={styles.stat}>
        <Text style={styles.statValue}>
            {value === null || value === undefined ? '—' : value}
            {value !== null && value !== undefined ? <Text style={styles.statPercent}>%</Text> : null}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const QuickAction = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.actionIcon}>
            <Ionicons name={icon as any} size={20} color={Palette.primary} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
);

const SectionHeader = ({ title, action, onAction }: {
    title: string; action?: string; onAction?: () => void;
}) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && onAction ? (
            <TouchableOpacity onPress={onAction} hitSlop={8}>
                <Text style={styles.sectionAction}>{action}</Text>
            </TouchableOpacity>
        ) : null}
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.lg },
    heroLabel: { fontSize: 15, color: Palette.white, fontFamily: Fonts.medium },
    heroNote: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.regular },
    statRow: { flexDirection: 'row', justifyContent: 'space-between' },
    stat: { flex: 1 },
    statValue: { fontSize: 24, color: Palette.white, fontFamily: Fonts.bold },
    statPercent: { fontSize: 13, fontFamily: Fonts.regular },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.regular, marginTop: 2 },

    reminderBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    reminderBody: { flex: 1 },
    reminderTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: '#92400E' },
    reminderDetail: { fontFamily: Fonts.regular, fontSize: 12, color: '#B45309', marginTop: 2, lineHeight: 17 },
    checkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        ...Shadow.card,
    },
    checkIcon: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary,
    },
    checkBody: { flex: 1, gap: 2 },
    checkTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    checkDetail: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 17 },
    checkStale: { fontSize: 11, color: Palette.primary, fontFamily: Fonts.medium, marginTop: 2 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    action: { alignItems: 'center', gap: 6, flex: 1 },
    actionIcon: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    actionLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    sectionAction: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.medium },

    doseList: { gap: Spacing.sm },
    medList: { gap: Spacing.sm },
    medRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.md,
    },
    medBody: { flex: 1, gap: 2 },
    medName: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    medStrength: { fontFamily: Fonts.regular, color: Palette.textSecondary },
    medSub: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    refillChip: {
        backgroundColor: Palette.warningSurface,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: Radius.sm,
    },
    refillText: { fontSize: 10, color: Palette.warning, fontFamily: Fonts.semibold },

    quietCard: {
        flexDirection: 'row',
        gap: Spacing.md,
        alignItems: 'center',
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
    },
    quietText: { flex: 1, fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 19 },

    footer: {
        fontSize: 11,
        color: Palette.textMuted,
        fontFamily: Fonts.regular,
        lineHeight: 17,
        marginTop: Spacing.sm,
    },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.md },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    emptyTitle: { fontSize: 21, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    emptyBody: {
        fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.regular,
        textAlign: 'center', lineHeight: 21, marginBottom: Spacing.md,
    },
    primaryButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary,
        borderRadius: Radius.md,
        paddingVertical: 15,
        alignSelf: 'stretch',
    },
    primaryButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    secondaryButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.md,
        paddingVertical: 15,
        alignSelf: 'stretch',
    },
    secondaryButtonText: { fontSize: 15, color: Palette.primary, fontFamily: Fonts.semibold },
});
