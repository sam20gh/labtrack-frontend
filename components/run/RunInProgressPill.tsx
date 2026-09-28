/**
 * "● 3.21 km · 18:04" floating over every other screen while a run is recording (plan §2.3).
 *
 * Leaving the live screen mid-run is allowed — to check a message, to look at the plan —
 * and this is the way back. It hides on the run screens themselves, and draws nothing when
 * no run is going, so it costs nothing the rest of the time.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import * as recorder from '@/lib/run/recorder';
import { distanceParts, formatClock } from '@/lib/run/format';
import { useUnits } from '@/lib/units';

export default function RunInProgressPill() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const units = useUnits();
    useSyncExternalStore(recorder.subscribe, recorder.getVersion);
    const [, tick] = useState(0);
    const state = recorder.getState();
    const active = state.phase === 'recording' || state.phase === 'paused';

    useEffect(() => {
        if (!active) return undefined;
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [active]);

    if (!active || pathname.startsWith('/activity/run')) return null;

    const d = distanceParts(state.live?.distanceM ?? 0, units);
    const label = `${state.phase === 'paused' ? 'Paused' : 'Recording'} · ${d.value} ${d.unit} · ${formatClock(state.activeSec)}`;
    // The hero violet in both schemes: it is a way back into a brand surface, and a control.
    const P = Palettes.light;

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 92 }]}>
            <Pressable
                onPress={() => router.push('/activity/run/live')}
                style={[styles.pill, { backgroundColor: P.primaryFill }]}
                accessibilityRole="button"
                accessibilityLabel={`${label}. Return to your activity.`}
            >
                <View style={[styles.dot, { backgroundColor: state.phase === 'paused' ? P.white : P.danger }]} />
                <Text style={[styles.text, { color: P.white }]}>{label}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, borderRadius: Radius.pill,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    text: { fontFamily: Fonts.semibold, fontSize: 14 },
});
