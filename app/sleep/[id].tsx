/**
 * Sleep Details — `Design/sleep.svg` frames 10 and 28.
 *
 * One night: the hypnogram, the stage breakdown, the key stats and how it sat against the
 * goal. The design's "Consult AI Assistant" button is real and routes into the assistant,
 * which already reads this person's biomarkers, plan and history.
 *
 * Three departures from the kit, all for the same reason — it must not say more than was
 * measured:
 *
 * 1. **"You did not sleep very well" is not printed.** The kit's headline is a verdict; what
 *    this screen prints is `explanation`, the server's account of the arithmetic that
 *    produced the score. A sentence somebody can check beats one they can only be told.
 * 2. **A source that reported no stages gets no chart.** There is no honest way to draw a
 *    night whose sequence nobody recorded, so the hypnogram is omitted and the breakdown
 *    rows say "Not reported" — see `components/sleep/Hypnogram.tsx`.
 * 3. **The kit's "-1 Less Sleep · your score has decreased" card is not reproduced.** It
 *    implies a running points balance that nothing here keeps: the sleep score is a mark out
 *    of a hundred for one night, not a currency.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { Hypnogram, StageLegend } from '@/components/sleep/Hypnogram';
import { StageRows } from '@/components/sleep/StageRows';
import {
    getNight, deleteNight, formatMinutes, formatClock, dayLabel, bandTint, splitMinutes,
    type SleepNight, type SleepSegment, type StageBreakdown,
} from '@/lib/sleep';
import { ApiError } from '@/lib/api';

interface Loaded {
    night: SleepNight & { segments: SleepSegment[] };
    breakdown: StageBreakdown['stages'];
    goalMinutes: number | null;
    explanation: string;
}

/** One labelled figure in the Key Stats block. Absent values print an em dash, never a zero. */
function Stat({
    icon, label, value, unit,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string; value: string; unit?: string;
}) {
    return (
        <View style={styles.stat}>
            <Ionicons name={icon} size={18} color={Palette.textSecondary} />
            <Text style={styles.statLabel}>{label}</Text>
            <View style={styles.statValueBox}>
                <Text style={styles.statValue}>{value}</Text>
                {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
            </View>
        </View>
    );
}

export default function SleepDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [data, setData] = useState<Loaded | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!id) return;
        try {
            setError(null);
            const result = await getNight(String(id));
            setData(result);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load that night.');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const remove = () => {
        if (!data) return;
        Alert.alert(
            'Delete this night?',
            data.night.source === 'manual'
                ? 'This night was entered by hand and will be removed.'
                : 'Your health store still has this night, so it will come back the next time '
                + 'the app syncs. To remove it for good, delete it there.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteNight(data.night._id);
                            router.back();
                        } catch (err) {
                            Alert.alert('Not deleted', err instanceof Error ? err.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Text style={styles.errorText}>{error || 'That night could not be found.'}</Text>
                    <Pressable style={styles.retry} onPress={() => router.back()}>
                        <Text style={styles.retryLabel}>Go back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const { night, breakdown, goalMinutes, explanation } = data;
    const split = splitMinutes(night.asleepMin);
    const progress = night.goalProgress;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Sleep details</Text>
                <Pressable onPress={remove} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={Palette.textSecondary} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroMark}>
                        <Ionicons name="moon" size={22} color={Palette.primary} />
                    </View>
                    <Text style={styles.heroValue}>
                        {split ? `${split.hours}h ${split.mins}m` : '—'}
                    </Text>
                    {night.band ? (
                        <Text style={[styles.heroBand, { color: bandTint(night.band.key) }]}>
                            {`${night.band.label} · ${night.score} out of 100`}
                        </Text>
                    ) : null}
                    <Text style={styles.heroMeta}>
                        {`${dayLabel(night.day)} · ${formatClock(night.bedtimeMin)} – ${formatClock(night.wakeMin)}`}
                    </Text>
                    {/* The server's own account of the score, not a verdict about the person. */}
                    <Text style={styles.heroExplain}>{explanation}</Text>
                </View>

                {/* ------------------------------------------------ goal progress */}
                {progress !== null && goalMinutes ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Goal progress</Text>
                        <View style={styles.progressRow}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                            </View>
                            <Text style={styles.progressValue}>{Math.round(progress * 100)}%</Text>
                        </View>
                        <Text style={styles.cardNote}>
                            {`Against a goal of ${formatMinutes(goalMinutes)} a night.`}
                        </Text>
                    </View>
                ) : null}

                {/* ------------------------------------------------- the hypnogram */}
                {night.segments?.length ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Through the night</Text>
                        <Hypnogram segments={night.segments} />
                        <StageLegend />
                    </View>
                ) : null}

                {/* --------------------------------------------------- breakdown */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Breakdown</Text>
                    <StageRows rows={breakdown} showDescription />
                </View>

                {/* --------------------------------------------------- key stats */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Key stats</Text>
                    <Stat
                        icon="moon-outline"
                        label="Bed time"
                        value={formatClock(night.bedtimeMin)}
                    />
                    <Stat
                        icon="sunny-outline"
                        label="Wake up time"
                        value={formatClock(night.wakeMin)}
                    />
                    <Stat
                        icon="bed-outline"
                        label="Time in bed"
                        value={formatMinutes(night.inBedMin)}
                    />
                    <Stat
                        icon="pulse-outline"
                        label="Efficiency"
                        // Null when the source never reported time awake. "—" rather than
                        // 100%, which would flatter every tracker that gives only a total.
                        value={Number.isFinite(night.efficiency as number) ? `${night.efficiency}` : '—'}
                        unit={Number.isFinite(night.efficiency as number) ? '%' : undefined}
                    />
                    <Stat
                        icon="speedometer-outline"
                        label="Sleep score"
                        value={Number.isFinite(night.score as number) ? `${night.score}` : '—'}
                    />
                </View>

                {/* ------------------------------------------------ where it came from */}
                <View style={styles.provenance}>
                    <Ionicons
                        name={night.source === 'manual' ? 'create-outline' : 'watch-outline'}
                        size={15}
                        color={Palette.textSecondary}
                    />
                    <Text style={styles.provenanceText}>
                        {night.source === 'manual'
                            ? 'Entered by hand.'
                            : `From ${night.sourceDevice?.name || (night.source === 'healthkit' ? 'Apple Health' : 'Health Connect')}. Measured values cannot be edited here.`}
                    </Text>
                </View>

                <Pressable
                    style={styles.assistant}
                    onPress={() => router.push('/(tabs)/assistant')}
                >
                    <Ionicons name="chatbubbles-outline" size={18} color={Palette.primary} />
                    <Text style={styles.assistantLabel}>Ask LabTrack AI about this night</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
    errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'center' },
    retry: {
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        borderRadius: Radius.pill, backgroundColor: Palette.primary,
    },
    retryLabel: { color: Palette.white, fontFamily: Fonts.semibold, fontSize: 14 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    hero: { alignItems: 'center', gap: 6 },
    heroMark: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    heroValue: { fontSize: 34, fontFamily: Fonts.bold, color: Palette.text },
    heroBand: { fontSize: 13, fontFamily: Fonts.semibold },
    heroMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    heroExplain: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', lineHeight: 19, marginTop: Spacing.sm,
    },

    card: {
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.background,
        borderWidth: 1, borderColor: Palette.borderLight,
        gap: Spacing.md,
        ...Shadow.card,
    },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    cardNote: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    progressTrack: {
        flex: 1, height: 10, borderRadius: 5,
        backgroundColor: Palette.borderLight, overflow: 'hidden',
    },
    progressFill: { height: 10, borderRadius: 5, backgroundColor: Palette.primary },
    progressValue: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },

    stat: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.sm,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    statLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text },
    statValueBox: { alignItems: 'flex-end' },
    statValue: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    statUnit: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    provenance: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    provenanceText: { flex: 1, fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },

    assistant: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill,
        backgroundColor: Palette.primarySurface,
    },
    assistantLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
});
