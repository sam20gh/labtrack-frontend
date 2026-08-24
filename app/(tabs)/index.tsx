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
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { getUserId, isSignedIn } from '@/lib/auth';
import { getLatestBiomarkers, byClinicalPriority, describeMovement, formatValue, FLAG_META } from '@/lib/biomarkers';
import { getPlan } from '@/lib/plan';
import { computeHealthScore, BAND_META, SCORE_DISCLAIMER, type HealthScore } from '@/lib/healthScore';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import ScoreRadar from '@/components/home/ScoreRadar';
import type { BiomarkerSummary, PlanItem, Product, User } from '@/types/api';

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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [explainerOpen, setExplainerOpen] = useState(false);

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
        const [userRes, biomarkerRes, planRes, productRes] = await Promise.allSettled([
            userId ? api.get<User>(`/users/${userId}`) : Promise.reject(new Error('no user id')),
            getLatestBiomarkers(),
            getPlan(),
            api.get<Product[]>('/products'),
        ]);

        if (userRes.status === 'fulfilled') setUser(userRes.value);
        if (biomarkerRes.status === 'fulfilled') setBiomarkers(biomarkerRes.value.biomarkers ?? []);
        if (planRes.status === 'fulfilled') setPlanItems(planRes.value.items ?? []);
        if (productRes.status === 'fulfilled') setProducts(Array.isArray(productRes.value) ? productRes.value.slice(0, 6) : []);

        const rejected = [userRes, biomarkerRes, planRes, productRes]
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
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
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
                            onPressAvatar={() => router.push('/(tabs)/ProfileScreen')}
                        />

                        <ScoreHero score={score} onExplain={() => setExplainerOpen(true)} />

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
                                <QuickAction icon="flask-outline" label="Order test" onPress={() => router.push('/(tabs)/orders')} />
                                <QuickAction icon="calendar-outline" label="My plan" onPress={() => router.push('/myplans')} />
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

                        {biomarkers.length === 0 && (
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
        </View>
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
    return (
        <TouchableOpacity style={[styles.attentionCard, { borderColor: meta.color }]} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.flagPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.flagText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.attentionName} numberOfLines={2}>
                {biomarker.displayName ?? biomarker.name}
            </Text>
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
    greetingLabel: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.body },
    greetingName: { fontSize: 24, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    avatar: {
        width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '700', color: Palette.primary },

    // Score hero
    hero: {
        marginHorizontal: GUTTER, borderRadius: Radius.xl, padding: Spacing.xl,
        gap: Spacing.md, ...Shadow.card,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: {
        fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
        color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', fontFamily: Fonts.body,
    },
    heroBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroFigures: { gap: Spacing.sm },
    heroScore: {
        fontSize: 56, lineHeight: 60, fontWeight: '800', color: Palette.white, fontFamily: Fonts.display,
    },
    bandPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill,
    },
    bandDot: { width: 7, height: 7, borderRadius: Radius.pill },
    bandText: { fontSize: 12, fontWeight: '700', color: Palette.white },
    heroHeadline: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', fontFamily: Fonts.body },

    // Sections
    section: { marginTop: Spacing.xxl },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    sectionAction: { fontSize: 13, fontWeight: '600', color: Palette.primary },

    // Attention
    attentionCard: {
        width: 150, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1,
        backgroundColor: Palette.white, gap: 6, ...Shadow.card,
    },
    flagPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
    flagText: { fontSize: 10, fontWeight: '700' },
    attentionName: { fontSize: 13, fontWeight: '600', color: Palette.text, fontFamily: Fonts.body },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    attentionValue: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.display },
    unit: { fontSize: 11, color: Palette.textMuted },
    movement: { fontSize: 11, fontWeight: '600' },

    // Quick actions
    actionRow: { flexDirection: 'row', paddingHorizontal: GUTTER, gap: Spacing.md },
    action: { flex: 1, alignItems: 'center', gap: Spacing.sm },
    actionIcon: {
        width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    actionLabel: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, textAlign: 'center' },

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
    assessmentTitle: { fontSize: 14, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    assessmentBody: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, marginTop: 2 },

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
    planTitle: { fontSize: 14, fontWeight: '600', color: Palette.text, fontFamily: Fonts.body },
    planMeta: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
    planDue: { fontSize: 12, fontWeight: '700', color: Palette.textSecondary },

    // Metric grid
    metricGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: GUTTER,
    },
    metricCard: {
        flexGrow: 1, flexBasis: '46%', padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, gap: 6,
    },
    metricTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    metricName: { flex: 1, fontSize: 12, fontWeight: '600', color: Palette.textSecondary },
    statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
    metricValue: { fontSize: 22, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },

    // Products
    productCard: { width: 152, gap: 6 },
    productImage: { width: 152, height: 104, borderRadius: Radius.lg, backgroundColor: Palette.surface },
    productPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 13, fontWeight: '600', color: Palette.text, fontFamily: Fonts.body },
    productPrice: { fontSize: 14, fontWeight: '700', color: Palette.primary },

    // Empty
    emptyCard: {
        alignItems: 'center', gap: Spacing.sm, marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: Palette.surface,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    emptyBody: { fontSize: 13, lineHeight: 19, color: Palette.textSecondary, textAlign: 'center' },

    primaryButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: 14, paddingHorizontal: Spacing.xxl, alignItems: 'center', marginTop: Spacing.sm,
        alignSelf: 'stretch',
    },
    primaryButtonText: { color: Palette.white, fontSize: 15, fontWeight: '700' },

    // Signed out
    welcomeTitle: {
        fontSize: 26, lineHeight: 32, fontWeight: '800', color: Palette.white, fontFamily: Fonts.display,
    },
    ctaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    ctaPrimary: {
        flex: 1, backgroundColor: Palette.white, borderRadius: Radius.md,
        paddingVertical: 13, alignItems: 'center',
    },
    ctaPrimaryText: { color: Palette.primaryDark, fontSize: 14, fontWeight: '700' },
    ctaSecondary: {
        flex: 1, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)',
    },
    ctaSecondaryText: { color: Palette.white, fontSize: 14, fontWeight: '700' },
    benefitCard: {
        flexGrow: 1, flexBasis: '46%', padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, gap: Spacing.sm,
    },
    benefitTitle: { fontSize: 14, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    benefitBody: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary },

    // Explainer sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.64)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: Palette.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.md,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: Radius.pill, backgroundColor: Palette.border, alignSelf: 'center',
    },
    sheetTitle: { fontSize: 20, fontWeight: '700', color: Palette.text, fontFamily: Fonts.display },
    sheetBody: { fontSize: 13, lineHeight: 19, color: Palette.textSecondary },
    pillarRow: { gap: 5 },
    pillarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pillarLabel: { fontSize: 13, fontWeight: '700', color: Palette.text },
    pillarValue: { fontSize: 13, fontWeight: '700', color: Palette.primary },
    pillarTrack: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    pillarFill: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.primary },
    pillarDetail: { fontSize: 12, color: Palette.textSecondary },
    disclaimer: { fontSize: 11, lineHeight: 16, color: Palette.textMuted, marginTop: Spacing.sm },
});
