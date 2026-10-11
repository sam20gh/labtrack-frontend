/**
 * Recovery — the middle ring of the home screen's Today readout, explained.
 *
 * Every number is the server's (`GET /readout/recovery`, `utils/dailyReadout.js`). The screen
 * answers three questions in order: what is it today, what moved it, and what does that mean
 * for today's effort.
 *
 * - **One colour.** Teal at every score; the state is a word and a glyph. See `lib/readout.ts`.
 * - **Each signal is drawn against the person's own usual**, as a marker on a track whose
 *   middle third is "near usual". The position is a picture of distance, not a second score.
 * - **Reasons are measurements, never causes.** The server writes them; the static line under
 *   them lists common things that move recovery and claims none of them happened.
 * - **The trend leaves gaps as gaps.** A night with no band is a missing bar, not a short one.
 *
 * `SafeAreaView edges={['top']}` and a drawn header, like every screen here — the root Stack
 * draws none (`app/recovery/_layout.tsx`).
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { ApiError } from '@/lib/api';
import {
    getRecovery, recoveryCaption, signalPosition, signalValue, SIGNAL_LABEL, TARGET_LINE,
    type RecoveryDetail,
} from '@/lib/readout';
import { ErrorState } from '@/components/errors';
import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

const RING = 150;
const STROKE = 13;

export default function RecoveryScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [detail, setDetail] = useState<RecoveryDetail | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const mounted = useRef(true);

    const load = useCallback(async () => {
        try {
            const data = await getRecovery();
            if (!mounted.current) return;
            setDetail(data);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            if (mounted.current) setError(err);
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; };
    }, [load]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recovery</Text>
            <View style={{ width: 24 }} />
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    // A failed load with nothing to show is an error, never "no recovery yet".
    if (error && !detail) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <ErrorState error={error} subject="your recovery" onRetry={load} variant="inline" />
            </SafeAreaView>
        );
    }

    const recovery = detail?.recovery ?? null;
    const score = recovery?.score ?? null;
    const c = 2 * Math.PI * ((RING - STROKE) / 2);
    const signals = (recovery?.signals ?? []).filter((s) => s.key !== 'sleep' || s.value != null);
    const peak = Math.max(1, ...(detail?.trend ?? []).map((t) => t.score ?? 0));

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
            >
                <View style={[styles.card, styles.hero]}>
                    <Svg width={RING} height={RING} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <Circle cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2} stroke={Palette.borderLight} strokeWidth={STROKE} fill="none" />
                        {score != null && score > 0 && (
                            <Circle
                                cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2}
                                stroke={Palette.teal} strokeWidth={STROKE} fill="none"
                                strokeDasharray={`${(c * score) / 100} ${c}`} strokeLinecap="round"
                                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                            />
                        )}
                        <SvgText
                            x={RING / 2} y={RING / 2 + 12} textAnchor="middle"
                            fontFamily={Fonts.bold} fontSize={38} fill={Palette.text}
                        >
                            {score != null ? String(score) : '--'}
                        </SvgText>
                    </Svg>
                    <Text style={styles.state} accessibilityRole="header">
                        {score != null ? `Recovery ${score} · ${recoveryCaption(recovery)}` : recoveryCaption(recovery)}
                    </Text>
                    <Text style={styles.sub}>
                        {score != null
                            ? 'Compared with your usual over the last 28 days.'
                            : recovery?.state === 'learning'
                                ? 'Recovery compares each morning with your own usual, so it needs five nights with your band before it says anything.'
                                : recovery?.state === 'insufficient'
                                    ? 'Recovery needs at least two of heart rate variability, resting heart rate and sleep. Wear your band overnight.'
                                    : 'Wear your band or watch overnight and your recovery appears here in the morning.'}
                    </Text>
                </View>

                {recovery?.held && (
                    <TouchableOpacity style={styles.note} onPress={() => router.push('/notifications')} accessibilityRole="button">
                        <Ionicons name="notifications-outline" size={18} color={Palette.text} />
                        <Text style={[styles.noteText, styles.flex]}>
                            A reading is waiting for you in your notifications. Look at it before planning a hard day.
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                    </TouchableOpacity>
                )}

                {signals.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>What went into it</Text>
                        {signals.map((s) => (
                            <View key={s.key} style={styles.signal} accessible accessibilityLabel={`${SIGNAL_LABEL[s.key]}: ${signalValue(s)}`}>
                                <View style={styles.signalHead}>
                                    <Text style={styles.signalLabel}>{SIGNAL_LABEL[s.key]}</Text>
                                    <Text style={styles.signalValue}>{signalValue(s)}</Text>
                                </View>
                                <View style={styles.track}>
                                    {s.key !== 'sleep' && <View style={[styles.band, { backgroundColor: `${Palette.teal}33` }]} />}
                                    <View style={[styles.marker, { left: `${signalPosition(s) * 100}%` }]} />
                                </View>
                            </View>
                        ))}
                        <Text style={styles.footnote}>
                            Shaded: near your usual. Based on {signals.length} of 4 signals.
                        </Text>
                    </View>
                )}

                {(detail?.reasons.length ?? 0) > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Why it reads {score}</Text>
                        {detail!.reasons.map((r) => <Text key={r} style={styles.body}>{r}</Text>)}
                        <Text style={styles.footnote}>
                            A late meal, alcohol, a hard session or a short night the day before can each lower
                            recovery for a day or two.
                        </Text>
                    </View>
                )}

                {detail && (
                    <TouchableOpacity style={styles.card} onPress={() => router.push('/activity')} accessibilityRole="button">
                        <View style={styles.signalHead}>
                            <Text style={styles.cardTitle}>Today's effort</Text>
                            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                        </View>
                        <Text style={styles.body}>{TARGET_LINE[detail.targetReason](detail.effortTarget)}</Text>
                    </TouchableOpacity>
                )}

                {(detail?.trend ?? []).some((t) => t.score != null) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Last 7 days</Text>
                        <View style={styles.trend}>
                            {detail!.trend.map((t, i) => (
                                <View key={t.day} style={styles.trendCol}>
                                    <View style={styles.trendTrack}>
                                        {t.score != null && (
                                            <View
                                                style={[
                                                    styles.trendBar,
                                                    {
                                                        height: `${(t.score / peak) * 100}%`,
                                                        backgroundColor: Palette.teal,
                                                        opacity: i === detail!.trend.length - 1 ? 1 : 0.55,
                                                    },
                                                ]}
                                            />
                                        )}
                                    </View>
                                    <Text style={styles.trendLabel}>
                                        {new Date(`${t.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2, gap: Spacing.md },
    card: {
        padding: Spacing.lg, borderRadius: Radius.xl, gap: Spacing.md,
        backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.borderLight,
    },
    hero: { alignItems: 'center', gap: Spacing.sm },
    state: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    sub: { fontSize: 14, lineHeight: 20, color: Palette.textSecondary, ...BodyFont.regular, textAlign: 'center' },
    cardTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    body: { fontSize: 14, lineHeight: 20, color: Palette.text, ...BodyFont.regular },
    footnote: { fontSize: 12, lineHeight: 17, color: Palette.textSecondary, ...BodyFont.regular },
    note: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Palette.borderLight,
    },
    noteText: { fontSize: 13, lineHeight: 18, color: Palette.text, ...BodyFont.medium },
    signal: { gap: 6 },
    signalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    signalLabel: { flexShrink: 1, fontSize: 13, color: Palette.text, ...BodyFont.medium },
    signalValue: { fontSize: 13, color: Palette.text, ...BodyFont.semibold, fontVariant: ['tabular-nums'] },
    track: { height: 8, borderRadius: 4, backgroundColor: Palette.borderLight, justifyContent: 'center' },
    band: { position: 'absolute', top: 0, bottom: 0, left: '33.3%', width: '33.4%', borderRadius: 4 },
    marker: { position: 'absolute', width: 4, height: 16, marginLeft: -2, borderRadius: 2, backgroundColor: Palette.text },
    trend: { flexDirection: 'row', gap: 6, height: 96 },
    trendCol: { flex: 1, alignItems: 'center', gap: 4 },
    trendTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    trendBar: { width: '100%', borderRadius: 4 },
    trendLabel: { fontSize: 11, color: Palette.textSecondary, ...BodyFont.medium },
}));
