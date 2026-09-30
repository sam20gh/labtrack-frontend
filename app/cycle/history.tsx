/**
 * Every cycle, newest first, each as a bar: the period in rose, the rest of the cycle in grey,
 * the length at the end.
 *
 * A bar rather than a table row because the thing somebody scans a cycle history for is
 * *shape* — are they about the same, is one much longer — and bars of one scale answer that at
 * a glance where a column of numbers makes them do arithmetic.
 *
 * Two labels, both neutral:
 *   - a cycle outside 24–38 days says so in grey, never in a warning colour;
 *   - a cycle too long to be anything but a gap in logging (over 60 days) says it is not used
 *     for predictions, which is exactly what `cycleForecast.USABLE` does with it.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ErrorState, EmptyState } from '@/components/errors';
import { getCycleHistory, formatDay, addDays, type CycleHistory } from '@/lib/cycle';
import { ApiError } from '@/lib/api';

/** The widest a bar gets, in days. A longer cycle is drawn full-width and labelled. */
const SCALE_DAYS = 45;

export default function CycleHistoryScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [data, setData] = useState<CycleHistory | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await getCycleHistory());
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
            <Text style={styles.headerTitle} accessibilityRole="header">History</Text>
        </View>
    );

    if (loading) {
        return <SafeAreaView style={styles.screen} edges={['top']}>{header}<View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View></SafeAreaView>;
    }
    if (error || !data) {
        return <SafeAreaView style={styles.screen} edges={['top']}>{header}<ErrorState error={error} subject="your cycle history" onRetry={load} /></SafeAreaView>;
    }

    const { stats, accuracy, cycles, openCycle, periods } = data;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.stats}>
                    {[
                        ['Usual cycle', stats.averageCycle],
                        ['Usual period', stats.averagePeriod],
                        ['Cycles logged', stats.cyclesLogged],
                    ].map(([label, value]) => (
                        <View key={label as string} style={styles.stat}>
                            <Text style={styles.statValue}>{value ?? '—'}</Text>
                            <Text style={styles.statLabel}>{label}</Text>
                        </View>
                    ))}
                </View>

                {accuracy ? (
                    <View style={styles.accuracy}>
                        <Ionicons name="checkmark-done-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.accuracyText}>
                            {`Checked against your history, ${accuracy.hits} of your last ${accuracy.checked} periods started inside the window we would have predicted.`}
                        </Text>
                    </View>
                ) : null}

                {openCycle ? (
                    <View style={styles.row}>
                        <View style={styles.rowHead}>
                            <Text style={styles.rowTitle}>Current cycle</Text>
                            <Text style={styles.rowLength}>{`Day ${openCycle.day}`}</Text>
                        </View>
                        <Text style={styles.rowDates}>{`Since ${formatDay(openCycle.start)}`}</Text>
                    </View>
                ) : null}

                {!cycles.length && !periods.length ? (
                    <EmptyState title="Nothing logged yet" body="Your cycles appear here once you have logged a period." />
                ) : null}

                {cycles.map((c) => {
                    const width = Math.min(1, c.length / SCALE_DAYS);
                    const periodShare = Math.min(1, c.periodLength / c.length);
                    return (
                        <View
                            key={c.start}
                            style={styles.row}
                            accessible
                            accessibilityLabel={`Cycle from ${formatDay(c.start)}, ${c.length} days, period ${c.periodLength} days`}
                        >
                            <View style={styles.rowHead}>
                                <Text style={styles.rowDates}>{`${formatDay(c.start)} – ${formatDay(addDays(c.nextStart, -1))}`}</Text>
                                <Text style={styles.rowLength}>{`${c.length} days`}</Text>
                            </View>
                            <View style={styles.track}>
                                <View style={[styles.bar, { width: `${width * 100}%` }]}>
                                    <View style={[styles.barPeriod, { flex: periodShare }]} />
                                    <View style={{ flex: 1 - periodShare }} />
                                </View>
                            </View>
                            <Text style={styles.rowNote}>
                                {!c.usable
                                    ? 'Probably a gap in logging — not used for predictions'
                                    : `Period ${c.periodLength} day${c.periodLength === 1 ? '' : 's'}${c.outsideUsual ? ' · outside the usual 24–38 days' : ''}`}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.xxxl },
    stats: { flexDirection: 'row', gap: Spacing.sm },
    stat: {
        flex: 1, padding: Spacing.md, borderRadius: Radius.lg, gap: 2,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    statValue: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    statLabel: { fontSize: 11, ...BodyFont.regular, color: Palette.textSecondary },
    accuracy: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Palette.borderLight },
    accuracyText: { flex: 1, fontSize: 13, ...BodyFont.regular, color: Palette.text, lineHeight: 19 },
    row: {
        padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.sm,
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.borderLight,
    },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    rowTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    rowDates: { fontSize: 13, ...BodyFont.medium, color: Palette.text },
    rowLength: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    track: { height: 10, borderRadius: 5, backgroundColor: 'transparent' },
    bar: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', backgroundColor: Palette.borderSlate },
    barPeriod: { backgroundColor: Palette.cycleFill },
    rowNote: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary },
}));
