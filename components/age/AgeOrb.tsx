/**
 * The Miovix Age hero.
 *
 * The reference design draws a luminous particle sphere with the age over it. This is that,
 * in `react-native-svg` — the same call `ScoreGauge`, `MetricAreaChart` and every ported
 * illustration already make. **No new dependency**, because a `package.json` change moves the
 * Expo fingerprint and silently strands every installed build, which is the fourth trap in
 * `CLAUDE.md` and has already cost this project two shipped features.
 *
 * Three things that are not decoration:
 *
 * 1. **The colour is the band, not the feature.** A gap is teal when it is closed, warm amber
 *    when it is open, and grey when it is neither. It is never `Palette.danger`: that red is a
 *    verdict on a *result*, and putting it on "your bloods suggest you are four years older"
 *    teaches people the colour means nothing. Same argument `Palette.alert` makes for error
 *    states.
 * 2. **A null age draws the sphere unlit and no number.** Not a zero, not a dash inside a full
 *    orb — the difference between "we worked out your age" and "we cannot yet" has to survive
 *    being glanced at, and a lit orb with a placeholder in it states the first while meaning
 *    the second. This is the call `ScoreGauge` makes about a knob at zero.
 * 3. **The particles are seeded, not random.** `Math.random()` in a render body reshuffles the
 *    sphere on every state change — a tap on the pace row, a refresh finishing — which reads
 *    as a glitch rather than as motion. A small deterministic hash gives the same cloud every
 *    time for the same size.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { Fonts, Palette } from '@/constants/theme';
import type { AgeBand } from '@/lib/age';

interface Props {
    /** Biological age in years, or null when nothing could be worked out. */
    value: number | null;
    band: AgeBand | null;
    /** The line under the number — "4.1 years younger", or the reason there is none. */
    caption?: string;
    size?: number;
}

const BAND_GLOW: Record<AgeBand, string> = {
    younger: '#14B8A6',
    on_track: '#94A3B8',
    older: '#F59E0B',
};

/**
 * A deterministic pseudo-random sequence.
 *
 * Mulberry32. Seeded so the cloud is stable across re-renders — see the header.
 */
const seeded = (seed: number) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Points scattered inside a disc, denser at the rim.
 *
 * `sqrt` on the radius would spread them evenly across the area; this deliberately does not,
 * because an evenly filled disc reads as a flat circle. Biasing outwards leaves the centre
 * clear for the numeral and gives the edge the suggestion of a shell.
 */
const cloud = (count: number, radius: number, seed: number) => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
        const angle = rand() * Math.PI * 2;
        const r = radius * (0.35 + 0.65 * Math.sqrt(rand()));
        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r * 0.94,
            size: 0.8 + rand() * 2.6,
            opacity: 0.12 + rand() * 0.5,
        };
    });
};

export default function AgeOrb({ value, band, caption, size = 240 }: Props) {
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.42;

    const particles = useMemo(
        () => cloud(Math.round(size * 0.46), radius, Math.round(size)),
        [size, radius],
    );

    const lit = value !== null;
    const glow = lit && band ? BAND_GLOW[band] : Palette.borderStrong;

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                <Defs>
                    <RadialGradient id="orbFill" cx="50%" cy="46%" r="52%">
                        <Stop offset="0%" stopColor={glow} stopOpacity={lit ? 0.06 : 0.03} />
                        <Stop offset="62%" stopColor={glow} stopOpacity={lit ? 0.3 : 0.08} />
                        <Stop offset="100%" stopColor={glow} stopOpacity={lit ? 0.62 : 0.14} />
                    </RadialGradient>
                    <RadialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
                        <Stop offset="70%" stopColor={glow} stopOpacity={0} />
                        <Stop offset="100%" stopColor={glow} stopOpacity={lit ? 0.22 : 0.06} />
                    </RadialGradient>
                </Defs>

                <Circle cx={cx} cy={cy} r={size * 0.49} fill="url(#orbHalo)" />
                <Circle cx={cx} cy={cy} r={radius} fill="url(#orbFill)" />

                <G opacity={lit ? 1 : 0.35}>
                    {particles.map((p, i) => (
                        <Circle
                            key={i}
                            cx={cx + p.x}
                            cy={cy + p.y}
                            r={p.size}
                            fill={glow}
                            opacity={p.opacity}
                        />
                    ))}
                </G>

                <Circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    stroke={glow}
                    strokeOpacity={lit ? 0.45 : 0.18}
                    strokeWidth={1}
                    fill="none"
                />
            </Svg>

            <View style={styles.centre} pointerEvents="none">
                {lit ? (
                    <>
                        <Text style={styles.value}>{value!.toFixed(1)}</Text>
                        <Text style={styles.unit}>MIOVIX AGE</Text>
                        {!!caption && (
                            <Text style={[styles.caption, { color: glow }]} numberOfLines={2}>
                                {caption}
                            </Text>
                        )}
                    </>
                ) : (
                    <Text style={styles.empty} numberOfLines={3}>
                        {caption || 'Not enough to say yet'}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    value: { fontFamily: Fonts.bold, fontSize: 46, color: Palette.text, lineHeight: 52 },
    unit: { fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 1.4, color: Palette.textSecondary, marginTop: 2 },
    caption: { fontFamily: Fonts.semibold, fontSize: 13, marginTop: 6, textAlign: 'center' },
    empty: { fontFamily: Fonts.medium, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 },
});
