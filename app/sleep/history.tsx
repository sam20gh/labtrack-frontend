/**
 * Sleep History — `Design/sleep.svg` frames 9 and 11.
 *
 * One screen for the list and its filter sheet, because the design's two frames differ only
 * by which filters are populated — the same arrangement `/sleep/nights` takes on the server.
 *
 * **Rows are grouped by day, and the group headings are the words people navigate by.**
 * "Today", "Yesterday", then dates. The kit prints "Jun 23" on every row *and* a date heading
 * above it, which is the same fact twice.
 *
 * The kit's swipe-to-delete is kept, and what it deletes is honest about itself: removing a
 * night that came from a watch is a local decision, and the health store still holds it, so
 * the confirmation says it will come back on the next sync rather than letting it silently
 * reappear.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal, Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import { NightRow } from '@/components/sleep/NightRow';
import { BedIllustration } from '@/components/sleep/BedIllustration';
import {
    listNights, deleteNight, dayLabel, formatMinutes, STAGE_META, STAGE_ORDER,
    type SleepNight, type NightQuery, type SleepStageKey,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

/** The date presets the filter sheet offers. `null` days means "everything". */
const DATE_PRESETS: { key: string; label: string; days: number | null }[] = [
    { key: '7', label: 'Last 7 days', days: 7 },
    { key: '30', label: 'Last 30 days', days: 30 },
    { key: '90', label: 'Last 3 months', days: 90 },
    { key: 'all', label: 'All time', days: null },
];

const SORTS: { key: NonNullable<NightQuery['sort']>; label: string }[] = [
    { key: 'recent', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'longest', label: 'Longest' },
    { key: 'shortest', label: 'Shortest' },
    { key: 'best', label: 'Best score' },
];

/** `YYYY-MM-DD` n days before today, in local time. */
const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SleepHistoryScreen() {
    const router = useRouter();

    const [nights, setNights] = useState<SleepNight[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [filterOpen, setFilterOpen] = useState(false);
    const [preset, setPreset] = useState('30');
    const [sort, setSort] = useState<NonNullable<NightQuery['sort']>>('recent');
    const [stage, setStage] = useState<SleepStageKey | null>(null);

    const query = useMemo<NightQuery>(() => {
        const days = DATE_PRESETS.find((p) => p.key === preset)?.days ?? null;
        return {
            sort,
            limit: 100,
            ...(days ? { from: daysAgo(days) } : {}),
            ...(stage ? { stage } : {}),
        };
    }, [preset, sort, stage]);

    const load = useCallback(async () => {
        try {
            setError(null);
            const result = await listNights(query);
            setNights(result.nights);
            setTotal(result.total);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load your sleep history.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [query, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Rows grouped under the day heading somebody would actually look for. */
    const groups = useMemo(() => {
        const map = new Map<string, SleepNight[]>();
        for (const night of nights) {
            const key = dayLabel(night.day);
            map.set(key, [...(map.get(key) || []), night]);
        }
        return [...map.entries()];
    }, [nights]);

    const remove = (night: SleepNight) => {
        Alert.alert(
            'Delete this night?',
            night.source === 'manual'
                ? `${formatMinutes(night.asleepMin)} on ${dayLabel(night.day)} will be removed.`
                : 'Your health store still has this night, so it will come back the next time '
                + 'the app syncs. To remove it for good, delete it there.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteNight(night._id);
                            setNights((prev) => prev.filter((n) => n._id !== night._id));
                        } catch (err) {
                            Alert.alert('Not deleted', err instanceof Error ? err.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <View style={{ flex: 1 }} />
            </View>

            <View style={styles.titleBlock}>
                <Text style={styles.title}>Sleep history</Text>
                <Text style={styles.subtitle}>
                    {total > 0
                        ? `${total} ${total === 1 ? 'night' : 'nights'} recorded`
                        : 'See your sleep history here'}
                </Text>
            </View>

            <View style={styles.controls}>
                <Text style={styles.controlsLabel}>
                    {DATE_PRESETS.find((p) => p.key === preset)?.label}
                    {stage ? ` · ${STAGE_META[stage].label}` : ''}
                </Text>
                <Pressable style={styles.filterButton} onPress={() => setFilterOpen(true)}>
                    <Ionicons name="options-outline" size={16} color={Palette.primary} />
                    <Text style={styles.filterLabel}>Filter</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor={Palette.primary}
                        />
                    }
                >
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {!error && !nights.length ? (
                        <View style={styles.empty}>
                            <BedIllustration width={200} />
                            <Text style={styles.emptyTitle}>Nothing here yet</Text>
                            <Text style={styles.emptyBody}>
                                {stage || preset !== 'all'
                                    ? 'No nights match this filter. Try widening it.'
                                    : 'Connect a watch or your phone’s health store, or add a night by hand.'}
                            </Text>
                        </View>
                    ) : null}

                    {groups.map(([label, rows]) => (
                        <View key={label} style={styles.group}>
                            <Text style={styles.groupTitle}>{label}</Text>
                            {rows.map((night) => (
                                <Pressable
                                    key={night._id}
                                    onLongPress={() => remove(night)}
                                    delayLongPress={400}
                                >
                                    <NightRow
                                        night={night}
                                        showSource
                                        // The group heading above already says which day.
                                        showDay={false}
                                        onPress={() => router.push(`/sleep/${night._id}`)}
                                    />
                                </Pressable>
                            ))}
                        </View>
                    ))}

                    {nights.length ? (
                        <Text style={styles.hint}>Press and hold a night to delete it.</Text>
                    ) : null}
                </ScrollView>
            )}

            {/* ------------------------------------------------- filter sheet */}
            <Modal
                visible={filterOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setFilterOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={styles.sheetTitle}>Filter sleep history</Text>
                        <Pressable onPress={() => setFilterOpen(false)} hitSlop={10}>
                            <Ionicons name="close" size={22} color={Palette.text} />
                        </Pressable>
                    </View>

                    <Text style={styles.fieldLabel}>Date</Text>
                    <View style={styles.chips}>
                        {DATE_PRESETS.map((p) => (
                            <Pressable
                                key={p.key}
                                style={[styles.chip, preset === p.key && styles.chipActive]}
                                onPress={() => setPreset(p.key)}
                            >
                                <Text style={[styles.chipLabel, preset === p.key && styles.chipLabelActive]}>
                                    {p.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={styles.fieldLabel}>Sleep phase</Text>
                    <View style={styles.chips}>
                        <Pressable
                            style={[styles.chip, !stage && styles.chipActive]}
                            onPress={() => setStage(null)}
                        >
                            <Text style={[styles.chipLabel, !stage && styles.chipLabelActive]}>Any</Text>
                        </Pressable>
                        {STAGE_ORDER.map((s) => (
                            <Pressable
                                key={s}
                                style={[styles.chip, stage === s && styles.chipActive]}
                                onPress={() => setStage(stage === s ? null : s)}
                            >
                                <Text style={[styles.chipLabel, stage === s && styles.chipLabelActive]}>
                                    {STAGE_META[s].label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    {/* The server filters to nights that *reported* the stage, not to nights
                        where it dominated. Said here because the two are easy to confuse. */}
                    <Text style={styles.fieldHint}>
                        Shows nights where your source recorded that stage.
                    </Text>

                    <Text style={styles.fieldLabel}>Sort by</Text>
                    <View style={styles.chips}>
                        {SORTS.map((s) => (
                            <Pressable
                                key={s.key}
                                style={[styles.chip, sort === s.key && styles.chipActive]}
                                onPress={() => setSort(s.key)}
                            >
                                <Text style={[styles.chipLabel, sort === s.key && styles.chipLabelActive]}>
                                    {s.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable style={styles.apply} onPress={() => setFilterOpen(false)}>
                        <Text style={styles.applyLabel}>Show results</Text>
                        <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                    </Pressable>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    titleBlock: { paddingHorizontal: Spacing.xl, gap: 2 },
    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    controls: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    },
    controlsLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.text },
    filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    filterLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.primary },

    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl * 2, gap: Spacing.xl },
    error: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.danger },
    group: { gap: Spacing.sm },
    groupTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text, marginBottom: 2 },
    hint: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, textAlign: 'center' },

    empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
    emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    emptyBody: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingHorizontal: Spacing.xl, lineHeight: 19,
    },

    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' },
    sheet: {
        backgroundColor: Palette.background,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: Spacing.xl, gap: Spacing.md,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    fieldLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: Spacing.sm },
    fieldHint: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    chipActive: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    chipLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipLabelActive: { color: Palette.primary },
    apply: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill,
        backgroundColor: Palette.primary, marginTop: Spacing.lg,
    },
    applyLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
