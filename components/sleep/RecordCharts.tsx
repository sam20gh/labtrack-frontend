/**
 * The Sleep Record's four charts — `app/sleep/record.tsx`.
 *
 * - `StackedSleepBars`: one bar per night (or typical night per week / month), stacked
 *   deep → light → REM → no-stage-data, awake on top, a nap floating above a wider gap.
 * - `DayTimeline`: a single day as a ribbon on a clock — the night in its stages, then the
 *   naps, at their real times.
 * - `CompositionBar`: where a typical night goes, as one 100% bar with its legend.
 * - `SleepWindowChart`: when somebody was asleep, as floating bars from bedtime to wake,
 *   shaded from night into dawn.
 *
 * Four rules they share with `SleepCharts.tsx`:
 *
 * 1. **A day with no data has no bar**, never a bar on the floor.
 * 2. **Stacked bars start at zero.** A compressed axis is right for one bar per weekday
 *    (`WeekdayBars` does it), and wrong for a stack: lifting the floor cuts the deep segment
 *    off first, which is the one people are looking for.
 * 3. **Colour carries identity, text carries value.** Every figure is printed in text ink
 *    beside its swatch — light and awake are under 3:1 against white, so a legend of dots
 *    alone would not be readable.
 * 4. **Views, not a chart library.** Every chart here is a flex row of rectangles; the one
 *    gradient is `expo-linear-gradient`, already a dependency. A new package would move the
 *    fingerprint and strand every installed build — the fourth trap in `CLAUDE.md`.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette, Fonts, Spacing, BodyFont } from '@/constants/theme';
import {
    STAGE_META, NAP_META, UNSTAGED_META, formatMinutes, formatClock,
    type SleepRecordBar, type RecordBucket, type SleepRecord, type SleepStageKey,
} from '@/lib/sleep';

const finite = (v: unknown): v is number => Number.isFinite(v as number);

const monthShort = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short' });

/** `10p`, `6a` — axis ticks are hours, not times. */
export const clockTick = (minutes: number): string => {
    const h24 = Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h}${h24 >= 12 ? 'p' : 'a'}`;
};

export const barHasData = (b: SleepRecordBar) => finite(b.asleepMin) || b.napCount > 0;

/**
 * Tick labels under a row of bars, one per bar or null. Counted back from the newest so the
 * bar people look at first is always labelled.
 */
export function barLabels(bars: SleepRecordBar[], bucket: RecordBucket): (string | null)[] {
    const n = bars.length;
    const every = bucket === 'day'
        ? (n <= 7 ? 1 : n <= 14 ? 2 : 5)
        : bucket === 'week' ? 9 : Math.max(1, Math.ceil(n / 6));

    return bars.map((bar, i) => {
        if ((n - 1 - i) % every !== 0) return null;
        const date = new Date(`${bar.from}T00:00:00`);
        if (bucket === 'day') {
            return n <= 7
                ? date.toLocaleDateString(undefined, { weekday: 'short' })
                : String(date.getDate());
        }
        if (bucket === 'week') return monthShort(bar.to);
        return date.getMonth() === 0 || i === 0
            ? `${monthShort(bar.from)} ’${String(date.getFullYear()).slice(2)}`
            : monthShort(bar.from);
    });
}

/* ================================================================ stacked bars */

interface StackPiece { key: string; minutes: number; tint: string }

/** Bottom to top. Awake sits above the sleep it interrupted; the nap floats clear of both. */
const piecesOf = (bar: SleepRecordBar): { night: StackPiece[]; nap: StackPiece | null } => {
    const night: StackPiece[] = [];
    const push = (key: string, minutes: number | null, tint: string) => {
        if (finite(minutes) && minutes > 0) night.push({ key, minutes, tint });
    };
    push('deep', bar.deepMin, STAGE_META.deep.tint);
    push('light', bar.lightMin, STAGE_META.light.tint);
    push('rem', bar.remMin, STAGE_META.rem.tint);
    push('unstaged', bar.unstagedMin, UNSTAGED_META.tint);
    push('awake', bar.awakeMin, STAGE_META.awake.tint);
    const nap = finite(bar.napMin) && bar.napMin > 0
        ? { key: 'nap', minutes: bar.napMin, tint: NAP_META.tint }
        : null;
    return { night, nap };
};

const barTotal = (bar: SleepRecordBar) => {
    const { night, nap } = piecesOf(bar);
    return night.reduce((s, p) => s + p.minutes, 0) + (nap?.minutes ?? 0);
};

export function StackedSleepBars({
    bars, bucket, goalMinutes, selected, onSelect, height = 190,
}: {
    bars: SleepRecordBar[];
    bucket: RecordBucket;
    goalMinutes: number | null;
    selected: number | null;
    onSelect: (index: number) => void;
    height?: number;
}) {
    const n = bars.length;
    const peak = Math.max(...bars.map(barTotal), goalMinutes ?? 0, 360);
    const step = peak > 720 ? 240 : 120;
    const ceiling = Math.ceil((peak + 30) / step) * step;
    const px = (minutes: number) => (minutes / ceiling) * height;

    const thin = n > 31;
    const gap = n <= 10 ? 10 : thin ? 2 : 3;
    const segGap = thin ? 1 : 2;
    const napGap = thin ? 2 : 4;
    const radius = thin ? 2 : 4;
    const ticks = Array.from({ length: ceiling / step + 1 }, (_, i) => i * step);
    const labels = barLabels(bars, bucket);

    return (
        <View>
            <View style={styles.plotRow}>
                <View style={[styles.yAxis, { height }]}>
                    {ticks.map((t) => (
                        <Text key={t} style={[styles.yTick, { bottom: px(t) - 6 }]}>{`${t / 60}h`}</Text>
                    ))}
                </View>

                <View style={[styles.plot, { height }]}>
                    {ticks.map((t) => (
                        <View key={t} style={[styles.grid, { bottom: px(t) }, t === 0 && styles.baseline]} />
                    ))}

                    {finite(goalMinutes) && goalMinutes > 0 ? (
                        <View style={[styles.goalLine, { bottom: px(goalMinutes) }]} pointerEvents="none">
                            <View style={styles.goalDash} />
                            <Text style={styles.goalTag}>{`Goal ${formatMinutes(goalMinutes)}`}</Text>
                        </View>
                    ) : null}

                    <View style={[styles.bars, { gap }]}>
                        {bars.map((bar, i) => {
                            const has = barHasData(bar);
                            const { night, nap } = piecesOf(bar);
                            const dim = selected !== null && selected !== i;
                            const top = [...night].reverse();
                            return (
                                <Pressable
                                    key={bar.from}
                                    style={styles.column}
                                    disabled={!has}
                                    onPress={() => onSelect(i)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: selected === i }}
                                    accessibilityLabel={has
                                        ? `${bar.from}: ${formatMinutes(bar.asleepMin)} asleep${bar.napMin ? `, ${formatMinutes(bar.napMin)} napping` : ''}`
                                        : `${bar.from}: nothing recorded`}
                                >
                                    <View style={[styles.stack, { opacity: dim ? 0.3 : 1 }, n <= 10 && { maxWidth: 30 }]}>
                                        {nap ? (
                                            <View
                                                style={{
                                                    height: Math.max(2, px(nap.minutes)),
                                                    backgroundColor: nap.tint,
                                                    borderRadius: radius,
                                                    marginBottom: napGap,
                                                }}
                                            />
                                        ) : null}
                                        {top.map((p, k) => (
                                            <View
                                                key={p.key}
                                                style={{
                                                    height: Math.max(1, px(p.minutes) - (k < top.length - 1 ? segGap : 0)),
                                                    marginBottom: k < top.length - 1 ? segGap : 0,
                                                    backgroundColor: p.tint,
                                                    borderTopLeftRadius: k === 0 ? radius : 0,
                                                    borderTopRightRadius: k === 0 ? radius : 0,
                                                }}
                                            />
                                        ))}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>

            <View style={[styles.xRow, { gap }]}>
                {labels.map((label, i) => (
                    <View key={`x-${bars[i].from}`} style={styles.xCell}>
                        {label ? (
                            <Text
                                numberOfLines={1}
                                style={[styles.xTick, selected === i && styles.xTickActive]}
                            >
                                {label}
                            </Text>
                        ) : null}
                    </View>
                ))}
            </View>
        </View>
    );
}

/** The legend under the stack: only what the window actually contains, in stack order. */
export function StackLegend({ bars }: { bars: SleepRecordBar[] }) {
    const any = (pick: (b: SleepRecordBar) => number | null) => bars.some((b) => finite(pick(b)) && (pick(b) as number) > 0);
    const items: { label: string; tint: string }[] = [];
    if (any((b) => b.deepMin)) items.push(STAGE_META.deep);
    if (any((b) => b.lightMin)) items.push(STAGE_META.light);
    if (any((b) => b.remMin)) items.push(STAGE_META.rem);
    if (any((b) => b.unstagedMin)) items.push(UNSTAGED_META);
    if (any((b) => b.awakeMin)) items.push(STAGE_META.awake);
    if (any((b) => b.napMin)) items.push(NAP_META);
    if (!items.length) return null;

    return (
        <View style={styles.legend}>
            {items.map((item) => (
                <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.swatch, { backgroundColor: item.tint }]} />
                    <Text style={styles.legendText}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
}

/* ================================================================ day timeline */

type Timeline = NonNullable<SleepRecord['timeline']>;

/**
 * One day on a clock. The night is drawn from its segments when it has them; a night
 * without them, and every nap, is one solid block — the time is real even where the stages
 * are not, and inventing a sequence for them is what `Hypnogram` refuses to do.
 */
export function DayTimeline({ sessions }: { sessions: Timeline }) {
    if (!sessions.length) return null;
    const HOUR = 3_600_000;
    const start = Math.floor(Math.min(...sessions.map((s) => new Date(s.startedAt).getTime())) / HOUR) * HOUR;
    const end = Math.ceil(Math.max(...sessions.map((s) => new Date(s.endedAt).getTime())) / HOUR) * HOUR;
    const span = Math.max(end - start, HOUR);
    const pct = (t: number) => `${((t - start) / span) * 100}%` as const;
    const hours = span / HOUR;
    const every = hours <= 10 ? 2 : hours <= 18 ? 3 : 4;

    const ticks: number[] = [];
    for (let t = start; t <= end; t += HOUR * every) ticks.push(t);

    const tintOf = (kind: 'night' | 'nap', stage: string) => {
        if (kind === 'nap') return NAP_META.tint;
        return STAGE_META[stage as SleepStageKey]?.tint ?? UNSTAGED_META.tint;
    };

    return (
        <View>
            <View style={styles.ribbon}>
                {ticks.map((t) => (
                    <View key={t} style={[styles.ribbonTick, { left: pct(t) }]} />
                ))}
                {sessions.map((s) => {
                    const sStart = new Date(s.startedAt).getTime();
                    const sEnd = new Date(s.endedAt).getTime();
                    const width = `${((sEnd - sStart) / span) * 100}%` as const;
                    const staged = s.kind === 'night' && s.segments.length > 0;
                    return (
                        <View
                            key={s.id}
                            style={[
                                styles.ribbonSession,
                                { left: pct(sStart), width },
                                !staged && { backgroundColor: s.kind === 'nap' ? NAP_META.tint : Palette.primary },
                            ]}
                        >
                            {staged ? s.segments.map((seg) => {
                                const a = new Date(seg.startedAt).getTime();
                                const b = new Date(seg.endedAt).getTime();
                                return (
                                    <View
                                        key={seg.startedAt}
                                        style={{
                                            position: 'absolute', top: 0, bottom: 0,
                                            left: `${((a - sStart) / (sEnd - sStart)) * 100}%`,
                                            width: `${((b - a) / (sEnd - sStart)) * 100}%`,
                                            backgroundColor: tintOf(s.kind, seg.stage),
                                        }}
                                    />
                                );
                            }) : null}
                        </View>
                    );
                })}
            </View>
            <View style={styles.ribbonAxis}>
                {ticks.map((t) => (
                    <Text key={t} style={[styles.ribbonLabel, { left: pct(t) }]}>
                        {clockTick(new Date(t).getHours() * 60)}
                    </Text>
                ))}
            </View>
        </View>
    );
}

/* ================================================================ composition */

const COMPOSITION: SleepStageKey[] = ['deep', 'light', 'rem', 'awake'];

/** Where a typical night goes. Shares are the server's, so they match Sleep Insight's donut. */
export function CompositionBar({
    stages,
}: {
    stages: Record<SleepStageKey, { avgMin: number | null; share: number | null }>;
}) {
    const rows = COMPOSITION.filter((k) => finite(stages[k].share) && (stages[k].share as number) > 0);
    if (!rows.length) return null;

    return (
        <View style={{ gap: Spacing.md }}>
            <View style={styles.compBar}>
                {rows.map((k, i) => (
                    <View
                        key={k}
                        style={{
                            flex: stages[k].share as number,
                            backgroundColor: STAGE_META[k].tint,
                            marginLeft: i ? 2 : 0,
                        }}
                    />
                ))}
            </View>
            {COMPOSITION.map((k) => (
                <View key={k} style={styles.compRow}>
                    <View style={[styles.swatch, { backgroundColor: STAGE_META[k].tint }]} />
                    <Text style={styles.compLabel}>{STAGE_META[k].label}</Text>
                    <Text style={styles.compValue}>
                        {finite(stages[k].avgMin) ? `${formatMinutes(stages[k].avgMin)} / night` : 'Not reported'}
                    </Text>
                    <Text style={styles.compShare}>
                        {finite(stages[k].share) ? `${Math.round(stages[k].share as number)}%` : ''}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/* ================================================================ sleep window */

/** Minutes since 18:00, so a night reads top to bottom without wrapping at midnight. */
const fold = (m: number) => (((m - 1080) % 1440) + 1440) % 1440;

/**
 * When somebody was asleep: each bar runs from bedtime (top) to wake (bottom), shaded from
 * the deep violet of the night into the amber of the morning. The dashed lines are the
 * circular averages the server computed — never a plain mean, which puts a 23:40 and a 00:20
 * bedtime at noon.
 */
export function SleepWindowChart({
    bars, bucket, bedtimeMin, wakeMin, height = 170,
}: {
    bars: SleepRecordBar[];
    bucket: RecordBucket;
    bedtimeMin: number | null;
    wakeMin: number | null;
    height?: number;
}) {
    const drawn = bars.map((b) => (finite(b.bedtimeMin) && finite(b.wakeMin) && fold(b.wakeMin) > fold(b.bedtimeMin)
        ? { top: fold(b.bedtimeMin), bottom: fold(b.wakeMin) }
        : null));
    const valid = drawn.filter(Boolean) as { top: number; bottom: number }[];
    if (valid.length < 2) return null;

    const lo = Math.floor((Math.min(...valid.map((v) => v.top)) - 30) / 60) * 60;
    const hi = Math.ceil((Math.max(...valid.map((v) => v.bottom)) + 30) / 60) * 60;
    const span = hi - lo;
    const y = (m: number) => ((m - lo) / span) * height;
    const tickStep = span > 720 ? 180 : 120;
    const ticks: number[] = [];
    for (let t = lo; t <= hi; t += tickStep) ticks.push(t);

    const n = bars.length;
    const gap = n <= 10 ? 10 : n > 31 ? 2 : 3;
    const labels = barLabels(bars, bucket);

    const guide = (m: number | null, label: string) => (finite(m) ? (
        <View style={[styles.windowGuide, { top: y(fold(m)) }]} pointerEvents="none">
            <View style={styles.goalDash} />
            <Text style={styles.windowGuideTag}>{`${label} ${formatClock(m)}`}</Text>
        </View>
    ) : null);

    return (
        <View>
            <View style={styles.plotRow}>
                <View style={[styles.yAxis, { height }]}>
                    {ticks.map((t) => (
                        <Text key={t} style={[styles.yTick, { top: y(t) - 6 }]}>{clockTick(t + 1080)}</Text>
                    ))}
                </View>
                <View style={[styles.plot, { height }]}>
                    {ticks.map((t) => (
                        <View key={t} style={[styles.grid, { top: y(t) }]} />
                    ))}
                    <View style={[styles.bars, { gap, alignItems: 'stretch' }]}>
                        {drawn.map((d, i) => (
                            <View key={bars[i].from} style={styles.column}>
                                {d ? (
                                    <LinearGradient
                                        colors={[STAGE_META.deep.tint, STAGE_META.rem.tint, STAGE_META.awake.tint]}
                                        style={[
                                            styles.windowBar,
                                            { top: y(d.top), height: Math.max(3, y(d.bottom) - y(d.top)) },
                                            n <= 10 && { maxWidth: 30 },
                                            n > 31 && { borderRadius: 2 },
                                        ]}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </View>
                    {guide(bedtimeMin, 'Bed')}
                    {guide(wakeMin, 'Up')}
                </View>
            </View>
            <View style={[styles.xRow, { gap }]}>
                {labels.map((label, i) => (
                    <View key={`w-${bars[i].from}`} style={styles.xCell}>
                        {label ? <Text numberOfLines={1} style={styles.xTick}>{label}</Text> : null}
                    </View>
                ))}
            </View>
        </View>
    );
}

const Y_AXIS = 28;

const styles = StyleSheet.create({
    plotRow: { flexDirection: 'row' },
    yAxis: { width: Y_AXIS, position: 'relative' },
    yTick: {
        position: 'absolute', left: 0, fontSize: 10, lineHeight: 12,
        ...BodyFont.medium, color: Palette.textMuted,
    },
    plot: { flex: 1, position: 'relative' },
    grid: {
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundColor: Palette.borderLight,
    },
    baseline: { backgroundColor: Palette.borderSlate },
    bars: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row', alignItems: 'flex-end',
    },
    column: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
    stack: { width: '100%', justifyContent: 'flex-end' },

    goalLine: {
        position: 'absolute', left: 0, right: 0, zIndex: 3,
        flexDirection: 'row', alignItems: 'center',
    },
    goalDash: {
        flex: 1, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Palette.text,
        opacity: 0.55,
    },
    goalTag: {
        fontSize: 9, fontFamily: Fonts.bold, color: Palette.white, backgroundColor: Palette.text,
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
        transform: [{ translateY: -8 }],
    },

    xRow: { flexDirection: 'row', marginLeft: Y_AXIS, marginTop: 6 },
    xCell: { flex: 1, alignItems: 'center', overflow: 'visible' },
    xTick: {
        fontSize: 10, ...BodyFont.medium, color: Palette.textMuted,
        width: 44, textAlign: 'center',
    },
    xTickActive: { color: Palette.text, fontFamily: Fonts.bold },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, rowGap: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },

    ribbon: {
        height: 34, borderRadius: 10, backgroundColor: Palette.borderLight,
        position: 'relative', overflow: 'hidden',
    },
    ribbonTick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: Palette.borderSlate },
    ribbonSession: {
        position: 'absolute', top: 5, bottom: 5, borderRadius: 6, overflow: 'hidden',
    },
    ribbonAxis: { height: 16, position: 'relative', marginTop: 4 },
    ribbonLabel: {
        position: 'absolute', fontSize: 10, ...BodyFont.medium, color: Palette.textMuted,
        width: 30, marginLeft: -15, textAlign: 'center',
    },

    compBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' },
    compRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    compLabel: { flex: 1, fontSize: 14, ...BodyFont.medium, color: Palette.text },
    compValue: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    compShare: {
        width: 40, textAlign: 'right', fontSize: 12, ...BodyFont.medium,
        color: Palette.textSecondary,
    },

    windowBar: { position: 'absolute', width: '100%', borderRadius: 5 },
    windowGuide: {
        position: 'absolute', left: 0, right: 0, zIndex: 3,
        flexDirection: 'row', alignItems: 'center',
    },
    windowGuideTag: {
        fontSize: 9, fontFamily: Fonts.bold, color: Palette.text, backgroundColor: Palette.background,
        paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
        borderWidth: 1, borderColor: Palette.borderSlate, transform: [{ translateY: -1 }],
    },
});
