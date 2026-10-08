/**
 * One metric's history — every card on the Health Metrics list opens here.
 *
 * A chart, a summary, the individual entries, and at the foot the way on to the metric's
 * insight and to the tracker it comes from. Weight and blood pressure are entered by hand and
 * their entries carry a delete; the six device-fed metrics (heart rate, HRV, blood oxygen,
 * temperature, sleep, steps) are read-only here, because a reading a device sent is not a
 * typo to correct. They differ enough in the middle to branch, and not enough to justify
 * separate screens that would drift apart on the chrome — which is exactly what happened
 * before: the device-fed cards opened Activity or the bracelet's pairing screen, so the list
 * behaved three different ways depending on which card was tapped.
 *
 * **Hydration is not here.** `Design/hydration.svg` is five screens — a glass at today's
 * level, a month of ticks, a vessel breakdown, a level ladder, and a per-entry detail — none of
 * which has a counterpart on the others. It lives at `app/metrics/water/`; `/metrics/water` is
 * a static route and wins over this one without either having to know about the other.
 *
 * The blood-pressure branch carries the one thing the kit's version does not: **the worst
 * reading in the window is shown next to the average**, because an average is precisely the
 * operation that hides a single alarming reading, and this is the screen someone would look at
 * to find one. The device-fed summary follows the same rule — lowest and highest sit beside
 * the average.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import { MetricAreaChart } from '@/components/metric/MetricAreaChart';
import {
    getHistory, deleteLog, today as localToday, metricTint, metricIcon,
    HISTORY_METRIC, METRIC_INSIGHT_ROUTE, METRIC_SOURCE_LINK,
    type MetricHistory, type MetricLog, type HistoryKind, type HistoryEntry, type MetricKey,
} from '@/lib/metrics';
import { dayLabel } from '@/lib/hydration';
import { formatMinutes } from '@/lib/sleep';
import { useUnits, unitLabel, displayWeight, type UnitPrefs } from '@/lib/units';
import { Spacing, Radius, Shadow, Fonts, BodyFont, tone } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

/**
 * What this screen knows about each kind before the server answers. Tints are read from
 * `metricTint` rather than typed here: this table once held its own copy of blood pressure's
 * colour, which would have kept this screen purple after the dashboard moved on. A device-fed
 * kind's title and unit come back from the server too (temperature's title depends on which
 * site the window holds), and those win once loaded.
 */
const META: Record<string, { title: string; unit: string; logRoute?: string }> = {
    weight: { title: 'Weight', unit: 'kg', logRoute: '/metrics/log/weight' },
    'blood-pressure': { title: 'Blood Pressure', unit: 'mmHg', logRoute: '/metrics/log/blood-pressure' },
    'heart-rate': { title: 'Heart Rate', unit: 'bpm' },
    hrv: { title: 'Heart Rate Variability', unit: 'ms' },
    // Unitless: the bracelet's own score on a scale its maker does not publish.
    stress: { title: 'Stress', unit: '' },
    spo2: { title: 'Blood Oxygen', unit: '%' },
    temperature: { title: 'Temperature', unit: '°C' },
    sleep: { title: 'Sleep', unit: 'h' },
    steps: { title: 'Steps', unit: 'steps' },
};

const LOGGABLE = new Set(['weight', 'blood-pressure']);

/** A device-fed value with its unit, the way the list card prints it. */
const formatValue = (value: number | null | undefined, unit: string): string => {
    if (value === null || value === undefined) return '--';
    if (unit === 'h') return formatMinutes(value * 60);
    if (unit === 'steps') return `${Math.round(value).toLocaleString()} steps`;
    if (unit === '%') return `${value}%`;
    return unit ? `${value} ${unit}` : String(value);
};

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const RANGES = [
    { key: 7, label: '1w' },
    { key: 30, label: '1m' },
    { key: 90, label: '3m' },
    { key: 365, label: '1y' },
];

export default function MetricDetailScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { kind } = useLocalSearchParams<{ kind: string }>();
    const meta = META[kind ?? ''] ?? null;
    const metricKey: MetricKey | null = meta ? HISTORY_METRIC[kind as keyof typeof HISTORY_METRIC] ?? null : null;
    const loggable = LOGGABLE.has(kind ?? '');
    const tint = metricKey ? metricTint(metricKey, Palette) : Palette.primary;
    const units = useUnits();
    const [history, setHistory] = useState<MetricHistory | null>(null);

    /**
     * The unit this screen draws in, and the function that gets a stored value there.
     *
     * Blood pressure has no alternative unit (see `lib/units.ts`), so it falls through to
     * the identity — which is also what any metric added later does until someone teaches
     * `lib/units.ts` about it.
     */
    const shownUnit = kind === 'weight' ? unitLabel('weight', units) : history?.unit ?? meta?.unit ?? '';
    const toShown = (value: number) => (kind === 'weight' ? displayWeight(value, units) : value);

    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (d: number) => {
        if (!meta) { setLoading(false); return; }
        try {
            setHistory(await getHistory(kind as HistoryKind, d));
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [kind, meta, router]);

    useFocusEffect(useCallback(() => { load(days); }, [load, days]));

    const remove = useCallback((log: MetricLog) => {
        Alert.alert('Remove this entry?', 'It will be deleted from your record.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteLog(log._id);
                        await load(days);
                        Toast.show({ type: 'success', text1: 'Entry removed' });
                    } catch {
                        Toast.show({ type: 'error', text1: 'Could not remove that entry' });
                    }
                },
            },
        ]);
    }, [days, load]);

    if (!meta) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><Text style={styles.muted}>Unknown metric.</Text></View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    const chartWidth = width - Spacing.lg * 2 - Spacing.md * 2;
    const summary = history?.summary;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{history?.label ?? meta.title}</Text>
                {/* Only a kind somebody can enter by hand gets a "+". The rest keep the slot. */}
                {meta.logRoute ? (
                    <TouchableOpacity
                        onPress={() => router.push(meta.logRoute as never)}
                        hitSlop={12}
                        accessibilityLabel={`Log ${meta.title.toLowerCase()}`}
                    >
                        <Ionicons name="add-circle" size={26} color={tint} />
                    </TouchableOpacity>
                ) : <View style={styles.headerSpacer} />}
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(days); setRefreshing(false); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                {/* Blood pressure leads with the mean AND the worst. */}
                {kind === 'blood-pressure' && summary && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Over {days} days</Text>
                        <Text style={styles.big}>
                            {summary.mean.systolic}/{summary.mean.diastolic}
                            <Text style={styles.bigUnit}> mmHg average</Text>
                        </Text>
                        <View style={[styles.pill, { backgroundColor: `${tone(summary.mean.category.colour)}22` }]}>
                            <View style={[styles.dot, { backgroundColor: tone(summary.mean.category.colour) }]} />
                            <Text style={[styles.pillText, { color: tone(summary.mean.category.colour) }]}>
                                {summary.mean.category.label}
                            </Text>
                        </View>

                        {summary.meanPulse && (
                            <Text style={styles.hint}>Average pulse {summary.meanPulse} bpm.</Text>
                        )}

                        {/*
                          * The worst reading, whenever it was worse than the average. This is
                          * the line that stops a fortnight with one crisis reading in it from
                          * reading as an unremarkable fortnight.
                          */}
                        {summary.worst && summary.worst.category.key !== summary.mean.category.key && (
                            <View style={[styles.worstBox, summary.hadCrisis && styles.worstBoxUrgent]}>
                                <Ionicons
                                    name={summary.hadCrisis ? 'warning' : 'alert-circle-outline'}
                                    size={16}
                                    color={summary.hadCrisis ? '#FFFFFF' : tone(summary.worst.category.colour)}
                                />
                                <Text style={[styles.worstText, summary.hadCrisis && styles.worstTextUrgent]}>
                                    Your highest reading was {summary.worst.systolic}/{summary.worst.diastolic} —
                                    {' '}{summary.worst.category.label.toLowerCase()}. An average can hide a reading like that.
                                </Text>
                            </View>
                        )}

                        <Text style={styles.hint}>{summary.note}</Text>
                    </View>
                )}

                {!loggable && (
                    <DeviceSummary
                        history={history}
                        days={days}
                        unit={shownUnit}
                        tint={tint}
                        icon={metricKey ? metricIcon(metricKey) : 'stats-chart-outline'}
                    />
                )}

                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>Trend</Text>
                        <View style={styles.rangeRow}>
                            {RANGES.map((r) => (
                                <TouchableOpacity
                                    key={r.key}
                                    style={[styles.rangeChip, days === r.key && { backgroundColor: tint }]}
                                    onPress={() => setDays(r.key)}
                                >
                                    <Text style={[styles.rangeText, days === r.key && styles.rangeTextActive]}>{r.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {history && history.series.some((p) => p.value !== null) ? (
                        <MetricAreaChart
                            points={history.series.map((p) => ({
                                day: p.day,
                                value: p.value === null ? null : toShown(p.value),
                            }))}
                            width={chartWidth}
                            height={160}
                            color={tint}
                            unit={shownUnit}
                            maxXLabels={days <= 7 ? 7 : 6}
                        />
                    ) : (
                        <Text style={styles.empty}>Nothing logged in this period yet.</Text>
                    )}
                </View>

                <Text style={styles.sectionTitle}>{kind === 'sleep' ? 'All sleeps' : 'All entries'}</Text>
                {loggable ? (
                    history?.logs.length ? (
                        <View style={styles.card}>
                            {history.logs.map((log, i) => (
                                <LogRow
                                    key={log._id}
                                    log={log}
                                    kind={kind as string}
                                    last={i === history.logs.length - 1}
                                    units={units}
                                    onDelete={() => remove(log)}
                                />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.empty}>No entries yet. Tap + to add one.</Text>
                        </View>
                    )
                ) : (
                    <DeviceEntries
                        entries={history?.entries ?? []}
                        truncated={!!history?.truncated}
                        onOpen={(route) => router.push(route as never)}
                    />
                )}

                {metricKey && (
                    <MoreLinks
                        title={history?.label ?? meta.title}
                        insightRoute={METRIC_INSIGHT_ROUTE(metricKey)}
                        source={METRIC_SOURCE_LINK[metricKey]}
                        tint={tint}
                        onOpen={(route) => router.push(route as never)}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

/**
 * The device-fed summary: the latest figure, then the window's average beside its lowest and
 * highest — the same reason the blood-pressure card shows its worst reading.
 */
const DeviceSummary = ({ history, days, unit, tint, icon }: {
    history: MetricHistory | null; days: number; unit: string; tint: string; icon: string;
}) => {
    const styles = useStyles();
    const stats = history?.stats;

    return (
        <View style={styles.card}>
            <View style={styles.summaryHead}>
                <View style={[styles.summaryIcon, { backgroundColor: `${tint}22` }]}>
                    <Ionicons name={icon as never} size={18} color={tint} />
                </View>
                <Text style={styles.cardTitle}>Over {days} days</Text>
            </View>

            {stats ? (
                <>
                    <Text style={styles.big}>{formatValue(stats.latest.value, unit)}</Text>
                    <Text style={styles.hint}>Latest · {dayLabel(stats.latest.day, localToday())}</Text>
                    <View style={styles.statRow}>
                        <Stat label="Daily average" value={formatValue(stats.average, unit)} />
                        <Stat label="Lowest" value={formatValue(stats.min, unit)} />
                        <Stat label="Highest" value={formatValue(stats.max, unit)} />
                    </View>
                    <Text style={styles.hint}>
                        {stats.daysWithData} of {days} days reported.
                    </Text>
                </>
            ) : (
                <Text style={styles.muted}>Nothing recorded in this period.</Text>
            )}

            {history?.note ? <Text style={styles.hint}>{history.note}</Text> : null}
        </View>
    );
};

const Stat = ({ label, value }: { label: string; value: string }) => {
    const styles = useStyles();
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
};

/**
 * Individual readings are grouped under their day — "Today", "Yesterday", then dates — the
 * way the hydration and sleep histories group theirs. A per-day metric (HRV, steps) is one row
 * a day already, so its rows carry the date themselves and are not grouped a second time.
 * Days are `entry.day`, the server's local day, never re-derived from the timestamp.
 */
const DeviceEntries = ({ entries, truncated, onOpen }: {
    entries: HistoryEntry[]; truncated: boolean; onOpen: (route: string) => void;
}) => {
    const styles = useStyles();
    const now = localToday();

    if (!entries.length) {
        return (
            <View style={styles.card}>
                <Text style={styles.empty}>
                    Nothing recorded in this period. Readings appear here when your phone or
                    bracelet syncs.
                </Text>
            </View>
        );
    }

    const perDay = entries.every((e) => e.perDay);
    const groups: { day: string; rows: HistoryEntry[] }[] = [];
    for (const e of entries) {
        const last = groups[groups.length - 1];
        if (!perDay && last?.day === e.day) last.rows.push(e);
        else groups.push({ day: e.day, rows: [e] });
    }

    return (
        <>
            {perDay ? (
                <View style={styles.card}>
                    {entries.map((e, i) => (
                        <EntryRow key={e.id} entry={e} when={dayLabel(e.day, now)} last={i === entries.length - 1} onOpen={onOpen} />
                    ))}
                </View>
            ) : groups.map((g) => (
                <View key={g.day} style={styles.group}>
                    <Text style={styles.groupTitle}>{dayLabel(g.day, now)}</Text>
                    <View style={styles.card}>
                        {g.rows.map((e, i) => (
                            <EntryRow
                                key={e.id}
                                entry={e}
                                when={e.at && e.end ? `${formatTime(e.at)} – ${formatTime(e.end)}` : e.at ? formatTime(e.at) : ''}
                                last={i === g.rows.length - 1}
                                onOpen={onOpen}
                            />
                        ))}
                    </View>
                </View>
            ))}
            {truncated && <Text style={styles.hint}>Showing the latest {entries.length}. Pick a shorter range to see every reading.</Text>}
        </>
    );
};

const EntryRow = ({ entry, when, last, onOpen }: {
    entry: HistoryEntry; when: string; last: boolean; onOpen: (route: string) => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    const meta = [when, entry.label, entry.detail].filter(Boolean).join(' · ');
    const body = (
        <>
            <View style={styles.flex}>
                <Text style={styles.logValue}>{formatValue(entry.value, entry.unit)}</Text>
                {meta ? <Text style={styles.logWhen}>{meta}</Text> : null}
            </View>
            {entry.route && <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />}
        </>
    );

    // Only a row with somewhere to go is a button; the rest are not dressed as one.
    return entry.route ? (
        <TouchableOpacity
            style={[styles.logRow, !last && styles.logDivider]}
            onPress={() => onOpen(entry.route as string)}
            accessibilityRole="button"
        >
            {body}
        </TouchableOpacity>
    ) : (
        <View style={[styles.logRow, !last && styles.logDivider]}>{body}</View>
    );
};

/**
 * The foot of every history: its insight, and the tracker the numbers come from. Offered
 * after the entries rather than instead of them — the card promised a history, so that comes
 * first, and these are where someone goes next.
 */
const MoreLinks = ({ title, insightRoute, source, tint, onOpen }: {
    title: string;
    insightRoute: string;
    source?: { label: string; route: string; icon: string };
    tint: string;
    onOpen: (route: string) => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.card}>
            <TouchableOpacity
                style={[styles.linkRow, source && styles.logDivider]}
                onPress={() => onOpen(insightRoute)}
                accessibilityRole="link"
            >
                <View style={[styles.summaryIcon, { backgroundColor: Palette.borderLight }]}>
                    <Ionicons name="analytics-outline" size={18} color={Palette.primary} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.linkTitle}>See {title.toLowerCase()} insights</Text>
                    <Text style={styles.logWhen}>What your readings show over time</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
            </TouchableOpacity>

            {source && (
                <TouchableOpacity style={styles.linkRow} onPress={() => onOpen(source.route)} accessibilityRole="link">
                    <View style={[styles.summaryIcon, { backgroundColor: Palette.borderLight }]}>
                        <Ionicons name={source.icon as never} size={18} color={Palette.textSecondary} />
                    </View>
                    <Text style={[styles.linkTitle, styles.flex]}>{source.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const LogRow = ({ log, kind, last, units, onDelete }: {
    log: MetricLog; kind: string; last: boolean; units: UnitPrefs; onDelete: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    const when = new Date(log.measuredAt);
    // Converted for display only — `log.weightKg` and `log.ml` are what the record holds.
    const value = kind === 'weight'
        ? `${displayWeight(log.weightKg as number, units)} ${unitLabel('weight', units)}`
        : `${log.systolic}/${log.diastolic} mmHg`;

    return (
        <View style={[styles.logRow, !last && styles.logDivider]}>
            <View style={styles.flex}>
                <Text style={styles.logValue}>{value}</Text>
                <Text style={styles.logWhen}>
                    {when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {' · '}
                    {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {log.pulse ? ` · ${log.pulse} bpm` : ''}
                </Text>
            </View>

            {/*
              * The category the reading was given when it was taken — read from the stored
              * key, never reclassified. A guideline revision must not silently restage a
              * reading someone was already shown. See `MetricLog.category`.
              */}
            {log.category && (
                <View style={[styles.pill, { backgroundColor: `${tone(log.category.colour)}22` }]}>
                    <Text style={[styles.pillText, { color: tone(log.category.colour) }]}>{log.category.label}</Text>
                </View>
            )}

            <TouchableOpacity onPress={onDelete} hitSlop={10} accessibilityLabel="Remove entry">
                <Ionicons name="trash-outline" size={17} color={Palette.textMuted} />
            </TouchableOpacity>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    muted: { ...BodyFont.regular, fontSize: 14, color: Palette.textMuted },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    headerSpacer: { width: 26 },
    content: { padding: Spacing.lg, paddingTop: 0, paddingBottom: Spacing.xl * 2, gap: Spacing.md },

    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    big: { fontFamily: Fonts.bold, fontSize: 30, color: Palette.text },
    bigUnit: { ...BodyFont.medium, fontSize: 14, color: Palette.textMuted },
    hint: { ...BodyFont.regular, fontSize: 11, color: Palette.textMuted, lineHeight: 16 },

    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
    pillText: { fontFamily: Fonts.semibold, fontSize: 11 },
    dot: { width: 7, height: 7, borderRadius: 4 },

    worstBox: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: Palette.borderLight, borderRadius: Radius.md, padding: Spacing.sm,
    },
    worstBoxUrgent: { backgroundColor: Palette.dangerFill },
    worstText: { flex: 1, ...BodyFont.medium, fontSize: 12, color: Palette.text, lineHeight: 17 },
    worstTextUrgent: { color: Palette.white },

    rangeRow: { flexDirection: 'row', gap: 5 },
    rangeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: Palette.borderLight },
    rangeText: { ...BodyFont.medium, fontSize: 11, color: Palette.textSecondary },
    rangeTextActive: { color: Palette.white },

    sectionTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text, marginTop: Spacing.xs },
    empty: { ...BodyFont.regular, fontSize: 12, color: Palette.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

    logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    logDivider: { borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    logValue: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },

    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    stat: { flex: 1, backgroundColor: Palette.canvas, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: 8 },
    statValue: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    statLabel: { ...BodyFont.regular, fontSize: 11, color: Palette.textMuted, marginTop: 2 },

    group: { gap: Spacing.xs },
    groupTitle: { ...BodyFont.semibold, fontSize: 12, color: Palette.textSecondary, marginLeft: 4 },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    linkTitle: { ...BodyFont.medium, fontSize: 14, color: Palette.text },
    logWhen: { ...BodyFont.regular, fontSize: 11, color: Palette.textMuted, marginTop: 2 },
}));
