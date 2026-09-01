/**
 * Home.
 *
 * Rebuilt against `Design/index.svg` — the kit's full "Home" frame. That mockup is a
 * scroll of one tracker section per feature, each headed by a title and a "See All", under
 * a purple header and a score card that overlaps it. This screen follows that shape with
 * LabTrack's own data, plus one section the mockup does not have: **Latest Analysis**,
 * which sits directly under the score because the interpretation is what this product is
 * for.
 *
 * Two places the mockup is deliberately not reproduced, both for the reason this codebase
 * keeps giving — a control or a number the backend cannot honestly back is worse than none:
 *
 *   - The kit's sleep card draws a four-stage hypnogram (Awake / REM / Deep / Light).
 *     `DailyMetrics.sleep` records duration, time in bed, efficiency and a score, and
 *     nothing reports stages, so this draws the nights it actually has.
 *   - The kit's symptom card lists "Recent Checks" with risk levels. There is no diagnosis
 *     engine and no stored check — see **Symptom checker** in CLAUDE.md — so the card is
 *     the search and the common symptoms, which is what `app/symptoms` really does.
 *
 * The header is drawn under the status bar, so the root is *not* wrapped in a top-inset
 * SafeAreaView the way the other tab screens are; the gradient takes `insets.top` as
 * padding instead. Same rule, applied to a screen whose first element is full-bleed.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    RefreshControl, Image, useWindowDimensions,
    type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Avatar } from '@/components/Avatar';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { getUserId, isSignedIn } from '@/lib/auth';
import { getLatestBiomarkers, byClinicalPriority } from '@/lib/biomarkers';
import { getDay as getNutritionDay } from '@/lib/nutrition';
import {
    getLatestInterpretation, generateInterpretation, hasMeaningfulChanges, isVerified,
    RISK_META, byRiskSeverity, type LatestInterpretation,
} from '@/lib/interpretation';
import { getScore, bandMeta, isMostlyReported, type HealthScore } from '@/lib/score';
import {
    getOverview, METRIC_ICON, METRIC_TINT, METRIC_ROUTE,
    type MetricCard as MetricCardData,
} from '@/lib/metrics';
import {
    getSummary as getActivitySummary, getDay as getActivityDay,
    formatDuration, formatDistance, formatType,
    type ActivitySummary, type ActivitySession, type DayMetrics,
} from '@/lib/activity';
import {
    getSchedule as getMedicationSchedule, updateDose,
} from '@/lib/medications';
import {
    getAppointments, professionalOf, nameOf, initialsOf, isLive,
    formatTime as formatApptTime, formatRelativeDay,
} from '@/lib/appointments';
import { getConversation, messageTime, type Conversation } from '@/lib/assistant';
import { SYMPTOMS } from '@/lib/symptoms';
import { listResources, routeFor, openResourcesHub, type ResourceCard as ResourceCardType } from '@/lib/resources';
import { ArticleCard } from '@/components/resources/ResourceCards';
import { CalorieRing } from '@/components/nutrition/CalorieRing';
import { DoseRow } from '@/components/medications/DoseRow';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type {
    BiomarkerSummary, MedicationScheduleDay, NutritionDay, Product, User, Appointment,
} from '@/types/api';

/**
 * What the score card shows before the score has loaded, or for a signed-out visitor.
 *
 * A placeholder rather than a zero. A score of 0 on first launch is a claim about someone's
 * health made before anything is known about them.
 */
const EMPTY_SCORE: HealthScore = {
    value: null,
    band: null,
    bandLabel: null,
    headline: 'Log a day or upload a result to unlock your score',
    pillars: [],
    coverage: { scored: 0, observed: 0, reported: 0, total: 0, observedWeight: 0 },
    windowDays: 30,
    computedAt: new Date().toISOString(),
    change: null,
    disclaimer: '',
    bands: [],
};

/** The six the kit's carousel shows, in its order. Anything the server omits drops out. */
const METRIC_ORDER = ['heart_rate', 'blood_pressure', 'weight', 'sleep', 'hydration', 'steps'] as const;

/** The chips under the symptom search — the everyday ones, from the real catalogue. */
const COMMON_SYMPTOM_IDS = ['headache', 'fever', 'nausea', 'fatigue', 'dry-cough'];

const DAY = 24 * 60 * 60 * 1000;

/** "Wed, Jun 25" — the date line above the greeting. */
const formatToday = () =>
    new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function HomeScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    /** The library, with its first-run gate. Shared with the quick actions — see `lib/resources.ts`. */
    const openResources = useCallback(() => openResourcesHub(router), [router]);

    const [signedIn, setSignedIn] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [analysis, setAnalysis] = useState<LatestInterpretation | null>(null);
    const [nutrition, setNutrition] = useState<NutritionDay | null>(null);
    const [resources, setResources] = useState<ResourceCardType[]>([]);
    const [score, setScore] = useState<HealthScore>(EMPTY_SCORE);
    const [metrics, setMetrics] = useState<MetricCardData[]>([]);
    const [activity, setActivity] = useState<ActivitySummary | null>(null);
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [dayMetrics, setDayMetrics] = useState<DayMetrics | null>(null);
    const [medications, setMedications] = useState<MedicationScheduleDay | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [generating, setGenerating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analysisExpanded, setAnalysisExpanded] = useState(false);
    const [busyDose, setBusyDose] = useState<string | null>(null);

    const load = useCallback(async () => {
        const loggedIn = await isSignedIn();
        setSignedIn(loggedIn);

        // Products are the only thing worth fetching for a signed-out visitor, and the
        // catalogue is the one endpoint that answers without a linked account.
        if (!loggedIn) {
            setProducts(await api.get<Product[]>('/products').then((p) => (Array.isArray(p) ? p.slice(0, 6) : [])).catch(() => []));
            return;
        }

        const userId = await getUserId();

        // Settled rather than all: a home screen that renders nothing because one tracker
        // hiccuped is worse than one missing a section. Every call here is a database
        // read — nothing model-backed is awaited before the first paint, which is the rule
        // `app/nutrition/index.tsx` records.
        const results = await Promise.allSettled([
            userId ? api.get<User>(`/users/${userId}`) : Promise.reject(new Error('no user id')),
            getLatestBiomarkers(),
            // One call: the newest result, the newest interpretation, and whether they are
            // the same document. Scoped by the token, so it does not depend on the cached
            // user id the way the old /test-results?user_id= path did.
            getLatestInterpretation(),
            getNutritionDay(),
            // The score is computed server-side — it reads a month of activity, sleep,
            // meals and doses this screen never loads. See the header of `lib/score.ts`.
            getScore(),
            getOverview(7),
            getActivitySummary('1w'),
            getActivityDay(),
            getMedicationSchedule(),
            getAppointments(),
            getConversation(),
            // The newest of the library, for the rail at the foot of the screen. Six cards,
            // because this is a rail and nobody scrolls twenty of them sideways.
            listResources({ limit: 6, sort: 'newest' }),
        ]);

        const [
            userRes, biomarkerRes, analysisRes, nutritionRes, scoreRes, metricsRes,
            activityRes, activityDayRes, medicationRes, appointmentRes, conversationRes,
            resourceRes,
        ] = results;

        if (userRes.status === 'fulfilled') setUser(userRes.value as User);
        if (biomarkerRes.status === 'fulfilled') setBiomarkers(biomarkerRes.value.biomarkers ?? []);
        if (analysisRes.status === 'fulfilled') setAnalysis(analysisRes.value);
        if (nutritionRes.status === 'fulfilled') setNutrition(nutritionRes.value);
        if (scoreRes.status === 'fulfilled') setScore(scoreRes.value);
        if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.metrics ?? []);
        if (activityRes.status === 'fulfilled') setActivity(activityRes.value);
        if (activityDayRes.status === 'fulfilled') {
            setSessions(activityDayRes.value.sessions ?? []);
            setDayMetrics(activityDayRes.value.metrics ?? null);
        }
        if (medicationRes.status === 'fulfilled') setMedications(medicationRes.value);
        if (appointmentRes.status === 'fulfilled') setAppointments(appointmentRes.value ?? []);
        if (conversationRes.status === 'fulfilled') setConversation(conversationRes.value);
        if (resourceRes.status === 'fulfilled') setResources(resourceRes.value.items ?? []);

        const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (rejected.some((r) => r.reason instanceof ApiError && r.reason.isAuthError)) {
            router.replace('/(auth)/loginscreen');
        } else if (rejected.length) {
            // Sections quietly missing is how the old screen hid outages. Say it once.
            Toast.show({
                type: 'error',
                text1: 'Some data could not load',
                text2: 'Pull down to try again.',
            });
        }
    }, [router]);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            load().finally(() => { if (active) setLoading(false); });
            return () => { active = false; };
        }, [load]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    /**
     * Generate (or regenerate) the interpretation for the newest result.
     *
     * The server reads *all* of this person's biomarkers when it builds the context, not
     * just the ones on this document — so an analysis generated against the newest result
     * already accounts for everything that came before it.
     *
     * Generating also rebuilds the plan, so a fresh run reloads the whole screen.
     */
    const handleGenerate = useCallback(async (force = false) => {
        const targetId = analysis?.latestResult?.id;
        if (!targetId) {
            Toast.show({ type: 'error', text1: 'Add a result first', text2: 'There is nothing to interpret yet.' });
            return;
        }
        setGenerating(true);
        try {
            const result = await generateInterpretation({ testResultId: targetId, force });
            Toast.show({
                type: 'success',
                text1: result.cached ? 'Showing your existing analysis' : 'Analysis ready',
                text2: result.plan?.created
                    ? `${result.plan.created} plan item${result.plan.created > 1 ? 's' : ''} updated`
                    : undefined,
            });
            // Reload rather than patching state locally: this changes the plan and the
            // score's plan pillar too.
            await load();
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Could not generate an analysis';

            // 429 is the rate limiter, and it is not a failure — the server is saying the
            // analysis would be identical, or that enough have been run today.
            if (error instanceof ApiError && error.status === 429) {
                Toast.show({ type: 'info', text1: 'No new analysis needed', text2: message });
                return;
            }

            // 503 means the server has no AI key — reflect that rather than letting the
            // user keep pressing something that cannot work.
            if (error instanceof ApiError && error.status === 503) {
                setAnalysis((prev) => (prev ? { ...prev, available: false } : prev));
            }
            Toast.show({ type: 'error', text1: 'Analysis failed', text2: message });
        } finally {
            setGenerating(false);
        }
    }, [analysis, load]);

    /**
     * Take, skip or undo one of today's doses from the home card.
     *
     * The row is optimistic about nothing: the schedule is refetched, because the server
     * recomputes adherence and this card draws it. `scoreController.touch()` runs on that
     * write too, so the score above is stale by one pull-to-refresh — which is the trade
     * the score's own design accepts rather than blocking a write on a scorer.
     */
    const handleDose = useCallback(async (id: string, action: 'take' | 'skip' | 'undo') => {
        setBusyDose(id);
        try {
            await updateDose(id, action);
            setMedications(await getMedicationSchedule());
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not update that dose',
                text2: error instanceof ApiError ? error.message : undefined,
            });
        } finally {
            setBusyDose(null);
        }
    }, []);

    /** Out-of-range markers, worst first. Counted on the score card rather than railed. */
    const attention = useMemo(
        () => biomarkers.filter((b) => b.flag !== 'normal' && b.flag !== 'unknown').sort(byClinicalPriority),
        [biomarkers],
    );

    /** The carousel, in the kit's order, with anything the server did not report removed. */
    const metricCards = useMemo(
        () => METRIC_ORDER
            .map((key) => metrics.find((m) => m.key === key))
            .filter((m): m is MetricCardData => Boolean(m)),
        [metrics],
    );

    /** The next appointment, and the ones after it. Cancelled and completed drop out. */
    const liveAppointments = useMemo(
        () => appointments
            .filter(isLive)
            .filter((a) => new Date(a.scheduledFor).getTime() > Date.now() - DAY)
            .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
        [appointments],
    );

    const firstName = user?.firstName?.trim() || 'there';
    const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase();

    if (loading && signedIn === null) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={[]}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                {signedIn ? (
                    <>
                        <HomeHeader
                            name={firstName}
                            initials={initials}
                            photo={user?.profileImage ?? null}
                            streak={activity?.streak ?? 0}
                            topInset={insets.top}
                            onSearch={() => router.push('/resources/search')}
                            onPressAvatar={() => router.push('/profile')}
                        />

                        <ScoreCard
                            score={score}
                            attention={attention.length}
                            onPress={() => router.push('/score')}
                        />

                        {/*
                          Latest analysis — the one section `Design/index.svg` does not
                          carry. It sits first because the interpretation is the product:
                          every other card here reports a measurement, and this one is the
                          only thing that says what the measurements mean.
                        */}
                        {analysis?.latestResult && (
                            <Section
                                title="Latest Analysis"
                                action={analysis.interpretation ? 'View plan' : undefined}
                                onAction={analysis.interpretation ? () => router.push('/myplans') : undefined}
                            >
                                <AnalysisCard
                                    analysis={analysis}
                                    generating={generating}
                                    expanded={analysisExpanded}
                                    onToggle={() => setAnalysisExpanded((v) => !v)}
                                    onGenerate={() => handleGenerate(false)}
                                    onRegenerate={() => handleGenerate(true)}
                                />
                            </Section>
                        )}

                        {metricCards.length > 0 && (
                            <Section title="Health Metrics" action="See All" onAction={() => router.push('/metrics')}>
                                <MetricsRail cards={metricCards} router={router} />
                            </Section>
                        )}

                        <Section title="Activity" action="See All" onAction={() => router.push('/activity')}>
                            <ActivityCard
                                summary={activity}
                                sessions={sessions}
                                onLog={() => router.push('/activity/log')}
                                onSession={(id) => router.push({ pathname: '/activity/session/[id]', params: { id } })}
                            />
                        </Section>

                        <Section title="Sleep" action="See All" onAction={() => router.push('/activity')}>
                            <SleepCard
                                card={metrics.find((m) => m.key === 'sleep') ?? null}
                                today={dayMetrics}
                                onOpen={() => router.push('/activity')}
                            />
                        </Section>

                        <Section title="Nutrition" action="See All" onAction={() => router.push('/nutrition')}>
                            <NutritionCard
                                day={nutrition}
                                onOpen={() => router.push('/nutrition')}
                                onLog={() => router.push('/nutrition/log')}
                            />
                        </Section>

                        <Section
                            title="Doctor Appointment"
                            action="See All"
                            onAction={() => router.push('/appointments')}
                        >
                            <AppointmentsCard
                                appointments={liveAppointments}
                                onOpen={() => router.push('/appointments')}
                                onBook={() => router.push('/(tabs)/professionals')}
                            />
                        </Section>

                        <Section
                            title="Medications"
                            action="See All"
                            onAction={() => router.push('/medications')}
                        >
                            <MedicationsCard
                                schedule={medications}
                                busyDose={busyDose}
                                onDose={handleDose}
                                onAdd={() => router.push('/medications/add')}
                                onOpen={(id) => router.push({ pathname: '/medications/[id]', params: { id } })}
                            />
                        </Section>

                        <Section title="Symptom Checker">
                            <SymptomCheckerCard
                                onSearch={() => router.push('/symptoms')}
                                onSymptom={(id) => router.push({ pathname: '/symptoms', params: { symptom: id } })}
                            />
                        </Section>

                        <Section title="AI Health Assistant">
                            <AssistantCard
                                conversation={conversation}
                                onOpen={() => router.push('/(tabs)/assistant')}
                            />
                        </Section>

                        <SupportBanner onPress={() => router.push('/help')} />

                        {/*
                            News & Resources.

                            The card is `ArticleCard` from `components/resources`, not a
                            home-screen copy of it. The library already owns the byline, the
                            category chip and the "2.5k" formatting, and a second version
                            here is how the same article ends up with two different view
                            counts on two screens.

                            "See All" goes to the library rather than to a filtered list:
                            this rail is a sample of everything, so its See All has to be
                            everything too.
                        */}
                        {resources.length > 0 && (
                            <Section title="News & Resources" action="See All" onAction={openResources}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                                    {resources.map((card) => (
                                        <ArticleCard
                                            key={card.id}
                                            card={card}
                                            width={Math.min(300, width * 0.8)}
                                            onPress={() => {
                                                const { pathname, params } = routeFor(card);
                                                router.push({ pathname: pathname as any, params });
                                            }}
                                        />
                                    ))}
                                </ScrollView>
                            </Section>
                        )}
                    </>
                ) : (
                    <SignedOut products={products} router={router} topInset={insets.top} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// Header and score
// ---------------------------------------------------------------------------

/**
 * The purple header.
 *
 * Full-bleed to the top of the screen, so it takes the status-bar inset as padding rather
 * than sitting under a SafeAreaView. Its bottom padding is deep enough for the score card
 * to overlap it by half — the card is pulled up with a negative margin instead of being
 * absolutely positioned, so the sections below still flow underneath it.
 *
 * The kit puts a green presence dot on the avatar. LabTrack models no presence, so there
 * is none here; the streak chip beside the date is real (`ActivitySummary.streak`) and is
 * hidden rather than shown as a zero.
 */
const HomeHeader = ({ name, initials, photo, streak, topInset, onSearch, onPressAvatar }: {
    name: string;
    initials: string;
    photo: string | null;
    streak: number;
    topInset: number;
    onSearch: () => void;
    onPressAvatar: () => void;
}) => (
    <LinearGradient
        colors={Palette.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + Spacing.lg }]}
    >
        <View style={styles.headerRow}>
            <View style={styles.flex}>
                <View style={styles.dateRow}>
                    <Text style={styles.headerDate}>{formatToday()}</Text>
                    {streak > 0 && (
                        <View style={styles.streakChip}>
                            <Ionicons name="flame" size={12} color={Palette.white} />
                            <Text style={styles.streakText}>{streak}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.headerGreeting} numberOfLines={1}>Hello, {name}!</Text>
            </View>

            <TouchableOpacity style={styles.headerSearch} onPress={onSearch} accessibilityLabel="Search">
                <Ionicons name="search" size={20} color={Palette.primaryDark} />
            </TouchableOpacity>

            {/* Photo, then initials, then the generic glyph — and a photo that fails to
                load falls back the same way. See `components/Avatar.tsx`. */}
            <TouchableOpacity onPress={onPressAvatar} accessibilityLabel="Your profile">
                <Avatar uri={photo} initials={initials} size={44} style={styles.headerAvatar} textStyle={{ fontSize: 15 }} />
            </TouchableOpacity>
        </View>
    </LinearGradient>
);

/**
 * The score card, overlapping the header.
 *
 * The kit's second meta chip reads "plus User" — a subscription badge. This shows the thing
 * a person actually needs to see beside a health score: how many of their markers are out
 * of range, or, when none are, how much of the score was measured rather than reported.
 * That provenance line used to live on the old hero and is the whole point of the score
 * being computed from the trackers — see **The LabTrack score** in CLAUDE.md.
 */
const ScoreCard = ({ score, attention, onPress }: {
    score: HealthScore; attention: number; onPress: () => void;
}) => {
    const band = bandMeta(score.band);
    const mostlyReported = isMostlyReported(score);

    return (
        <TouchableOpacity style={styles.scoreCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.scoreBox}>
                <Text style={styles.scoreValue}>{score.value ?? '--'}</Text>
            </View>

            <View style={styles.flex}>
                <Text style={styles.scoreBand} numberOfLines={1}>
                    {score.value === null ? 'No score yet' : `${band.label} health`}
                </Text>

                <View style={styles.scoreMetaRow}>
                    <View style={styles.scoreMeta}>
                        <Ionicons name="heart" size={14} color={band.color} />
                        <Text style={styles.scoreMetaText}>{band.label}</Text>
                    </View>

                    {score.value !== null && <Text style={styles.scoreDot}>·</Text>}

                    {score.value !== null && (attention > 0 ? (
                        <View style={styles.scoreMeta}>
                            <Ionicons name="alert-circle" size={14} color={Palette.danger} />
                            <Text style={[styles.scoreMetaText, { color: Palette.danger }]}>
                                {attention} need{attention === 1 ? 's' : ''} attention
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.scoreMeta}>
                            <Ionicons
                                name={mostlyReported ? 'clipboard-outline' : 'pulse'}
                                size={14}
                                color={mostlyReported ? Palette.warning : Palette.success}
                            />
                            <Text style={styles.scoreMetaText}>
                                {score.coverage.observedWeight}% measured
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            <Ionicons name="chevron-forward" size={22} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

// ---------------------------------------------------------------------------
// Health metrics
// ---------------------------------------------------------------------------

/**
 * The metrics carousel and its page dots.
 *
 * The dots are driven by the real scroll offset rather than by a paged ScrollView: the
 * cards are narrower than the screen, so paging would snap two-and-a-bit cards at a time
 * and leave the last one unreachable. `CARD_PITCH` is the card plus its gap.
 */
const METRIC_CARD_WIDTH = 152;
const METRIC_CARD_PITCH = METRIC_CARD_WIDTH + Spacing.md;

const MetricsRail = ({ cards, router }: { cards: MetricCardData[]; router: Router }) => {
    const [page, setPage] = useState(0);
    const lastPage = useRef(0);

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = Math.round(e.nativeEvent.contentOffset.x / METRIC_CARD_PITCH);
        if (next !== lastPage.current) {
            lastPage.current = next;
            setPage(next);
        }
    };

    return (
        <>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
                onScroll={onScroll}
                scrollEventThrottle={32}
            >
                {cards.map((card) => (
                    <MetricTile
                        key={card.key}
                        card={card}
                        onPress={() => router.push(METRIC_ROUTE[card.key] as any)}
                    />
                ))}
            </ScrollView>

            <View style={styles.dots}>
                {cards.map((card, i) => (
                    <View
                        key={card.key}
                        style={[styles.dot, i === Math.min(page, cards.length - 1) && styles.dotActive]}
                    />
                ))}
            </View>
        </>
    );
};

/**
 * One metric tile.
 *
 * `fallback` is drawn as a value with a label saying where it came from, never passed off
 * as a reading — the same rule the metrics screen follows. A metric with neither a value
 * nor a fallback shows a dash and its status line, because "--" and "0" are different
 * claims.
 */
const MetricTile = ({ card, onPress }: { card: MetricCardData; onPress: () => void }) => {
    const tint = METRIC_TINT[card.key];
    const value = card.value ?? card.fallback?.value ?? null;
    const reported = card.value == null && card.fallback != null;

    return (
        <TouchableOpacity style={styles.metricTile} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.metricTileIcon, { backgroundColor: `${tint}1A` }]}>
                <Ionicons name={METRIC_ICON[card.key] as any} size={22} color={tint} />
            </View>

            <View style={styles.valueRow}>
                <Text style={styles.metricTileValue} numberOfLines={1}>
                    {value === null ? '--' : typeof value === 'number' ? Math.round(value * 10) / 10 : value}
                </Text>
                <Text style={styles.unit}>{card.unit}</Text>
            </View>

            <Text style={styles.metricTileLabel} numberOfLines={1}>{card.label}</Text>
            {reported && <Text style={styles.metricTileNote}>From your profile</Text>}
            {card.urgent && (
                <Text style={[styles.metricTileNote, { color: Palette.danger }]}>Crisis reading</Text>
            )}
        </TouchableOpacity>
    );
};

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/** An arc, for the goal ring in the activity card. `react-native-svg` is already a dep. */
const ProgressRing = ({ done, total, size = 66, stroke = 6 }: {
    done: number; total: number; size?: number; stroke?: number;
}) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const ratio = total > 0 ? Math.min(1, done / total) : 0;

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2} cy={size / 2} r={r}
                    stroke={Palette.borderLight} strokeWidth={stroke} fill="none"
                />
                {ratio > 0 && (
                    <Circle
                        cx={size / 2} cy={size / 2} r={r}
                        stroke={Palette.primary} strokeWidth={stroke} fill="none"
                        strokeDasharray={`${c * ratio} ${c}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                )}
            </Svg>
            <View style={styles.ringCentre}>
                <Text style={styles.ringText}>{total > 0 ? `${done}/${total}` : done}</Text>
            </View>
        </View>
    );
};

/**
 * Activity.
 *
 * `summary.band` is the server's own wording ("Very Active" in the kit) and `goal` is null
 * — never zero — when nobody has set a plan to measure against, which is when the ring is
 * dropped rather than drawn empty. Same call `alignment: 'unassessed'` makes in nutrition.
 */
const ActivityCard = ({ summary, sessions, onLog, onSession }: {
    summary: ActivitySummary | null;
    sessions: ActivitySession[];
    onLog: () => void;
    onSession: (id: string) => void;
}) => {
    const goal = summary?.goal;
    const done = goal?.sessions.done ?? 0;
    const target = goal?.sessions.target ?? 0;
    const recent = sessions.slice(0, 2);

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                        {summary?.band?.label ?? (recent.length ? 'Active today' : 'Nothing logged today')}
                    </Text>
                    <Text style={styles.cardBody}>
                        {goal && target > done
                            ? `You need ${target - done} more ${target - done === 1 ? 'session' : 'sessions'} this week.`
                            : goal
                                ? "You've hit this week's target."
                                : 'Set a weekly target and this starts tracking against it.'}
                    </Text>
                </View>
                {goal && <ProgressRing done={done} total={target} />}
            </View>

            {recent.length > 0 && (
                <View style={styles.rowList}>
                    {recent.map((session) => (
                        <SessionRow key={session._id} session={session} onPress={() => onSession(session._id)} />
                    ))}
                </View>
            )}

            <CardFooterAction label="Log Activity" onPress={onLog} />
        </View>
    );
};

const SESSION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
    walking: 'walk-outline',
    running: 'walk-outline',
    jogging: 'walk-outline',
    hiking: 'trail-sign-outline',
    cycling: 'bicycle-outline',
    biking: 'bicycle-outline',
    swimming: 'water-outline',
    yoga: 'body-outline',
    rowing: 'boat-outline',
    weightlifting: 'barbell-outline',
};

const SessionRow = ({ session, onPress }: { session: ActivitySession; onPress: () => void }) => {
    const when = new Date(session.startedAt);
    const distance = formatDistance(session.distanceM);

    return (
        <TouchableOpacity style={styles.rowItem} onPress={onPress} activeOpacity={0.85}>
            <Ionicons
                name={SESSION_ICON[session.type] ?? 'fitness-outline'}
                size={24}
                color={Palette.text}
            />
            <View style={styles.flex}>
                <Text style={styles.rowTitle}>{formatType(session.type)}</Text>
                <Text style={styles.rowMeta}>
                    {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {', '}
                    {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <View style={styles.statRow}>
                    <Stat icon="time-outline" tint={Palette.textSecondary} text={formatDuration(session.durationSec)} />
                    {session.activeKcal != null && (
                        <Stat icon="flame-outline" tint="#F59E0B" text={`${Math.round(session.activeKcal)} kcal`} />
                    )}
                    {distance && <Stat icon="location-outline" tint={Palette.danger} text={distance} />}
                    {session.scoreDelta > 0 && (
                        <Stat icon="add-circle-outline" tint={Palette.primary} text={`${session.scoreDelta} score`} />
                    )}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

const Stat = ({ icon, tint, text }: {
    icon: keyof typeof Ionicons.glyphMap; tint: string; text: string;
}) => (
    <View style={styles.stat}>
        <Ionicons name={icon} size={13} color={tint} />
        <Text style={styles.statText}>{text}</Text>
    </View>
);

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

/**
 * Sleep.
 *
 * The kit draws a four-stage hypnogram (Awake / REM / Deep / Light). Nothing in this app
 * reports stages — `DailyMetrics.sleep` carries `asleepMin`, `inBedMin`, `efficiency` and
 * a score, and that is all `healthSync` receives — so this draws the week it actually has:
 * one bar per night, in hours, with a gap for a night nothing was recorded. Inventing a
 * stage split to fill the kit's shape would be a chart about nothing.
 *
 * The figures come from the metrics overview's own sleep card rather than from a second
 * query, so the number here and the number on `app/metrics` cannot disagree. `efficiency`
 * is the one thing that card does not carry, and it is read from today's rollup — only
 * when today is the night being shown, or it would caption Tuesday's hours with Monday's
 * efficiency.
 */
const SleepCard = ({ card, today, onOpen }: {
    card: MetricCardData | null; today: DayMetrics | null; onOpen: () => void;
}) => {
    const hours = typeof card?.value === 'number' ? card.value : null;
    const nights = (card?.series ?? []).slice(-7);
    const peak = Math.max(1, ...nights.map((n) => n.value ?? 0));
    const hasNights = nights.some((n) => (n.value ?? 0) > 0);

    // Only when the card's newest night IS today, so the caption cannot describe one night
    // with another night's number.
    const efficiency = card?.at && card.at === today?.day ? today.sleep.efficiency : null;

    if (hours === null && !hasNights) {
        return (
            <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.85}>
                <View style={styles.cardHead}>
                    <View style={styles.flex}>
                        <Text style={styles.cardTitle}>No sleep recorded</Text>
                        <Text style={styles.cardBody}>
                            Connect a watch or a phone health store and your nights appear here. Nothing
                            on this device measures sleep on its own.
                        </Text>
                    </View>
                    <Ionicons name="moon-outline" size={26} color={Palette.primaryLight} />
                </View>
            </TouchableOpacity>
        );
    }

    const whole = hours === null ? null : Math.floor(hours);
    const mins = hours === null ? null : Math.round((hours - Math.floor(hours)) * 60);

    return (
        <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.85}>
            <View style={styles.cardHead}>
                <View style={styles.flex}>
                    {hours !== null ? (
                        <Text style={styles.bigFigure}>
                            {whole}<Text style={styles.bigUnit}> hr </Text>
                            {mins}<Text style={styles.bigUnit}> min</Text>
                        </Text>
                    ) : (
                        <Text style={styles.cardTitle}>Your recorded nights</Text>
                    )}
                    <Text style={styles.cardBody}>
                        {efficiency !== null && efficiency !== undefined
                            ? `${Math.round(efficiency)}% of your time in bed was spent asleep.`
                            : card?.status ?? 'Your recorded nights over the past week.'}
                    </Text>
                </View>
                <View style={styles.roundButton}>
                    <Ionicons name="chevron-forward" size={20} color={Palette.white} />
                </View>
            </View>

            {hasNights && (
                <View style={styles.sleepChart}>
                    {nights.map((night) => (
                        <View key={night.day} style={styles.sleepColumn}>
                            <View style={styles.sleepTrack}>
                                {(night.value ?? 0) > 0 && (
                                    <View style={[styles.sleepBar, { height: `${((night.value as number) / peak) * 100}%` }]} />
                                )}
                            </View>
                            <Text style={styles.sleepLabel}>
                                {new Date(`${night.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
};

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/**
 * Nutrition.
 *
 * The kit's ring and macro read-out, using the tracker's own `CalorieRing` rather than a
 * home-screen copy — it already knows how to draw an over-target day as an overshoot arc
 * rather than a ring pinned at 100%.
 *
 * The plan's dietary guidance is named on the card because that is what connects a calorie
 * ring to the interpretation that asked for it; without it this is a widget from a
 * different app. See **Nutrition tracker** in CLAUDE.md.
 */
const NutritionCard = ({ day, onOpen, onLog }: {
    day: NutritionDay | null; onOpen: () => void; onLog: () => void;
}) => {
    const target = day?.targets && 'calories' in day.targets ? day.targets.calories : 0;
    const consumed = day?.totals.calories ?? 0;
    const pattern = day?.plan?.guidance?.find((g) => g.kind === 'pattern')?.label
        ?? day?.plan?.guidance?.[0]?.label;

    if (!day?.plan || !target) {
        return (
            <TouchableOpacity style={styles.cardRow} onPress={onOpen} activeOpacity={0.85}>
                <View style={styles.roundIcon}>
                    <Ionicons name="restaurant-outline" size={20} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.cardTitle}>Set up nutrition tracking</Text>
                    <Text style={styles.cardBody}>
                        Targets built from your profile and the dietary advice on your plan.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </TouchableOpacity>
        );
    }

    const remaining = Math.max(0, Math.round(target - consumed));
    const over = consumed > target;

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.nutritionTop} onPress={onOpen} activeOpacity={0.85}>
                <CalorieRing
                    consumed={consumed}
                    target={target}
                    size={132}
                    stroke={12}
                    caption={over
                        ? `${Math.round(consumed - target).toLocaleString()} over`
                        : `${remaining.toLocaleString()} left`}
                />
                <View style={styles.macroList}>
                    <Macro label="Protein" grams={day.totals.protein} tint={Palette.primary} />
                    <Macro label="Fat" grams={day.totals.fat} tint="#FB7185" />
                    <Macro label="Carbs" grams={day.totals.carbs} tint="#F59E0B" />
                </View>
            </TouchableOpacity>

            <View>
                <Text style={styles.cardTitle}>
                    {day.meals.length === 0
                        ? 'Nothing logged yet today'
                        : over ? "You're over today's target" : "You're on track!"}
                </Text>
                <Text style={styles.cardBody}>
                    {day.adherence.assessed > 0
                        ? `${day.adherence.aligned + day.adherence.partial} of ${day.adherence.assessed} meals moved you towards your plan.`
                        : pattern
                            ? `Your plan asks for a ${pattern.toLowerCase()} pattern. Log a meal and it is scored against that.`
                            : `${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'} logged.`}
                </Text>
            </View>

            <CardFooterAction label="Log Meal" onPress={onLog} />
        </View>
    );
};

const Macro = ({ label, grams, tint }: { label: string; grams: number; tint: string }) => (
    <View style={styles.macro}>
        <View style={[styles.macroDot, { borderColor: tint }]} />
        <View>
            <Text style={styles.macroLabel}>{label}</Text>
            <Text style={styles.macroValue}>{Math.round(grams)}g</Text>
        </View>
    </View>
);

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/**
 * Doctor Appointment.
 *
 * The kit labels its featured doctor "Available Remotely" and gives every card a star
 * rating. Neither is modelled — nothing holds a professional's working hours and there is
 * no patient review model (see **Roadmap** in CLAUDE.md) — so the card shows the booking's
 * own status, which is the one per-appointment signal the API can actually back.
 */
const AppointmentsCard = ({ appointments, onOpen, onBook }: {
    appointments: Appointment[]; onOpen: () => void; onBook: () => void;
}) => {
    if (appointments.length === 0) {
        return (
            <TouchableOpacity style={styles.cardRow} onPress={onBook} activeOpacity={0.85}>
                <View style={styles.roundIcon}>
                    <Ionicons name="calendar-outline" size={20} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.cardTitle}>No appointments booked</Text>
                    <Text style={styles.cardBody}>
                        Browse specialists and request a consultation about your results.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </TouchableOpacity>
        );
    }

    const [next, ...rest] = appointments;
    const professional = professionalOf(next);
    const when = new Date(next.scheduledFor);

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.doctorRow} onPress={onOpen} activeOpacity={0.85}>
                <Avatar
                    uri={professional?.profile_image ?? null}
                    initials={initialsOf(professional)}
                    size={52}
                />
                <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{nameOf(professional)}</Text>
                    <Text style={styles.rowMeta}>
                        {when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {', '}
                        {formatApptTime(when)}
                    </Text>
                    <Text style={styles.rowMeta}>
                        {(professional?.speciality ?? []).join(' · ') || 'Consultation'}
                        {' · '}
                        {next.durationMinutes ?? 30}m
                    </Text>
                    <View style={styles.statusRow}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: next.status === 'confirmed' ? Palette.success : Palette.warning },
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: next.status === 'confirmed' ? Palette.success : Palette.warning },
                        ]}>
                            {next.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {rest.length > 0 && (
                <>
                    <View style={styles.divider} />
                    <Text style={styles.subHeading}>Upcoming Appointments</Text>
                    <View style={styles.rowList}>
                        {rest.slice(0, 3).map((appointment) => {
                            const p = professionalOf(appointment);
                            const at = new Date(appointment.scheduledFor);
                            return (
                                <TouchableOpacity
                                    key={appointment._id}
                                    style={styles.upcomingRow}
                                    onPress={onOpen}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.dateChip}>
                                        <Text style={styles.dateChipDay}>{at.getDate()}</Text>
                                        <Text style={styles.dateChipWeekday}>
                                            {at.toLocaleDateString(undefined, { weekday: 'short' })}
                                        </Text>
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.rowTitle} numberOfLines={1}>{nameOf(p)}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={1}>
                                            {formatRelativeDay(at)} · {formatApptTime(at)}
                                        </Text>
                                    </View>
                                    <Text style={styles.rowMeta}>{appointment.durationMinutes ?? 30}m</Text>
                                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
};

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

/**
 * Today's doses, with the kit's Skipped / Taken pair.
 *
 * `DoseRow` is the medications hub's own row, not a copy — it already handles the settled
 * state, the undo, and the overdue wording. Two versions of a control that records whether
 * someone took a medicine is exactly the drift this codebase keeps refusing.
 *
 * A dose scheduled for tonight is neither taken nor missed, which is why the header counts
 * what is *left* rather than showing an adherence percentage a day can never reach yet.
 */
const MedicationsCard = ({ schedule, busyDose, onDose, onAdd, onOpen }: {
    schedule: MedicationScheduleDay | null;
    busyDose: string | null;
    onDose: (id: string, action: 'take' | 'skip' | 'undo') => void;
    onAdd: () => void;
    onOpen: (id: string) => void;
}) => {
    const doses = schedule?.doses ?? [];

    if (doses.length === 0) {
        return (
            <TouchableOpacity style={styles.cardRow} onPress={onAdd} activeOpacity={0.85}>
                <View style={styles.roundIcon}>
                    <Ionicons name="medkit-outline" size={20} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.cardTitle}>Nothing scheduled today</Text>
                    <Text style={styles.cardBody}>
                        Add a medication to track doses and check it against the ones you already take.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </TouchableOpacity>
        );
    }

    const pending = doses.filter((d) => d.status === 'scheduled').length;

    return (
        <View style={styles.card}>
            <Text style={styles.cardBody}>
                {pending === 0
                    ? 'Every dose today has been recorded.'
                    : `${pending} dose${pending === 1 ? '' : 's'} left today.`}
            </Text>

            <View style={styles.rowList}>
                {doses.slice(0, 3).map((dose) => (
                    <DoseRow
                        key={dose._id}
                        dose={dose}
                        busy={busyDose === dose._id}
                        onTake={() => onDose(dose._id, 'take')}
                        onSkip={() => onDose(dose._id, 'skip')}
                        onUndo={() => onDose(dose._id, 'undo')}
                        onPress={() => onOpen(dose.medicationId)}
                    />
                ))}
            </View>
        </View>
    );
};

// ---------------------------------------------------------------------------
// Symptom checker, assistant, support
// ---------------------------------------------------------------------------

/**
 * Symptom checker.
 *
 * The kit ends this flow on a "Your Possible Conditions" list with match percentages, and
 * its home card previews "Recent Checks" with risk levels. There is no diagnosis engine
 * and no stored check — `app/symptoms` composes a message and sends it to the assistant,
 * which answers against the person's own records. So the card is the entry point: the
 * search, and the symptoms people actually start from.
 */
const SymptomCheckerCard = ({ onSearch, onSymptom }: {
    onSearch: () => void; onSymptom: (id: string) => void;
}) => {
    const common = COMMON_SYMPTOM_IDS
        .map((id) => SYMPTOMS.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.searchField} onPress={onSearch} activeOpacity={0.85}>
                <Ionicons name="search" size={18} color={Palette.textMuted} />
                <Text style={styles.searchPlaceholder}>Search for a symptom…</Text>
            </TouchableOpacity>

            <View style={styles.chipRow}>
                <Text style={styles.chipLead}>Most common</Text>
                {common.map((symptom) => (
                    <TouchableOpacity
                        key={symptom.id}
                        style={styles.chip}
                        onPress={() => onSymptom(symptom.id)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.chipText}>{symptom.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.cardNote}>
                What you pick is composed into a question for the assistant, which answers with your
                results and plan in front of it. It does not diagnose.
            </Text>
        </View>
    );
};

/**
 * AI Health Assistant.
 *
 * Shows the last thing the assistant actually said, so the bubble is a resumption rather
 * than a stock line. With no conversation yet it says what the assistant is for; with no
 * model key on the server it says that instead of offering a chat that answers 503.
 */
const AssistantCard = ({ conversation, onOpen }: {
    conversation: Conversation | null; onOpen: () => void;
}) => {
    const last = [...(conversation?.messages ?? [])].reverse().find((m) => m.role === 'assistant');
    const unavailable = conversation?.available === false;

    return (
        <View style={styles.card}>
            <View style={styles.bubbleRow}>
                <View style={styles.botIcon}>
                    <Ionicons name="sparkles" size={18} color={Palette.primary} />
                </View>
                <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>
                        {unavailable
                            ? 'The assistant is unavailable on this server right now. Your results and trackers are unaffected.'
                            : last?.text
                                ?? 'Ask me anything about your results, your plan, or a symptom — I read your own records before answering.'}
                    </Text>
                    {!!last && (
                        <View style={styles.bubbleFoot}>
                            <Text style={styles.bubbleTime}>{messageTime(last.createdAt)}</Text>
                            <Ionicons name="checkmark-done" size={14} color={Palette.success} />
                        </View>
                    )}
                </View>
            </View>

            {!unavailable && (
                <>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.footerAction} onPress={onOpen} activeOpacity={0.8}>
                        <Text style={styles.footerActionText}>
                            {last ? 'Continue the conversation' : 'Chat with LabTrack AI'}
                        </Text>
                        <Ionicons name="chatbubble-ellipses-outline" size={17} color={Palette.primary} />
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
};

const SupportBanner = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity style={styles.support} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.flex}>
            <Text style={styles.supportBody}>
                Need help? Our Help Center has the FAQ, and you can email support from there.
            </Text>
            <Text style={styles.supportLink}>Get support</Text>
        </View>
        <Ionicons name="headset-outline" size={40} color={Palette.primaryLight} />
    </TouchableOpacity>
);

/** The kit's underlined footer action — "Log Activity +" — above a hairline rule. */
const CardFooterAction = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.footerAction} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.footerActionText}>{label}</Text>
            <Ionicons name="add" size={18} color={Palette.primary} />
        </TouchableOpacity>
    </>
);

// ---------------------------------------------------------------------------
// Latest analysis
// ---------------------------------------------------------------------------

/**
 * How a plain-language key point is drawn.
 *
 * Three tones rather than the five biomarker flags, and deliberately not the same palette:
 * these label what the person should *do* about a point, not how far a number sits from a
 * reference range. `act` is warning-amber and not danger-red — the analysis is a
 * surveillance read that a clinician has not necessarily signed, and a red card on a home
 * screen says something this product is careful never to say.
 */
const TONE_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
    good: { icon: 'checkmark-circle', color: Palette.success, bg: Palette.successSurface },
    watch: { icon: 'eye-outline', color: Palette.textSecondary, bg: Palette.surface },
    act: { icon: 'flag-outline', color: Palette.warning, bg: Palette.warningSurface },
};

/**
 * Latest AI analysis.
 *
 * Four states, and the two in the middle are the ones the first version got wrong:
 *
 *   - no analysis at all              → the card is the call to action
 *   - analysis, but of an OLDER result → show it, say so plainly, and offer to analyse the
 *                                        new one.
 *   - analysis of the newest result    → the normal case
 *   - AI unavailable on the server     → no button to press
 *
 * The stale analysis is never relabelled as belonging to the new result. It names the
 * values it read, and a reader who thinks it covers bloods it never saw is being misled.
 */
const AnalysisCard = ({
    analysis, generating, expanded, onToggle, onGenerate, onRegenerate,
}: {
    analysis: LatestInterpretation;
    generating: boolean;
    expanded: boolean;
    onToggle: () => void;
    onGenerate: () => void;
    onRegenerate: () => void;
}) => {
    const { interpretation, latestResult, source, isForLatestResult, available, verification } = analysis;

    // The version written for the reader rather than for a clinician. Absent on analyses
    // generated before this layer existed — see the render below for the fallback.
    const plain = interpretation?.plain_summary;

    // Policy currently shows unverified interpretations, so `withheld` is always false
    // today. It is handled anyway: if regulation later requires sign-off first, the server
    // flips one function and this screen already knows what to render.
    const withheld = verification?.withheld === true;
    const verified = isVerified(verification);

    const fmt = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    // The card is headed by whichever document the reader is being shown.
    const headed = interpretation && !isForLatestResult && source ? source : latestResult;
    const headTitle = (headed && 'testType' in headed ? headed.testType : null) || 'Test result';
    const headMeta = [headed?.labName, fmt(headed?.date)].filter(Boolean).join(' · ');

    // A withheld analysis is not a missing one — offering to generate would produce the
    // same cached result and withhold it again.
    const needsFresh = !withheld && Boolean(latestResult) && (!interpretation || !isForLatestResult);

    return (
        <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
                <View style={styles.analysisIcon}>
                    <Ionicons name="sparkles" size={18} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.analysisTest} numberOfLines={1}>{headTitle}</Text>
                    <Text style={styles.analysisMeta} numberOfLines={1}>
                        {headMeta || 'Awaiting details'}
                    </Text>
                </View>
                {verified ? (
                    <View style={[styles.aiBadge, styles.verifiedBadge]}>
                        <Ionicons name="checkmark-circle" size={13} color={Palette.success} />
                        <Text style={[styles.aiBadgeText, { color: Palette.success }]}>Verified</Text>
                    </View>
                ) : interpretation ? (
                    <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                ) : null}
            </View>

            {/* An analysis that predates the newest result is still worth reading — but the
                reader has to know which draw it describes. */}
            {interpretation && !isForLatestResult && (
                <View style={styles.staleNote}>
                    <Ionicons name="time-outline" size={16} color={Palette.warning} />
                    <Text style={styles.staleText}>
                        This analysis covers your {fmt(source?.date) ?? 'earlier'} result.
                        Your newer {latestResult?.testType || 'result'} has not been analysed yet.
                    </Text>
                </View>
            )}

            {/* The lab's own wording, when the report carried any. Distinct from the AI
                read and labelled as such so the two are never confused. */}
            {!!latestResult?.labInterpretation && (
                <View style={styles.labNote}>
                    <Text style={styles.labNoteLabel}>From the lab</Text>
                    <Text style={styles.detailBody}>{latestResult.labInterpretation}</Text>
                </View>
            )}

            {withheld ? (
                <View style={styles.withheldNote}>
                    <Ionicons name="lock-closed-outline" size={18} color={Palette.textSecondary} />
                    <View style={styles.flex}>
                        <Text style={styles.withheldTitle}>Awaiting clinician review</Text>
                        <Text style={styles.detailBody}>
                            Your results have been analysed. A clinician is reviewing the analysis before
                            it is released, and you will be notified as soon as it is ready.
                        </Text>
                    </View>
                </View>
            ) : interpretation ? (
                <>
                    {/*
                      * Collapsed, this card is written for the person; expanded, it is the
                      * clinical read. `plain_summary` is what makes that split possible.
                      *
                      * Without it — every analysis generated before the plain-language
                      * layer existed, and `Interpretation` is append-only so those are
                      * never rewritten — the clinical summary is shown as it always was.
                      */}
                    {plain ? (
                        <>
                            <Text style={styles.plainHeadline}>{plain.headline}</Text>
                            <Text style={styles.analysisSummary}>{plain.what_it_means}</Text>

                            {plain.key_points?.length > 0 && (
                                <View style={styles.pointList}>
                                    {plain.key_points.map((point) => {
                                        const meta = TONE_META[point.tone] ?? TONE_META.watch;
                                        return (
                                            <View key={`${point.label}-${point.detail}`} style={styles.point}>
                                                <View style={[styles.pointIcon, { backgroundColor: meta.bg }]}>
                                                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                                                </View>
                                                <View style={styles.flex}>
                                                    <Text style={styles.pointLabel}>{point.label}</Text>
                                                    <Text style={styles.detailBody}>{point.detail}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* One thing to do, not a list. Someone who reads only the top
                                of this card should still leave with an action. */}
                            {!!plain.next_step && (
                                <View style={styles.nextStep}>
                                    <View style={styles.changesHeader}>
                                        <Ionicons name="arrow-forward-circle-outline" size={15} color={Palette.primary} />
                                        <Text style={styles.changesLabel}>Your next step</Text>
                                    </View>
                                    <Text style={styles.nextStepText}>{plain.next_step}</Text>
                                </View>
                            )}
                        </>
                    ) : (
                        /* 5 rather than 4: at 16px the same clamp showed noticeably less
                           summary than it did at 13px. */
                        <Text style={styles.analysisSummary} numberOfLines={expanded ? undefined : 5}>
                            {interpretation.summary}
                        </Text>
                    )}

                    {/*
                      * "What changed" names the values that moved and the directions they
                      * moved in — by design, and technical by the same token. Where a plain
                      * summary exists it already tells that story in everyday words, so
                      * this stays behind the fold and the collapsed card stays readable.
                      */}
                    {hasMeaningfulChanges(interpretation) && (!plain || expanded) && (
                        <View style={styles.changesNote}>
                            <View style={styles.changesHeader}>
                                <Ionicons name="git-compare-outline" size={15} color={Palette.primary} />
                                <Text style={styles.changesLabel}>What changed</Text>
                            </View>
                            <Text style={styles.detailBody} numberOfLines={expanded ? undefined : 3}>
                                {interpretation.changes_since_last}
                            </Text>
                        </View>
                    )}

                    {expanded && (
                        <View style={styles.analysisDetail}>
                            {/* The clinical summary, shown here rather than at the top when
                                a plain one exists. Same words a reviewing clinician reads,
                                and labelled so nobody mistakes the two for a repetition. */}
                            {plain && (
                                <AnalysisBlock title="The detailed read">
                                    <Text style={styles.detailBody}>{interpretation.summary}</Text>
                                </AnalysisBlock>
                            )}

                            {interpretation.biomarkers_of_concern?.length > 0 && (
                                <AnalysisBlock title="Worth attention">
                                    {interpretation.biomarkers_of_concern.map((b) => (
                                        <View key={b.name} style={styles.detailItem}>
                                            <Text style={styles.detailName}>{b.name}</Text>
                                            <Text style={styles.detailBody}>{b.observation}</Text>
                                            <Text style={styles.detailAction}>{b.action}</Text>
                                        </View>
                                    ))}
                                </AnalysisBlock>
                            )}

                            {interpretation.risks?.length > 0 && (
                                <AnalysisBlock title="Risks assessed">
                                    {[...interpretation.risks].sort(byRiskSeverity).map((r) => {
                                        const meta = RISK_META[r.level] ?? RISK_META.unknown;
                                        return (
                                            <View key={`${r.condition}-${r.level}`} style={styles.detailItem}>
                                                <View style={styles.riskRow}>
                                                    <Text style={[styles.detailName, styles.flex]}>{r.condition}</Text>
                                                    <View style={[styles.riskPill, { backgroundColor: meta.bg }]}>
                                                        <Text style={[styles.riskText, { color: meta.color }]}>{meta.label}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.detailBody}>{r.rationale}</Text>
                                            </View>
                                        );
                                    })}
                                </AnalysisBlock>
                            )}

                            {interpretation.lifestyle_recommendations?.length > 0 && (
                                <AnalysisBlock title="Suggested changes">
                                    {interpretation.lifestyle_recommendations.map((l) => (
                                        <View key={`${l.area}-${l.recommendation}`} style={styles.detailItem}>
                                            <Text style={styles.detailName}>{l.area}</Text>
                                            <Text style={styles.detailBody}>{l.recommendation}</Text>
                                        </View>
                                    ))}
                                </AnalysisBlock>
                            )}

                            {!!interpretation.follow_up && (
                                <AnalysisBlock title="Next review">
                                    <Text style={styles.detailBody}>{interpretation.follow_up}</Text>
                                </AnalysisBlock>
                            )}

                            {interpretation.limitations?.length > 0 && (
                                <AnalysisBlock title="What this could not assess">
                                    {interpretation.limitations.map((l) => (
                                        <Text key={l} style={styles.detailBody}>• {l}</Text>
                                    ))}
                                </AnalysisBlock>
                            )}
                        </View>
                    )}

                    <View style={styles.analysisFooter}>
                        <TouchableOpacity onPress={onToggle} hitSlop={8} style={styles.footerLink}>
                            <Text style={styles.footerLinkText}>
                                {expanded ? 'Show less' : plain ? 'Read the full analysis' : 'Read full analysis'}
                            </Text>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Palette.primary} />
                        </TouchableOpacity>
                        {available && !needsFresh && (
                            <TouchableOpacity onPress={onRegenerate} hitSlop={8} disabled={generating}>
                                <Text style={[styles.regenerateText, generating && styles.disabledText]}>
                                    {generating ? 'Working…' : 'Regenerate'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.analysisDisclaimer}>
                        {verified
                            ? `Reviewed by a clinician${verification?.reviewedAt ? ` on ${new Date(verification.reviewedAt).toLocaleDateString()}` : ''}`
                            : 'AI-generated · not yet verified by a clinician'}
                        {analysis.generatedAt ? ` · analysed ${new Date(analysis.generatedAt).toLocaleDateString()}` : ''}
                    </Text>
                </>
            ) : (
                <Text style={styles.analysisSummary}>
                    {available
                        ? 'This result has not been analysed yet. Generate an analysis to see what it means and refresh your plan.'
                        : 'AI analysis is unavailable on this server right now. Your result is saved and your markers are still tracked.'}
                </Text>
            )}

            {/* One button, whether this is the first analysis or a catch-up for a newer
                result. It always targets the newest result. */}
            {available && needsFresh && (
                <TouchableOpacity
                    style={[styles.primaryButton, generating && styles.buttonDisabled]}
                    onPress={onGenerate}
                    disabled={generating}
                >
                    {generating
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : <Text style={styles.primaryButtonText}>
                            {interpretation ? 'Analyse latest result' : 'Get AI analysis'}
                        </Text>}
                </TouchableOpacity>
            )}
        </View>
    );
};

const AnalysisBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.analysisBlock}>
        <Text style={styles.analysisBlockTitle}>{title}</Text>
        {children}
    </View>
);

const Section = ({ title, action, onAction, children }: {
    title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {action && onAction && (
                <TouchableOpacity onPress={onAction} hitSlop={8}>
                    <Text style={styles.sectionAction}>{action}</Text>
                </TouchableOpacity>
            )}
        </View>
        {children}
    </View>
);

// ---------------------------------------------------------------------------
// Signed out
// ---------------------------------------------------------------------------

const ProductCard = ({ product, onPress }: { product: Product; onPress: () => void }) => (
    <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.85}>
        {product.image
            ? <Image source={{ uri: product.image }} style={styles.productImage} />
            : <View style={[styles.productImage, styles.productPlaceholder]}>
                <Ionicons name="flask-outline" size={26} color={Palette.primaryLight} />
            </View>}
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>£{product.price}</Text>
    </TouchableOpacity>
);

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    { icon: 'sparkles-outline', title: 'AI interpretation', body: 'Your results explained in plain language.' },
    { icon: 'trending-up-outline', title: 'Track over time', body: 'Every marker charted against your own range.' },
    { icon: 'calendar-outline', title: 'A real plan', body: 'Screenings and consultations, dated and bookable.' },
    { icon: 'shield-checkmark-outline', title: 'Genetic context', body: 'Ranges narrowed to your DNA where it matters.' },
];

const SignedOut = ({ products, router, topInset }: {
    products: Product[]; router: Router; topInset: number;
}) => (
    <>
        <LinearGradient
            colors={Palette.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.welcomeHero, { paddingTop: topInset + Spacing.xxl }]}
        >
            <Text style={styles.heroEyebrow}>LabTrack</Text>
            <Text style={styles.welcomeTitle}>Understand what your results actually mean</Text>
            <Text style={styles.heroHeadline}>
                Upload a lab report and get an interpretation, a tracked history, and a plan you can act on.
            </Text>
            <View style={styles.ctaRow}>
                <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push('/signup')}>
                    <Text style={styles.ctaPrimaryText}>Create account</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/(auth)/loginscreen')}>
                    <Text style={styles.ctaSecondaryText}>Sign in</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>

        <Section title="Why LabTrack">
            <View style={styles.benefitGrid}>
                {BENEFITS.map((b) => (
                    <View key={b.title} style={styles.benefitCard}>
                        <View style={styles.benefitIcon}>
                            <Ionicons name={b.icon} size={20} color={Palette.primary} />
                        </View>
                        <Text style={styles.benefitTitle}>{b.title}</Text>
                        <Text style={styles.benefitBody}>{b.body}</Text>
                    </View>
                ))}
            </View>
        </Section>

        {products.length > 0 && (
            <Section title="Popular tests" action="See all" onAction={() => router.push('/(tabs)/orders')}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                    {products.map((p) => (
                        <ProductCard
                            key={p._id}
                            product={p}
                            onPress={() => router.push({ pathname: '/ProductDetails', params: { productId: p._id } })}
                        />
                    ))}
                </ScrollView>
            </Section>
        )}
    </>
);

// ---------------------------------------------------------------------------
// Styles — 16pt gutter and the kit's card radius.
// ---------------------------------------------------------------------------

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: Spacing.xxxl },
    flex: { flex: 1 },
    hScroll: { paddingHorizontal: GUTTER, gap: Spacing.md },

    // Header ---------------------------------------------------------------
    header: {
        paddingHorizontal: GUTTER,
        // Deep enough that the score card, pulled up by half its height, still leaves the
        // gradient reading as a band rather than as a stripe behind a card.
        paddingBottom: Spacing.xxxl + Spacing.xxl,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerDate: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.medium },
    streakChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#F59E0B', borderRadius: Radius.sm,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    streakText: { fontSize: 12, color: Palette.white, fontFamily: Fonts.bold },
    headerGreeting: { fontSize: 26, color: Palette.white, fontFamily: Fonts.bold, marginTop: 6 },
    headerSearch: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    headerAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },

    // Score card -----------------------------------------------------------
    scoreCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
        marginHorizontal: GUTTER, marginTop: -Spacing.xxxl - Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.white, ...Shadow.card,
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    },
    scoreBox: {
        width: 66, height: 66, borderRadius: Radius.lg,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    scoreValue: { fontSize: 28, color: Palette.primary, fontFamily: Fonts.bold },
    scoreBand: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold },
    scoreMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
    scoreMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    scoreMetaText: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium },
    scoreDot: { fontSize: 13, color: Palette.textMuted },

    // Sections -------------------------------------------------------------
    section: { marginTop: Spacing.xxl },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold },
    sectionAction: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.semibold },

    // The shared card the kit draws every section in.
    card: {
        marginHorizontal: GUTTER, padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.md,
    },
    cardRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.borderLight,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    cardTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    cardBody: { fontSize: 14, lineHeight: 20, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 3 },
    cardNote: { fontSize: 12, lineHeight: 17, color: Palette.textMuted, fontFamily: Fonts.regular },
    bigFigure: { fontSize: 30, color: Palette.text, fontFamily: Fonts.bold },
    bigUnit: { fontSize: 15, color: Palette.textSecondary, fontFamily: Fonts.regular },
    divider: { height: 1, backgroundColor: Palette.border },
    subHeading: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    roundIcon: {
        width: 42, height: 42, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    roundButton: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    footerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    footerActionText: { fontSize: 15, color: Palette.primary, fontFamily: Fonts.semibold },
    rowList: { gap: Spacing.md },
    rowItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    rowMeta: { fontSize: 12.5, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 1 },
    statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: 5 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12.5, color: Palette.text, fontFamily: Fonts.semibold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    statusDot: { width: 7, height: 7, borderRadius: Radius.pill },
    statusText: { fontSize: 13, fontFamily: Fonts.semibold },

    // Health metrics -------------------------------------------------------
    metricTile: {
        width: METRIC_CARD_WIDTH, padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.sm,
    },
    metricTileIcon: {
        width: 40, height: 40, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
    },
    metricTileValue: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold },
    metricTileLabel: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    metricTileNote: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.medium },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    unit: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.regular },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: Spacing.md },
    dot: { width: 18, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.border },
    dotActive: { width: 26, backgroundColor: Palette.primary },

    // Activity -------------------------------------------------------------
    ringCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    ringText: { fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },

    // Sleep ----------------------------------------------------------------
    sleepChart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: 86 },
    sleepColumn: { flex: 1, alignItems: 'center', gap: 5 },
    sleepTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    sleepBar: {
        width: '100%', borderRadius: Radius.sm, backgroundColor: Palette.primary, minHeight: 4,
    },
    sleepLabel: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.medium },

    // Nutrition ------------------------------------------------------------
    nutritionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    macroList: { flex: 1, gap: Spacing.md },
    macro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    macroDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 3 },
    macroLabel: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    macroValue: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },

    // Appointments ---------------------------------------------------------
    doctorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    dateChip: {
        width: 46, height: 46, borderRadius: Radius.md, borderWidth: 1,
        borderColor: Palette.border, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    dateChipDay: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    dateChipWeekday: { fontSize: 10, color: Palette.textSecondary, fontFamily: Fonts.medium },

    // Symptoms -------------------------------------------------------------
    searchField: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white, paddingHorizontal: Spacing.lg, paddingVertical: 13,
    },
    searchPlaceholder: { fontSize: 14, color: Palette.textMuted, fontFamily: Fonts.regular },
    chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
    chipLead: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    chip: {
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white, paddingHorizontal: Spacing.md, paddingVertical: 6,
    },
    chipText: { fontSize: 13, color: Palette.text, fontFamily: Fonts.medium },

    // Assistant ------------------------------------------------------------
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    botIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    bubble: {
        flex: 1, backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderLight,
        padding: Spacing.md, gap: 4,
    },
    bubbleText: { fontSize: 14.5, lineHeight: 21, color: Palette.text, fontFamily: Fonts.regular },
    bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    bubbleTime: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular },

    // Support --------------------------------------------------------------
    support: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.primarySurface,
        borderWidth: 1, borderColor: '#E9D5FF',
    },
    supportBody: { fontSize: 14, lineHeight: 20, color: Palette.text, fontFamily: Fonts.regular },
    supportLink: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold, marginTop: 6 },

    // Latest analysis ------------------------------------------------------
    analysisCard: {
        marginHorizontal: GUTTER, padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
        gap: Spacing.md,
    },
    analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    analysisIcon: {
        width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    analysisTest: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    analysisMeta: { fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 2 },
    aiBadge: {
        paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm,
        backgroundColor: Palette.primarySurface,
    },
    aiBadgeText: { fontSize: 12, color: Palette.primary, fontFamily: Fonts.bold, letterSpacing: 0.5 },
    analysisSummary: { fontSize: 16, lineHeight: 24, color: Palette.text, fontFamily: Fonts.regular },

    /**
     * The plain-language block.
     *
     * Larger and heavier than the clinical summary it replaces at the top of the card,
     * because it is now the thing most people will read and the only thing some of them
     * will. No `fontWeight` beside `fontFamily` — Android renders regular when both are
     * set on a custom face.
     */
    plainHeadline: { fontSize: 19, lineHeight: 26, color: Palette.text, fontFamily: Fonts.semibold },
    pointList: { gap: Spacing.md },
    point: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    pointIcon: {
        width: 26, height: 26, borderRadius: 13,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    pointLabel: { fontSize: 15.5, color: Palette.text, fontFamily: Fonts.semibold, marginBottom: 1 },
    nextStep: {
        gap: 5, padding: Spacing.md, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
    },
    nextStepText: { fontSize: 15.5, lineHeight: 22, color: Palette.text, fontFamily: Fonts.medium },
    analysisDetail: { gap: Spacing.lg, paddingTop: Spacing.xs },
    analysisBlock: { gap: 6 },
    analysisBlockTitle: {
        fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase',
        color: Palette.textMuted, fontFamily: Fonts.bold,
    },
    detailItem: {
        gap: 2, paddingLeft: Spacing.md,
        borderLeftWidth: 2, borderLeftColor: Palette.borderLight,
    },
    detailName: { fontSize: 16, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    detailBody: { fontSize: 15, lineHeight: 22, color: Palette.textSecondary, fontFamily: Fonts.regular },
    detailAction: { fontSize: 15, lineHeight: 22, color: Palette.primary, fontFamily: Fonts.medium },
    riskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    riskPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
    riskText: { fontSize: 12, fontFamily: Fonts.bold },
    analysisFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.md,
    },
    footerLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerLinkText: { fontSize: 15, color: Palette.primary, fontFamily: Fonts.semibold },
    regenerateText: { fontSize: 15, color: Palette.textSecondary, fontFamily: Fonts.semibold },
    disabledText: { color: Palette.textMuted },
    buttonDisabled: { opacity: 0.6 },
    analysisDisclaimer: { fontSize: 13, lineHeight: 19, color: Palette.textMuted, fontFamily: Fonts.regular },
    staleNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
        padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Palette.warningSurface,
    },
    staleText: {
        flex: 1, fontSize: 14, lineHeight: 20, color: Palette.warning, fontFamily: Fonts.medium,
    },
    withheldNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Palette.surface,
    },
    withheldTitle: {
        fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold, marginBottom: 4,
    },
    verifiedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: Palette.successSurface,
    },
    changesNote: {
        gap: 5, padding: Spacing.md, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
    },
    changesHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    changesLabel: {
        fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
        color: Palette.primary, fontFamily: Fonts.bold,
    },
    labNote: {
        gap: 3, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Palette.surface,
    },
    labNoteLabel: {
        fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
        color: Palette.textMuted, fontFamily: Fonts.bold,
    },

    primaryButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 14, paddingHorizontal: Spacing.xxl, alignItems: 'center', marginTop: Spacing.sm,
        alignSelf: 'stretch',
    },
    primaryButtonText: { color: Palette.white, fontSize: 15, fontFamily: Fonts.semibold },

    // Signed out -----------------------------------------------------------
    welcomeHero: {
        paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.md,
    },
    heroEyebrow: {
        fontSize: 12, letterSpacing: 0.8,
        color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', fontFamily: Fonts.bold,
    },
    heroHeadline: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', fontFamily: Fonts.regular },
    welcomeTitle: { fontSize: 26, lineHeight: 34, color: Palette.white, fontFamily: Fonts.bold },
    ctaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    ctaPrimary: {
        flex: 1, backgroundColor: Palette.white, borderRadius: Radius.md,
        paddingVertical: 13, alignItems: 'center',
    },
    ctaPrimaryText: { color: Palette.primaryDark, fontSize: 14, fontFamily: Fonts.semibold },
    ctaSecondary: {
        flex: 1, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)',
    },
    ctaSecondaryText: { color: Palette.white, fontSize: 14, fontFamily: Fonts.semibold },
    benefitGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: GUTTER,
    },
    benefitCard: {
        flexGrow: 1, flexBasis: '46%', padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, gap: Spacing.sm,
    },
    benefitIcon: {
        width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    benefitTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.bold },
    benefitBody: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, fontFamily: Fonts.regular },

    // Products -------------------------------------------------------------
    productCard: { width: 152, gap: 6 },
    productImage: { width: 152, height: 104, borderRadius: Radius.lg, backgroundColor: Palette.surface },
    productPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    productPrice: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold },
});
