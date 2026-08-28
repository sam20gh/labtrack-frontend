/**
 * Home.
 *
 * Rebuilt against the turing kit's "Home & Smart Health Metrics" flow. The kit leads with
 * one AI-derived score drawn as a six-axis polygon, an explainer sheet behind it, and then
 * short, scannable sections underneath. This screen follows that shape with LabTrack's own
 * data: the pillars are the things the app measures, not step counts it has never held.
 *
 * The previous version opened with a coral gradient, a score derived from BMI alone, and a
 * "Get AI Analysis" button as the primary action — it showed the same screen whether every
 * marker was normal or three were critical. The ordering here is clinical: what is wrong
 * comes first, what is due comes next, and shopping comes last.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    RefreshControl, Image, Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { getUserId, isSignedIn } from '@/lib/auth';
import {
    getLatestBiomarkers, byClinicalPriority, describeMovement, formatValue, FLAG_META,
    medicalName, plainName,
} from '@/lib/biomarkers';
import { getPlan } from '@/lib/plan';
import { getDay as getNutritionDay } from '@/lib/nutrition';
import {
    getLatestInterpretation, generateInterpretation, hasMeaningfulChanges, isVerified,
    RISK_META, byRiskSeverity, type LatestInterpretation,
} from '@/lib/interpretation';
import { computeHealthScore, BAND_META, SCORE_DISCLAIMER, type HealthScore } from '@/lib/healthScore';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import ScoreRadar from '@/components/home/ScoreRadar';
import type { BiomarkerSummary, NutritionDay, PlanItem, Product, User } from '@/types/api';

const EMPTY_SCORE: HealthScore = {
    value: null, band: 'unknown', headline: 'Add a result to unlock your score', pillars: [], coverage: 0,
};

const greetingFor = (hour: number) =>
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

const DAY = 24 * 60 * 60 * 1000;

/** "Overdue", "Due today", "In 12 days" — a date on its own makes the reader do the maths. */
const describeDue = (iso: string) => {
    const days = Math.round((new Date(iso).getTime() - Date.now()) / DAY);
    if (Number.isNaN(days)) return { text: 'Scheduled', overdue: false };
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
    if (days === 0) return { text: 'Due today', overdue: true };
    if (days === 1) return { text: 'Due tomorrow', overdue: false };
    if (days < 30) return { text: `In ${days} days`, overdue: false };
    return { text: `In ${Math.round(days / 30)} months`, overdue: false };
};

export default function HomeScreen() {
    const router = useRouter();

    const [signedIn, setSignedIn] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
    const [planItems, setPlanItems] = useState<PlanItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [analysis, setAnalysis] = useState<LatestInterpretation | null>(null);
    const [nutrition, setNutrition] = useState<NutritionDay | null>(null);
    const [generating, setGenerating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [explainerOpen, setExplainerOpen] = useState(false);
    const [analysisExpanded, setAnalysisExpanded] = useState(false);

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

        // Settled rather than all: a home screen that renders nothing because the plan
        // endpoint hiccuped is worse than one missing a section.
        const [userRes, biomarkerRes, planRes, productRes, analysisRes, nutritionRes] = await Promise.allSettled([
            userId ? api.get<User>(`/users/${userId}`) : Promise.reject(new Error('no user id')),
            getLatestBiomarkers(),
            getPlan(),
            api.get<Product[]>('/products'),
            // One call: the newest result, the newest interpretation, and whether they are
            // the same document. Scoped by the token, so it does not depend on the cached
            // user id the way the old /test-results?user_id= path did.
            getLatestInterpretation(),
            getNutritionDay(),
        ]);

        if (userRes.status === 'fulfilled') setUser(userRes.value);
        if (biomarkerRes.status === 'fulfilled') setBiomarkers(biomarkerRes.value.biomarkers ?? []);
        if (planRes.status === 'fulfilled') setPlanItems(planRes.value.items ?? []);
        if (productRes.status === 'fulfilled') setProducts(Array.isArray(productRes.value) ? productRes.value.slice(0, 6) : []);
        if (analysisRes.status === 'fulfilled') setAnalysis(analysisRes.value);
        if (nutritionRes.status === 'fulfilled') setNutrition(nutritionRes.value);

        const rejected = [userRes, biomarkerRes, planRes, productRes, analysisRes, nutritionRes]
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected');
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
     * Generating also rebuilds the plan, so a fresh run reloads the whole screen: "Next up"
     * would otherwise show the previous plan beside the new analysis.
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
            // analysis would be identical, or that enough have been run today. The user
            // still has their existing analysis, so this reads as information.
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

    const score = useMemo(
        () => (signedIn
            ? computeHealthScore({
                biomarkers,
                planItems,
                heightCm: user?.height,
                weightKg: user?.weight,
                assessment: user?.healthAssessment,
            })
            : EMPTY_SCORE),
        [signedIn, biomarkers, planItems, user],
    );

    /** Out-of-range markers, worst first — the reason someone opens a health app. */
    const attention = useMemo(
        () => biomarkers.filter((b) => b.flag !== 'normal' && b.flag !== 'unknown').sort(byClinicalPriority).slice(0, 6),
        [biomarkers],
    );

    /** The next few things actually due, soonest first. Completed and dismissed drop out. */
    const upcoming = useMemo(
        () => planItems
            .filter((i) => i.status !== 'completed' && i.status !== 'dismissed')
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 3),
        [planItems],
    );

    const movers = useMemo(
        () => biomarkers.filter((b) => b.measurementCount > 1 && b.delta != null).slice(0, 4),
        [biomarkers],
    );

    const firstName = user?.firstName?.trim() || 'there';
    const initials = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '');
    const assessmentDone = user?.healthAssessment?.isComplete;

    if (loading && signedIn === null) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                {signedIn ? (
                    <>
                        <Greeting
                            name={firstName}
                            initials={initials.toUpperCase()}
                            onPressAvatar={() => router.push('/profile')}
                        />

                        <ScoreHero score={score} onExplain={() => setExplainerOpen(true)} />

                        {analysis?.latestResult && (
                            <Section
                                title="Latest analysis"
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

                        {attention.length > 0 && (
                            <Section
                                title="Needs attention"
                                action="All results"
                                onAction={() => router.push('/(tabs)/results')}
                            >
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.hScroll}
                                >
                                    {attention.map((b) => (
                                        <AttentionCard
                                            key={b._id}
                                            biomarker={b}
                                            onPress={() => router.push({ pathname: '/biomarker/[name]', params: { name: b.name } })}
                                        />
                                    ))}
                                </ScrollView>
                            </Section>
                        )}

                        <Section title="Quick actions">
                            <View style={styles.actionRow}>
                                <QuickAction icon="add-circle-outline" label="Add result" onPress={() => router.push('/add-result')} />
                                <QuickAction icon="pulse-outline" label="Symptoms" onPress={() => router.push('/symptoms')} />
                                <QuickAction icon="flask-outline" label="Order test" onPress={() => router.push('/(tabs)/orders')} />
                                <QuickAction icon="calendar-outline" label="My plan" onPress={() => router.push('/myplans')} />
                                <QuickAction icon="restaurant-outline" label="Nutrition" onPress={() => router.push('/nutrition')} />
                                <QuickAction icon="people-outline" label="Consult" onPress={() => router.push('/(tabs)/professionals')} />
                            </View>
                        </Section>

                        {!assessmentDone && (
                            <TouchableOpacity
                                style={styles.assessmentCard}
                                activeOpacity={0.85}
                                onPress={() => router.push('/health-assessment')}
                            >
                                <View style={styles.assessmentIcon}>
                                    <Ionicons name="clipboard-outline" size={20} color={Palette.primary} />
                                </View>
                                <View style={styles.flex}>
                                    <Text style={styles.assessmentTitle}>Complete your health profile</Text>
                                    <Text style={styles.assessmentBody}>
                                        Sleep, activity and history sharpen every insight LabTrack gives you.
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                            </TouchableOpacity>
                        )}

                        <Section
                            title="Today's nutrition"
                            action={nutrition?.meals.length ? 'Full tracker' : undefined}
                            onAction={nutrition?.meals.length ? () => router.push('/nutrition') : undefined}
                        >
                            <NutritionSummaryCard day={nutrition} onPress={() => router.push('/nutrition')} />
                        </Section>

                        {upcoming.length > 0 && (
                            <Section title="Next up" action="Full plan" onAction={() => router.push('/myplans')}>
                                <View style={styles.stack}>
                                    {upcoming.map((item) => (
                                        <PlanRow key={item._id} item={item} onPress={() => router.push('/myplans')} />
                                    ))}
                                </View>
                            </Section>
                        )}

                        {movers.length > 0 && (
                            <Section title="Recent movement" action="All results" onAction={() => router.push('/(tabs)/results')}>
                                <View style={styles.metricGrid}>
                                    {movers.map((b) => (
                                        <MetricCard
                                            key={b._id}
                                            biomarker={b}
                                            onPress={() => router.push({ pathname: '/biomarker/[name]', params: { name: b.name } })}
                                        />
                                    ))}
                                </View>
                            </Section>
                        )}

                        {biomarkers.length === 0 && !analysis?.latestResult && (
                            <View style={styles.emptyCard}>
                                <Ionicons name="document-text-outline" size={40} color={Palette.primaryLight} />
                                <Text style={styles.emptyTitle}>No results yet</Text>
                                <Text style={styles.emptyBody}>
                                    Upload a lab report or order a test, and your score and trends start building.
                                </Text>
                                <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/add-result')}>
                                    <Text style={styles.primaryButtonText}>Add a result</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {products.length > 0 && (
                            <Section title="Recommended tests" action="See all" onAction={() => router.push('/(tabs)/orders')}>
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
                ) : (
                    <SignedOut products={products} router={router} />
                )}
            </ScrollView>

            <ScoreExplainer visible={explainerOpen} score={score} onClose={() => setExplainerOpen(false)} />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const Greeting = ({ name, initials, onPressAvatar }: { name: string; initials: string; onPressAvatar: () => void }) => (
    <View style={styles.greetingRow}>
        <View style={styles.flex}>
            <Text style={styles.greetingLabel}>{greetingFor(new Date().getHours())}</Text>
            <Text style={styles.greetingName} numberOfLines={1}>{name}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={onPressAvatar} accessibilityLabel="Your profile">
            {initials.trim()
                ? <Text style={styles.avatarText}>{initials}</Text>
                : <Ionicons name="person" size={18} color={Palette.primary} />}
        </TouchableOpacity>
    </View>
);

/**
 * The score hero. The number is deliberately large and the radar deliberately unlabelled
 * with values — it communicates shape (which pillar is dented), and the sheet behind the
 * info button carries the detail.
 */
const ScoreHero = ({ score, onExplain }: { score: HealthScore; onExplain: () => void }) => {
    const band = BAND_META[score.band];
    // The radar shares its row with the score, so it takes what is left of the width
    // rather than a fixed size that overflows on a 360pt phone.
    const { width } = useWindowDimensions();
    const radarSize = Math.max(96, Math.min(132, width - 236));
    return (
        <LinearGradient
            colors={Palette.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
        >
            <View style={styles.heroTop}>
                <Text style={styles.heroEyebrow}>LabTrack score</Text>
                <TouchableOpacity onPress={onExplain} hitSlop={12} accessibilityLabel="How your score is calculated">
                    <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
            </View>

            <View style={styles.heroBody}>
                <View style={styles.heroFigures}>
                    <Text style={styles.heroScore}>{score.value ?? '--'}</Text>
                    <View style={[styles.bandPill, { backgroundColor: `${band.color}33` }]}>
                        <View style={[styles.bandDot, { backgroundColor: band.color }]} />
                        <Text style={styles.bandText}>{band.label}</Text>
                    </View>
                </View>

                {score.pillars.length > 0 && (
                    <ScoreRadar pillars={score.pillars} size={radarSize} />
                )}
            </View>

            <Text style={styles.heroHeadline}>{score.headline}</Text>
        </LinearGradient>
    );
};


/**
 * Latest AI analysis.
 *
 * Four states, and the two in the middle are the ones the first version got wrong:
 *
 *   - no analysis at all              → the card is the call to action
 *   - analysis, but of an OLDER result → show it, say so plainly, and offer to analyse the
 *                                        new one. Previously this rendered nothing, so a
 *                                        person with a perfectly good analysis on their
 *                                        first result saw an empty home screen after
 *                                        adding a second.
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
                    {/* 5 rather than 4: at 16px the same clamp showed noticeably less
                        summary than it did at 13px. */}
                    <Text style={styles.analysisSummary} numberOfLines={expanded ? undefined : 5}>
                        {interpretation.summary}
                    </Text>

                    {hasMeaningfulChanges(interpretation) && (
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
                            <Text style={styles.footerLinkText}>{expanded ? 'Show less' : 'Read full analysis'}</Text>
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

const AttentionCard = ({ biomarker, onPress }: { biomarker: BiomarkerSummary; onPress: () => void }) => {
    const meta = FLAG_META[biomarker.flag];
    const movement = describeMovement(biomarker);
    // These cards are the first thing a worried person reads. A card that says only
    // "Ferritin · Low" names a problem in a language they do not speak.
    const plain = plainName(biomarker);
    return (
        <TouchableOpacity style={[styles.attentionCard, { borderColor: meta.color }]} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.flagPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.flagText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.attentionName} numberOfLines={2}>
                {medicalName(biomarker)}
            </Text>
            {plain && <Text style={styles.attentionPlain} numberOfLines={2}>{plain}</Text>}
            <View style={styles.valueRow}>
                <Text style={[styles.attentionValue, { color: meta.color }]}>{formatValue(biomarker.value)}</Text>
                <Text style={styles.unit}>{biomarker.unit}</Text>
            </View>
            {movement && (
                <Text style={[styles.movement, { color: movement.tone === 'good' ? Palette.success : movement.tone === 'bad' ? Palette.danger : Palette.textSecondary }]}>
                    {movement.text} since last
                </Text>
            )}
        </TouchableOpacity>
    );
};

const QuickAction = ({ icon, label, onPress }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void;
}) => (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.actionIcon}>
            <Ionicons name={icon} size={22} color={Palette.primary} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
);

const PLAN_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    test: 'flask-outline',
    scan: 'scan-outline',
    consultation: 'person-outline',
    assessment: 'clipboard-outline',
    lifestyle: 'leaf-outline',
};

const PlanRow = ({ item, onPress }: { item: PlanItem; onPress: () => void }) => {
    const due = describeDue(item.dueDate);
    return (
        <TouchableOpacity style={styles.planRow} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.planIcon, due.overdue && { backgroundColor: Palette.dangerSurface }]}>
                <Ionicons
                    name={PLAN_ICON[item.type] ?? 'flask-outline'}
                    size={18}
                    color={due.overdue ? Palette.danger : Palette.primary}
                />
            </View>
            <View style={styles.flex}>
                <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.planMeta} numberOfLines={1}>
                    {item.condition ?? item.speciality ?? item.frequency ?? 'Scheduled'}
                </Text>
            </View>
            <Text style={[styles.planDue, due.overdue && { color: Palette.danger }]}>{due.text}</Text>
        </TouchableOpacity>
    );
};

/**
 * Today's nutrition, on the home screen.
 *
 * A compact read of the same day the tracker shows, with the plan's dietary advice named
 * rather than implied. "Mediterranean" on the home screen is what connects a calorie bar to
 * the interpretation that asked for it; without it this is a widget from a different app.
 *
 * Three states, because they call for different things: no targets yet (set them up),
 * targets but nothing eaten (log something), and a day in progress (see how it is going).
 */
const NutritionSummaryCard = ({ day, onPress }: { day: NutritionDay | null; onPress: () => void }) => {
    const target = day?.targets && 'calories' in day.targets ? day.targets.calories : 0;
    const consumed = day?.totals.calories ?? 0;
    const pattern = day?.plan?.guidance?.find((g) => g.kind === 'pattern')?.label
        ?? day?.plan?.guidance?.[0]?.label;

    if (!day?.plan || !target) {
        return (
            <TouchableOpacity style={styles.nutritionCard} onPress={onPress} activeOpacity={0.85}>
                <View style={styles.nutritionIcon}>
                    <Ionicons name="restaurant-outline" size={20} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.nutritionTitle}>Set up nutrition tracking</Text>
                    <Text style={styles.nutritionBody}>
                        Targets built from your profile and the dietary advice on your plan.
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </TouchableOpacity>
        );
    }

    const ratio = Math.min(1, consumed / target);
    const over = consumed > target;

    return (
        <TouchableOpacity style={styles.nutritionCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.flex}>
                <View style={styles.nutritionTop}>
                    <Text style={styles.nutritionValue}>
                        {Math.round(consumed).toLocaleString()}
                        <Text style={styles.nutritionOf}> / {target.toLocaleString()} kcal</Text>
                    </Text>
                    {!!pattern && (
                        <View style={styles.nutritionChip}>
                            <Text style={styles.nutritionChipText}>{pattern}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.nutritionTrack}>
                    <View
                        style={[
                            styles.nutritionFill,
                            { width: `${ratio * 100}%`, backgroundColor: over ? Palette.warning : Palette.primary },
                        ]}
                    />
                </View>

                <Text style={styles.nutritionBody}>
                    {day.meals.length === 0
                        ? "Nothing logged yet today."
                        : day.adherence.assessed > 0
                            ? `${day.adherence.aligned + day.adherence.partial} of ${day.adherence.assessed} meals moved you towards your plan.`
                            : `${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'} logged.`}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

const MetricCard = ({ biomarker, onPress }: { biomarker: BiomarkerSummary; onPress: () => void }) => {
    const meta = FLAG_META[biomarker.flag];
    const movement = describeMovement(biomarker);
    return (
        <TouchableOpacity style={styles.metricCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.metricTop}>
                <Text style={styles.metricName} numberOfLines={1}>
                    {biomarker.displayName ?? biomarker.name}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            </View>
            <View style={styles.valueRow}>
                <Text style={styles.metricValue}>{formatValue(biomarker.value)}</Text>
                <Text style={styles.unit}>{biomarker.unit}</Text>
            </View>
            <Text
                style={[styles.movement, { color: movement?.tone === 'good' ? Palette.success : movement?.tone === 'bad' ? Palette.danger : Palette.textSecondary }]}
                numberOfLines={1}
            >
                {movement ? `${movement.text} since last` : `${biomarker.measurementCount} readings`}
            </Text>
        </TouchableOpacity>
    );
};

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

/**
 * Score explainer. The kit ships a dedicated "What is the nightingale score" screen for a
 * reason: a number a person cannot interrogate is a number they do not act on.
 */
const ScoreExplainer = ({ visible, score, onClose }: { visible: boolean; score: HealthScore; onClose: () => void }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
            <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>How your score works</Text>
                <Text style={styles.sheetBody}>
                    Six pillars, weighted by how much each one tells us about your health. Measured
                    markers count for more than anything you self-report.
                </Text>

                <View style={styles.stack}>
                    {score.pillars.map((p) => (
                        <View key={p.key} style={styles.pillarRow}>
                            <View style={styles.pillarHeader}>
                                <Text style={styles.pillarLabel}>{p.label}</Text>
                                <Text style={styles.pillarValue}>{p.value == null ? 'No data' : `${p.value}`}</Text>
                            </View>
                            <View style={styles.pillarTrack}>
                                <View style={[styles.pillarFill, { width: `${p.value ?? 0}%` }]} />
                            </View>
                            <Text style={styles.pillarDetail}>{p.detail}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.disclaimer}>{SCORE_DISCLAIMER}</Text>

                <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                    <Text style={styles.primaryButtonText}>Got it</Text>
                </TouchableOpacity>
            </Pressable>
        </Pressable>
    </Modal>
);

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    { icon: 'sparkles-outline', title: 'AI interpretation', body: 'Your results explained in plain language.' },
    { icon: 'trending-up-outline', title: 'Track over time', body: 'Every marker charted against your own range.' },
    { icon: 'calendar-outline', title: 'A real plan', body: 'Screenings and consultations, dated and bookable.' },
    { icon: 'shield-checkmark-outline', title: 'Genetic context', body: 'Ranges narrowed to your DNA where it matters.' },
];

const SignedOut = ({ products, router }: { products: Product[]; router: ReturnType<typeof useRouter> }) => (
    <>
        <LinearGradient
            colors={Palette.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
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
            <View style={styles.metricGrid}>
                {BENEFITS.map((b) => (
                    <View key={b.title} style={styles.benefitCard}>
                        <View style={styles.actionIcon}>
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
// Styles — 16pt gutter and 8pt card radius, matching the turing kit.
// ---------------------------------------------------------------------------

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: Spacing.xxxl },
    flex: { flex: 1 },
    stack: { gap: Spacing.sm },
    hScroll: { paddingHorizontal: GUTTER, gap: Spacing.md },

    // Greeting
    greetingRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: GUTTER, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    },
    greetingLabel: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    greetingName: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold },
    avatar: {
        width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold },

    // Score hero
    hero: {
        marginHorizontal: GUTTER, borderRadius: Radius.xl, padding: Spacing.xl,
        gap: Spacing.md, ...Shadow.card,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: {
        fontSize: 12, letterSpacing: 0.8,
        color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', fontFamily: Fonts.bold,
    },
    heroBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroFigures: { gap: Spacing.sm },
    heroScore: {
        fontSize: 56, lineHeight: 62, color: Palette.white, fontFamily: Fonts.bold,
    },
    bandPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill,
    },
    bandDot: { width: 7, height: 7, borderRadius: Radius.pill },
    bandText: { fontSize: 12, color: Palette.white, fontFamily: Fonts.semibold },
    heroHeadline: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', fontFamily: Fonts.regular },

    // Sections
    nutritionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        ...Shadow.card,
    },
    nutritionIcon: {
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nutritionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nutritionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    nutritionValue: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold },
    nutritionOf: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    nutritionChip: {
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 3,
    },
    nutritionChipText: { fontSize: 11, color: Palette.primaryDark, fontFamily: Fonts.semibold },
    nutritionTrack: {
        height: 6,
        borderRadius: Radius.pill,
        backgroundColor: Palette.borderLight,
        overflow: 'hidden',
        marginVertical: Spacing.sm,
    },
    nutritionFill: { height: '100%', borderRadius: Radius.pill },
    nutritionBody: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 17 },
    section: { marginTop: Spacing.xxl },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    sectionAction: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.semibold },


    // Latest analysis
    analysisCard: {
        marginHorizontal: GUTTER, padding: Spacing.lg, borderRadius: Radius.lg,
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

    // Attention
    attentionCard: {
        width: 150, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1,
        backgroundColor: Palette.white, gap: 6, ...Shadow.card,
    },
    flagPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
    flagText: { fontSize: 10, fontFamily: Fonts.bold },
    attentionName: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    attentionPlain: { fontSize: 11.5, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    attentionValue: { fontSize: 22, fontFamily: Fonts.bold },
    unit: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular },
    movement: { fontSize: 11, fontFamily: Fonts.semibold },

    // Quick actions
    actionRow: { flexDirection: 'row', paddingHorizontal: GUTTER, gap: Spacing.md },
    action: { flex: 1, alignItems: 'center', gap: Spacing.sm },
    actionIcon: {
        width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    actionLabel: { fontSize: 12, color: Palette.textSecondary, textAlign: 'center', fontFamily: Fonts.semibold },

    // Assessment nudge
    assessmentCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: Spacing.xxl, padding: Spacing.lg,
        borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
    },
    assessmentIcon: {
        width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
    },
    assessmentTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.bold },
    assessmentBody: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, marginTop: 2, fontFamily: Fonts.regular },

    // Plan
    planRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
    },
    planIcon: {
        width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    planTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },
    planMeta: { fontSize: 12, color: Palette.textSecondary, marginTop: 2, fontFamily: Fonts.regular },
    planDue: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.semibold },

    // Metric grid
    metricGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: GUTTER,
    },
    metricCard: {
        flexGrow: 1, flexBasis: '46%', padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, gap: 6,
    },
    metricTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    metricName: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.semibold },
    statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
    metricValue: { fontSize: 22, color: Palette.text, fontFamily: Fonts.bold },

    // Products
    productCard: { width: 152, gap: 6 },
    productImage: { width: 152, height: 104, borderRadius: Radius.lg, backgroundColor: Palette.surface },
    productPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    productPrice: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.bold },

    // Empty
    emptyCard: {
        alignItems: 'center', gap: Spacing.sm, marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: Palette.surface,
    },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    emptyBody: { fontSize: 13, lineHeight: 19, color: Palette.textSecondary, textAlign: 'center', fontFamily: Fonts.regular },

    primaryButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 14, paddingHorizontal: Spacing.xxl, alignItems: 'center', marginTop: Spacing.sm,
        alignSelf: 'stretch',
    },
    primaryButtonText: { color: Palette.white, fontSize: 15, fontFamily: Fonts.semibold },

    // Signed out
    welcomeTitle: {
        fontSize: 26, lineHeight: 34, color: Palette.white, fontFamily: Fonts.bold,
    },
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
    benefitCard: {
        flexGrow: 1, flexBasis: '46%', padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, gap: Spacing.sm,
    },
    benefitTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.bold },
    benefitBody: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, fontFamily: Fonts.regular },

    // Explainer sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.64)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: Palette.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.md,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: Radius.pill, backgroundColor: Palette.border, alignSelf: 'center',
    },
    sheetTitle: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold },
    sheetBody: { fontSize: 13, lineHeight: 19, color: Palette.textSecondary, fontFamily: Fonts.regular },
    pillarRow: { gap: 5 },
    pillarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pillarLabel: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },
    pillarValue: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.bold },
    pillarTrack: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    pillarFill: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.primary },
    pillarDetail: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    disclaimer: { fontSize: 11, lineHeight: 16, color: Palette.textMuted, marginTop: Spacing.sm, fontFamily: Fonts.regular },
});
