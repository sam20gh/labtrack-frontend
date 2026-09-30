/**
 * The cycle dashboard.
 *
 * One question decides the layout: **what does somebody open this for?** Almost always one of
 * two things — to log that their period started, or to see when it is due. So the ring and its
 * sentence come first, the one action that fits the moment sits directly under them, and
 * everything else is below the fold.
 *
 * Five decisions:
 *
 * 1. **The primary action changes with the state.** Not on a period: "Period started today".
 *    On one and today not yet logged: "Still on my period" beside "It's finished". Paused:
 *    "Change status". A dashboard with all of them at once is a dashboard where the likeliest
 *    tap is a guess.
 * 2. **"It's finished" writes nothing.** The period ended on the last day logged, which the
 *    record already says; what it dismisses is the question, remembered on this device for
 *    this period only. Writing an "end" row would be a second source of truth about the same
 *    days.
 * 3. **A period somebody only logged the start of is asked about**, once, with the likely end
 *    offered as one tap. Without it a one-day period feeds the average and every period after
 *    is predicted a day long.
 * 4. **Flow is one tap on the dashboard; symptoms are one screen away.** Flow is the thing
 *    logged every day of a period; symptoms are occasional, and twelve chips above the fold
 *    would push the prediction off the screen.
 * 5. **Notes are neutral rows, never a warning.** "Worth mentioning to a doctor" in the colour
 *    of a finding would read as one. `PlanNotes` holds the same line.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState } from '@/components/errors';
import { CycleRing } from '@/components/cycle/CycleRing';
import { DayDot } from '@/components/cycle/DayDot';
import { FlowPicker } from '@/components/cycle/LogControls';
import {
    getCycleOverview, updateCyclePlan, editPeriodDays, saveCycleDay, headline, formatRange, formatDay,
    daysBetween, addDays, sourceLine, symptomLabel, MOODS, FERTILE_DISCLAIMER,
    type CycleOverview, type Flow,
} from '@/lib/cycle';
import { ApiError } from '@/lib/api';

/** The period whose "is it over?" question was answered on this device. See decision 2. */
const ENDED_KEY = 'cycle.endedPeriodStart';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const styles = useStyles();
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
            {children}
        </View>
    );
}

function LinkRow({ icon, title, body, onPress }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string; onPress: () => void;
}) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <Pressable style={styles.linkRow} onPress={onPress} accessibilityRole="button">
            <View style={styles.linkIcon}><Ionicons name={icon} size={18} color={Palette.textSecondary} /></View>
            <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{title}</Text>
                <Text style={styles.linkBody}>{body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </Pressable>
    );
}

export default function CycleDashboard() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [data, setData] = useState<CycleOverview | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [endedStart, setEndedStart] = useState<string | null>(null);
    const mounted = useRef(true);

    const load = useCallback(async () => {
        try {
            setError(null);
            const [overview, ended] = await Promise.all([
                getCycleOverview(),
                AsyncStorage.getItem(ENDED_KEY).catch(() => null),
            ]);
            if (!mounted.current) return;
            if (!overview.plan.onboarded) {
                router.replace('/cycle/setup');
                return;
            }
            setData(overview);
            setEndedStart(ended);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            if (mounted.current) setError(err);
        } finally {
            if (mounted.current) { setLoading(false); setRefreshing(false); }
        }
    }, [router]);

    useFocusEffect(useCallback(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; };
    }, [load]));

    /** Every write goes through here: one spinner, one refetch, one place errors surface. */
    const act = async (work: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await work();
            await load();
        } catch (err) {
            // The dashboard is already drawn; replacing it with an error screen would hide
            // the thing that did not change. Say what failed and leave it where it was.
            Alert.alert('Not saved', err instanceof ApiError ? err.message : 'Please try again.');
        } finally {
            if (mounted.current) setBusy(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (!data) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ErrorState error={error} subject="your cycle" onRetry={() => { setLoading(true); load(); }} />
            </SafeAreaView>
        );
    }

    const header = (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">Cycle</Text>
            <View style={styles.headerActions}>
                <Pressable onPress={() => router.push('/cycle/calendar')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Calendar">
                    <Ionicons name="calendar-outline" size={22} color={Palette.text} />
                </Pressable>
                <Pressable onPress={() => router.push('/cycle/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cycle settings">
                    <Ionicons name="settings-outline" size={22} color={Palette.text} />
                </Pressable>
            </View>
        </View>
    );

    // Set up, then switched off: say so, and offer the switch rather than a dashboard of
    // predictions nobody asked to see.
    if (data.access === 'off') {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <View style={styles.centre}>
                    <Ionicons name="flower-outline" size={40} color={Palette.textMuted} />
                    <Text style={styles.offTitle}>Cycle tracking is off</Text>
                    <Text style={styles.offBody}>Your logged days are kept. Turn it back on to see predictions and get reminders.</Text>
                    <Pressable
                        style={styles.primaryBtn}
                        onPress={() => act(() => updateCyclePlan({ enabled: true }))}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryLabel}>Turn on</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const { reading, plan, today, todayLog } = data;
    const yesterday = addDays(today, -1);
    const current = reading.currentPeriod;
    const acknowledgedEnd = Boolean(current && endedStart === current.start && current.loggedThrough < today);
    const onPeriod = Boolean(current) && !acknowledgedEnd;
    const words = acknowledgedEnd && reading.prediction
        ? { title: `Next period likely ${formatRange(reading.prediction.window)}`, detail: `${sourceLine(reading.prediction)}.` }
        : headline(reading, plan.status);
    const ringSize = Math.min(250, width - Spacing.xl * 2 - 40);

    const startToday = () => act(async () => {
        await AsyncStorage.removeItem(ENDED_KEY).catch(() => {});
        await editPeriodDays({ add: [today] });
    });
    const finished = async () => {
        if (!current) return;
        await AsyncStorage.setItem(ENDED_KEY, current.start).catch(() => {});
        setEndedStart(current.start);
    };
    const setFlow = (flow: Flow | null) => act(() => saveCycleDay(today, {
        flow,
        symptoms: todayLog?.symptoms ?? [],
        mood: todayLog?.mood ?? null,
        note: todayLog?.note ?? null,
    }));

    let actions: React.ReactNode;
    if (reading.state === 'paused') {
        actions = (
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/cycle/settings')} accessibilityRole="button">
                <Text style={styles.secondaryLabel}>Change status</Text>
            </Pressable>
        );
    } else if (onPeriod && current?.loggedThrough === yesterday) {
        actions = (
            <View style={styles.actionRow}>
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={startToday} disabled={busy} accessibilityRole="button">
                    <Text style={styles.primaryLabel}>Still going</Text>
                </Pressable>
                <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={finished} accessibilityRole="button">
                    <Text style={styles.secondaryLabel}>It&apos;s finished</Text>
                </Pressable>
            </View>
        );
    } else if (!(onPeriod && current?.loggedThrough === today)) {
        // Loud only when it is likely. Nine days out the same action is still one tap away,
        // outlined — a solid purple button there reads as "you should be doing this now".
        const likely = reading.state !== 'upcoming' || (reading.daysUntil?.from ?? 99) <= 3;
        actions = (
            <View style={{ gap: Spacing.sm, alignSelf: 'stretch' }}>
                <Pressable style={likely ? styles.primaryBtn : [styles.secondaryBtn, styles.withIcon]} onPress={startToday} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color={likely ? Palette.white : Palette.primary} size="small" /> : (
                        <>
                            <Ionicons name="water" size={18} color={likely ? Palette.white : Palette.primary} />
                            <Text style={likely ? styles.primaryLabel : styles.secondaryLabel}>Period started today</Text>
                        </>
                    )}
                </Pressable>
                <Pressable onPress={() => router.push('/cycle/calendar?edit=1')} style={styles.textBtn} accessibilityRole="button">
                    <Text style={styles.textBtnLabel}>Started on another day</Text>
                </Pressable>
            </View>
        );
    }

    const prompt = data.prompt;
    const fertile = plan.fertileAllowed ? reading.fertile : null;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Palette.primary} />
                }
            >
                {header}

                {/* ------------------------------------------------ the ring */}
                <View style={styles.hero}>
                    <CycleRing reading={reading} size={ringSize}>
                        {reading.cycleDay ? (
                            <>
                                <Text style={styles.ringCaption}>{onPeriod ? 'PERIOD DAY' : 'CYCLE DAY'}</Text>
                                <Text style={styles.ringNumber}>{onPeriod ? current?.day : reading.cycleDay}</Text>
                                {/* "33 of about 29" reads as a sum gone wrong; past the
                                    expected length the headline says how late, and that is enough. */}
                                {reading.prediction && !onPeriod && (reading.cycleDay ?? 0) <= reading.prediction.cycleLength ? (
                                    <Text style={styles.ringSub}>of about {reading.prediction.cycleLength}</Text>
                                ) : null}
                            </>
                        ) : (
                            <Ionicons name="flower-outline" size={44} color={Palette.cycle} />
                        )}
                    </CycleRing>
                    <Text style={styles.headline} accessibilityRole="header">{words.title}</Text>
                    {words.detail ? <Text style={styles.detail}>{words.detail}</Text> : null}
                    {actions}
                </View>

                {/* -------------------------------------------- the one question */}
                {prompt ? (
                    <View style={styles.promptCard}>
                        <Text style={styles.promptTitle}>When did your period end?</Text>
                        <Text style={styles.promptBody}>
                            {`You logged it starting ${formatDay(prompt.start)}. Knowing how long it lasted keeps predictions right.`}
                        </Text>
                        <View style={styles.actionRow}>
                            <Pressable
                                style={[styles.primaryBtn, { flex: 1 }]}
                                onPress={() => act(() => editPeriodDays({ add: daysBetween(addDays(prompt.start, 1), prompt.suggestedEnd) }))}
                                disabled={busy}
                                accessibilityRole="button"
                            >
                                <Text style={styles.primaryLabel}>{`On ${formatDay(prompt.suggestedEnd)}`}</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.secondaryBtn, { flex: 1 }]}
                                onPress={() => router.push('/cycle/calendar?edit=1')}
                                accessibilityRole="button"
                            >
                                <Text style={styles.secondaryLabel}>Pick the days</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : null}

                {/* ------------------------------------------------ this week */}
                <View style={styles.week}>
                    {data.week.map((m) => (
                        <View key={m.day} style={styles.weekCell}>
                            <Text style={[styles.weekday, m.today && styles.weekdayToday]}>
                                {new Date(`${m.day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' })}
                            </Text>
                            <DayDot
                                mark={m}
                                size={36}
                                onPress={m.future ? undefined : () => router.push(`/cycle/log?day=${m.day}`)}
                            />
                        </View>
                    ))}
                </View>

                {/* ------------------------------------------------ today */}
                <Section title="Today">
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Flow</Text>
                        <FlowPicker value={todayLog?.flow ?? null} onChange={setFlow} />
                        <Pressable style={styles.moreRow} onPress={() => router.push(`/cycle/log?day=${today}`)} accessibilityRole="button">
                            <Text style={styles.moreText} numberOfLines={1}>
                                {todayLog?.symptoms?.length || todayLog?.mood
                                    ? [
                                        ...(todayLog.symptoms ?? []).map(symptomLabel),
                                        todayLog.mood ? `feeling ${MOODS.find((m) => m.value === todayLog.mood)?.label.toLowerCase()}` : null,
                                    ].filter(Boolean).join(' · ')
                                    : 'Add symptoms, mood or a note'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                        </Pressable>
                    </View>
                </Section>

                {/* ------------------------------------------------ fertile, opt-in */}
                {fertile ? (
                    <Section title={fertile.now ? 'Fertile window, now' : 'Next fertile window'}>
                        <View style={[styles.card, styles.fertileCard]}>
                            <Text style={styles.fertileRange}>{formatRange(fertile.window)}</Text>
                            <Text style={styles.fertileNote}>{FERTILE_DISCLAIMER}</Text>
                        </View>
                    </Section>
                ) : null}

                {/* ------------------------------------------------ the numbers */}
                <Section title="Your cycle">
                    <View style={styles.stats}>
                        {[
                            { label: 'Usual cycle', value: data.stats.averageCycle, unit: 'days' },
                            { label: 'Usual period', value: data.stats.averagePeriod, unit: 'days' },
                            { label: 'Varies by', value: data.stats.variation, unit: 'days' },
                        ].map((s) => (
                            <View key={s.label} style={styles.stat}>
                                <Text style={styles.statValue}>{s.value ?? '—'}</Text>
                                <Text style={styles.statLabel}>{s.value === null ? s.label : `${s.label}, ${s.unit}`}</Text>
                            </View>
                        ))}
                    </View>
                    {data.stats.cyclesLogged < 2 ? (
                        <Text style={styles.footnote}>These fill in once you have logged two full cycles.</Text>
                    ) : null}
                </Section>

                {data.notes.length ? (
                    <Section title="Worth mentioning to a doctor">
                        <View style={styles.card}>
                            {data.notes.map((n, i) => (
                                <View key={n.key} style={[styles.note, i > 0 && styles.noteDivider]}>
                                    <Ionicons name="information-circle-outline" size={18} color={Palette.textSecondary} />
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={styles.noteTitle}>{n.title}</Text>
                                        <Text style={styles.noteBody}>{n.body}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </Section>
                ) : null}

                <View style={styles.links}>
                    <LinkRow icon="calendar-outline" title="Calendar" body="Every period, prediction and log" onPress={() => router.push('/cycle/calendar')} />
                    <LinkRow icon="list-outline" title="History" body="Each cycle and period, and how predictions did" onPress={() => router.push('/cycle/history')} />
                    <LinkRow icon="analytics-outline" title="Insight" body="Lengths, symptom patterns and temperature" onPress={() => router.push('/cycle/insight')} />
                </View>

                <View style={styles.privacy}>
                    <Ionicons name="lock-closed-outline" size={14} color={Palette.textMuted} />
                    <Text style={styles.privacyText}>Private to you. Clinicians reviewing your results do not see your cycle.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl * 2, gap: Spacing.xl },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },

    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headerTitle: { flex: 1, fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    headerActions: { flexDirection: 'row', gap: Spacing.lg },

    hero: {
        alignItems: 'center', gap: Spacing.md, padding: Spacing.xl, borderRadius: Radius.xl,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    ringCaption: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.textSecondary, letterSpacing: 1 },
    ringNumber: { fontSize: 56, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 62 },
    ringSub: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },
    headline: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center', marginTop: Spacing.sm },
    detail: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

    actionRow: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: 14, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill,
        backgroundColor: Palette.primaryFill, minHeight: 48,
    },
    primaryLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
    secondaryBtn: {
        alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: Spacing.lg,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary, minHeight: 48,
    },
    secondaryLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.primary },
    withIcon: { flexDirection: 'row', gap: Spacing.sm },
    textBtn: { alignSelf: 'center', paddingVertical: 6 },
    textBtnLabel: { fontSize: 14, ...BodyFont.medium, color: Palette.primary },

    offTitle: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    offBody: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

    promptCard: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.sm,
        backgroundColor: Palette.cycleSurface,
    },
    promptTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    promptBody: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19, marginBottom: Spacing.xs },

    week: {
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Palette.background,
    },
    weekCell: { alignItems: 'center', gap: 4, flex: 1 },
    weekday: { fontSize: 11, ...BodyFont.medium, color: Palette.textMuted },
    weekdayToday: { color: Palette.primary },

    section: { gap: Spacing.md },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    card: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.md,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    cardLabel: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
    moreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xs },
    moreText: { flex: 1, fontSize: 14, ...BodyFont.medium, color: Palette.primary },

    fertileCard: { backgroundColor: Palette.tealSurface, borderColor: 'transparent', gap: 4 },
    fertileRange: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.teal },
    fertileNote: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },

    stats: { flexDirection: 'row', gap: Spacing.sm },
    stat: {
        flex: 1, padding: Spacing.md, borderRadius: Radius.lg, gap: 2,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    statValue: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    statLabel: { fontSize: 11, ...BodyFont.regular, color: Palette.textSecondary },
    footnote: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted },

    note: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    noteDivider: { borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.md },
    noteTitle: { fontSize: 14, ...BodyFont.semibold, color: Palette.text },
    noteBody: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19 },

    links: { borderRadius: Radius.lg, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight },
    linkRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    linkIcon: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    linkTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    linkBody: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },

    privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
    privacyText: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted, textAlign: 'center', flexShrink: 1 },
}));
