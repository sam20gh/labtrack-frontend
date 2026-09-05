/**
 * Hydration Details — `Design/hydration.svg` frame 5.
 *
 * One entry, and the day it belongs to. The vessel, the volume, when it was logged, then how
 * that day went and what the window around it looks like.
 *
 * Three things worth knowing:
 *
 * 1. **The header action is remove, not edit.** The design draws a pencil. `MetricLog` has no
 *    update route — the collection is written once and recounted by `recomputeMetricDay`, and
 *    a screen offering an edit that quietly discards itself is worse than one that does not
 *    offer it. Removing and re-logging is the honest correction, and the row already knows how
 *    to do that.
 * 2. **The day's band is derived from the server's own ladder**, via `levelForPercent`. The
 *    server classifies today only, and a detail screen usually is not looking at today.
 * 3. **The recommendations are fixed guidance, not a model's output.** The kit's card looks
 *    generated; there is no hydration recommender behind it, so these are the four behavioural
 *    lines from the level screen and they carry no numbers — a figure here would eventually
 *    contradict the derived target beside it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import {
    deleteLog, getHistory, getHydrationToday, today as localToday,
    type MetricHistory, type HydrationToday,
} from '@/lib/metrics';
import {
    busiestHour, changeVsPrevious, containerFor, containerLabel, dayLabel,
    levelForPercent, splitVolume, summarise,
} from '@/lib/hydration';
import { useUnits, formatVolume } from '@/lib/units';
import { ContainerGlass } from '@/components/hydration/ContainerGlass';
import { WaterHeader, SectionHeader, EmptyNote, cardStyles } from '@/components/hydration/HydrationChrome';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

/** Matches `STEPS` on the level screen. Behavioural, and deliberately free of figures. */
const ADVICE = [
    'Drink small amounts through the day rather than a lot at once.',
    'Foods with water in them count — cucumber, oranges, watermelon.',
    'Thirst and pale urine are better signals than any number on a screen.',
];

/** The API caps a history read at 300 entries; see the note where this is used. */
const WINDOW_DAYS = 365;

export default function HydrationEntryScreen() {
    const router = useRouter();
    const units = useUnits();
    const { id } = useLocalSearchParams<{ id: string }>();
    const day = localToday();

    const [history, setHistory] = useState<MetricHistory | null>(null);
    const [today, setToday] = useState<HydrationToday | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [h, t] = await Promise.allSettled([
                getHistory('water', WINDOW_DAYS),
                getHydrationToday(),
            ]);
            if (h.status === 'fulfilled') setHistory(h.value);
            if (t.status === 'fulfilled') setToday(t.value);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const log = useMemo(() => history?.logs.find((l) => l._id === id) ?? null, [history, id]);
    const series = useMemo(() => history?.series ?? [], [history]);
    const stats = useMemo(() => summarise(series, day), [series, day]);
    const change = useMemo(() => changeVsPrevious(series, day), [series, day]);

    const remove = useCallback(() => {
        if (!log) return;
        Alert.alert(
            'Remove this entry?',
            'It will be deleted from your record and the day recounted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteLog(log._id);
                            Toast.show({ type: 'success', text1: 'Entry removed' });
                            router.back();
                        } catch {
                            Toast.show({ type: 'error', text1: 'Could not remove that entry' });
                        }
                    },
                },
            ],
        );
    }, [log, router]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (!log) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <WaterHeader title="Hydration Details" />
                {/*
                  Either it was removed, or it is older than the 300 entries a history read
                  returns. Both are "we cannot show you this one", and neither is an error the
                  person did anything to cause.
                */}
                <EmptyNote>That entry is no longer in view. It may have been removed.</EmptyNote>
            </SafeAreaView>
        );
    }

    const when = new Date(log.measuredAt);
    const size = containerFor(log.ml);
    const amount = splitVolume(log.ml, units);

    const dayPoint = series.find((p) => p.day === log.day) ?? null;
    const dayTotal = dayPoint?.value ?? null;
    const dayTarget = dayPoint?.target ?? null;
    const dayPercent = dayTotal !== null && dayTarget ? Math.round((dayTotal / dayTarget) * 100) : null;
    const dayLevel = levelForPercent(today?.levels ?? [], dayPercent, dayTotal === null ? 0 : 1);
    const hour = busiestHour(history?.logs ?? []);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <WaterHeader
                title="Hydration Details"
                right={(
                    <Pressable onPress={remove} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove entry">
                        <Ionicons name="trash-outline" size={20} color={Palette.textSecondary} />
                    </Pressable>
                )}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <ContainerGlass size={size} height={96} />
                    <Text style={styles.heroValue}>
                        {amount.value}<Text style={styles.heroUnit}>{amount.unit}</Text>
                    </Text>
                    <Text style={styles.heroName}>
                        {containerLabel(size)}
                        {log.drinkType && log.drinkType !== 'water' ? ` of ${log.drinkType}` : ''}
                    </Text>

                    <View style={styles.stampRow}>
                        <Stamp icon="calendar-outline" text={when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} />
                        <Stamp icon="time-outline" text={when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} />
                    </View>

                    <Text style={styles.heroBlurb}>
                        Staying hydrated helps regulate body temperature and supports how you feel
                        through the day.
                    </Text>
                </View>

                {/* ---- The day this belongs to --------------------------------- */}
                <SectionHeader title={`${dayLabel(log.day, day)} in total`} />
                <View style={cardStyles.card}>
                    <View style={styles.dayRow}>
                        <View style={styles.flex}>
                            <Text style={styles.dayValue}>{formatVolume(dayTotal, units) ?? '--'}</Text>
                            <Text style={styles.dayLabel}>
                                {dayTarget ? `against a ${formatVolume(dayTarget, units)} target` : 'no target on record for that day'}
                            </Text>
                        </View>
                        {dayPercent !== null && (
                            <View style={styles.percentPill}>
                                <Text style={styles.percentText}>{dayPercent}%</Text>
                            </View>
                        )}
                    </View>

                    {dayTarget && dayTotal !== null && (
                        <View style={styles.track}>
                            <View style={[styles.fill, { width: `${Math.min(100, (dayTotal / dayTarget) * 100)}%` }]} />
                        </View>
                    )}

                    <Text style={styles.dayNote}>
                        {dayLevel
                            ? `${dayLevel.label} — ${dayLevel.blurb}`
                            : 'Nothing else is on record for that day.'}
                    </Text>
                </View>

                {/* ---- Key stats ------------------------------------------------ */}
                <SectionHeader title="Key Stats" />
                <View style={cardStyles.card}>
                    <Stat
                        icon="analytics-outline"
                        label="Daily average"
                        value={formatVolume(stats.dailyAverageMl, units) ?? '—'}
                        sub={`across ${stats.daysLogged} ${stats.daysLogged === 1 ? 'day' : 'days'} you logged`}
                    />
                    <Stat
                        icon="trending-up-outline"
                        label="Change over this window"
                        value={change !== null ? `${change > 0 ? '+' : ''}${change}%` : '—'}
                        sub={change !== null ? 'second half against the first' : 'not enough logged days to compare'}
                        tone={change === null ? undefined : change >= 0 ? Palette.successDeep : Palette.warning}
                    />
                    <Stat
                        icon="water-outline"
                        label="Days on target"
                        value={`${stats.metCount}`}
                        sub={stats.streak ? `${stats.streak} in a row right now` : 'no run going right now'}
                    />
                    <Stat
                        icon="time-outline"
                        label="Most drinks land around"
                        value={hour !== null ? `${String(hour).padStart(2, '0')}:00` : '—'}
                        sub={hour !== null ? 'across the whole window' : 'not enough entries to see a pattern'}
                        last
                    />
                </View>

                {/* ---- Guidance -------------------------------------------------- */}
                <SectionHeader title="Worth knowing" />
                <View style={cardStyles.card}>
                    {ADVICE.map((line) => (
                        <View key={line} style={styles.advice}>
                            <Ionicons name="checkmark-circle" size={18} color={Palette.success} />
                            <Text style={styles.adviceText}>{line}</Text>
                        </View>
                    ))}
                    <Pressable
                        style={styles.adviceLink}
                        onPress={() => router.push('/metrics/water/level')}
                        accessibilityRole="button"
                    >
                        <Text style={styles.adviceLinkText}>See how to move up a level</Text>
                    </Pressable>
                </View>

                {/* ---- Actions ---------------------------------------------------- */}
                <Pressable
                    style={styles.primary}
                    onPress={() => router.push({
                        pathname: '/(tabs)/assistant',
                        params: {
                            prompt: `On ${log.day} I drank ${dayTotal ?? 0} ml against a target of ${dayTarget ?? 'unknown'} ml. Is there anything in my results or plan that changes what I should be drinking?`,
                        },
                    })}
                    accessibilityRole="button"
                >
                    <Ionicons name="sparkles" size={17} color={Palette.white} />
                    <Text style={styles.primaryText}>Ask LabTrack AI about this</Text>
                </Pressable>

                <Pressable
                    style={styles.secondary}
                    onPress={() => Share.share({
                        message: `${formatVolume(log.ml, units)} logged at ${when.toLocaleString()} — ${formatVolume(dayTotal, units) ?? '0 ml'} that day.`,
                    })}
                    accessibilityRole="button"
                >
                    <Ionicons name="share-outline" size={17} color={Palette.primary} />
                    <Text style={styles.secondaryText}>Share</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const Stamp = ({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) => (
    <View style={styles.stamp}>
        <Ionicons name={icon} size={14} color={Palette.textMuted} />
        <Text style={styles.stampText}>{text}</Text>
    </View>
);

const Stat = ({ icon, label, value, sub, tone, last }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string; value: string; sub: string; tone?: string; last?: boolean;
}) => (
    <View style={[styles.stat, !last && styles.statDivided]}>
        <Ionicons name={icon} size={18} color={Palette.textSecondary} />
        <View style={styles.flex}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statSub}>{sub}</Text>
        </View>
        <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.lg },

    hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
    heroValue: { fontFamily: Fonts.bold, fontSize: 38, color: Palette.text, marginTop: Spacing.sm },
    heroUnit: { fontFamily: Fonts.medium, fontSize: 17, color: Palette.textSecondary },
    heroName: { fontFamily: Fonts.medium, fontSize: 15, color: Palette.textSecondary },
    stampRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, marginTop: 2 },
    stamp: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    stampText: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted },
    heroBlurb: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 19, marginTop: Spacing.sm, paddingHorizontal: Spacing.md,
    },

    dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    dayValue: { fontFamily: Fonts.bold, fontSize: 26, color: Palette.text },
    dayLabel: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 },
    percentPill: {
        paddingHorizontal: 11, paddingVertical: 5,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    percentText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primaryDark },
    track: { height: 8, borderRadius: 4, backgroundColor: Palette.border, overflow: 'hidden', marginTop: Spacing.lg },
    fill: { height: '100%', borderRadius: 4, backgroundColor: '#2563EB' },
    dayNote: { fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textSecondary, marginTop: Spacing.md, lineHeight: 18 },

    stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    statDivided: { borderBottomWidth: 1, borderBottomColor: Palette.border },
    statLabel: { fontFamily: Fonts.medium, fontSize: 13.5, color: Palette.text },
    statSub: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, marginTop: 1 },
    statValue: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },

    advice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md },
    adviceText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 },
    adviceLink: { borderTopWidth: 1, borderTopColor: Palette.border, paddingTop: Spacing.md, alignItems: 'center' },
    adviceLinkText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.xl, paddingVertical: Spacing.lg,
    },
    primaryText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },
    secondary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        borderRadius: Radius.xl, paddingVertical: Spacing.md,
        borderWidth: 1, borderColor: Palette.primaryLight, backgroundColor: Palette.primarySurface,
    },
    secondaryText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },
});
