/**
 * The sleep score ring — `Design/sleep.svg` frames 6 (empty) and 7 (populated).
 *
 * Two arcs on one track. The purple arc is the score; the dark arc behind it is the rest of
 * the way to 100. They are drawn as two arcs rather than one arc on a grey track because
 * that is what the design does, and because the dark remainder is what makes a 61 read as
 * "there is more of this" rather than as a ring that happens to stop.
 *
 * Three things it will not do:
 *
 * 1. **It never renders a score of zero.** A person with no night synced has no score, and
 *    the design's empty state draws a `0` inside a flat track — which reads as a mark out of
 *    a hundred somebody earned. `score: null` draws the track, an em dash and "No sleep
 *    recorded", which is the fact.
 * 2. **The band's label is the server's**, never computed here. `utils/sleepScore.js` owns
 *    the ladder, and the bottom band is "Needs attention" rather than what the kit calls it
 *    — see the note at the top of that module.
 * 3. **It does not animate on every render.** The ring is the first thing on a screen
 *    somebody opens at 7am, and a half-second sweep before the number settles is half a
 *    second of a dashboard that cannot be read.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts } from '@/constants/theme';
import { bandTint, type SleepBand } from '@/lib/sleep';

interface Props {
    score: number | null;
    band: SleepBand | null;
    size?: number;
    /** Opens the explainer sheet. The `?` beside the band label in the design. */
    onExplain?: () => void;
    /** The two floating chips the design hangs off the ring. Optional; omitted when unused. */
    onLeftAction?: () => void;
    onRightAction?: () => void;
    leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
    rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
}

const STROKE = 22;

export function SleepRing({
    score, band, size = 260, onExplain,
    onLeftAction, onRightAction, leftIcon = 'moon', rightIcon = 'eye-outline',
}: Props) {
    const radius = (size - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const has = Number.isFinite(score as number);
    const filled = has ? Math.max(0, Math.min(1, (score as number) / 100)) : 0;

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
                    {/* The halo the design draws behind the track — one pale ring, not a shadow. */}
                    <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={Palette.primarySurface} strokeWidth={STROKE + 14} fill="none"
                    />
                    <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={has ? Palette.text : Palette.borderLight}
                        strokeWidth={STROKE}
                        fill="none"
                    />
                    {has && filled > 0 && (
                        <Circle
                            cx={size / 2} cy={size / 2} r={radius}
                            stroke={Palette.primary}
                            strokeWidth={STROKE}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - filled)}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                </G>
            </Svg>

            <View style={styles.centre}>
                <Text style={styles.value}>{has ? Math.round(score as number) : '—'}</Text>
                <Text style={styles.outOf}>{has ? 'Out of 100' : 'No sleep recorded'}</Text>

                {band ? (
                    <Pressable
                        onPress={onExplain}
                        disabled={!onExplain}
                        style={styles.bandRow}
                        accessibilityRole={onExplain ? 'button' : undefined}
                        accessibilityLabel={onExplain ? `${band.label} — what this means` : band.label}
                    >
                        <Text style={[styles.band, { color: bandTint(band.key) }]}>{band.label}</Text>
                        {onExplain ? (
                            <Ionicons name="help-circle-outline" size={14} color={Palette.textMuted} />
                        ) : null}
                    </Pressable>
                ) : null}
            </View>

            {onLeftAction ? (
                <Pressable style={[styles.chip, styles.chipLeft]} onPress={onLeftAction}>
                    <Ionicons name={leftIcon} size={16} color={Palette.primary} />
                </Pressable>
            ) : null}
            {onRightAction ? (
                <Pressable style={[styles.chip, styles.chipRight, styles.chipDark]} onPress={onRightAction}>
                    <Ionicons name={rightIcon} size={16} color={Palette.white} />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    centre: { alignItems: 'center', gap: 2 },
    value: { fontSize: 44, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 52 },
    outOf: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    bandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    band: { fontSize: 12, fontFamily: Fonts.medium },
    chip: {
        position: 'absolute',
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.white,
        borderWidth: 1, borderColor: Palette.primaryPale,
    },
    chipDark: { backgroundColor: Palette.text, borderColor: Palette.text },
    // Sat on the ring itself, at the ten-o'clock and four-o'clock positions the design uses.
    chipLeft: { left: -6, top: '42%' },
    chipRight: { right: -6, top: '58%' },
});

export default SleepRing;
