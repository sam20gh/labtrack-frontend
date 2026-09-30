/**
 * Cycle insight — lengths against the usual band, which symptoms arrive when, how the
 * predictions have done, and the night-time temperature from the bracelet.
 *
 * The temperature chart is the bracelet's part in this feature, and it is drawn more humbly
 * than it could be. Nights are plotted as they were measured — the median wrist reading inside
 * each night's sleep — with period starts marked. What it may *mean* (a rise after ovulation)
 * is marked only when the server's `CYCLE_TEMPERATURE_SIGNAL` is on, which it stays off until
 * real bracelet data has shown the shift is visible at all. Until then the chart says plainly
 * that nothing is concluded from it.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState } from '@/components/errors';
import { getCycleInsight, symptomLabel, diffDays, formatDay, type CycleInsight } from '@/lib/cycle';
import { ApiError } from '@/lib/api';

/** [1,2,3,6] → "days 1–3 and 6". */
const describeDays = (days: number[]): string => {
    const runs: string[] = [];
    let start = days[0];
    for (let i = 1; i <= days.length; i += 1) {
        if (days[i] !== days[i - 1] + 1) {
            runs.push(start === days[i - 1] ? `${start}` : `${start}–${days[i - 1]}`);
            start = days[i];
        }
    }
    const single = days.length === 1;
    const joined = runs.length > 1 ? `${runs.slice(0, -1).join(', ')} and ${runs[runs.length - 1]}` : runs[0];
    return `${single ? 'day' : 'days'} ${joined}`;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const styles = useStyles();
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
}

function LengthChart({ data, width }: { data: CycleInsight; width: number }) {
    const Palette = usePalette();
    const height = 150;
    const pad = { l: 26, r: 8, t: 8, b: 20 };
    const cycles = data.cycles.filter((c) => c.usable);
    const max = Math.max(45, ...cycles.map((c) => c.length));
    const min = 15;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
    const slot = (width - pad.l - pad.r) / Math.max(cycles.length, 1);
    const barW = Math.min(22, slot * 0.6);
    return (
        <Svg width={width} height={height} accessibilityLabel={`Cycle lengths: ${cycles.map((c) => c.length).join(', ')} days`}>
            <Rect x={pad.l} y={y(data.normal.cycleMax)} width={width - pad.l - pad.r} height={y(data.normal.cycleMin) - y(data.normal.cycleMax)} fill={Palette.borderLight} />
            {[data.normal.cycleMin, data.normal.cycleMax].map((v) => (
                <SvgText key={v} x={pad.l - 4} y={y(v) + 4} fontSize={10} fill={Palette.textMuted} textAnchor="end">{v}</SvgText>
            ))}
            {cycles.map((c, i) => {
                const x = pad.l + i * slot + (slot - barW) / 2;
                return (
                    <React.Fragment key={c.start}>
                        <Rect x={x} y={y(c.length)} width={barW} height={height - pad.b - y(c.length)} rx={4} fill={Palette.cycleFill} />
                        <SvgText x={x + barW / 2} y={height - 6} fontSize={10} fill={Palette.textSecondary} textAnchor="middle">{c.length}</SvgText>
                    </React.Fragment>
                );
            })}
        </Svg>
    );
}

function TemperatureChart({ data, width }: { data: CycleInsight['temperature']; width: number }) {
    const Palette = usePalette();
    const height = 150;
    const pad = { l: 34, r: 8, t: 10, b: 18 };
    const values = data.nights.map((n) => n.celsius);
    const lo = Math.min(...values) - 0.1;
    const hi = Math.max(...values) + 0.1;
    const span = Math.max(1, diffDays(data.from, data.nights[data.nights.length - 1].day));
    const x = (day: string) => pad.l + (diffDays(data.from, day) / span) * (width - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
    // Gaps stay gaps: a missing night breaks the line rather than being drawn through.
    let path = '';
    data.nights.forEach((n, i) => {
        const gap = i > 0 && diffDays(data.nights[i - 1].day, n.day) > 1;
        path += `${i === 0 || gap ? 'M' : 'L'} ${x(n.day)} ${y(n.celsius)} `;
    });
    return (
        <Svg width={width} height={height} accessibilityLabel={`Night temperatures from ${formatDay(data.from)}, ${data.nights.length} nights`}>
            {[lo + 0.1, hi - 0.1].map((v) => (
                <SvgText key={v} x={pad.l - 4} y={y(v) + 4} fontSize={10} fill={Palette.textMuted} textAnchor="end">{v.toFixed(1)}</SvgText>
            ))}
            {data.periodStarts.map((d) => (
                <Line key={d} x1={x(d)} x2={x(d)} y1={pad.t} y2={height - pad.b} stroke={Palette.cycle} strokeWidth={1.5} strokeDasharray="3 3" />
            ))}
            <Path d={path} fill="none" stroke={Palette.textSecondary} strokeWidth={1.5} />
            {data.nights.map((n) => <Circle key={n.day} cx={x(n.day)} cy={y(n.celsius)} r={2} fill={Palette.textSecondary} />)}
            {data.signal ? data.confirmedOvulations.filter((d) => d >= data.from).map((d) => (
                <Line key={d} x1={x(d)} x2={x(d)} y1={pad.t} y2={height - pad.b} stroke={Palette.teal} strokeWidth={2} />
            )) : null}
        </Svg>
    );
}

export default function CycleInsightScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [data, setData] = useState<CycleInsight | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const chartWidth = width - Spacing.xl * 2 - Spacing.lg * 2;

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await getCycleInsight());
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const header = (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">Insight</Text>
        </View>
    );

    if (loading) {
        return <SafeAreaView style={styles.screen} edges={['top']}>{header}<View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View></SafeAreaView>;
    }
    if (error || !data) {
        return <SafeAreaView style={styles.screen} edges={['top']}>{header}<ErrorState error={error} subject="your cycle insight" onRetry={load} /></SafeAreaView>;
    }

    const usable = data.cycles.filter((c) => c.usable);
    const t = data.temperature;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                <Section title="Cycle length">
                    {usable.length >= 2 ? (
                        <>
                            <LengthChart data={data} width={chartWidth} />
                            <Text style={styles.caption}>The shaded band is the usual 24–38 days.</Text>
                        </>
                    ) : (
                        <Text style={styles.empty}>Log two full cycles to see how their lengths compare.</Text>
                    )}
                </Section>

                <Section title="Symptoms by cycle day">
                    {data.symptoms.length ? data.symptoms.slice(0, 8).map((s) => (
                        <View key={s.symptom} style={styles.symptomRow}>
                            <Text style={styles.symptomName}>{symptomLabel(s.symptom)}</Text>
                            <Text style={styles.symptomWhen}>
                                {s.count === 1
                                    ? `${describeDays(s.peakDays).replace(/^d/, 'D')} · once`
                                    : `Mostly ${describeDays(s.peakDays)} · ${s.count} times`}
                            </Text>
                        </View>
                    )) : (
                        <Text style={styles.empty}>Log symptoms on the days you have them and patterns show up here.</Text>
                    )}
                </Section>

                <Section title="How predictions have done">
                    {data.accuracy ? (
                        <>
                            <Text style={styles.big}>{`${data.accuracy.hits} of ${data.accuracy.checked}`}</Text>
                            <Text style={styles.caption}>
                                recent periods started inside the window we would have predicted from the cycles before them.
                            </Text>
                            <View style={styles.checks}>
                                {data.accuracy.checks.map((c) => (
                                    <View key={c.start} style={styles.check}>
                                        <Ionicons
                                            name={c.hit ? 'checkmark-circle-outline' : 'ellipse-outline'}
                                            size={16}
                                            color={Palette.textSecondary}
                                        />
                                        <Text style={styles.checkText}>
                                            {`${formatDay(c.start)} · ${c.missDays === 0 ? 'on the day' : `${Math.abs(c.missDays)} day${Math.abs(c.missDays) === 1 ? '' : 's'} ${c.missDays > 0 ? 'later' : 'earlier'}`}`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : (
                        <Text style={styles.empty}>After a few cycles we check each prediction against the day your period actually started.</Text>
                    )}
                </Section>

                <Section title="Night-time temperature">
                    {t.nights.length >= 3 ? (
                        <>
                            <TemperatureChart data={t} width={chartWidth} />
                            <Text style={styles.caption}>
                                {t.signal
                                    ? 'Your wrist temperature while asleep, from your bracelet. Dashed lines are period starts; a teal line marks where a rise suggests ovulation had already happened.'
                                    : 'Your wrist temperature while asleep, from your bracelet. Dashed lines are period starts. We are still checking how reliable this signal is, so nothing is concluded from it yet.'}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.empty}>
                            Wear your bracelet to bed and your night-time temperature appears here. It can show the
                            small rise that follows ovulation.
                        </Text>
                    )}
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xl, paddingBottom: Spacing.xxxl },
    section: { gap: Spacing.md },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    card: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.sm,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    caption: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },
    empty: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 19 },
    big: { fontSize: 28, fontFamily: Fonts.bold, color: Palette.text },
    symptomRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: Spacing.md },
    symptomName: { fontSize: 14, ...BodyFont.medium, color: Palette.text },
    symptomWhen: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, flexShrink: 1, textAlign: 'right' },
    checks: { gap: 6, marginTop: Spacing.sm },
    check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    checkText: { fontSize: 13, ...BodyFont.regular, color: Palette.text },
}));
