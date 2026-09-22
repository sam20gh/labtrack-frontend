/**
 * The Miovix Age hero.
 *
 * ## What it draws, and why it is a dial rather than a glow
 *
 * The first version was a particle sphere with the number over it. It looked like a mood
 * light: pretty, and carrying exactly one bit of information in its colour. The thing a
 * person actually wants to know is not "what is my number" but **"which side of my real age
 * am I, and by how far"** — so the ring is the answer and the number is the label.
 *
 * A tick at twelve o'clock is the person's calendar age. The arc sweeps **left when they are
 * younger and right when they are older**, over a ±10-year scale with marks at five. Direction
 * and distance are legible before the numeral is read, which is the whole job of a hero.
 *
 * ## Three things that are load-bearing
 *
 * 1. **Type is sized from the orb, never fixed.** The first version set 46px whatever the
 *    orb's size, so the home card rendered it at 132pt and "41.2" wrapped onto two lines
 *    across the middle of the sphere. Every size below is a fraction of `size`, and the
 *    numeral is `numberOfLines={1}` with `adjustsFontSizeToFit` behind that as a backstop.
 * 2. **An unlit orb has no arc and no number.** Not a zero, not a needle parked at the tick.
 *    "We worked out your age" and "we cannot yet" have to survive being glanced at, and a lit
 *    dial with a placeholder in it states the first while meaning the second — the call
 *    `ScoreGauge` makes about a knob at zero.
 * 3. **The colour is the band and never `Palette.danger`.** That red is a verdict on a
 *    *result*; putting it on "your bloods suggest you are four years older" teaches people the
 *    colour means nothing. Same argument `Palette.alert` makes for error states.
 *
 * ## Motion
 *
 * Three animations, all on the UI thread through Reanimated, which already drives SVG in
 * `components/bracelet/DeviceStage.tsx`:
 *
 * - **the sweep** — the arc springs out from the tick on mount and whenever the value moves,
 *   and the numeral counts with it. It is the only one that carries meaning.
 * - **the drift** — the particle cloud turns once a minute, so the sphere is alive without
 *   anything appearing to happen.
 * - **the breath** — the halo swells and settles on a four-second cycle.
 *
 * `useReducedMotion()` switches all three off and renders the finished state. Somebody who has
 * asked their phone to stop animating things has asked this too, and a health number that
 * pulses at a person who finds motion unpleasant is a poor trade for some sparkle.
 *
 * No new dependency: `react-native-svg` and `react-native-reanimated` are both already here.
 * A `package.json` change moves the Expo fingerprint and silently strands every installed
 * build, which is the fourth trap in `CLAUDE.md`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
    Circle, Defs, RadialGradient, LinearGradient, Stop, G, Line,
} from 'react-native-svg';
import Animated, {
    useSharedValue, useAnimatedProps, useAnimatedStyle,
    withRepeat, withTiming, withSpring, useReducedMotion, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Fonts, Palette } from '@/constants/theme';
import type { AgeBand } from '@/lib/age';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
    /** Biological age in years, or null when nothing could be worked out. */
    value: number | null;
    band: AgeBand | null;
    /** Chronological age, which is where the tick sits. Without it the dial has no zero. */
    chronologicalAge?: number | null;
    /** The line under the number. Omitted on the small card, which prints it alongside. */
    caption?: string;
    size?: number;
}

/**
 * Each band's two gradient stops.
 *
 * Two rather than one because a flat stroke at this width reads as a plastic ring; a gradient
 * along the sweep gives it depth and makes the direction of travel legible at a glance. The
 * pairs stay inside one hue family — a rainbow arc would imply a scale that does not exist.
 */
const BAND_RAMP: Record<AgeBand, [string, string]> = {
    younger: ['#2DD4BF', '#0D9488'],
    on_track: ['#A5B4FC', '#818CF8'],
    older: ['#FCD34D', '#F59E0B'],
};

/** The particle cloud's own tints, one per band, kept lighter than the ring. */
const BAND_DUST: Record<AgeBand, string> = {
    younger: '#5EEAD4',
    on_track: '#C7D2FE',
    older: '#FDE68A',
};

/** Years either side of the tick that fill the whole sweep, and where the marks go. */
const SCALE_YEARS = 10;
const MARK_YEARS = [5, 10];

/** Half the dial's total sweep, in degrees. 135 each way leaves a 90° gap at the foot. */
const HALF_SWEEP = 135;

/** Mulberry32 — a deterministic sequence, so the cloud does not reshuffle on every render. */
const seeded = (seed: number) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Points scattered inside a disc, biased outwards.
 *
 * `sqrt` alone would spread them evenly by area, which reads as a flat speckled circle.
 * Pushing them towards the rim leaves the centre clear for the numeral and gives the edge the
 * suggestion of a shell.
 */
const cloud = (count: number, radius: number, seed: number) => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
        const angle = rand() * Math.PI * 2;
        const r = radius * (0.3 + 0.7 * Math.sqrt(rand()));
        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r * 0.95,
            size: 0.7 + rand() * 2.4,
            opacity: 0.16 + rand() * 0.52,
        };
    });
};

/**
 * How far round the dial the arc reaches, −1…1.
 *
 * Signed, because the sign **is** the direction of travel — negative sweeps left for younger,
 * positive sweeps right for older. Clamped at the ends rather than allowed to wrap: a gap
 * beyond ten years is already the widest thing the dial can say, and a second lap would read
 * as a smaller number than a first.
 *
 * Exported because the arc is drawn with a mirrored transform and a dash offset, and getting
 * either backwards draws a confident arc pointing the wrong way — which looks deliberate and
 * is the one failure nobody would report as a bug. `__tests__/AgeOrb-test.tsx` pins it.
 */
export const arcReach = (
    value: number | null | undefined,
    chronologicalAge: number | null | undefined,
): number => {
    if (!Number.isFinite(value ?? NaN) || !Number.isFinite(chronologicalAge ?? NaN)) return 0;
    const gap = (value as number) - (chronologicalAge as number);
    return Math.max(-1, Math.min(1, gap / SCALE_YEARS));
};

/** Degrees clockwise from twelve o'clock that a reach lands on. Negative is anticlockwise. */
export const arcEndDegrees = (reach: number) => reach * HALF_SWEEP;

const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/**
 * The counting numeral.
 *
 * Its own component so that fifty state updates during the entrance re-render one `<Text>`
 * and never the SVG above it. The arc animates on the UI thread through Reanimated; this is
 * the one thing on the screen that has to become a string, and a string cannot cross to the
 * UI thread without an `AnimatedTextInput` — which brings its own padding and alignment
 * quirks for a gain nobody would notice on a number that settles in under a second.
 *
 * It counts from a little below the target rather than from zero. Counting a *biological age*
 * up from 0 draws the eye through every number the person is not, and briefly shows a
 * four-year-old. Starting close reads as the dial settling, which is what is actually
 * happening beside it.
 */
const COUNT_MS = 850;
const COUNT_FROM_BELOW = 6;

const CountUp = ({ to, style, animate }: { to: number; style: object; animate: boolean }) => {
    const [shown, setShown] = useState(animate ? Math.max(0, to - COUNT_FROM_BELOW) : to);

    useEffect(() => {
        if (!animate) { setShown(to); return undefined; }

        const from = Math.max(0, to - COUNT_FROM_BELOW);
        const started = Date.now();
        let frame: number;

        const tick = () => {
            const t = Math.min(1, (Date.now() - started) / COUNT_MS);
            // Eased out, so it decelerates onto the value in step with the arc's spring
            // rather than arriving at a constant rate and stopping dead.
            const eased = 1 - (1 - t) ** 3;
            setShown(from + (to - from) * eased);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [to, animate]);

    return (
        <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
            {shown.toFixed(1)}
        </Text>
    );
};

export default function AgeOrb({
    value, band, chronologicalAge, caption, size = 240,
}: Props) {
    const reduced = useReducedMotion();

    const cx = size / 2;
    const cy = size / 2;
    /** The ring sits outside the sphere, so the two do not fight for the same pixels. */
    const stroke = Math.max(5, size * 0.055);
    const ringR = size / 2 - stroke / 2 - size * 0.015;
    const sphereR = ringR - stroke * 1.15;

    const lit = value !== null && Number.isFinite(value);
    const [rampFrom, rampTo] = band ? BAND_RAMP[band] : [Palette.borderStrong, Palette.border];
    const dust = band ? BAND_DUST[band] : Palette.borderStrong;

    const particles = useMemo(
        () => cloud(Math.round(size * 0.42), sphereR * 0.92, Math.round(size)),
        [size, sphereR],
    );

    const target = useMemo(
        () => arcReach(lit ? (value as number) : null, chronologicalAge),
        [lit, value, chronologicalAge],
    );

    const circumference = 2 * Math.PI * ringR;
    /** The arc's full length if `target` were ±1, as a share of the circle. */
    const fullFraction = HALF_SWEEP / 360;

    const sweep = useSharedValue(reduced ? 1 : 0);
    const spin = useSharedValue(0);
    const breath = useSharedValue(0);

    useEffect(() => {
        if (reduced) {
            sweep.value = 1;
            return;
        }
        sweep.value = 0;
        // Spring rather than a timing curve: the small overshoot is what makes the dial feel
        // like it settled rather than stopped, and it is the only playful thing on a screen
        // that is otherwise being careful.
        sweep.value = withSpring(1, { damping: 14, stiffness: 90, mass: 0.9 });
    }, [target, reduced, sweep]);

    useEffect(() => {
        if (reduced) return undefined;
        spin.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false);
        breath.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true,
        );
        return () => { cancelAnimation(spin); cancelAnimation(breath); };
    }, [reduced, spin, breath]);

    const arcProps = useAnimatedProps(() => {
        const reach = Math.abs(target) * fullFraction * sweep.value;
        return {
            strokeDasharray: [circumference, circumference],
            strokeDashoffset: circumference * (1 - reach),
        };
    });

    const dustStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${spin.value * 360}deg` }],
    }));

    const haloStyle = useAnimatedStyle(() => ({
        opacity: 0.45 + breath.value * 0.35,
        transform: [{ scale: 1 + breath.value * 0.035 }],
    }));

    /**
     * Mirrored for the younger case.
     *
     * A dashed circle only ever draws clockwise from its start, so the anticlockwise sweep is
     * the same arc reflected about the vertical axis. Static per render — the direction does
     * not animate — so it costs nothing on the UI thread.
     */
    const arcTransform = target < 0
        ? `translate(${2 * cx}, 0) scale(-1, 1) rotate(-90, ${cx}, ${cy})`
        : `rotate(-90, ${cx}, ${cy})`;

    const valueSize = size * 0.215;
    const unitSize = Math.max(8, Math.min(11, size * 0.05));
    const captionSize = Math.max(9.5, Math.min(13, size * 0.055));

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            {/* The halo breathes behind everything, so nothing it touches has to re-render. */}
            <Animated.View style={[StyleSheet.absoluteFill, haloStyle]} pointerEvents="none">
                <Svg width={size} height={size}>
                    <Defs>
                        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                            <Stop offset="58%" stopColor={rampFrom} stopOpacity={0} />
                            <Stop offset="100%" stopColor={rampFrom} stopOpacity={lit ? 0.3 : 0.07} />
                        </RadialGradient>
                    </Defs>
                    <Circle cx={cx} cy={cy} r={size * 0.5} fill="url(#halo)" />
                </Svg>
            </Animated.View>

            {/* The drifting cloud, on its own layer so one transform turns the whole sphere. */}
            <Animated.View style={[StyleSheet.absoluteFill, dustStyle]} pointerEvents="none">
                <Svg width={size} height={size}>
                    <G opacity={lit ? 1 : 0.3}>
                        {particles.map((p, i) => (
                            <Circle
                                key={i}
                                cx={cx + p.x}
                                cy={cy + p.y}
                                r={p.size}
                                fill={dust}
                                opacity={p.opacity}
                            />
                        ))}
                    </G>
                </Svg>
            </Animated.View>

            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id="sphere" cx="38%" cy="32%" r="72%">
                        <Stop offset="0%" stopColor={Palette.white} stopOpacity={lit ? 0.95 : 0.6} />
                        <Stop offset="55%" stopColor={rampFrom} stopOpacity={lit ? 0.1 : 0.03} />
                        <Stop offset="100%" stopColor={rampTo} stopOpacity={lit ? 0.26 : 0.06} />
                    </RadialGradient>
                    <LinearGradient id="arc" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={rampFrom} />
                        <Stop offset="100%" stopColor={rampTo} />
                    </LinearGradient>
                </Defs>

                {/* The sphere, lit from the upper left so it reads as a body and not a disc. */}
                <Circle cx={cx} cy={cy} r={sphereR} fill="url(#sphere)" />
                <Circle
                    cx={cx} cy={cy} r={sphereR}
                    stroke={rampFrom} strokeOpacity={lit ? 0.3 : 0.12} strokeWidth={1} fill="none"
                />

                {/* The track: the full range the dial can express, always drawn. */}
                <Circle
                    cx={cx} cy={cy} r={ringR}
                    stroke={Palette.borderLight}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={[circumference * fullFraction * 2, circumference]}
                    strokeDashoffset={circumference * fullFraction}
                    transform={`rotate(-90, ${cx}, ${cy})`}
                />

                {lit && (
                    <G transform={arcTransform}>
                        <AnimatedCircle
                            cx={cx} cy={cy} r={ringR}
                            stroke="url(#arc)"
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            fill="none"
                            animatedProps={arcProps}
                        />
                    </G>
                )}

                {/*
                  The scale, and the person's own age at the top of it.

                  Without the tick the arc is a progress bar with no start, and "how far from
                  my real age" — the only question this hero answers — has nothing to be far
                  from. The marks at five years are what stop a long arc and a short one
                  looking like the same amount of information.
                */}
                {MARK_YEARS.map((years) =>
                    [-1, 1].map((dir) => {
                        const deg = (years / SCALE_YEARS) * HALF_SWEEP * dir;
                        const a = polar(cx, cy, ringR - stroke * 0.62, deg);
                        const b = polar(cx, cy, ringR + stroke * 0.62, deg);
                        return (
                            <Line
                                key={`${years}${dir}`}
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                stroke={Palette.background}
                                strokeWidth={1.5}
                                opacity={0.9}
                            />
                        );
                    }),
                )}

                <Circle
                    cx={cx} cy={cy - ringR} r={stroke * 0.3}
                    fill={lit ? rampTo : Palette.borderStrong}
                />
            </Svg>

            <View style={styles.centre} pointerEvents="none">
                {lit ? (
                    <>
                        <CountUp
                            to={value as number}
                            animate={!reduced}
                            style={[styles.value, { fontSize: valueSize, lineHeight: valueSize * 1.12 }]}
                        />
                        <Text style={[styles.unit, { fontSize: unitSize }]} numberOfLines={1}>
                            MIOVIX AGE
                        </Text>
                        {!!caption && (
                            <Text
                                style={[styles.caption, { color: rampTo, fontSize: captionSize }]}
                                numberOfLines={2}
                            >
                                {caption}
                            </Text>
                        )}
                    </>
                ) : (
                    <Text style={[styles.empty, { fontSize: captionSize }]} numberOfLines={3}>
                        {caption || 'Not enough to say yet'}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    centre: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '18%',
    },
    // `fontWeight` is deliberately absent everywhere here: Android cannot synthesise a weight
    // from a custom face, so pairing the two renders regular on Android and a fake bold on iOS.
    value: { fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    unit: { fontFamily: Fonts.semibold, letterSpacing: 1.3, color: Palette.textMuted, marginTop: 1 },
    caption: { fontFamily: Fonts.semibold, marginTop: 5, textAlign: 'center' },
    empty: { fontFamily: Fonts.medium, color: Palette.textSecondary, textAlign: 'center', lineHeight: 18 },
});
