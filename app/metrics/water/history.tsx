/**
 * Hydration History — `Design/hydration.svg` frame 4.
 *
 * Every entry in the window, grouped under its local day, newest first. The design puts a
 * "Newest First" control in the header and a swipe-to-delete on each row; both are here, with
 * delete behind a confirm rather than a swipe — a swipe that destroys a record with no
 * confirmation is one thumb away from deleting the wrong day, and the row is a link to the
 * detail screen, so the gesture would compete with the tap.
 *
 * **Days are the server's local days, not the device's.** `MetricLog.day` is written from the
 * client's `tzOffset` at log time, so an evening drink in the Americas is filed under that
 * evening rather than the next morning in UTC — the trap `MealLog.day` documents. Grouping by
 * `log.day` rather than by `measuredAt` is what preserves that.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SectionList, Pressable, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { deleteLog, getHistory, today as localToday, type MetricHistory, type MetricLog } from '@/lib/metrics';
import { containerFor, dayLabel, describeEntry, groupByDay } from '@/lib/hydration';
import { useUnits, formatVolume } from '@/lib/units';
import { ContainerGlass } from '@/components/hydration/ContainerGlass';
import { WaterHeader, EmptyNote } from '@/components/hydration/HydrationChrome';
import { RangeTabs, type MetricRange } from '@/components/metric/RangeTabs';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

const SPAN: Record<MetricRange, number> = { '1d': 7, '1w': 7, '1m': 31, '1y': 365, all: 365 };

export default function HydrationHistoryScreen() {
    const router = useRouter();
    const units = useUnits();
    const day = localToday();

    const [range, setRange] = useState<MetricRange>('1m');
    const [history, setHistory] = useState<MetricHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    /** Newest first is the default; the design offers the reverse and so does this. */
    const [newestFirst, setNewestFirst] = useState(true);

    const load = useCallback(async (days: number) => {
        try {
            setHistory(await getHistory('water', days));
        } catch {
            // Left as-is: the screen already renders an empty state, and a toast on a
            // read that the pull-to-refresh can retry is noise.
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(SPAN[range]); }, [load, range]));

    const sections = useMemo(() => {
        const grouped = groupByDay(history?.logs ?? []);
        const ordered = newestFirst ? grouped : [...grouped].reverse();
        return ordered.map((g) => ({
            title: dayLabel(g.day, day),
            totalMl: g.totalMl,
            data: newestFirst ? g.logs : [...g.logs].reverse(),
        }));
    }, [history, newestFirst, day]);

    const remove = useCallback((log: MetricLog) => {
        Alert.alert(
            'Remove this entry?',
            `${formatVolume(log.ml, units)} logged at ${new Date(log.measuredAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. It will be deleted from your record and the day recounted.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteLog(log._id);
                            await load(SPAN[range]);
                            Toast.show({ type: 'success', text1: 'Entry removed' });
                        } catch {
                            Toast.show({ type: 'error', text1: 'Could not remove that entry' });
                        }
                    },
                },
            ],
        );
    }, [load, range, units]);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <WaterHeader title="Hydration History" onAdd={() => router.push('/metrics/log/water')} />

            <SectionList
                sections={sections}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.content}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => { setRefreshing(true); await load(SPAN[range]); setRefreshing(false); }}
                        tintColor={Palette.primary}
                    />
                )}
                ListHeaderComponent={(
                    <View style={styles.top}>
                        <Text style={styles.blurb}>Every drink you have logged, newest day first.</Text>
                        <RangeTabs value={range} onChange={setRange} />
                        <View style={styles.controls}>
                            <Text style={styles.count}>
                                {history?.logs.length ?? 0} {history?.logs.length === 1 ? 'entry' : 'entries'}
                            </Text>
                            <Pressable
                                style={styles.sort}
                                onPress={() => setNewestFirst((v) => !v)}
                                accessibilityRole="button"
                                accessibilityLabel={`Sorted ${newestFirst ? 'newest' : 'oldest'} first. Change.`}
                            >
                                <Ionicons name="swap-vertical" size={15} color={Palette.primary} />
                                <Text style={styles.sortText}>{newestFirst ? 'Newest first' : 'Oldest first'}</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionTotal}>{formatVolume(section.totalMl, units)}</Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.row}
                        onPress={() => router.push(`/metrics/water/${item._id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatVolume(item.ml, units)}, ${describeEntry(item)}`}
                    >
                        <View style={styles.vesselSlot}>
                            <ContainerGlass size={containerFor(item.ml)} height={40} />
                        </View>
                        <View style={styles.flex}>
                            <Text style={styles.rowValue}>{formatVolume(item.ml, units)}</Text>
                            <Text style={styles.rowMeta}>{describeEntry(item)}</Text>
                        </View>
                        <Text style={styles.rowTime}>
                            {new Date(item.measuredAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Pressable
                            onPress={() => remove(item)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Remove entry"
                        >
                            <Ionicons name="trash-outline" size={17} color={Palette.textMuted} />
                        </Pressable>
                    </Pressable>
                )}
                ListEmptyComponent={loading
                    ? <ActivityIndicator style={styles.spinner} color={Palette.primary} />
                    : <EmptyNote>Nothing logged in this period. Tap + to add a drink.</EmptyNote>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    spinner: { marginTop: Spacing.xxxl },

    top: { gap: Spacing.md, paddingBottom: Spacing.lg },
    blurb: { fontFamily: Fonts.regular, fontSize: 13.5, color: Palette.textSecondary },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },
    sort: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sortText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    sectionHead: {
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
        marginTop: Spacing.lg, marginBottom: Spacing.sm,
    },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    sectionTotal: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary },

    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
    },
    // Fixed slot: the vessels differ in size on purpose, and the rows still have to align.
    vesselSlot: { width: 34, alignItems: 'center', justifyContent: 'center' },
    rowValue: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    rowMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 1 },
    rowTime: { fontFamily: Fonts.medium, fontSize: 12.5, color: Palette.textSecondary },
});
