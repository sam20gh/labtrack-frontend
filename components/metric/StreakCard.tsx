/**
 * The streak card — `Design/activity.svg` frame 18.
 *
 * Frame 7 draws this card with a flat amber blob; frame 18 is the same card finished, with
 * a flame badge carrying the count inside three fading rings. This is frame 18. The badge
 * shape, its gradient and the rings are **ported, not redrawn** — lifted out of the export
 * with its own coordinates kept, so a re-issued export diffs against this file directly.
 *
 * **The digit is not ported.** The export's "8" is outlined type, and a badge that always
 * says 8 is a picture of somebody else's streak. It is a `Text` laid over the badge,
 * shrinking as the count grows so a hundred-day streak still fits the shape.
 *
 * The card is drawn only when there **is** a streak. A "0 day streak" is not an
 * encouragement, it is a scoreboard reading zero, and it is the first thing somebody sees
 * on the screen they opened to feel better about moving.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

/**
 * The export's frame for the badge and its rings: centre (7398, 503), outer ring r 77.5.
 * The rings deliberately run past the card's edge — the card clips them, as the export does.
 */
const VIEW_BOX = '7320 425 156 156';
const ART = 156;
/** The badge sits in a square this size at the card's left, centred on the rings. */
const SLOT = 112;

const BADGE = 'M7397.17 473.01L7397.12 485.298L7408 496.132L7412.9 491.232L7416.75 491.613L7423.41 501.613L7423.83 503V519.667L7423.1 521.434L7409.77 534.768L7408 535.5H7388L7386.23 534.768L7372.9 521.434L7372.17 519.667V493L7372.9 491.236L7392.85 471.236L7394.62 470.5H7394.67L7397.17 473.01Z';

/** The export draws three rings, each a fading fill with the fade inverted on its stroke. */
const RINGS = [
    { r: 77.5, opacity: 0.12, y1: 425, y2: 581 },
    { r: 59.5, opacity: 0.16, y1: 443, y2: 563 },
    { r: 43.5, opacity: 0.24, y1: 459, y2: 547 },
];

/** Smaller type as the count grows, so three digits still sit inside the badge. */
const digitSize = (days: number) => (days < 10 ? 28 : days < 100 ? 22 : 17);

function StreakBadge({ days }: { days: number }) {
    return (
        <View style={styles.slot}>
            <Svg
                width={ART}
                height={ART}
                viewBox={VIEW_BOX}
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
            >
                <Defs>
                    {RINGS.map((ring, i) => (
                        <React.Fragment key={ring.r}>
                            <LinearGradient id={`streakFill${i}`} x1="7398" y1={ring.y1} x2="7398" y2={ring.y2} gradientUnits="userSpaceOnUse">
                                <Stop stopColor={Palette.flame} />
                                <Stop offset="1" stopColor={Palette.flame} stopOpacity="0" />
                            </LinearGradient>
                            <LinearGradient id={`streakStroke${i}`} x1="7398" y1={ring.y1} x2="7398" y2={ring.y2} gradientUnits="userSpaceOnUse">
                                <Stop stopColor={Palette.flame} stopOpacity="0" />
                                <Stop offset="1" stopColor={Palette.flame} />
                            </LinearGradient>
                        </React.Fragment>
                    ))}
                    <LinearGradient id="streakBadge" x1="7398" y1="470.5" x2="7398" y2="535.5" gradientUnits="userSpaceOnUse">
                        <Stop stopColor={Palette.flameLight} />
                        <Stop offset="1" stopColor={Palette.flameDeep} />
                    </LinearGradient>
                </Defs>

                {RINGS.map((ring, i) => (
                    <Circle
                        key={ring.r}
                        cx="7398"
                        cy="503"
                        r={ring.r}
                        opacity={ring.opacity}
                        fill={`url(#streakFill${i})`}
                        stroke={`url(#streakStroke${i})`}
                    />
                ))}
                <Path d={BADGE} fill="url(#streakBadge)" />
            </Svg>

            <Text
                style={[styles.digit, { fontSize: digitSize(days) }]}
                numberOfLines={1}
                allowFontScaling={false}
            >
                {days}
            </Text>
        </View>
    );
}

interface Props {
    /** Consecutive days ending today with an activity on them. Never rendered at zero. */
    days: number;
    /** The longest run this person has managed, when the server knows it. */
    best?: number | null;
}

export function StreakCard({ days, best }: Props) {
    if (!days || days <= 0) return null;

    // Only claimed when it is a fact the server sent. "Your longest streak" over a figure
    // computed from the last seven days would be a claim about a history nothing read.
    const isBest = Number.isFinite(best as number) && days >= (best as number);

    return (
        <View
            style={styles.card}
            accessible
            accessibilityLabel={`${days}-day activity streak`}
        >
            <StreakBadge days={days} />

            <View style={styles.body}>
                <Text style={styles.title}>{days}d streak</Text>
                <Text style={styles.copy}>
                    {isBest
                        ? `Your longest streak for activity is ${days} days. Keep it up!`
                        : `You’re on a ${days}-day streak. Keep it up!`}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.warningSurface,
        borderWidth: 1,
        borderColor: Palette.flame,
        borderRadius: Radius.lg,
        // The outer rings run past the card's edge in the export, and are meant to be cut.
        overflow: 'hidden',
        minHeight: SLOT,
    },
    slot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
    // Centred on the slot and larger than it, so the rings bleed under the card's edge.
    art: { position: 'absolute', left: (SLOT - ART) / 2, top: (SLOT - ART) / 2 },
    digit: {
        fontFamily: Fonts.bold,
        color: Palette.white,
        // The export outlines its digit in the badge's own deep orange; a shadow at zero
        // offset is the nearest thing a `Text` has, and keeps white legible on the yellow top.
        textShadowColor: Palette.flameDeep,
        textShadowRadius: 3,
        textShadowOffset: { width: 0, height: 0 },
        marginTop: 2,
    },
    body: { flex: 1, paddingVertical: Spacing.lg, paddingRight: Spacing.lg, gap: 4 },
    title: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    copy: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textOnWarm, lineHeight: 18 },
});
