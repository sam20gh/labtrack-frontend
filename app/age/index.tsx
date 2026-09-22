/**
 * Miovix Age.
 *
 * The orb, the pace, what each half contributed, and the three things that would move it.
 *
 * Five things to know before changing this screen:
 *
 * 1. **The gap leads, not the age.** "50.5" means nothing without "and you are 45"; the
 *    number people act on is the difference. So the orb carries the age and the line under it
 *    carries the gap, and the gap is what gets the colour.
 * 2. **Provenance is rendered, always.** A number from a published equation on fresh bloods
 *    and one from an unvalidated aggregation of hazard ratios must not look identical. The
 *    source chip is not optional chrome — it is the claim the backend was careful to keep
 *    separable, and `SourceChip` is where it survives.
 * 3. **A pace is never drawn as 1.0x when nothing is known.** `state: 'unknown'` draws the
 *    reason, not a needle in the middle of the track. "Aging normally" told to somebody about
 *    whom nothing is known is a reassurance, which is worse than a blank rather than a milder
 *    version of one.
 * 4. **A refusing half is a card, not an absence.** "Your results are missing RDW and
 *    lymphocytes" is the most actionable thing on this screen for most people, and dropping
 *    the half because it has no number would hide it.
 * 5. **Levers load after the first paint.** `/age/levers` re-runs both halves once per
 *    contributor; it is cheap arithmetic but it is work nobody asked for while a screen is
 *    trying to paint. The failure `app/nutrition/index.tsx` documents, with a `mounted` ref
 *    guarding the write.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AgeOrb from '@/components/age/AgeOrb';
import {
    getAge, getAgeLevers, deltaLabel, tintForBand, paceLabel, paceFraction, refusalTitle,
    type MiovixAge, type AgeLever, type AgeHalf, type AgeHalfRefusal, type AgeSource,
} from '@/lib/age';
import { ApiError } from '@/lib/api';
import { describeError } from '@/lib/appState';
import StateView from '@/components/errors/StateView';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const isHalf = (h: AgeHalf | AgeHalfRefusal | null | undefined): h is AgeHalf => Boolean(h?.ok);

const SOURCE_LABEL: Record<AgeSource, string> = {
    lab: 'From your blood results',
    lifestyle: 'From your trackers',
    blended: 'Blood results and trackers',
};

export default function MiovixAgeScreen() {
    const router = useRouter();
    const [age, setAge] = useState<MiovixAge | null>(null);
    const [levers, setLevers] = useState<AgeLever[] | null>(null);
    const [error, setError] = useState<ApiError | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const mounted = useRef(true);

    useEffect(() => () => { mounted.current = false; }, []);

    const load = useCallback(async (refresh = false) => {
        try {
            const data = await getAge({ refresh });
            if (!mounted.current) return;
            setAge(data);
            setError(null);
        } catch (err) {
            if (mounted.current) setError(err as ApiError);
        } finally {
            if (mounted.current) { setLoading(false); setRefreshing(false); }
        }
    }, []);

    /**
     * The levers, on their own timeline.
     *
     * Deliberately not inside the `load` above: the two calls are independent, and holding the
     * age behind the lever computation would put the heavier of the two in front of the thing
     * the screen exists to show.
     */
    const loadLevers = useCallback(async () => {
        try {
            const data = await getAgeLevers();
            if (mounted.current) setLevers(data.levers ?? []);
        } catch {
            // A failed lever fetch costs a section, never the screen. The age above it is
            // still the answer the person came for.
            if (mounted.current) setLevers([]);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        mounted.current = true;
        load();
        loadLevers();
        return () => { mounted.current = false; };
    }, [load, loadLevers]));

    const onRefresh = () => { setRefreshing(true); load(true); loadLevers(); };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <Header onBack={() => router.back()} onHow={() => router.push('/age/how')} />
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error) {
        const state = describeError(error);
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <Header onBack={() => router.back()} onHow={() => router.push('/age/how')} />
                {/*
                  A retry is offered only where retrying could work — `retryable` comes off
                  `lib/appState.ts`, so a 404 leads with the way out and a dropped connection
                  leads with "Try again". The rule the table exists to centralise.
                */}
                <StateView
                    state={state}
                    primary={state.retryable
                        ? {
                            label: 'Try again',
                            icon: 'refresh-outline',
                            onPress: () => { setLoading(true); load(true); },
                        }
                        : { label: 'Go back', icon: 'arrow-back-outline', onPress: () => router.back() }}
                    secondary={{
                        label: 'Contact Support',
                        icon: 'chatbubble-ellipses-outline',
                        onPress: () => router.push('/help'),
                    }}
                />
            </SafeAreaView>
        );
    }

    const gap = age?.ok ? deltaLabel(age.delta, age.band) : '';
    const tint = tintForBand(age?.band);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <Header onBack={() => router.back()} onHow={() => router.push('/age/how')} />

            <ScrollView
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                <View style={styles.hero}>
                    <AgeOrb
                        value={age?.ok ? age.value! : null}
                        band={age?.band ?? null}
                        chronologicalAge={age?.chronologicalAge ?? null}
                        caption={age?.ok ? gap : age?.message}
                        size={246}
                    />
                    {age?.ok && (
                        <Text style={styles.chrono}>
                            You are {age.chronologicalAge!.toFixed(0)}
                        </Text>
                    )}
                    {age?.ok && age.source && <SourceChip source={age.source} weights={age.weights} />}
                </View>

                {age?.ok && <PaceCard age={age} tint={tint} />}

                {age?.ok && levers === null && <LeverSkeleton />}
                {age?.ok && levers !== null && levers.length > 0 && (
                    <Section
                        title="What would move it"
                        action="See all"
                        onAction={() => router.push('/age/levers')}
                    >
                        {levers.map((l) => (
                            <LeverRow key={l.key} lever={l} onPress={() => router.push(l.route as never)} />
                        ))}
                    </Section>
                )}

                <Section title="What this is built from">
                    <HalfCard
                        half={age?.lab}
                        title="Blood results"
                        icon="water-outline"
                        onFix={() => router.push('/add-result' as never)}
                        fixLabel="Add a result"
                    />
                    <HalfCard
                        half={age?.lifestyle}
                        title="Activity, sleep and vitals"
                        icon="pulse-outline"
                        onFix={() => router.push('/activity' as never)}
                        fixLabel="Set up tracking"
                    />
                </Section>

                <TouchableOpacity style={styles.howRow} onPress={() => router.push('/age/how')}>
                    <Ionicons name="help-circle-outline" size={18} color={Palette.primary} />
                    <Text style={styles.howText}>How is this worked out?</Text>
                    <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                </TouchableOpacity>

                <Text style={styles.disclaimer}>{age?.disclaimer}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const Header = ({ onBack, onHow }: { onBack: () => void; onHow: () => void }) => (
    <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Miovix Age</Text>
        <TouchableOpacity onPress={onHow} hitSlop={12} accessibilityLabel="How this works">
            <Ionicons name="information-circle-outline" size={22} color={Palette.textSecondary} />
        </TouchableOpacity>
    </View>
);

/**
 * Which evidence the number rests on.
 *
 * Shown on every result, and the weights are shown when there are two — "mostly your bloods"
 * is a materially different claim from "mostly your watch", and somebody deciding whether to
 * book a blood test is entitled to know which.
 */
const SourceChip = ({ source, weights }: { source: AgeSource; weights?: Partial<Record<AgeSource, number>> }) => {
    const split = source === 'blended' && weights?.lab !== undefined
        ? ` · ${Math.round((weights.lab ?? 0) * 100)}% bloods`
        : '';
    return (
        <View style={styles.sourceChip}>
            <Ionicons name="shield-checkmark-outline" size={13} color={Palette.textSecondary} />
            <Text style={styles.sourceText}>{SOURCE_LABEL[source]}{split}</Text>
        </View>
    );
};

/**
 * Pace of aging.
 *
 * The track is the −1×…3× scale the design draws. An `unknown` pace draws **no marker at
 * all** — not one parked at 1.0 — for the reason in the file header.
 */
const PaceCard = ({ age, tint }: { age: MiovixAge; tint: string }) => {
    const pace = age.pace;
    const fraction = paceFraction(pace);
    const provisional = pace?.state === 'provisional';

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Pace of aging</Text>
                {provisional && (
                    <View style={styles.provisionalChip}>
                        <Text style={styles.provisionalText}>Early estimate</Text>
                    </View>
                )}
            </View>

            <Text style={[styles.paceValue, { color: pace?.ok ? tint : Palette.textMuted }]}>
                {pace?.ok ? `${pace.value!.toFixed(2)}×` : '—'}
            </Text>
            <Text style={styles.paceLabel}>{paceLabel(pace)}</Text>

            <View style={styles.track}>
                <View style={styles.trackFill} />
                {fraction !== null && (
                    <View style={[styles.marker, { left: `${fraction * 100}%`, backgroundColor: tint }]} />
                )}
            </View>
            <View style={styles.trackScale}>
                <Text style={styles.trackTick}>Slower</Text>
                <Text style={styles.trackTick}>1.0×</Text>
                <Text style={styles.trackTick}>Faster</Text>
            </View>

            {!!pace?.message && <Text style={styles.paceNote}>{pace.message}</Text>}
            {pace?.state === 'measured' && pace.basis && (
                <Text style={styles.paceNote}>
                    From {pace.basis.snapshots} readings over {pace.basis.spanDays} days.
                </Text>
            )}
        </View>
    );
};

/**
 * One half, whether or not it produced a number.
 *
 * A refusal renders as a card with the reason and a way out, because for most people the
 * missing half is the most actionable thing on this screen. Dropping it would hide the one
 * instruction that would improve their answer.
 */
const HalfCard = ({ half, title, icon, onFix, fixLabel }: {
    half: AgeHalf | AgeHalfRefusal | null | undefined;
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    onFix: () => void;
    fixLabel: string;
}) => {
    if (!half) return null;

    if (!isHalf(half)) {
        return (
            <View style={styles.card}>
                <View style={styles.cardHead}>
                    <Ionicons name={icon} size={16} color={Palette.textSecondary} />
                    <Text style={styles.cardTitle}>{title}</Text>
                </View>
                <Text style={styles.refusalTitle}>{refusalTitle(half.reason)}</Text>
                <Text style={styles.refusalBody}>{half.message}</Text>
                {!!half.missing?.length && (
                    <Text style={styles.missing}>
                        Missing: {half.missing.map((m) => m.label).join(', ')}
                    </Text>
                )}
                <TouchableOpacity style={styles.fixButton} onPress={onFix}>
                    <Text style={styles.fixText}>{fixLabel}</Text>
                    <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                </TouchableOpacity>
            </View>
        );
    }

    const stale = half.freshness?.stale || (half.freshness?.weight ?? 1) < 0.8;

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Ionicons name={icon} size={16} color={Palette.textSecondary} />
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.halfValue}>{half.value.toFixed(1)}</Text>
            </View>
            <Text style={styles.halfMeta}>
                {deltaLabel(half.delta)}
                {half.coverage ? ` · ${half.coverage.scored} of ${half.coverage.total} measures` : ''}
                {half.freshness?.ageDays !== null && half.freshness?.ageDays !== undefined
                    ? ` · ${half.freshness.ageDays} days ago` : ''}
            </Text>
            {stale && (
                <Text style={styles.staleNote}>
                    These results are getting old, so they count for less. A newer panel would
                    sharpen this.
                </Text>
            )}
        </View>
    );
};

const LeverRow = ({ lever, onPress }: { lever: AgeLever; onPress: () => void }) => (
    <TouchableOpacity style={styles.leverRow} onPress={onPress} accessibilityRole="button">
        <View style={styles.leverSaving}>
            <Text style={styles.leverYears}>−{lever.years.toFixed(1)}</Text>
            <Text style={styles.leverUnit}>yrs</Text>
        </View>
        <View style={styles.leverBody}>
            <Text style={styles.leverLabel}>{lever.label}</Text>
            <Text style={styles.leverDetail}>
                {lever.display ?? lever.value} → {lever.target} {lever.unit}
            </Text>
        </View>
        {/*
          A clinical lever is a conversation to have, not a task to do. The word is the whole
          difference between "walk more" and "ask about your RDW", and a screen that dressed
          the second as the first would be handing somebody homework they cannot complete.
        */}
        {lever.modifiable === 'clinical' && (
            <View style={styles.clinicalChip}><Text style={styles.clinicalText}>Ask about</Text></View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
    </TouchableOpacity>
);

const LeverSkeleton = () => (
    <Section title="What would move it">
        {[0, 1, 2].map((i) => <View key={i} style={styles.skeletonRow} />)}
    </Section>
);

const Section = ({ title, action, onAction, children }: {
    title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) => (
    <View style={styles.section}>
        <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {!!action && (
                <TouchableOpacity onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity>
            )}
        </View>
        {children}
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    hero: { alignItems: 'center', paddingVertical: Spacing.lg },
    chrono: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary, marginTop: Spacing.sm },
    sourceChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        backgroundColor: Palette.surface, borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.border,
    },
    sourceText: { fontFamily: Fonts.medium, fontSize: 11, color: Palette.textSecondary },

    section: { marginTop: Spacing.xl },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    sectionAction: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    card: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Palette.border, marginBottom: Spacing.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, flex: 1 },

    paceValue: { fontFamily: Fonts.bold, fontSize: 32 },
    paceLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
    provisionalChip: {
        paddingHorizontal: Spacing.sm, paddingVertical: 3,
        backgroundColor: Palette.warningSurface, borderRadius: Radius.sm,
    },
    provisionalText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.warning },
    track: {
        height: 6, borderRadius: Radius.pill, backgroundColor: Palette.borderLight,
        marginTop: Spacing.lg, justifyContent: 'center',
    },
    trackFill: { ...StyleSheet.absoluteFillObject, borderRadius: Radius.pill },
    marker: {
        position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6,
        borderWidth: 2, borderColor: Palette.background,
    },
    trackScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    trackTick: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },
    paceNote: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.sm, lineHeight: 16 },

    halfValue: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    halfMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },
    staleNote: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.warning, marginTop: Spacing.sm, lineHeight: 16 },
    refusalTitle: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text, marginBottom: 2 },
    refusalBody: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, lineHeight: 18 },
    missing: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.text, marginTop: Spacing.sm },
    fixButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
    fixText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    leverRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background, borderRadius: Radius.xl,
        padding: Spacing.lg, borderWidth: 1, borderColor: Palette.border, marginBottom: Spacing.sm,
    },
    leverSaving: { alignItems: 'center', minWidth: 46 },
    leverYears: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.teal },
    leverUnit: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },
    leverBody: { flex: 1 },
    leverLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    leverDetail: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 1 },
    clinicalChip: {
        paddingHorizontal: Spacing.sm, paddingVertical: 3,
        backgroundColor: Palette.infoSurface, borderRadius: Radius.sm,
    },
    clinicalText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.info },
    skeletonRow: {
        height: 66, borderRadius: Radius.xl, backgroundColor: Palette.borderLight, marginBottom: Spacing.sm,
    },

    howRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xl,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
        backgroundColor: Palette.background, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border,
    },
    howText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, flex: 1 },
    disclaimer: {
        fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted,
        lineHeight: 17, marginTop: Spacing.xl,
    },
});
