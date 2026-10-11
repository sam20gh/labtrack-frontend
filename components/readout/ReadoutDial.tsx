/**
 * The big dial at the top of the Sleep, Recovery and Effort pages.
 *
 * The same ring the home screen's Today card draws, at page size, in the same colour
 * (`readoutTint`), so tapping a ring lands on a page that opens with that ring. Inside it sits
 * the Predyqt mark and wordmark above the number: the dial is the product's own reading, not a
 * device's, and says so.
 *
 * Kept true from the home card:
 *
 * 1. **One colour per ring, at every value.** The track is the same hue, faint; the arc is the
 *    hue at full strength. The state is a word under the number, never a colour change.
 * 2. **No number is not zero.** `value: null` draws the track alone, a dash and the reason.
 * 3. **The arc stops at a full circle.** Effort can pass its target, and a second lap is
 *    unreadable; the number in the middle carries the overshoot.
 * 4. **No sweep on every render.** It is the first thing read at 7am, and half a second of
 *    sweeping arc is half a second of a number nobody can read.
 *
 * The two optional side buttons and the explain link are the ones the kit's sleep ring
 * (`Design/sleep.svg` frame 7) carried, which this replaced on `/sleep`, so that page keeps its
 * way to the goal and the insight.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import BrandMark from '@/components/BrandMark';
import { Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { readoutTint, type ReadoutKind } from '@/lib/readout';

interface SideAction {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
}

interface Props {
    kind: ReadoutKind;
    /** The number in the middle. Null draws a dash and `emptyLabel`. */
    value: number | null;
    /** How full the arc is, 0–1. Defaults to `value / 100`. */
    ratio?: number | null;
    /** Under the number, inside the ring: "OUT OF 100", "OF 30 MIN". */
    unitLabel?: string;
    /** Under the ring: the state in words. */
    caption?: string | null;
    /** Shown in place of the unit when there is no value. */
    emptyLabel?: string;
    size?: number;
    onExplain?: () => void;
    left?: SideAction;
    right?: SideAction;
}

const NAME: Record<ReadoutKind, string> = { sleep: 'Sleep', recovery: 'Recovery', effort: 'Effort' };

export default function ReadoutDial({
    kind, value, ratio, unitLabel = 'out of 100', caption, emptyLabel = 'Nothing yet',
    size = 230, onExplain, left, right,
}: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const tint = readoutTint(kind, Palette);
    const stroke = Math.round(size * 0.08);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const has = typeof value === 'number' && Number.isFinite(value);
    const filled = has ? Math.max(0, Math.min(1, ratio ?? (value as number) / 100)) : 0;

    return (
        <View style={styles.block}>
            <View
                style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
                accessible
                accessibilityRole="image"
                accessibilityLabel={has
                    ? `${NAME[kind]} ${value} ${unitLabel}${caption ? `, ${caption}` : ''}`
                    : `${NAME[kind]}: ${emptyLabel}`}
            >
                <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
                        {/* Same hue, faint: the track says which ring this is even when empty. */}
                        <Circle
                            cx={size / 2} cy={size / 2} r={radius}
                            stroke={tint} strokeOpacity={0.16} strokeWidth={stroke} fill="none"
                        />
                        {filled > 0 && (
                            <Circle
                                cx={size / 2} cy={size / 2} r={radius}
                                stroke={tint} strokeWidth={stroke} fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - filled)}
                                strokeLinecap="round"
                            />
                        )}
                    </G>
                </Svg>

                <View style={styles.centre}>
                    <View style={styles.brand}>
                        <BrandMark size={11} color={tint} />
                        <Text style={[styles.wordmark, { color: tint }]}>PREDYQT</Text>
                    </View>
                    <Text style={[styles.value, { fontSize: Math.round(size * 0.25), lineHeight: Math.round(size * 0.29) }]}>
                        {has ? Math.round(value as number) : '—'}
                    </Text>
                    <Text style={styles.unit}>{has ? unitLabel : emptyLabel}</Text>
                    <Text style={[styles.kind, { color: tint }]}>{NAME[kind]}</Text>
                </View>

                {left ? (
                    <Pressable
                        style={[styles.side, styles.sideLeft, { borderColor: tint }]}
                        onPress={left.onPress}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={left.label}
                    >
                        <Ionicons name={left.icon} size={16} color={tint} />
                    </Pressable>
                ) : null}
                {right ? (
                    <Pressable
                        style={[styles.side, styles.sideRight, { backgroundColor: tint, borderColor: tint }]}
                        onPress={right.onPress}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={right.label}
                    >
                        <Ionicons name={right.icon} size={16} color={Palette.white} />
                    </Pressable>
                ) : null}
            </View>

            {caption ? (
                <Pressable
                    onPress={onExplain}
                    disabled={!onExplain}
                    style={styles.captionRow}
                    accessibilityRole={onExplain ? 'button' : undefined}
                    accessibilityLabel={onExplain ? `${caption}, what this means` : caption}
                >
                    <Text style={styles.caption}>{caption}</Text>
                    {onExplain ? <Ionicons name="help-circle-outline" size={16} color={Palette.textMuted} /> : null}
                </Pressable>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    block: { alignSelf: 'center', alignItems: 'center', gap: 10 },
    centre: { alignItems: 'center' },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    wordmark: { fontSize: 11, letterSpacing: 2.4, fontFamily: Fonts.semibold },
    value: { color: Palette.text, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
    unit: { fontSize: 13, color: Palette.textSecondary, ...BodyFont.medium },
    kind: { marginTop: 4, fontSize: 11, letterSpacing: 1.2, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
    side: {
        position: 'absolute',
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.background,
        borderWidth: 1.5,
    },
    // On the ring, at the ten-o'clock and four-o'clock positions `Design/sleep.svg` draws.
    sideLeft: { left: -4, top: '40%' },
    sideRight: { right: -4, top: '60%' },
    captionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    caption: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
}));
