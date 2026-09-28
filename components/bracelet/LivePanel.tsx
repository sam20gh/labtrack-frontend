/**
 * Live view: what the bracelet reads this second, and a reading taken on request.
 *
 * Holds the bracelet's one connection while open (`lib/health/jstyle/live.ts`), so the
 * parent disables Sync meanwhile and syncs once it closes — a measurement taken here is
 * saved as it finishes, and whatever else the bracelet recorded comes over then.
 *
 * Two things this panel will not do:
 *
 * - **Show a zero as a reading.** A sensor still settling reports 0; that is drawn as
 *   "Reading…", because "0 bpm" on a health screen is a sentence nobody should see.
 * - **Keep the stream running off-screen.** The parent stops it on blur. A stream nobody is
 *   watching keeps the bracelet's radio awake and flattens it in a day.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { METRIC_TINT } from '@/lib/metrics';
import type { JstyleMeasure } from '@/modules/jstyle-ble';
import * as live from '@/lib/health/jstyle/live';

type Phase = 'off' | 'starting' | 'on';

const MEASURES: { kind: JstyleMeasure; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { kind: 'hr', label: 'Heart rate', icon: 'heart-outline' },
    { kind: 'spo2', label: 'Blood oxygen', icon: 'water' },
    { kind: 'hrv', label: 'HRV & stress', icon: 'pulse-outline' },
];

/** What a finished measurement says, in words — including when it got nothing. */
const describe = (kind: JstyleMeasure, r: live.MeasureResult | null): string => {
    if (!r) {
        return 'No reading came through. Tighten the band a little, keep your arm still, and try again.';
    }
    if (kind === 'spo2') return `Blood oxygen ${r.spo2}% — saved to your record.`;
    if (kind === 'hr') return `Heart rate ${r.heartRate} bpm — saved to your record.`;
    const parts = [
        r.hrv !== null ? `HRV ${r.hrv} ms` : null,
        r.stress !== null ? `stress ${r.stress} (the bracelet's own score)` : null,
    ].filter(Boolean);
    return `${parts.join(', ')}. Shown here only — your record keeps HRV as a daily average.`;
};

export default function LivePanel({
    busy, onLiveChange, onStopped,
}: {
    /** A sync holds the connection; live view cannot start until it lets go. */
    busy: boolean;
    onLiveChange: (on: boolean) => void;
    /** Live view closed, by the person or because the bracelet went away. */
    onStopped: () => void;
}) {
    const Palette = usePalette();
    const styles = useStyles();

    const [phase, setPhase] = useState<Phase>('off');
    const [reading, setReading] = useState<live.LiveReading | null>(null);
    const [measuring, setMeasuring] = useState<JstyleMeasure | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [partial, setPartial] = useState<live.MeasureResult | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const setOn = useCallback((on: boolean) => {
        onLiveChange(on);
        if (!on) onStopped();
    }, [onLiveChange, onStopped]);

    const start = useCallback(async () => {
        setPhase('starting');
        setMessage(null);
        setReading(null);
        try {
            await live.start({
                onReading: (r) => { if (mounted.current) setReading(r); },
                onMeasurement: (m) => { if (mounted.current) setPartial(m); },
                onLost: () => {
                    if (!mounted.current) return;
                    setPhase('off');
                    setMeasuring(null);
                    setMessage('The bracelet went out of range. Bring it closer and start again.');
                    setOn(false);
                },
            });
            if (!mounted.current) return;
            setPhase('on');
            onLiveChange(true);
        } catch (err) {
            if (!mounted.current) return;
            setPhase('off');
            setMessage(err instanceof Error ? err.message : 'Could not reach the bracelet.');
        }
    }, [onLiveChange, setOn]);

    const stop = useCallback(async () => {
        await live.stop();
        if (!mounted.current) return;
        setPhase('off');
        setMeasuring(null);
        setReading(null);
        setOn(false);
    }, [setOn]);

    // Leaving the screen closes live view. A stream nobody is watching keeps the bracelet's
    // radio awake, and the held connection would stop every later sync from connecting.
    useFocusEffect(useCallback(() => () => {
        if (live.isLive()) void stop();
    }, [stop]));

    const measure = useCallback(async (kind: JstyleMeasure) => {
        setMeasuring(kind);
        setPartial(null);
        setMessage(null);
        setSecondsLeft(live.MEASURE_SECONDS);
        const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
        try {
            const result = await live.measure(kind);
            if (mounted.current) setMessage(describe(kind, result));
        } catch (err) {
            if (mounted.current) setMessage(err instanceof Error ? err.message : 'The measurement failed.');
        } finally {
            clearInterval(tick);
            if (mounted.current) setMeasuring(null);
        }
    }, []);

    const hr = reading?.heartRate ?? null;

    return (
        <View style={styles.wrap}>
            <Text style={styles.head}>Live</Text>

            {phase === 'on' ? (
                <View style={styles.card}>
                    <View style={styles.hero} accessible accessibilityLabel={hr ? `Heart rate ${hr} beats per minute` : 'Heart rate, reading'}>
                        <Ionicons name="heart" size={28} color={METRIC_TINT.heart_rate} />
                        {hr ? (
                            <Text style={styles.heroValue}>
                                {hr}<Text style={styles.heroUnit}> bpm</Text>
                            </Text>
                        ) : (
                            <Text style={styles.heroPending}>Reading…</Text>
                        )}
                    </View>

                    <View style={styles.row}>
                        <Stat label="Steps today" value={reading?.steps?.toLocaleString() ?? null} />
                        <Stat label="Skin temp" value={reading?.temperature ? `${reading.temperature.toFixed(1)} °C` : null} />
                        {reading?.spo2 ? <Stat label="Blood oxygen" value={`${reading.spo2}%`} /> : null}
                    </View>

                    <Text style={styles.sub}>Take a reading</Text>
                    <View style={styles.measures}>
                        {MEASURES.map((m) => {
                            const active = measuring === m.kind;
                            return (
                                <Pressable
                                    key={m.kind}
                                    onPress={() => measure(m.kind)}
                                    disabled={measuring !== null}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Measure ${m.label}`}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        active && styles.chipActive,
                                        pressed && styles.chipPressed,
                                        measuring !== null && !active && styles.disabled,
                                    ]}
                                >
                                    {active
                                        ? <ActivityIndicator size="small" color={Palette.primary} />
                                        : <Ionicons name={m.icon} size={16} color={Palette.primary} />}
                                    <Text style={styles.chipLabel}>{m.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {measuring ? (
                        <Text style={styles.progress}>
                            Keep still — {secondsLeft}s left
                            {partial?.heartRate && measuring === 'hr' ? ` · ${partial.heartRate} bpm so far` : ''}
                            {partial?.spo2 && measuring === 'spo2' ? ` · ${partial.spo2}% so far` : ''}
                        </Text>
                    ) : null}
                </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <Pressable
                onPress={phase === 'on' ? stop : start}
                disabled={phase === 'starting' || measuring !== null || (busy && phase === 'off')}
                accessibilityRole="button"
                style={({ pressed }) => [
                    styles.toggle,
                    pressed && styles.chipPressed,
                    (phase === 'starting' || measuring !== null || (busy && phase === 'off')) && styles.disabled,
                ]}
            >
                {phase === 'starting'
                    ? <ActivityIndicator size="small" color={Palette.primary} />
                    : <Ionicons name={phase === 'on' ? 'stop-circle-outline' : 'radio-outline'} size={18} color={Palette.primary} />}
                <Text style={styles.toggleLabel}>
                    {phase === 'on' ? 'Close live view' : phase === 'starting' ? 'Connecting…' : 'Open live view'}
                </Text>
            </Pressable>
        </View>
    );
}

const Stat = ({ label, value }: { label: string; value: string | null }) => {
    const styles = useStyles();
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value ?? '…'}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    wrap: { width: '100%', marginTop: Spacing.lg, gap: Spacing.sm },
    head: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    card: {
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.borderLight,
        padding: Spacing.lg, gap: Spacing.md,
    },
    hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    heroValue: { fontFamily: Fonts.bold, fontSize: 40, color: Palette.text },
    heroUnit: { ...BodyFont.regular, fontSize: 16, color: Palette.textSecondary },
    heroPending: { ...BodyFont.medium, fontSize: 18, color: Palette.textMuted },
    row: { flexDirection: 'row', gap: Spacing.lg },
    stat: { gap: 2 },
    statValue: { fontFamily: Fonts.semibold, fontSize: 18, color: Palette.text },
    statLabel: { ...BodyFont.regular, fontSize: 12, color: Palette.textMuted },
    sub: { ...BodyFont.medium, fontSize: 13, color: Palette.textSecondary },
    measures: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: Palette.primary, borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md, paddingVertical: 8,
    },
    chipActive: { backgroundColor: Palette.primarySurface },
    chipPressed: { opacity: 0.7 },
    chipLabel: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },
    disabled: { opacity: 0.4 },
    progress: { ...BodyFont.medium, fontSize: 13, color: Palette.textSecondary },
    message: { ...BodyFont.regular, fontSize: 14, color: Palette.textSecondary, lineHeight: 20 },
    toggle: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        borderWidth: 1, borderColor: Palette.primary, borderRadius: Radius.lg,
        paddingVertical: 14,
    },
    toggleLabel: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.primary },
}));
