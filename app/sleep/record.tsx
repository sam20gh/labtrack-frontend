/**
 * Sleep Record — every night and nap, stacked by stage, for a day, a week, a month, a year
 * or everything on record. `GET /sleep/record`; the arithmetic is `utils/sleepRecord.js`.
 *
 * Where this sits among the sleep screens: the dashboard is *last night*, Insight is *the
 * patterns* (weekday means, stage ranges), History is *the list*. This is the one that shows
 * the nights themselves side by side, in colour, so a bad Tuesday is visible as a short bar
 * rather than as a dent in an average.
 *
 * Five decisions:
 *
 * 1. **The chart is the navigation.** Tapping a bar fills the panel above it with that
 *    night's figures and a way into Sleep Details. A tooltip would cover the bars next to
 *    it; a panel that is always there keeps its place, and it defaults to the newest night.
 * 2. **Naps float above the night, separated by a gap.** They are separate sleeps, and
 *    stacking them flush would make a 40-minute nap look like forty more minutes of the
 *    night. They are pink because they are not a stage.
 * 3. **A day is a timeline, not a single bar.** One bar tells you nothing a number does not;
 *    `1d` draws the day on a clock — the night in its stages, then the naps where they fell.
 * 4. **The ‹ › arrows page through time.** A record you can only see the latest window of is
 *    a dashboard. The server says whether there is anything earlier, so the back arrow never
 *    leads to an empty screen.
 * 5. **Stale content stays up while the next window loads.** Switching range dims the page
 *    rather than blanking it; replacing real content with a spinner to report that more is
 *    coming is the flicker `StaleNotice` exists to avoid.
 * 6. **The hero collapses as you scroll.** Expanded it is almost half the screen, which is
 *    right for the first glance and wrong for reading the cards under it. The controls —
 *    back, range, ‹ › — stay pinned; the big figure fades out and its value moves into the
 *    title, so the one number the hero exists for never leaves the screen. It is measured
 *    rather than hard-coded, because the chips wrap and a Dynamic Type setting changes
 *    every height in it. Built on core `Animated`, not Reanimated: a scroll-linked height
 *    on one view does not need a worklet, and the hero sits in the layout flow rather than
 *    floating over the list so that pull-to-refresh stays visible below it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Animated,
    useWindowDimensions, type ScrollView, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { ErrorState, StaleNotice } from '@/components/errors';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { Hypnogram } from '@/components/sleep/Hypnogram';
import { BedIllustration } from '@/components/sleep/BedIllustration';
import {
    StackedSleepBars, StackLegend, DayTimeline, CompositionBar, SleepWindowChart, barHasData,
} from '@/components/sleep/RecordCharts';
import {
    getRecord, formatMinutes, formatClock, splitMinutes, dayLabel,
    STAGE_META, NAP_META, UNSTAGED_META,
    type SleepRecord, type SleepRecordBar, type RecordBucket, type PeriodComparison,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const finite = (v: unknown): v is number => Number.isFinite(v as number);

const PERIOD_WORD: Record<MetricRange, string> = {
    '1d': 'day', '1w': 'week', '1m': '30 days', '1y': 'year', all: 'period',
};

const shortDate = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const monthYear = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

function periodLabel(data: SleepRecord | null, range: MetricRange): string {
    if (!data || !data.days.length) return ' ';
    const first = data.days[0];
    const last = data.days[data.days.length - 1];
    if (range === '1d') return dayLabel(last);
    if (range === '1w' || range === '1m') return `${shortDate(first)} – ${shortDate(last)}`;
    if (range === '1y') return `${monthYear(first)} – ${monthYear(last)}`;
    return data.summary.nights || data.summary.naps.count ? `Since ${monthYear(first)}` : 'All time';
}

/** What one bar is called in the panel above the chart. */
function barTitle(bar: SleepRecordBar, bucket: RecordBucket): string {
    if (bucket === 'day') return dayLabel(bar.from);
    if (bucket === 'week') return `Week of ${shortDate(bar.from)}`;
    return new Date(`${bar.from}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** The chart's caption: what a bar *is*, which changes with the range. */
const BUCKET_NOTE: Record<RecordBucket, string> = {
    day: 'Each bar is one night. Tap a bar to see it.',
    week: 'Each bar is a typical night that week. Tap a bar to see it.',
    month: 'Each bar is a typical night that month. Tap a bar to see it.',
};

/* ------------------------------------------------------------------ pieces */

/** `▲ 6% vs previous week`, or a plain line when there is nothing to compare with. */
function DeltaChip({ comparison, period }: { comparison: PeriodComparison | undefined; period: string }) {
    if (!comparison || comparison.deltaPct === null || comparison.direction === null) return null;
    const flat = comparison.direction === 'flat';
    const up = comparison.direction === 'up';
    return (
        <View style={styles.deltaChip}>
            <Ionicons
                name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={Palette.white}
            />
            <Text style={styles.deltaText}>
                {flat ? `Same as previous ${period}` : `${Math.abs(comparison.deltaPct)}% vs previous ${period}`}
            </Text>
        </View>
    );
}

function HeroChip({ icon, label }: { icon: IconName; label: string }) {
    return (
        <View style={styles.heroChip}>
            <Ionicons name={icon} size={13} color={Palette.white} />
            <Text style={styles.heroChipText}>{label}</Text>
        </View>
    );
}

/** Hero padding above the controls, and below them once folded. */
const HERO_PAD_TOP = Spacing.md;
const HERO_PAD_COLLAPSED = 14;

/** Deterministic "stars" for the night-sky hero — positions fixed so nothing shifts on render. */
const STARS = [
    { t: 14, l: 72, s: 3 }, { t: 30, l: 88, s: 2 }, { t: 52, l: 64, s: 2 }, { t: 22, l: 40, s: 2 },
    { t: 70, l: 92, s: 3 }, { t: 10, l: 18, s: 2 }, { t: 84, l: 78, s: 2 }, { t: 44, l: 96, s: 2 },
];

function StatTile({
    icon, tint, surface, label, value, note,
}: {
    icon: IconName; tint: string; surface: string; label: string; value: string; note?: string | null;
}) {
    return (
        <View style={styles.tile}>
            <View style={[styles.tileIcon, { backgroundColor: surface }]}>
                <Ionicons name={icon} size={16} color={tint} />
            </View>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            {note ? <Text style={styles.tileNote} numberOfLines={2}>{note}</Text> : null}
        </View>
    );
}

function Card({ title, subtitle, children, right }: {
    title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                </View>
                {right}
            </View>
            {children}
        </View>
    );
}

/** The panel above the chart: whichever bar is selected, in full. */
function SelectedPanel({
    bar, bucket, onOpen,
}: { bar: SleepRecordBar; bucket: RecordBucket; onOpen: (id: string) => void }) {
    const chips: { label: string; tint: string; minutes: number | null }[] = [
        { label: STAGE_META.deep.label, tint: STAGE_META.deep.tint, minutes: bar.deepMin },
        { label: STAGE_META.light.label, tint: STAGE_META.light.tint, minutes: bar.lightMin },
        { label: STAGE_META.rem.label, tint: STAGE_META.rem.tint, minutes: bar.remMin },
        { label: STAGE_META.awake.label, tint: STAGE_META.awake.tint, minutes: bar.awakeMin },
        { label: NAP_META.label, tint: NAP_META.tint, minutes: bar.napMin },
    ].filter((c) => finite(c.minutes) && (c.minutes as number) > 0);
    const staged = [bar.deepMin, bar.lightMin, bar.remMin].some(finite);
    if (finite(bar.unstagedMin) && bar.unstagedMin > 0 && !staged) {
        chips.unshift({ label: UNSTAGED_META.label, tint: UNSTAGED_META.tint, minutes: bar.unstagedMin });
    }

    return (
        <View style={styles.panel}>
            <View style={styles.panelHead}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.panelDate}>{barTitle(bar, bucket)}</Text>
                    <Text style={styles.panelValue}>
                        {finite(bar.asleepMin) ? formatMinutes(bar.asleepMin) : 'No night'}
                        <Text style={styles.panelUnit}>
                            {finite(bar.asleepMin) ? (bucket === 'day' ? ' asleep' : ' typical night') : ''}
                        </Text>
                    </Text>
                    {bucket !== 'day' ? (
                        <Text style={styles.panelMeta}>
                            {`${bar.nights} of ${bar.dayCount} nights recorded`}
                        </Text>
                    ) : finite(bar.bedtimeMin) && finite(bar.wakeMin) ? (
                        <Text style={styles.panelMeta}>
                            {`${formatClock(bar.bedtimeMin)} → ${formatClock(bar.wakeMin)}`}
                            {finite(bar.score) ? `  ·  Score ${bar.score}` : ''}
                        </Text>
                    ) : null}
                </View>
                {bar.nightId ? (
                    <Pressable
                        onPress={() => onOpen(bar.nightId as string)}
                        style={styles.panelOpen}
                        accessibilityRole="button"
                        accessibilityLabel="Open this night"
                    >
                        <Text style={styles.panelOpenText}>Details</Text>
                        <Ionicons name="chevron-forward" size={14} color={Palette.primary} />
                    </Pressable>
                ) : null}
            </View>
            {chips.length ? (
                <View style={styles.chipRow}>
                    {chips.map((c) => (
                        <View key={c.label} style={styles.stageChip}>
                            <View style={[styles.dot, { backgroundColor: c.tint }]} />
                            <Text style={styles.stageChipLabel}>{c.label}</Text>
                            <Text style={styles.stageChipValue}>{formatMinutes(c.minutes)}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

/** A night in the list: its date, a thin stacked bar to scale, and the total. */
function NightStrip({
    bar, bucket, scale, onPress,
}: { bar: SleepRecordBar; bucket: RecordBucket; scale: number; onPress?: () => void }) {
    const pieces = [
        { key: 'deep', m: bar.deepMin, tint: STAGE_META.deep.tint },
        { key: 'light', m: bar.lightMin, tint: STAGE_META.light.tint },
        { key: 'rem', m: bar.remMin, tint: STAGE_META.rem.tint },
        { key: 'unstaged', m: bar.unstagedMin, tint: UNSTAGED_META.tint },
        { key: 'awake', m: bar.awakeMin, tint: STAGE_META.awake.tint },
    ].filter((p) => finite(p.m) && (p.m as number) > 0);
    const total = pieces.reduce((s, p) => s + (p.m as number), 0);

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [styles.strip, pressed && { opacity: 0.7 }]}
            accessibilityRole={onPress ? 'button' : undefined}
        >
            <View style={styles.stripHead}>
                <Text style={styles.stripDate}>{barTitle(bar, bucket)}</Text>
                <View style={styles.stripRight}>
                    {bar.napCount > 0 ? (
                        <View style={styles.napBadge}>
                            <Text style={styles.napBadgeText}>
                                {bar.napCount === 1 ? '+ nap' : `+ ${bar.napCount} naps`}
                            </Text>
                        </View>
                    ) : null}
                    <Text style={styles.stripValue}>
                        {finite(bar.asleepMin) ? formatMinutes(bar.asleepMin) : 'Nap only'}
                    </Text>
                    {onPress ? <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} /> : null}
                </View>
            </View>
            <View style={styles.stripTrack}>
                <View style={[styles.stripFill, { width: `${Math.min(100, (total / scale) * 100)}%` }]}>
                    {pieces.map((p, i) => (
                        <View
                            key={p.key}
                            style={{ flex: p.m as number, backgroundColor: p.tint, marginLeft: i ? 1.5 : 0 }}
                        />
                    ))}
                </View>
            </View>
        </Pressable>
    );
}

/* ------------------------------------------------------------------ screen */

export default function SleepRecordScreen() {
    const router = useRouter();

    const [range, setRange] = useState<MetricRange>('1w');
    const [end, setEnd] = useState<string | null>(null);
    const [data, setData] = useState<SleepRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [selected, setSelected] = useState<number | null>(null);

    // A fast tap from 1w to 1y must not let the slower 1w response land last.
    const requestRef = useRef(0);

    const load = useCallback(async () => {
        const request = ++requestRef.current;
        setLoading(true);
        try {
            setError(null);
            const result = await getRecord(range, end);
            if (request !== requestRef.current) return;
            setData(result);
        } catch (err) {
            if (request !== requestRef.current) return;
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err);
        } finally {
            if (request === requestRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [range, end, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Default to the newest bar with something in it — the night people open this to see.
    useEffect(() => {
        if (!data) return;
        let latest: number | null = null;
        data.series.forEach((b, i) => { if (barHasData(b)) latest = i; });
        setSelected(latest);
    }, [data]);

    const changeRange = (next: MetricRange) => {
        if (next === range) return;
        setEnd(null);
        setRange(next);
    };

    const openNight = (id: string) => router.push(`/sleep/${id}`);

    const summary = data?.summary;
    const empty = Boolean(data && summary && summary.nights === 0 && summary.naps.count === 0);
    const selectedBar = data && selected !== null ? data.series[selected] : null;
    // A single day is headed by its total — night plus naps — which is the figure every other
    // health app shows as "total sleep". The night alone is on the tile below.
    const dayBar = range === '1d' ? data?.series[0] ?? null : null;
    const dayNaps = dayBar?.napCount ? dayBar.napMin : null;
    const heroMinutes = range === '1d'
        ? dayBar?.totalAsleepMin ?? dayBar?.asleepMin ?? null
        : summary?.avgAsleepMin ?? null;
    const hero = splitMinutes(heroMinutes);

    const listBars = useMemo(
        () => (data ? data.series.filter(barHasData).slice().reverse() : []),
        [data]
    );
    const stripScale = useMemo(
        () => Math.max(1, ...listBars.map((b) => [b.deepMin, b.lightMin, b.remMin, b.unstagedMin, b.awakeMin]
            .reduce<number>((s, m) => s + (finite(m) ? m : 0), 0))),
        [listBars]
    );
    const mainNight = data?.timeline?.find((t) => t.kind === 'night') ?? null;

    /* ------------------------------------------------ the collapsing hero */
    const { height: windowHeight } = useWindowDimensions();
    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef<ScrollView>(null);
    const lastY = useRef(0);
    const [topH, setTopH] = useState(0);
    const [figureH, setFigureH] = useState(0);

    const onTopLayout = (e: LayoutChangeEvent) => setTopH(Math.round(e.nativeEvent.layout.height));
    const onFigureLayout = (e: LayoutChangeEvent) => setFigureH(Math.round(e.nativeEvent.layout.height));

    const expanded = HERO_PAD_TOP + topH + figureH;
    const collapsed = HERO_PAD_TOP + topH + HERO_PAD_COLLAPSED;
    const collapseBy = Math.max(0, expanded - collapsed);
    const measured = topH > 0 && figureH > 0 && collapseBy > 0;
    // Guard against a zero-length input range before the first layout pass.
    const range0 = Math.max(1, collapseBy);

    const anim = useMemo(() => {
        const clamp = { extrapolate: 'clamp' as const };
        return {
            heroHeight: scrollY.interpolate({ inputRange: [0, range0], outputRange: [expanded, collapsed], ...clamp }),
            figureOpacity: scrollY.interpolate({ inputRange: [0, range0 * 0.6], outputRange: [1, 0], ...clamp }),
            figureShift: scrollY.interpolate({ inputRange: [0, range0], outputRange: [0, -24], ...clamp }),
            figureScale: scrollY.interpolate({ inputRange: [0, range0], outputRange: [1, 0.9], ...clamp }),
            titleOpacity: scrollY.interpolate({ inputRange: [range0 * 0.55, range0 * 0.9], outputRange: [1, 0], ...clamp }),
            compactOpacity: scrollY.interpolate({ inputRange: [range0 * 0.6, range0], outputRange: [0, 1], ...clamp }),
            compactShift: scrollY.interpolate({ inputRange: [range0 * 0.6, range0], outputRange: [8, 0], ...clamp }),
        };
    }, [scrollY, range0, expanded, collapsed]);
    const heroHeight = measured ? anim.heroHeight : null;
    const { figureOpacity, figureShift, figureScale, titleOpacity, compactOpacity, compactShift } = anim;

    // JS driver: `height` is a layout property and the native driver cannot animate it.
    const onScroll = useMemo(() => Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
            useNativeDriver: false,
            listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => { lastY.current = e.nativeEvent.contentOffset.y; },
        }
    ), [scrollY]);

    /** Never leave the hero stuck half-folded: settle to whichever end is nearer. */
    const snap = () => {
        const y = lastY.current;
        if (!collapseBy || y <= 0 || y >= collapseBy) return;
        scrollRef.current?.scrollTo({ y: y < collapseBy / 2 ? 0 : collapseBy, animated: true });
    };

    const compactLabel = heroMinutes !== null
        ? `${formatMinutes(heroMinutes)} · ${range === '1d' ? 'total sleep' : 'avg night'}`
        : 'Sleep record';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {/* ------------------------------------------------------ night-sky hero */}
            <Animated.View style={[styles.hero, heroHeight ? { height: heroHeight } : null]}>
                <LinearGradient
                    colors={[Palette.primaryDeep, Palette.primaryDark, Palette.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                {STARS.map((s, i) => (
                    <View
                        key={i}
                        pointerEvents="none"
                        style={[styles.star, { top: `${s.t}%`, left: `${s.l}%`, width: s.s, height: s.s }]}
                    />
                ))}
                <Animated.View pointerEvents="none" style={[styles.heroMoon, { opacity: figureOpacity }]}>
                    <Ionicons name="moon" size={78} color="rgba(255,255,255,0.07)" />
                </Animated.View>

                <View style={styles.heroTop} onLayout={onTopLayout}>
                    <View style={styles.heroRow}>
                        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
                            <Ionicons name="chevron-back" size={24} color={Palette.white} />
                        </Pressable>
                        <View style={styles.heroTitleSlot}>
                            <Animated.Text style={[styles.heroTitle, { opacity: titleOpacity }]}>
                                Sleep record
                            </Animated.Text>
                            {/* The figure, carried up into the bar once the hero has folded. */}
                            <Animated.Text
                                numberOfLines={1}
                                style={[
                                    styles.heroTitle, styles.heroCompact,
                                    { opacity: compactOpacity, transform: [{ translateY: compactShift }] },
                                ]}
                                accessibilityElementsHidden
                                importantForAccessibility="no-hide-descendants"
                            >
                                {compactLabel}
                            </Animated.Text>
                        </View>
                        <Pressable onPress={() => router.push('/sleep/history')} hitSlop={10} accessibilityLabel="Sleep history">
                            <Ionicons name="list-outline" size={22} color={Palette.white} />
                        </Pressable>
                    </View>

                    <RangeTabs value={range} onChange={changeRange} />

                    <View style={styles.stepper}>
                        <Pressable
                            onPress={() => data?.previousEnd && setEnd(data.previousEnd)}
                            disabled={!data?.previousEnd}
                            hitSlop={10}
                            style={[styles.stepButton, !data?.previousEnd && styles.stepDisabled]}
                            accessibilityLabel="Earlier"
                        >
                            <Ionicons name="chevron-back" size={16} color={Palette.white} />
                        </Pressable>
                        <Text style={styles.stepLabel}>{periodLabel(data, range)}</Text>
                        <Pressable
                            onPress={() => data?.nextEnd && setEnd(data.nextEnd)}
                            disabled={!data?.nextEnd}
                            hitSlop={10}
                            style={[styles.stepButton, !data?.nextEnd && styles.stepDisabled]}
                            accessibilityLabel="Later"
                        >
                            <Ionicons name="chevron-forward" size={16} color={Palette.white} />
                        </Pressable>
                    </View>
                </View>

                <Animated.View
                    onLayout={onFigureLayout}
                    style={[
                        styles.heroBody,
                        { opacity: figureOpacity, transform: [{ translateY: figureShift }, { scale: figureScale }] },
                    ]}
                >
                    <View style={styles.heroFigure}>
                        {hero ? (
                            <Text style={styles.heroValue}>
                                {hero.hours}
                                <Text style={styles.heroUnit}>h </Text>
                                {hero.mins}
                                <Text style={styles.heroUnit}>m</Text>
                            </Text>
                        ) : (
                            <Text style={styles.heroValue}>—</Text>
                        )}
                        <Text style={styles.heroCaption}>
                            {range === '1d'
                                ? (dayNaps && finite(dayBar?.asleepMin)
                                    ? `total sleep · ${formatMinutes(dayBar?.asleepMin)} night + ${formatMinutes(dayNaps)} ${dayBar?.napCount === 1 ? 'nap' : 'naps'}`
                                    : dayNaps ? 'total sleep · naps only' : 'asleep that night')
                                : summary && summary.nights
                                    ? `average night · ${summary.nights} of ${summary.dayCount} nights recorded`
                                    : 'average night'}
                        </Text>
                        <DeltaChip comparison={summary?.comparison?.asleepMin} period={PERIOD_WORD[range]} />
                    </View>

                    {summary && !empty ? (
                        <View style={styles.heroChips}>
                            {finite(summary.avgScore) ? <HeroChip icon="star" label={`Score ${summary.avgScore}`} /> : null}
                            {summary.goal && summary.goal.nights ? (
                                <HeroChip icon="flag" label={`Goal ${summary.goal.met}/${summary.goal.nights}`} />
                            ) : null}
                            {summary.naps.count ? (
                                <HeroChip
                                    icon="partly-sunny"
                                    label={`${summary.naps.count} ${summary.naps.count === 1 ? 'nap' : 'naps'} · ${formatMinutes(summary.naps.totalMin)}`}
                                />
                            ) : null}
                        </View>
                    ) : null}
                </Animated.View>
            </Animated.View>

            {!data && loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : !data && error ? (
                <ErrorState error={error} subject="your sleep record" onRetry={load} />
            ) : data && summary ? (
                <Animated.ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[styles.content, { minHeight: windowHeight + collapseBy }]}
                    showsVerticalScrollIndicator={false}
                    style={loading && !refreshing ? styles.dimmed : undefined}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    onScrollEndDrag={(e) => {
                        if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.2) snap();
                    }}
                    onMomentumScrollEnd={snap}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor={Palette.primary}
                        />
                    }
                >
                    {error ? <StaleNotice onRetry={load} /> : null}

                    {empty ? (
                        <View style={[styles.card, styles.empty]}>
                            <BedIllustration width={180} />
                            <Text style={styles.emptyTitle}>No sleep recorded here</Text>
                            <Text style={styles.emptyBody}>
                                {data.previousEnd
                                    ? 'Nothing synced or logged for this period. Go back to see earlier nights.'
                                    : 'Once your watch or phone syncs a night — or you log one — it appears here in its stages.'}
                            </Text>
                            <View style={styles.emptyActions}>
                                {data.previousEnd ? (
                                    <Pressable style={styles.secondaryButton} onPress={() => setEnd(data.previousEnd)}>
                                        <Text style={styles.secondaryButtonText}>Earlier</Text>
                                    </Pressable>
                                ) : null}
                                <Pressable style={styles.primaryButton} onPress={() => router.push('/sleep/log')}>
                                    <Text style={styles.primaryButtonText}>Log a night</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <>
                            {/* -------------------------------------------- the chart */}
                            {range === '1d' ? (
                                <Card title="The day at a glance" subtitle="Your night in its stages, and any naps, on the clock.">
                                    {data.timeline && data.timeline.length ? (
                                        <>
                                            <DayTimeline sessions={data.timeline} />
                                            <View style={{ gap: Spacing.sm }}>
                                                {data.timeline.map((t) => (
                                                    <Pressable key={t.id} style={styles.sessionRow} onPress={() => openNight(t.id)}>
                                                        <View style={[styles.sessionIcon, { backgroundColor: t.kind === 'nap' ? Palette.pinkSurface : Palette.primarySurface }]}>
                                                            <Ionicons
                                                                name={t.kind === 'nap' ? 'partly-sunny' : 'moon'}
                                                                size={15}
                                                                color={t.kind === 'nap' ? NAP_META.tint : Palette.primary}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.sessionTitle}>{t.kind === 'nap' ? 'Nap' : 'Night'}</Text>
                                                            <Text style={styles.sessionMeta}>
                                                                {`${new Date(t.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(t.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                                                            </Text>
                                                        </View>
                                                        <Text style={styles.sessionValue}>{formatMinutes(t.asleepMin)}</Text>
                                                        <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} />
                                                    </Pressable>
                                                ))}
                                            </View>
                                            <StackLegend bars={data.series} />
                                        </>
                                    ) : null}
                                </Card>
                            ) : (
                                <Card title="Nightly sleep" subtitle={BUCKET_NOTE[data.bucket]}>
                                    {selectedBar ? (
                                        <SelectedPanel bar={selectedBar} bucket={data.bucket} onOpen={openNight} />
                                    ) : null}
                                    <StackedSleepBars
                                        bars={data.series}
                                        bucket={data.bucket}
                                        goalMinutes={summary.goal?.minutes ?? null}
                                        selected={selected}
                                        onSelect={setSelected}
                                    />
                                    <StackLegend bars={data.series} />
                                </Card>
                            )}

                            {range === '1d' && mainNight && mainNight.segments.length ? (
                                <Card title="Stages through the night">
                                    <Hypnogram segments={mainNight.segments} />
                                </Card>
                            ) : null}

                            {/* -------------------------------------------- the numbers */}
                            <View style={styles.grid}>
                                <StatTile
                                    icon="moon" tint={Palette.primary} surface={Palette.primarySurface}
                                    label={range === '1d' ? 'Night sleep' : 'Avg night'}
                                    value={formatMinutes(summary.avgAsleepMin)}
                                    note={range === '1d'
                                        ? (dayNaps ? `${formatMinutes(dayBar?.totalAsleepMin)} with naps` : null)
                                        : finite(summary.totalSleep?.avgMin) && summary.naps.count
                                            ? `${formatMinutes(summary.totalSleep.avgMin)} a day with naps`
                                            : finite(summary.totalAsleepMin) ? `${formatMinutes(summary.totalAsleepMin)} in total` : null}
                                />
                                <StatTile
                                    icon="bed" tint={Palette.indigo} surface={Palette.indigoSurface}
                                    label="Time in bed"
                                    value={formatMinutes(summary.avgInBedMin)}
                                    note={finite(summary.avgInBedMin) && finite(summary.avgAsleepMin)
                                        ? `${formatMinutes(Math.max(0, summary.avgInBedMin - summary.avgAsleepMin))} not asleep`
                                        : null}
                                />
                                <StatTile
                                    icon="speedometer" tint={Palette.sky} surface={Palette.skySurface}
                                    label="Efficiency"
                                    value={finite(summary.avgEfficiency) ? `${summary.avgEfficiency}%` : '—'}
                                    note={finite(summary.avgEfficiency) ? 'of time in bed spent asleep' : 'Your source does not report time awake'}
                                />
                                <StatTile
                                    icon="star" tint={Palette.amber} surface={Palette.warningSurface}
                                    label="Sleep score"
                                    value={finite(summary.avgScore) ? `${summary.avgScore}` : '—'}
                                    note={finite(summary.avgScore) ? (range === '1d' ? 'out of 100' : 'average, out of 100') : null}
                                />
                                <StatTile
                                    icon="cloudy-night" tint={Palette.primaryDark} surface={Palette.primaryTint}
                                    label={range === '1d' ? 'Fell asleep' : 'Typical bedtime'}
                                    value={formatClock(summary.bedtime.avgMin)}
                                    note={finite(summary.bedtime.spreadMin) ? `varies by ±${formatMinutes(summary.bedtime.spreadMin)}` : null}
                                />
                                <StatTile
                                    icon="sunny" tint={Palette.orange} surface={Palette.orangeSurface}
                                    label={range === '1d' ? 'Woke up' : 'Typical wake-up'}
                                    value={formatClock(summary.wake.avgMin)}
                                    note={finite(summary.wake.spreadMin) ? `varies by ±${formatMinutes(summary.wake.spreadMin)}` : null}
                                />
                                <StatTile
                                    icon="flag" tint={Palette.success} surface={Palette.successSurface}
                                    label="Goal reached"
                                    value={summary.goal && summary.goal.nights
                                        ? (range === '1d'
                                            ? (summary.goal.met ? 'Yes' : 'Not quite')
                                            : `${summary.goal.met} of ${summary.goal.nights}`)
                                        : '—'}
                                    note={summary.goal ? `goal ${formatMinutes(summary.goal.minutes)} a day, naps included` : 'No sleep goal set'}
                                />
                                <StatTile
                                    icon="partly-sunny" tint={NAP_META.tint} surface={Palette.pinkSurface}
                                    label="Naps"
                                    value={summary.naps.count ? formatMinutes(summary.naps.totalMin) : 'None'}
                                    note={summary.naps.count
                                        ? `${summary.naps.count} ${summary.naps.count === 1 ? 'nap' : 'naps'}, ${formatMinutes(summary.naps.avgMin)} each on average`
                                        : null}
                                />
                            </View>

                            {/* -------------------------------------------- composition */}
                            {summary.stagedNights > 0 ? (
                                <Card
                                    title="Where the night goes"
                                    subtitle={range === '1d'
                                        ? 'Time in each stage.'
                                        : `A typical night, from ${summary.stagedNights} ${summary.stagedNights === 1 ? 'night' : 'nights'} with stage data.`}
                                >
                                    <CompositionBar stages={summary.stages} />
                                </Card>
                            ) : summary.nights > 0 ? (
                                <View style={styles.note}>
                                    <Ionicons name="information-circle-outline" size={16} color={Palette.textSecondary} />
                                    <Text style={styles.noteText}>
                                        Your source reported how long you slept but not your stages, so the bars
                                        are grey. A watch that tracks stages fills them in.
                                    </Text>
                                </View>
                            ) : null}

                            {/* -------------------------------------------- sleep window */}
                            {range !== '1d' && summary.nights >= 2 ? (
                                <Card title="Your sleep window" subtitle="When you were asleep — from bedtime at the top to waking at the bottom.">
                                    <SleepWindowChart
                                        bars={data.series}
                                        bucket={data.bucket}
                                        bedtimeMin={summary.bedtime.avgMin}
                                        wakeMin={summary.wake.avgMin}
                                    />
                                </Card>
                            ) : null}

                            {/* -------------------------------------------- highlights */}
                            {range !== '1d' && summary.nights >= 2 ? (
                                <Card title="Highlights">
                                    {([
                                        { key: 'longest', icon: 'trending-up', tint: Palette.success, label: 'Longest night', fmt: formatMinutes },
                                        { key: 'shortest', icon: 'trending-down', tint: Palette.warning, label: 'Shortest night', fmt: formatMinutes },
                                        { key: 'bestScore', icon: 'trophy', tint: Palette.amber, label: 'Best score', fmt: (v: number) => `${v}` },
                                        { key: 'mostDeep', icon: 'water', tint: STAGE_META.deep.tint, label: 'Most deep sleep', fmt: formatMinutes },
                                    ] as const).map((h) => {
                                        const item = summary.highlights[h.key];
                                        if (!item) return null;
                                        return (
                                            <Pressable key={h.key} style={styles.highlight} onPress={() => openNight(item.id)}>
                                                <Ionicons name={h.icon} size={17} color={h.tint} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.highlightLabel}>{h.label}</Text>
                                                    <Text style={styles.highlightDay}>{dayLabel(item.day)}</Text>
                                                </View>
                                                <Text style={styles.highlightValue}>{h.fmt(item.value)}</Text>
                                                <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} />
                                            </Pressable>
                                        );
                                    })}
                                </Card>
                            ) : null}

                            {/* -------------------------------------------- naps */}
                            {range !== '1d' ? (
                                <Card
                                    title="Naps"
                                    right={summary.naps.count ? (
                                        <Text style={styles.cardCount}>{summary.naps.count}</Text>
                                    ) : undefined}
                                >
                                    {data.naps.length ? data.naps.slice(0, 8).map((nap) => (
                                        <Pressable key={nap.id} style={styles.napRow} onPress={() => openNight(nap.id)}>
                                            <View style={styles.napAccent} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.highlightLabel}>{nap.day ? dayLabel(nap.day) : 'Nap'}</Text>
                                                <Text style={styles.highlightDay}>
                                                    {`${formatClock(nap.startMin)} – ${formatClock(nap.endMin)}`}
                                                </Text>
                                            </View>
                                            <Text style={styles.highlightValue}>{formatMinutes(nap.minutes)}</Text>
                                        </Pressable>
                                    )) : (
                                        <Text style={styles.cardSubtitle}>
                                            No naps in this period. A nap is a sleep of up to three hours during
                                            the day, at least an hour apart from your night.
                                        </Text>
                                    )}
                                </Card>
                            ) : null}

                            {/* -------------------------------------------- night by night */}
                            {range !== '1d' && listBars.length ? (
                                <Card title={data.bucket === 'day' ? 'Night by night' : data.bucket === 'week' ? 'Week by week' : 'Month by month'}>
                                    {listBars.slice(0, 31).map((bar) => (
                                        <NightStrip
                                            key={bar.from}
                                            bar={bar}
                                            bucket={data.bucket}
                                            scale={stripScale}
                                            onPress={bar.nightId ? () => openNight(bar.nightId as string) : undefined}
                                        />
                                    ))}
                                    {data.bucket === 'day' && listBars.length > 31 ? (
                                        <Pressable onPress={() => router.push('/sleep/history')}>
                                            <Text style={styles.link}>See every night in Sleep History</Text>
                                        </Pressable>
                                    ) : null}
                                </Card>
                            ) : null}
                        </>
                    )}
                </Animated.ScrollView>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dimmed: { opacity: 0.55 },

    hero: {
        paddingHorizontal: Spacing.xl, paddingTop: HERO_PAD_TOP,
        overflow: 'hidden', zIndex: 2,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    },
    heroTop: { gap: Spacing.lg },
    heroBody: { paddingTop: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
    heroTitleSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.md },
    heroCompact: { position: 'absolute', fontSize: 15 },
    star: { position: 'absolute', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
    heroMoon: { position: 'absolute', right: -8, top: 86 },
    heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },

    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepButton: {
        width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    stepDisabled: { opacity: 0.3 },
    stepLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },

    heroFigure: { alignItems: 'center', gap: 4 },
    heroValue: { fontSize: 46, lineHeight: 52, fontFamily: Fonts.bold, color: Palette.white },
    heroUnit: { fontSize: 20, fontFamily: Fonts.semibold, color: 'rgba(255,255,255,0.75)' },
    heroCaption: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.8)' },
    deltaChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    deltaText: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.white },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
    heroChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    },
    heroChipText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.white },

    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    card: {
        padding: Spacing.lg, borderRadius: 18, backgroundColor: Palette.background,
        borderWidth: 1, borderColor: Palette.borderLight, gap: Spacing.md, ...Shadow.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    cardSubtitle: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary,
        lineHeight: 17, marginTop: 2,
    },
    cardCount: {
        fontSize: 12, fontFamily: Fonts.bold, color: NAP_META.tint,
        backgroundColor: Palette.pinkSurface, paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: Radius.pill, overflow: 'hidden',
    },

    panel: {
        padding: Spacing.md, borderRadius: 14, backgroundColor: Palette.primaryTint, gap: Spacing.sm,
    },
    panelHead: { flexDirection: 'row', alignItems: 'flex-start' },
    panelDate: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.primaryDark },
    panelValue: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text },
    panelUnit: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    panelMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    panelOpen: {
        flexDirection: 'row', alignItems: 'center', gap: 2,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
        backgroundColor: Palette.background,
    },
    panelOpenText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.primary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    stageChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill,
        backgroundColor: Palette.background,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    stageChipLabel: { fontSize: 11, fontFamily: Fonts.medium, color: Palette.textSecondary },
    stageChipValue: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.text },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    tile: {
        flexBasis: '47%', flexGrow: 1, padding: Spacing.md, borderRadius: 16,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
        gap: 3, ...Shadow.card,
    },
    tileIcon: {
        width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
    },
    tileLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tileValue: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    tileNote: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 15 },

    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sessionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sessionTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    sessionMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    sessionValue: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text },

    highlight: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4,
    },
    highlightLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    highlightDay: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    highlightValue: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text },

    napRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    napAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: NAP_META.tint },

    strip: { gap: 6, paddingVertical: 2 },
    stripHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stripDate: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },
    stripRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stripValue: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.text },
    stripTrack: { height: 8, borderRadius: 4, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    stripFill: { flexDirection: 'row', height: '100%', borderRadius: 4, overflow: 'hidden' },
    napBadge: {
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill,
        backgroundColor: Palette.pinkSurface,
    },
    napBadgeText: { fontSize: 10, fontFamily: Fonts.semibold, color: NAP_META.tint },

    note: {
        flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: 14,
        backgroundColor: Palette.surface,
    },
    noteText: { flex: 1, fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 17 },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary, textAlign: 'center' },

    empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 19, paddingHorizontal: Spacing.md,
    },
    emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    primaryButton: {
        paddingHorizontal: Spacing.xl, paddingVertical: 10, borderRadius: Radius.pill,
        backgroundColor: Palette.primary,
    },
    primaryButtonText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
    secondaryButton: {
        paddingHorizontal: Spacing.xl, paddingVertical: 10, borderRadius: Radius.pill,
        backgroundColor: Palette.primarySurface,
    },
    secondaryButtonText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
});
