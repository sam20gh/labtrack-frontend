/**
 * Face B — Focus. No map: it is unmounted, not hidden, so the GPU stops drawing tiles and
 * the OLED shows black. Three numbers large enough to read at arm's length mid-stride, and a
 * ring that says how far along you are:
 *
 * - with a distance or time goal, the goal;
 * - otherwise the current kilometre (or mile) filling — a lap ring.
 *
 * With a pace goal the ghost gap sits under it: "12 s ahead" on a bar that slides either
 * side of centre.
 *
 * **The ring beats at the bracelet's measured heart rate**, and only then — with no reading it
 * is still, because a ring that pulsed without a heartbeat behind it would be a decoration
 * pretending to be a measurement. Reduce Motion keeps it still and keeps the number.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { ZONES } from '@/lib/run/zones';
import Svg, { Circle } from 'react-native-svg';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import TickerNumber from './TickerNumber';

export interface HudColours {
    background: string;
    text: string;
    secondary: string;
    track: string;
    accent: string;
}

interface Props {
    hud: HudColours;
    clock: string;
    distance: { value: string; unit: string };
    pace: { value: string; unit: string } | null;
    paceLabel: string;
    /** 0–1 for the ring. */
    ring: number;
    ringLabel: string;
    ghostGapSec: number | null;
    /** Live heart rate, zone (null without an estimate) and whether zones are estimated. */
    heart?: { bpm: number; zone: number | null; estimated: boolean } | null;
    cadence?: number | null;
}

export default function FocusFace({ hud, clock, distance, pace, paceLabel, ring, ringLabel, ghostGapSec, heart, cadence }: Props) {
    const size = 250;
    const stroke = 10;
    const r = size / 2 - stroke;
    const c = 2 * Math.PI * r;
    const reduce = useReducedMotion();
    const beat = useSharedValue(1);
    const bpm = heart?.bpm ?? null;

    useEffect(() => {
        if (!bpm || reduce) {
            cancelAnimation(beat);
            beat.value = 1;
            return;
        }
        const period = 60_000 / bpm;
        beat.value = withRepeat(withSequence(
            withTiming(1.035, { duration: period * 0.18, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: period * 0.82, easing: Easing.inOut(Easing.quad) }),
        ), -1, false);
    // Restart only when the rate moves by a few beats, not on every reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bpm ? Math.round(bpm / 4) : 0, reduce]);
    const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
    const zoneLabel = heart?.zone ? ZONES[heart.zone - 1].label : null;

    return (
        <View style={[styles.face, { backgroundColor: hud.background }]}>
            <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, beatStyle]}>
                <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
                    <Circle cx={size / 2} cy={size / 2} r={r} stroke={hud.track} strokeWidth={stroke} fill="none" />
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={hud.accent}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${c} ${c}`}
                        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, ring)))}
                        fill="none"
                    />
                </Svg>
                <TickerNumber value={distance.value} size={64} color={hud.text} accessibilityLabel={`${distance.value} ${distance.unit}`} />
                <Text style={[styles.unit, { color: hud.secondary }]}>{distance.unit}</Text>
                <Text style={[styles.ringLabel, { color: hud.secondary }]}>{ringLabel}</Text>
            </Animated.View>

            {heart && (
                <View style={styles.heart} accessible accessibilityLabel={`Heart rate ${heart.bpm}${heart.zone ? `, zone ${heart.zone}, ${zoneLabel}` : ''}`}>
                    <Text style={[styles.heartText, { color: hud.text }]}>♥ {heart.bpm}</Text>
                    {heart.zone ? (
                        <Text style={[styles.heartZone, { color: hud.secondary }]}>
                            Zone {heart.zone} · {zoneLabel}{heart.estimated ? ' (estimated)' : ''}
                        </Text>
                    ) : null}
                    {cadence ? <Text style={[styles.heartZone, { color: hud.secondary }]}>{cadence} steps/min</Text> : null}
                </View>
            )}

            <View style={styles.row}>
                <View style={styles.cell}>
                    <TickerNumber value={clock} size={40} color={hud.text} accessibilityLabel={`Time ${clock}`} />
                    <Text style={[styles.label, { color: hud.secondary }]}>Time</Text>
                </View>
                <View style={styles.cell}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <TickerNumber value={pace?.value ?? '—'} size={40} color={hud.text} accessibilityLabel={`${paceLabel} ${pace ? `${pace.value} ${pace.unit}` : 'not available'}`} />
                        {pace && <Text style={[styles.small, { color: hud.secondary }]}> {pace.unit}</Text>}
                    </View>
                    <Text style={[styles.label, { color: hud.secondary }]}>{paceLabel}</Text>
                </View>
            </View>

            {ghostGapSec != null && <GhostGap gap={ghostGapSec} hud={hud} />}
        </View>
    );
}

function GhostGap({ gap, hud }: { gap: number; hud: HudColours }) {
    // ±60 s fills the bar; beyond that the lead or deficit is the headline, not the bar.
    const f = Math.max(-1, Math.min(1, gap / 60));
    const text = gap === 0 ? 'Level with your pace' : `${Math.abs(gap)} s ${gap > 0 ? 'ahead' : 'behind'}`;
    return (
        <View style={styles.ghost} accessible accessibilityLabel={`${text} of your target pace`}>
            <View style={[styles.ghostTrack, { backgroundColor: hud.track }]}>
                <View style={[styles.ghostCentre, { backgroundColor: hud.secondary }]} />
                <View
                    style={[
                        styles.ghostFill,
                        { backgroundColor: hud.accent, width: `${Math.abs(f) * 50}%` },
                        f >= 0 ? { left: '50%' } : { right: '50%' },
                    ]}
                />
            </View>
            <Text style={[styles.ghostText, { color: hud.text }]}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    face: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl, paddingHorizontal: Spacing.xl },
    unit: { fontFamily: Fonts.semibold, fontSize: 18, marginTop: -4 },
    ringLabel: { ...BodyFont.regular, fontSize: 13, marginTop: Spacing.sm },
    row: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around' },
    cell: { alignItems: 'center', gap: 2 },
    label: { ...BodyFont.regular, fontSize: 13 },
    small: { fontFamily: Fonts.semibold, fontSize: 16 },
    heart: { alignItems: 'center', gap: 2, marginTop: -Spacing.md },
    heartText: { fontFamily: Fonts.bold, fontSize: 22 },
    heartZone: { ...BodyFont.regular, fontSize: 13 },
    ghost: { alignSelf: 'stretch', gap: Spacing.sm, alignItems: 'center' },
    ghostTrack: { alignSelf: 'stretch', height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
    ghostCentre: { position: 'absolute', left: '50%', width: 2, top: 0, bottom: 0, marginLeft: -1 },
    ghostFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: Radius.pill },
    ghostText: { fontFamily: Fonts.semibold, fontSize: 16 },
});
