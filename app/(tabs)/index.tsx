/**
 * Home.
 *
 * Built from `Design/index.svg` — the kit's "Home" frame, which is a scroll of one tracker
 * section per feature under a purple header and an overlapping score card. This screen
 * keeps that vocabulary and **does not keep its fixed running order**, because a mockup is
 * drawn once and a home screen is opened twice a day.
 *
 * The order of the page, and why:
 *
 *   1. **Header, with the day in one line.** Doses left, an appointment today, calories
 *      remaining — composed from state this screen has already loaded, fetching nothing.
 *      A greeting over a date is a screen that knows who you are and has nothing to say.
 *   2. **Score, with its movement.** The delta and the pillar that moved, not the band
 *      printed twice. `HealthScore.change` was fetched and thrown away for months.
 *   3. **Markers to watch.** The score card counts out-of-range markers; this names them,
 *      each with the direction it is heading. A count is not an answer.
 *   4. **Needs you.** Ranked across features by what happens if it is ignored — a crisis
 *      reading, then an overdue screening off the plan, then a result nothing has analysed,
 *      then one that is merely due, then an appointment inside 48 hours. Three at most.
 *      This is the only part of the page that differs between two visits on one day, and
 *      it is why the plan is fetched here at all.
 *   5. **Latest Analysis**, collapsed to a headline, three lines and one next step.
 *   6. **The trackers that have data**, most time-sensitive first.
 *   7. **Ask LabTrack AI** — the symptom search and the assistant, which were two sections
 *      describing one act.
 *   8. **Get more from LabTrack** — every tracker with nothing in it, as one list of rows
 *      rather than as six full cards each saying "connect a watch".
 *   9. **News & Resources.**
 *
 * The tracker/setup split is the load-bearing idea. A card is earned by having something to
 * report; a feature nobody has started is a row. `HomeScreen` decides which, so the cards
 * themselves no longer carry empty states — they guard and return null, and the guard can
 * never fire from here.
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
 * The support banner that used to close the page is gone: it was a permanent row about the
 * Help Center on a screen whose problem was length, and the profile links to help three
 * times.
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
import {
    getLatestBiomarkers, byClinicalPriority, describeMovement, medicalName, plainName,
    formatValue, FLAG_META, isCriticalFlag,
} from '@/lib/biomarkers';
import { getPlan, STATUS_META as PLAN_STATUS_META, TYPE_ICON as PLAN_TYPE_ICON } from '@/lib/plan';
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
    BiomarkerSummary, MedicationScheduleDay, NutritionDay, NutritionTargets, Product, User,
    Appointment, PlanItem,
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

/**
 * One row of the "Needs you" list.
 *
 * Deliberately not typed per feature. The list is ranked across features — a crisis reading
 * and an overdue screening compete for the same slot — so they have to be the same shape by
 * the time anything sorts them.
 */
interface HomeAction {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    surface: string;
    title: string;
    body: string;
    cta: string;
    onPress: () => void;
}

/**
 * One row of the "Get more from LabTrack" list.
 *
 * A tracker nobody has started. It is a row rather than the card that feature would draw,
 * because six cards each saying "connect a watch" is a screen about what the person has
 * *not* done, stacked on top of what they have.
 */
interface SetupItem {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    body: string;
    route: string;
}

/** How a plan item's date reads once it is asking for something. */
const dueLabel = (item: PlanItem) => {
    const due = new Date(item.dueDate);
    const when = formatRelativeDay(due);
    const what = item.condition || item.frequency || item.productName || item.speciality;
    const lead = item.status === 'urgent'
        ? `Overdue since ${when.toLowerCase() === 'today' ? 'today' : when}`
        : `Due ${when.toLowerCase()}`;
    return what ? `${lead} · ${what}` : lead;
};

/**
 * How far back the score's comparison point is.
 *
 * The server hands back the previous snapshot's date, not a window, so the wording has to
 * be derived. Past a fortnight it stops naming a number of days — "in 46 days" reads as a
 * countdown rather than as a comparison.
 */
const formatSince = (iso: string) => {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / DAY);
    if (!Number.isFinite(days) || days < 0) return 'since your last check';
    if (days <= 1) return 'since yesterday';
    if (days < 14) return `in ${days} days`;
    return 'since your last check';
};

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
    const [plan, setPlan] = useState<PlanItem[]>([]);
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
            // The plan is what the interpretation produced — dated screenings and
            // consultations. It is the only thing on this screen that says what to *do*,
            // which is why the "Needs you" list is built from it first.
            getPlan(),
            getConversation(),
            // The newest of the library, for the rail at the foot of the screen. Six cards,
            // because this is a rail and nobody scrolls twenty of them sideways.
            listResources({ limit: 6, sort: 'newest' }),
        ]);

        const [
            userRes, biomarkerRes, analysisRes, nutritionRes, scoreRes, metricsRes,
            activityRes, activityDayRes, medicationRes, appointmentRes, planRes,
            conversationRes, resourceRes,
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
        if (planRes.status === 'fulfilled') setPlan(planRes.value.items ?? []);
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

    /** Doses still to come today. Neither taken nor missed — see **Medication checker**. */
    const pendingDoses = useMemo(
        () => (medications?.doses ?? []).filter((d) => d.status === 'scheduled').length,
        [medications],
    );

    /**
     * The plan items that are asking for something now.
     *
     * `urgent` first, then `due`, each oldest-first. Everything else on the plan is a date
     * in the future and belongs on the plan screen, not on a home page whose job is to say
     * what today needs.
     */
    const planDue = useMemo(
        () => plan
            .filter((item) => item.status === 'urgent' || item.status === 'due')
            .sort((a, b) =>
                (a.status === 'urgent' ? 0 : 1) - (b.status === 'urgent' ? 0 : 1)
                || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        [plan],
    );

    /** The next appointment, but only while it is close enough to be worth preparing for. */
    const imminent = useMemo(
        () => liveAppointments.find(
            (a) => new Date(a.scheduledFor).getTime() - Date.now() < 2 * DAY,
        ) ?? null,
        [liveAppointments],
    );

    /** A blood-pressure reading in the crisis band anywhere in the window. */
    const crisis = useMemo(() => metricCards.find((c) => c.urgent) ?? null, [metricCards]);

    /**
     * The line under the greeting.
     *
     * Everything in it is already loaded — this composes, it does not fetch. Three parts at
     * most: past three the line wraps to a paragraph and stops being glanceable. A day with
     * nothing in it says so rather than being left blank, because a missing line reads as a
     * screen that failed to load.
     */
    const todayLine = useMemo(() => {
        const parts: string[] = [];

        if (pendingDoses > 0) {
            parts.push(`${pendingDoses} dose${pendingDoses === 1 ? '' : 's'} left`);
        }

        const todayAppt = liveAppointments.find(
            (a) => new Date(a.scheduledFor).toDateString() === new Date().toDateString(),
        );
        if (todayAppt) {
            parts.push(`${nameOf(professionalOf(todayAppt))} at ${formatApptTime(new Date(todayAppt.scheduledFor))}`);
        }

        const target = nutrition?.targets && 'calories' in nutrition.targets ? nutrition.targets.calories : 0;
        if (target > 0) {
            const left = Math.round(target - (nutrition?.totals.calories ?? 0));
            parts.push(left > 0 ? `${left.toLocaleString()} kcal left` : 'calorie target met');
        }

        const goal = activity?.goal;
        if (parts.length < 3 && goal && goal.sessions.target > goal.sessions.done) {
            const short = goal.sessions.target - goal.sessions.done;
            parts.push(`${short} workout${short === 1 ? '' : 's'} to go`);
        }

        return parts.length ? parts.slice(0, 3).join('  ·  ') : 'Nothing scheduled today.';
    }, [pendingDoses, liveAppointments, nutrition, activity]);

    /**
     * "Needs you" — the only part of this screen that differs between two visits on the
     * same day, and therefore the reason to open it twice.
     *
     * Ranked by what happens if it is ignored, not by which feature it belongs to: a
     * crisis reading outranks an overdue screening, which outranks an unread analysis.
     * Capped at three. A fourth row turns a list of things to do into a backlog, and a
     * backlog is a thing people learn to scroll past.
     */
    const actions = useMemo<HomeAction[]>(() => {
        const out: HomeAction[] = [];

        if (crisis) {
            out.push({
                id: 'crisis',
                icon: 'alert-circle',
                color: Palette.danger,
                surface: Palette.dangerSurface,
                title: 'A reading needs attention',
                body: `Your ${crisis.label.toLowerCase()} recorded a crisis-range value. This is not a diagnosis — speak to a clinician.`,
                cta: 'See the reading',
                onPress: () => router.push(METRIC_ROUTE[crisis.key] as never),
            });
        }

        for (const item of planDue.filter((i) => i.status === 'urgent').slice(0, 2)) {
            out.push({
                id: item._id,
                icon: (PLAN_TYPE_ICON[item.type] ?? 'calendar-outline') as HomeAction['icon'],
                color: PLAN_STATUS_META.urgent.color,
                surface: PLAN_STATUS_META.urgent.bg,
                title: item.title,
                body: dueLabel(item),
                cta: item.type === 'consultation' ? 'Book it' : 'Order it',
                onPress: () => router.push('/myplans'),
            });
        }

        // A result the analysis has not caught up with. `needsFresh` on the analysis card
        // says the same thing further down the screen; this is what puts it above the fold.
        if (analysis?.latestResult && analysis.available !== false
            && (!analysis.interpretation || !analysis.isForLatestResult)) {
            out.push({
                id: 'analyse',
                icon: 'sparkles',
                color: Palette.primary,
                surface: Palette.primarySurface,
                title: analysis.interpretation ? 'A newer result is waiting' : 'Your result has not been read yet',
                body: `${analysis.latestResult.testType || 'Your result'} is saved but has no analysis. Generating one also refreshes your plan.`,
                cta: generating ? 'Working…' : 'Analyse it',
                onPress: () => { if (!generating) handleGenerate(false); },
            });
        }

        for (const item of planDue.filter((i) => i.status === 'due').slice(0, 2)) {
            out.push({
                id: item._id,
                icon: (PLAN_TYPE_ICON[item.type] ?? 'calendar-outline') as HomeAction['icon'],
                color: PLAN_STATUS_META.due.color,
                surface: PLAN_STATUS_META.due.bg,
                title: item.title,
                body: dueLabel(item),
                cta: item.type === 'consultation' ? 'Book it' : 'Order it',
                onPress: () => router.push('/myplans'),
            });
        }

        if (imminent) {
            const at = new Date(imminent.scheduledFor);
            out.push({
                id: imminent._id,
                icon: 'calendar',
                color: imminent.status === 'confirmed' ? Palette.success : Palette.warning,
                surface: imminent.status === 'confirmed' ? Palette.successSurface : Palette.warningSurface,
                title: `${nameOf(professionalOf(imminent))} · ${formatRelativeDay(at)}`,
                body: imminent.status === 'confirmed'
                    ? `Confirmed for ${formatApptTime(at)}.`
                    : `Requested for ${formatApptTime(at)}. Still waiting on the clinician to confirm.`,
                cta: 'View',
                onPress: () => router.push('/appointments'),
            });
        }

        return out.slice(0, 3);
    }, [crisis, planDue, analysis, imminent, generating, handleGenerate, router]);

    const firstName = user?.firstName?.trim() || 'there';
    const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase();

    if (loading && signedIn === null) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    /**
     * Which trackers get a section, in what order, and which become a setup row.
     *
     * Two decisions, both of which the old screen made by hardcoding a list:
     *
     * 1. **A tracker with no data does not earn a card.** Sleep saying "connect a watch"
     *    used to occupy exactly as much of the screen as nutrition showing a real day. Six
     *    such cards is most of a scroll spent on things the person has not started, above
     *    the things they have.
     * 2. **Time-sensitivity outranks the kit's order.** Doses still due today and an
     *    appointment inside 48 hours move to the top; everything else keeps the order the
     *    mockup draws. A fixed order is a screen that reads the same at 8am and at 11pm.
     *
     * Built here rather than in a `useMemo` because every entry closes over `router` and the
     * handlers, so the dependency list would name almost everything in scope and re-run on
     * almost every render anyway.
     */
    const sleepCard = metrics.find((m) => m.key === 'sleep') ?? null;
    const nutritionTarget = nutrition?.targets && 'calories' in nutrition.targets
        ? nutrition.targets.calories : 0;

    const trackers: { id: string; order: number; node: React.ReactNode }[] = [];
    const setup: SetupItem[] = [];

    if (metricCards.some((c) => c.value !== null)) {
        trackers.push({
            id: 'metrics',
            order: 2,
            node: (
                <Section title="Health Metrics" action="See All" onAction={() => router.push('/metrics')}>
                    <MetricsRail cards={metricCards} router={router} />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'metrics',
            icon: 'analytics-outline',
            title: 'Log a metric',
            body: 'Weight, hydration and blood pressure. Three pillars, and nothing on this phone measures them for you.',
            route: '/metrics',
        });
    }

    if ((medications?.doses.length ?? 0) > 0) {
        trackers.push({
            id: 'medications',
            order: pendingDoses > 0 ? 0 : 4,
            node: (
                <Section title="Medications" action="See All" onAction={() => router.push('/medications')}>
                    <MedicationsCard
                        schedule={medications}
                        busyDose={busyDose}
                        onDose={handleDose}
                        onAdd={() => router.push('/medications/add')}
                        onOpen={(id) => router.push({ pathname: '/medications/[id]', params: { id } })}
                    />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'medications',
            icon: 'medkit-outline',
            title: 'Add a medication',
            body: 'Track doses, and have anything you already take checked against it.',
            route: '/medications/add',
        });
    }

    if (liveAppointments.length > 0) {
        trackers.push({
            id: 'appointments',
            order: imminent ? 1 : 5,
            node: (
                <Section title="Appointments" action="See All" onAction={() => router.push('/appointments')}>
                    <AppointmentsCard
                        appointments={liveAppointments}
                        onOpen={() => router.push('/appointments')}
                        onBook={() => router.push('/(tabs)/professionals')}
                    />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'appointments',
            icon: 'calendar-outline',
            title: 'Book a consultation',
            body: 'Browse specialists and ask one of them to review your results.',
            route: '/(tabs)/professionals',
        });
    }

    if (sessions.length > 0 || (activity?.totals.sessions ?? 0) > 0 || activity?.goal) {
        trackers.push({
            id: 'activity',
            order: 3,
            node: (
                <Section title="Activity" action="See All" onAction={() => router.push('/activity')}>
                    <ActivityCard
                        summary={activity}
                        sessions={sessions}
                        onLog={() => router.push('/activity/log')}
                        onSession={(id) => router.push({ pathname: '/activity/session/[id]', params: { id } })}
                    />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'activity',
            icon: 'fitness-outline',
            title: 'Log a workout',
            body: 'Or set a weekly target, and the activity pillar starts measuring against it.',
            route: '/activity/log',
        });
    }

    if (nutrition?.plan && nutritionTarget > 0) {
        trackers.push({
            id: 'nutrition',
            order: 3.5,
            node: (
                <Section title="Nutrition" action="See All" onAction={() => router.push('/nutrition')}>
                    <NutritionCard
                        day={nutrition}
                        onOpen={() => router.push('/nutrition')}
                        onLog={() => router.push('/nutrition/log')}
                    />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'nutrition',
            icon: 'restaurant-outline',
            title: 'Set up nutrition',
            body: 'Targets built from your profile and from the dietary advice on your plan.',
            route: '/nutrition',
        });
    }

    if (typeof sleepCard?.value === 'number' || (sleepCard?.series ?? []).some((n) => (n.value ?? 0) > 0)) {
        trackers.push({
            id: 'sleep',
            order: 6,
            node: (
                <Section title="Sleep" action="See All" onAction={() => router.push('/activity')}>
                    <SleepCard
                        card={sleepCard}
                        today={dayMetrics}
                        onOpen={() => router.push('/activity')}
                    />
                </Section>
            ),
        });
    } else {
        setup.push({
            id: 'sleep',
            icon: 'moon-outline',
            title: 'Connect a health store',
            body: 'Sleep, steps and heart rate come from a watch or your phone. Nothing here measures them alone.',
            route: '/activity/sources',
        });
    }

    trackers.sort((a, b) => a.order - b.order);

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
                            streak={activity?.streak ?? null}
                            today={todayLine}
                            topInset={insets.top}
                            onSearch={() => router.push('/resources/search')}
                            onPressAvatar={() => router.push('/profile')}
                            onPressStreak={() => router.push('/activity/history')}
                        />

                        <ScoreCard
                            score={score}
                            attention={attention.length}
                            onPress={() => router.push('/score')}
                        />

                        {/*
                          The markers behind the number, worst first. The score card used to
                          say "2 need attention" and stop there, which names a count and no
                          nouns — the one thing a person wants from a health app is *which*
                          two. Each tile carries its own movement, so a value that is still
                          out of range but heading back reads as progress rather than as a
                          second identical warning.
                        */}
                        {attention.length > 0 && (
                            <Section
                                title="Markers to watch"
                                action="See All"
                                onAction={() => router.push('/(tabs)/results')}
                            >
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.hScroll}
                                >
                                    {attention.slice(0, 5).map((marker) => (
                                        <MarkerTile
                                            key={marker._id}
                                            marker={marker}
                                            onPress={() => router.push({
                                                pathname: '/biomarker/[name]',
                                                params: { name: marker.name },
                                            })}
                                        />
                                    ))}
                                </ScrollView>
                            </Section>
                        )}

                        {/*
                          Needs you.

                          Above the analysis on purpose. The analysis explains, this asks —
                          and a screen whose first actionable element is four scrolls down is
                          a screen people learn to stop scrolling.
                        */}
                        {actions.length > 0 && (
                            <Section
                                title="Needs you"
                                action={plan.length > 0 ? 'Your plan' : undefined}
                                onAction={plan.length > 0 ? () => router.push('/myplans') : undefined}
                            >
                                <View style={styles.actionList}>
                                    {actions.map((action) => (
                                        <ActionRow key={action.id} action={action} />
                                    ))}
                                </View>
                            </Section>
                        )}

                        {/*
                          Latest analysis — the one section `Design/index.svg` does not
                          carry. It sits here because the interpretation is the product:
                          every tracker below reports a measurement, and this is the only
                          thing that says what the measurements mean.
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

                        {/* The trackers that have something to say, most urgent first. */}
                        {trackers.map((tracker) => (
                            <React.Fragment key={tracker.id}>{tracker.node}</React.Fragment>
                        ))}

                        {/*
                          Symptoms and the assistant were two sections and are one card. They
                          are the same act — the symptom screen composes a message and posts
                          it to the assistant — so drawing them as separate features was the
                          screen describing its own file layout rather than what a person
                          does with it.
                        */}
                        <Section title="Ask LabTrack AI">
                            <AskCard
                                conversation={conversation}
                                onSearch={() => router.push('/symptoms')}
                                onSymptom={(id) => router.push({ pathname: '/symptoms', params: { symptom: id } })}
                                onOpen={() => router.push('/(tabs)/assistant')}
                            />
                        </Section>

                        {/*
                          The trackers with nothing in them, as one list rather than as six
                          full-height cards saying "connect a watch".

                          Each row names the pillar it fills, because that is the true answer
                          to "why should I bother" — the score above genuinely cannot move
                          until one of these has data. See **The LabTrack score**.
                        */}
                        {setup.length > 0 && (
                            <Section title="Get more from LabTrack">
                                <View style={styles.card}>
                                    <Text style={styles.cardBody}>
                                        Each of these fills a pillar of your score. Until one has data,
                                        that pillar is counted as unknown rather than as a failure.
                                    </Text>
                                    <View style={styles.rowList}>
                                        {setup.map((item) => (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.setupRow}
                                                onPress={() => router.push(item.route as never)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.setupIcon}>
                                                    <Ionicons name={item.icon} size={18} color={Palette.primary} />
                                                </View>
                                                <View style={styles.flex}>
                                                    <Text style={styles.rowTitle}>{item.title}</Text>
                                                    <Text style={styles.rowMeta} numberOfLines={2}>{item.body}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </Section>
                        )}

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
const HomeHeader = ({
    name, initials, photo, streak, today, topInset, onSearch, onPressAvatar, onPressStreak,
}: {
    name: string;
    initials: string;
    photo: string | null;
    /** Null until the activity summary lands — distinct from a real streak of zero. */
    streak: number | null;
    today: string;
    topInset: number;
    onSearch: () => void;
    onPressAvatar: () => void;
    onPressStreak: () => void;
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
                    {streak !== null && (
                        <TouchableOpacity
                            style={[styles.streakChip, streak === 0 && styles.streakChipIdle]}
                            onPress={onPressStreak}
                            hitSlop={8}
                            accessibilityLabel={streak > 0 ? `${streak} day streak` : 'Start a streak'}
                        >
                            <Ionicons
                                name={streak > 0 ? 'flame' : 'flame-outline'}
                                size={12}
                                color={Palette.white}
                            />
                            <Text style={styles.streakText}>
                                {streak > 0 ? streak : 'Start a streak'}
                            </Text>
                        </TouchableOpacity>
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

        {/*
            The day in one line, composed from data the screen has already loaded — doses
            left, an appointment today, calories remaining. It fetches nothing.

            It is the answer to the question the greeting raises and never used to answer.
            "Hello, Hessam!" over a date is a screen that knows who you are and has nothing
            to tell you; a person who opens the app twice before lunch needs the second
            visit to differ from the first.
        */}
        <Text style={styles.headerToday} numberOfLines={2}>{today}</Text>
    </LinearGradient>
);

/**
 * The score card, overlapping the header.
 *
 * The kit's second meta chip reads "plus User" — a subscription badge. This shows the two
 * things a person actually needs beside a health score: **which way it moved**, and how
 * much of it was measured rather than reported.
 *
 * Three things it deliberately does not do:
 *
 * 1. **It does not print the band twice.** It used to read "Suboptimal health" and then
 *    "Suboptimal" again on the line below, which spends the most valuable line on the
 *    screen restating the line above it. The band is the title; the meta row is movement.
 * 2. **It does not invent a movement.** `score.change` is null until there are two
 *    snapshots to compare, and a delta of zero is drawn as "no change", not as "+0".
 * 3. **It does not describe a null score as a bad one.** No score is a statement about
 *    coverage — see **The LabTrack score** in CLAUDE.md.
 */
const ScoreCard = ({ score, attention, onPress }: {
    score: HealthScore; attention: number; onPress: () => void;
}) => {
    const band = bandMeta(score.band);
    const mostlyReported = isMostlyReported(score);
    const change = score.change;
    const delta = change?.delta ?? 0;

    // The pillar that moved most, in either direction. One name, not a list: the breakdown
    // screen is where the full ledger lives, and this is a line under a number.
    const moved = change
        ? [...change.improved.map((p) => ({ ...p, up: true })),
           ...change.declined.map((p) => ({ ...p, up: false }))]
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? null
        : null;

    return (
        <TouchableOpacity style={styles.scoreCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.scoreTop}>
                <View style={styles.scoreBox}>
                    <Text style={styles.scoreValue}>{score.value ?? '--'}</Text>
                </View>

                <View style={styles.flex}>
                    <Text style={styles.scoreBand} numberOfLines={1}>
                        {score.value === null ? 'No score yet' : `${band.label} health`}
                    </Text>

                    <View style={styles.scoreMetaRow}>
                        {score.value !== null && change && (
                            <View style={styles.scoreMeta}>
                                <Ionicons
                                    name={delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'remove'}
                                    size={14}
                                    color={delta > 0 ? Palette.success : delta < 0 ? Palette.warning : Palette.textMuted}
                                />
                                <Text style={[
                                    styles.scoreMetaText,
                                    delta > 0 && { color: Palette.success },
                                    delta < 0 && { color: Palette.warning },
                                ]}>
                                    {delta === 0
                                        ? `No change ${formatSince(change.since)}`
                                        : `${delta > 0 ? '+' : ''}${delta} ${formatSince(change.since)}`}
                                </Text>
                            </View>
                        )}

                        {score.value !== null && change && <Text style={styles.scoreDot}>·</Text>}

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
            </View>

            {/* What actually moved. The number alone is a verdict; this is the reason for
                it, and it is the difference between a score somebody watches and a score
                somebody stops believing. */}
            {moved && (
                <View style={styles.scoreFoot}>
                    <Ionicons
                        name={moved.up ? 'arrow-up-circle' : 'arrow-down-circle'}
                        size={14}
                        color={moved.up ? Palette.success : Palette.warning}
                    />
                    <Text style={styles.scoreFootText} numberOfLines={1}>
                        {moved.label} {moved.up ? 'improved' : 'slipped'}
                        {change && change.improved.length + change.declined.length > 1
                            ? ` · ${change.improved.length + change.declined.length - 1} other pillar${
                                change.improved.length + change.declined.length === 2 ? '' : 's'} moved`
                            : ''}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

/**
 * One out-of-range marker, with the direction it is heading.
 *
 * The score card counts them; this names them. `describeMovement` decides whether a
 * movement is good — up is not improvement, it depends on the analyte and on which way it
 * was wrong, which is exactly why that judgement lives in `lib/biomarkers.ts` and not here.
 */
const MarkerTile = ({ marker, onPress }: { marker: BiomarkerSummary; onPress: () => void }) => {
    const meta = FLAG_META[marker.flag];
    const movement = describeMovement(marker);
    const plain = plainName(marker);
    const critical = isCriticalFlag(marker.flag);

    return (
        <TouchableOpacity
            style={[styles.markerTile, { borderColor: meta.border }]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            {/* The flag gets its own line. Beside the movement it had about 80pt for
                "Critically high", which either wraps to two lines or truncates — and a
                truncated clinical label is the one string on this tile that must not be
                guessed at.

                The pill is filled rather than tinted. `meta.bg` is 1.02:1 against this
                card, so the old pale chip was a background nobody could see behind text
                doing all the work alone. Filled, the pill separates from the card by
                4.9:1 — and because critical differs from high by hue alone (1.04:1 in
                luminance), the icon carries the crisis tier for anyone who cannot see
                that hue. */}
            <View style={[styles.markerFlag, { backgroundColor: meta.chipBg }]}>
                {critical && <Ionicons name="alert-circle" size={11} color={meta.chipText} />}
                <Text style={[styles.markerFlagText, { color: meta.chipText }]} numberOfLines={1}>
                    {meta.label}
                </Text>
            </View>

            <View style={styles.markerHead}>
                <View style={styles.valueRow}>
                    {/* The number is the thing being judged, so it wears the judgement —
                        `meta.value`, not `meta.color`, because the raw red fails AA as
                        text on this card. It is the largest element here, which makes it
                        the cheapest place to put the status. */}
                    <Text style={[styles.markerValue, { color: meta.value }]} numberOfLines={1}>
                        {formatValue(marker.value)}
                    </Text>
                    <Text style={[styles.unit, styles.markerUnit]} numberOfLines={1}>{marker.unit}</Text>
                </View>
                {movement && (
                    <Text style={[
                        styles.markerMove,
                        {
                            color: movement.tone === 'good' ? Palette.success
                                : movement.tone === 'bad' ? Palette.danger : Palette.textMuted,
                        },
                    ]} numberOfLines={1}>
                        {movement.text}
                    </Text>
                )}
            </View>

            {/* The lay label gets two lines. It is the only string on this tile written for
                the person rather than for their doctor, and at 152pt it was being cut at
                about 22 characters — "Average red blood c…", which translates nothing and
                reads as a bug. One clipped line is worse than two whole ones. */}
            <View>
                <Text style={styles.markerName} numberOfLines={1}>{medicalName(marker)}</Text>
                {!!plain && <Text style={styles.markerPlain} numberOfLines={2}>{plain}</Text>}
            </View>
        </TouchableOpacity>
    );
};

/**
 * One "Needs you" row.
 *
 * The whole row is the target, and the call to action is a label rather than a button: a
 * button inside a row that is itself tappable gives two hit areas for one destination, and
 * the smaller of them is the one people miss.
 */
const ActionRow = ({ action }: { action: HomeAction }) => (
    <TouchableOpacity style={styles.actionRow} onPress={action.onPress} activeOpacity={0.85}>
        <View style={[styles.actionIcon, { backgroundColor: action.surface }]}>
            <Ionicons name={action.icon} size={20} color={action.color} />
        </View>
        <View style={styles.flex}>
            <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
            <Text style={styles.cardBody} numberOfLines={2}>{action.body}</Text>
            <Text style={[styles.actionCta, { color: action.color }]}>{action.cta}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </TouchableOpacity>
);

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

    // Gated by the caller: nights nobody has recorded are a setup row pointing at
    // `/activity/sources`, which is where connecting a health store actually happens.
    if (hours === null && !hasNights) return null;

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
 *
 * Three things about the layout:
 *
 * 1. **The macros are meters, not three dots and a number.** They used to be a dot beside
 *    "39g" in a `flex: 1` column, which meant a third of the card was blank to the right of
 *    a two-character value — the widest element in that column was the word "Protein". A
 *    gram figure alone also cannot be read: 39g of protein is most of a day for one person
 *    and a third of it for another. The target is what makes the number mean something, and
 *    drawing it as a bar is what makes it fill the width it was already occupying.
 * 2. **The top half is the tracker's own hero, in miniature.** `CalorieRing` already ships
 *    a `dark` tone for exactly this ground, so the card previews the screen it opens rather
 *    than restating it in a different visual language.
 * 3. **The verdict sits on white, under the gradient.** It is the one line that changes
 *    colour with the day — green on track, amber over — and a status colour laid on a
 *    violet gradient stops being a status colour.
 */
const NutritionCard = ({ day, onOpen, onLog }: {
    day: NutritionDay | null; onOpen: () => void; onLog: () => void;
}) => {
    const target = day?.targets && 'calories' in day.targets ? day.targets.calories : 0;
    const consumed = day?.totals.calories ?? 0;
    const pattern = day?.plan?.guidance?.find((g) => g.kind === 'pattern')?.label
        ?? day?.plan?.guidance?.[0]?.label;

    // Gated by the caller: an unconfigured tracker is a setup row rather than a card that
    // is mostly an invitation. The guard keeps the non-null assertions below honest.
    if (!day?.plan || !target) return null;

    const remaining = Math.max(0, Math.round(target - consumed));
    const over = consumed > target;
    const macroTargets = day.targets as NutritionTargets;

    // Nothing logged is not a failure and must not be dressed as one — the same call
    // `alignment: 'unassessed'` makes. Only a day with meals in it earns a verdict.
    const verdict = day.meals.length === 0
        ? { icon: 'restaurant-outline' as const, color: Palette.textSecondary, surface: Palette.borderLight }
        : over
            ? { icon: 'trending-up' as const, color: Palette.warning, surface: Palette.warningSurface }
            : { icon: 'checkmark' as const, color: Palette.success, surface: Palette.successSurface };

    return (
        <View style={styles.nutritionCard}>
            <TouchableOpacity onPress={onOpen} activeOpacity={0.9}>
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.nutritionHero}
                >
                    {/* Two soft highlights, drawn rather than shipped as an asset: a flat
                        three-stop gradient behind a ring reads as a coloured rectangle. */}
                    <View style={styles.heroGlowTop} pointerEvents="none" />
                    <View style={styles.heroGlowBottom} pointerEvents="none" />

                    <View style={styles.heroChipRow}>
                        <View style={styles.heroChip}>
                            <Ionicons
                                name={pattern ? 'leaf-outline' : 'flag-outline'}
                                size={12}
                                color={Palette.white}
                            />
                            {/* The plan's own words, not a paraphrase. Without this the ring
                                is a calorie counter that happens to live in a health app. */}
                            <Text style={styles.heroChipText} numberOfLines={1}>
                                {pattern ?? 'Your daily target'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                    </View>

                    <View style={styles.nutritionTop}>
                        <CalorieRing
                            consumed={consumed}
                            target={target}
                            size={124}
                            stroke={11}
                            tone="dark"
                            caption={over
                                ? `${Math.round(consumed - target).toLocaleString()} over`
                                : `${remaining.toLocaleString()} left`}
                        />
                        <View style={styles.macroList}>
                            <Macro label="Protein" grams={day.totals.protein} target={macroTargets.protein} tint={Palette.white} />
                            <Macro label="Fat" grams={day.totals.fat} target={macroTargets.fat} tint="#FDA4AF" />
                            <Macro label="Carbs" grams={day.totals.carbs} target={macroTargets.carbs} tint="#FCD34D" />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.nutritionBody}>
                <View style={styles.verdictRow}>
                    <View style={[styles.verdictIcon, { backgroundColor: verdict.surface }]}>
                        <Ionicons name={verdict.icon} size={18} color={verdict.color} />
                    </View>
                    <View style={styles.flex}>
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
                </View>

                <CardFooterAction label="Log Meal" onPress={onLog} />
            </View>
        </View>
    );
};

/**
 * One macro as a meter on the hero.
 *
 * The bar is clamped at full but the figure is not: past target the value turns amber and
 * keeps counting, so a bar that has run out still says by how much. A macro with no target
 * — possible only if a plan predates the macro split — draws the grams and no track rather
 * than a bar measured against nothing.
 */
const Macro = ({ label, grams, target, tint }: {
    label: string; grams: number; target?: number; tint: string;
}) => {
    const value = Math.round(grams);
    const hasTarget = typeof target === 'number' && target > 0;
    const ratio = hasTarget ? Math.min(1, grams / target) : 0;
    const over = hasTarget && grams > target;

    return (
        <View style={styles.macro}>
            <View style={styles.macroHead}>
                <Text style={styles.macroLabel}>{label}</Text>
                <Text style={[styles.macroValue, over && styles.macroValueOver]}>
                    {value}
                    <Text style={styles.macroTarget}>{hasTarget ? ` / ${Math.round(target)}g` : 'g'}</Text>
                </Text>
            </View>
            {hasTarget && (
                <View style={styles.macroTrack}>
                    <View style={[styles.macroFill, { width: `${ratio * 100}%`, backgroundColor: tint }]} />
                </View>
            )}
        </View>
    );
};

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
    // The caller only renders this section when there is a live appointment — an empty
    // diary is a row in "Get more from LabTrack" instead. This guard is here so the
    // destructure below cannot read a professional off `undefined` if it is ever reused.
    if (appointments.length === 0) return null;

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

            <CardFooterAction label="Book another" onPress={onBook} />
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
    // Gated by the caller: a day with no doses is a setup row, not a card. See the
    // tracker/setup split in `HomeScreen`.
    const doses = schedule?.doses ?? [];
    if (doses.length === 0) return null;

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

            <CardFooterAction label="Add medication" onPress={onAdd} />
        </View>
    );
};

// ---------------------------------------------------------------------------
// Ask LabTrack AI — symptoms and the assistant, in one card
// ---------------------------------------------------------------------------

/**
 * Ask LabTrack AI.
 *
 * These were two sections. They are one card because they are one act: `app/symptoms`
 * composes what you pick into a first-person message and posts it to the assistant, so
 * drawing them as separate features described the file layout rather than what a person
 * does. See **Symptom checker** in CLAUDE.md.
 *
 * Three things that are load-bearing:
 *
 * 1. **The last reply is clamped to three lines.** It used to render whole — fifteen lines
 *    of a paragraph the person has already read, in the middle of a home screen. The point
 *    of showing it at all is that reopening feels like a resumption rather than a fresh
 *    start, and three lines does that.
 * 2. **The safety sentence stays.** There is no diagnosis engine behind the chips, and the
 *    line saying so is not decoration — a percentage or a condition name on this card would
 *    be the most dangerous element in the app.
 * 3. **An unavailable assistant is said, not hidden.** With no model key on the server the
 *    card says so and offers no chat, rather than a control that answers 503.
 */
const AskCard = ({ conversation, onSearch, onSymptom, onOpen }: {
    conversation: Conversation | null;
    onSearch: () => void;
    onSymptom: (id: string) => void;
    onOpen: () => void;
}) => {
    const last = [...(conversation?.messages ?? [])].reverse().find((m) => m.role === 'assistant');
    const unavailable = conversation?.available === false;

    const common = COMMON_SYMPTOM_IDS
        .map((id) => SYMPTOMS.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.searchField} onPress={onSearch} activeOpacity={0.85}>
                <Ionicons name="search" size={18} color={Palette.textMuted} />
                <Text style={styles.searchPlaceholder}>Describe a symptom…</Text>
            </TouchableOpacity>

            <View style={styles.chipRow}>
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

            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.bubbleRow}
                onPress={unavailable ? undefined : onOpen}
                activeOpacity={unavailable ? 1 : 0.85}
                disabled={unavailable}
            >
                <View style={styles.botIcon}>
                    <Ionicons name="sparkles" size={18} color={Palette.primary} />
                </View>
                <View style={styles.bubble}>
                    <Text style={styles.bubbleText} numberOfLines={last ? 3 : undefined}>
                        {unavailable
                            ? 'The assistant is unavailable on this server right now. Your results and trackers are unaffected.'
                            : last?.text
                                ?? 'Ask about your results, your plan, or a symptom — I read your own records before answering.'}
                    </Text>
                    {!!last && (
                        <View style={styles.bubbleFoot}>
                            <Text style={styles.bubbleTime}>{messageTime(last.createdAt)}</Text>
                            <Ionicons name="checkmark-done" size={14} color={Palette.success} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            <Text style={styles.cardNote}>
                Whatever you pick is composed into a question for the assistant, which answers with
                your results and plan in front of it. It does not diagnose.
            </Text>

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

                            {/*
                              Clamped closed. Collapsed, this card is a headline, three
                              lines and one thing to do — the version somebody reads on the
                              way to work. It used to open at full length: headline, four
                              paragraphs, five key points and a caution box, which is most
                              of a screen of prose before anything below it is reachable,
                              and the next step was the part underneath all of it.
                            */}
                            <Text style={styles.analysisSummary} numberOfLines={expanded ? undefined : 3}>
                                {plain.what_it_means}
                            </Text>

                            {expanded && plain.key_points?.length > 0 && (
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
                                {expanded
                                    ? 'Show less'
                                    : plain?.key_points?.length
                                        ? `Read the full analysis · ${plain.key_points.length} points`
                                        : 'Read the full analysis'}
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
            <Section title="Popular tests" action="See All" onAction={() => router.push('/(tabs)/orders')}>
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
    // A streak of zero is an invitation, not a failure — so it keeps the shape and loses
    // the amber. The same call `app/profile.tsx` makes about its own streak card.
    streakChipIdle: { backgroundColor: 'rgba(255,255,255,0.22)' },
    streakText: { fontSize: 12, color: Palette.white, fontFamily: Fonts.bold },
    headerGreeting: { fontSize: 26, color: Palette.white, fontFamily: Fonts.bold, marginTop: 6 },
    headerToday: {
        fontSize: 14, lineHeight: 20, marginTop: Spacing.sm,
        color: 'rgba(255,255,255,0.92)', fontFamily: Fonts.medium,
    },
    headerSearch: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    headerAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },

    // Score card -----------------------------------------------------------
    // A column now, because the movement line sits under the whole thing rather than
    // beside the number. `scoreTop` carries what used to be on the card itself.
    scoreCard: {
        gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: -Spacing.xxxl - Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.white, ...Shadow.card,
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    },
    scoreTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    scoreFoot: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.md,
    },
    scoreFootText: { flex: 1, fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium },
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
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    cardTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    cardBody: { fontSize: 14, lineHeight: 20, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 3 },
    cardNote: { fontSize: 12, lineHeight: 17, color: Palette.textMuted, fontFamily: Fonts.regular },
    bigFigure: { fontSize: 30, color: Palette.text, fontFamily: Fonts.bold },
    bigUnit: { fontSize: 15, color: Palette.textSecondary, fontFamily: Fonts.regular },
    divider: { height: 1, backgroundColor: Palette.border },
    subHeading: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
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

    // Markers to watch -----------------------------------------------------
    // Same width as `metricTile`, so the two horizontal rails on this page line their
    // cards up rather than sitting 4pt out of step with each other.
    markerTile: {
        width: METRIC_CARD_WIDTH, padding: Spacing.lg, borderRadius: Radius.xl,
        // Warm, not grey: these cards carry amber and red flags, and a neutral-grey card
        // behind them reads as the colour having landed on the wrong layer. `borderColor`
        // is set per flag at the call site.
        backgroundColor: Palette.surfaceWarm, borderWidth: 1,
        gap: Spacing.sm,
    },
    markerHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
    markerFlag: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm,
        maxWidth: '100%',
    },
    markerFlagText: { fontSize: 11, fontFamily: Fonts.bold },
    markerMove: { fontSize: 12, fontFamily: Fonts.bold },
    markerValue: { fontSize: 22, fontFamily: Fonts.bold },   // colour is per flag
    markerUnit: { color: Palette.textOnWarm },              // `unit` is shared with metricTile
    markerName: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    markerPlain: { fontSize: 11.5, lineHeight: 15, color: Palette.textOnWarm, fontFamily: Fonts.regular },

    // Needs you ------------------------------------------------------------
    actionList: { gap: Spacing.md, marginHorizontal: GUTTER },
    actionRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.xl,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
        ...Shadow.card,
    },
    actionIcon: {
        width: 40, height: 40, borderRadius: Radius.lg,
        alignItems: 'center', justifyContent: 'center',
    },
    actionTitle: { fontSize: 16, lineHeight: 22, color: Palette.text, fontFamily: Fonts.semibold },
    actionCta: { fontSize: 14, fontFamily: Fonts.bold, marginTop: 7 },

    // Get more from LabTrack -----------------------------------------------
    setupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    setupIcon: {
        width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },

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
    // The gradient runs to the card's edge, so the padding every other card carries on its
    // container lives on the two blocks inside this one instead.
    nutritionCard: {
        marginHorizontal: GUTTER, borderRadius: Radius.xl, overflow: 'hidden',
        backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.borderLight,
    },
    nutritionHero: { padding: Spacing.lg, overflow: 'hidden' },
    heroGlowTop: {
        position: 'absolute', top: -70, right: -50, width: 190, height: 190,
        borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)',
    },
    heroGlowBottom: {
        position: 'absolute', bottom: -80, left: -60, width: 200, height: 200,
        borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)',
    },
    heroChipRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: Spacing.sm, marginBottom: Spacing.md,
    },
    heroChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
        backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md, paddingVertical: 5,
    },
    heroChipText: { flexShrink: 1, fontSize: 12, color: Palette.white, fontFamily: Fonts.medium },
    nutritionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    macroList: { flex: 1, gap: Spacing.lg },
    macro: { gap: 6 },
    macroHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
    macroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontFamily: Fonts.regular },
    macroValue: { fontSize: 16, color: Palette.white, fontFamily: Fonts.bold },
    macroValueOver: { color: '#FDE68A' },
    macroTarget: { fontSize: 11, color: 'rgba(255,255,255,0.72)', fontFamily: Fonts.regular },
    macroTrack: {
        height: 6, borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.24)', overflow: 'hidden',
    },
    macroFill: { height: '100%', borderRadius: Radius.pill },
    nutritionBody: { padding: Spacing.lg, gap: Spacing.md },
    verdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    verdictIcon: {
        width: 34, height: 34, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center', marginTop: 2,
    },

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
