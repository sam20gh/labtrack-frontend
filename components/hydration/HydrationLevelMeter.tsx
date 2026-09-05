/**
 * The vertical ladder from `Design/hydration.svg` frame 7 — "Your Hydration Level".
 *
 * A capsule with five stops, best at the top, and a droplet marker parked on the one the
 * day landed on. The design numbers them 5 down to 1; the server's `LEVELS` array is ordered
 * best first, so the number is `LEVELS.length - index` and neither side has to be reordered.
 *
 * **The labels are the server's, not the design's.** The kit calls the middle rung
 * "Dehydrated" and the bottom one "Critical", and this app will not: `utils/hydrationTargets.js`
 * says in as many words that these describe *the day's intake against the day's target*, not
 * the person's physiology, because nothing here measures hydration — it counts what somebody
 * typed in. "Critical" over a tally is a clinical claim from a to-do list. The same call
 * `labtrackScore.js` makes in refusing to name its bottom band "Critical", and `sleepScore.js`
 * before it.
 *
 * A day with no entries has **no rung at all**. `level` comes back null, the marker is not
 * drawn, and the caption says nothing was logged — rather than pinning the marker to the
 * bottom, which would tell somebody they were dangerously dry on a day they did not open
 * the app.
 */
import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Palette, Fonts, Spacing } from '@/constants/theme';
import { WaterDrop } from './WaterDrop';
import type { HydrationLevel } from '@/lib/metrics';

const TRACK_W = 62;
const TRACK_H = 300;
const STOP_R = 4;

interface Props {
    levels: HydrationLevel[];
    /** The key the day landed on, or null when nothing was logged. */
    activeKey: string | null;
}

export function HydrationLevelMeter({ levels, activeKey }: Props) {
    // Scoped, so two meters on one screen cannot claim the same gradient.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const count = levels.length || 5;
    // Stops sit inside the capsule's ends so the top and bottom markers are not half-clipped.
    const inset = 34;
    const step = (TRACK_H - inset * 2) / (count - 1);
    const yFor = (i: number) => inset + i * step;
    const activeIndex = activeKey ? levels.findIndex((l) => l.key === activeKey) : -1;

    return (
        <View style={styles.wrap}>
            <View style={{ width: TRACK_W, height: TRACK_H }}>
                <Svg width={TRACK_W} height={TRACK_H}>
                    <Defs>
                        <LinearGradient id={`hlm${uid}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#94A3B8" />
                            <Stop offset="0.28" stopColor="#60A5FA" />
                            <Stop offset="1" stopColor="#2563EB" />
                        </LinearGradient>
                    </Defs>
                    <Rect
                        x={0} y={0} width={TRACK_W} height={TRACK_H}
                        rx={TRACK_W / 2} fill={`url(#hlm${uid})`}
                    />
                    {levels.map((l, i) => (
                        <Circle
                            key={l.key}
                            cx={TRACK_W / 2}
                            cy={yFor(i)}
                            r={STOP_R}
                            fill={i === activeIndex ? 'transparent' : '#FFFFFF'}
                            opacity={i === activeIndex ? 0 : 0.85}
                        />
                    ))}
                </Svg>

                {/* The marker, drawn over the capsule so it reads as sitting on the track. */}
                {activeIndex >= 0 && (
                    <View style={[styles.marker, { top: yFor(activeIndex) - 26 }]}>
                        <WaterDrop size={22} filled color="#2563EB" />
                    </View>
                )}
            </View>

            <View style={{ height: TRACK_H }}>
                {levels.map((l, i) => (
                    <View key={l.key} style={[styles.rung, { top: yFor(i) - 11 }]}>
                        <Text style={[styles.number, i === activeIndex && styles.numberActive]}>
                            {count - i}
                        </Text>
                        <Text style={[styles.label, i === activeIndex && styles.labelActive]} numberOfLines={1}>
                            {l.label}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', gap: Spacing.lg, alignSelf: 'center' },
    marker: {
        position: 'absolute', left: (TRACK_W - 52) / 2,
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }, elevation: 5,
    },
    rung: { position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 22 },
    number: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.textMuted, width: 14 },
    numberActive: { color: Palette.primary },
    label: { fontFamily: Fonts.medium, fontSize: 13.5, color: Palette.textSecondary },
    labelActive: { fontFamily: Fonts.bold, color: Palette.text },
});
