/**
 * The trophy case, and the collection ring that goes round the profile avatar.
 *
 * ## Why this is the one dark card on the profile
 *
 * Everything else on `app/profile.tsx` is a white card on a pale canvas, because everything
 * else is a *control* — a setting to change, a status to read, a row to open. This is not a
 * control. It is the only thing on the screen a person keeps rather than adjusts, and it is
 * the payoff for months of logging meals and taking doses.
 *
 * So it is drawn as a display case: a deep violet plinth with the badges lit against it.
 * Gold and rose medals on a white card are washed-out stickers; the same medals on a dark
 * ground read as metal. That is the whole argument for the departure, and it is why the
 * departure is confined to exactly one card — a screen of dark cards is a different screen,
 * and this one is a settings hub with a trophy on it.
 *
 * ## The shelf is a fan, not a row
 *
 * Three medals, the newest raised and centred with the other two tilted behind it. A flat
 * row of three equal circles is a *list* of badges; a fan is a *hoard*, with a most-recent
 * one on top — which is the fact somebody opening their profile actually wants. The centre
 * medal is the only one that is named, because naming all three turns the shelf back into a
 * list.
 *
 * ## Nothing here is a second copy of anything
 *
 * The header names the points, the mosaic *is* the "12 of 24" drawn rather than written, and
 * the footer names the one badge that is closest. Four facts, four places. The failure to
 * avoid is the one the home screen's score card documents — spending the best line on the
 * screen restating the line above it.
 *
 * ## Locked is still a state, never a dimmed badge
 *
 * `BadgeMedal` draws the padlock, exactly as it does in the grid. Somebody with no badges
 * sees a case with three locked medals and a footer telling them what the first one takes —
 * an invitation, the call `StreakCard` already makes about a streak of zero.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { BadgeMedal, BADGE_TONES } from './BadgeMedal';
import {
    nextUp, pickShelf, progressLabel, toneColour, type Achievement, type AchievementSummary,
} from '@/lib/achievements';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

/**
 * The fan's geometry.
 *
 * Tilt and lift rather than a arc computed from an angle: three is not enough elements for a
 * formula to beat three chosen numbers, and hand-set values let the centre medal sit
 * fractionally proud of the other two in a way a uniform arc does not.
 */
const FAN = {
    /** The two behind, tilted out and dropped so the middle one reads as in front. */
    flank: { size: 56, tilt: 15, lift: 14 },
    /** The newest, raised and square to the viewer. */
    hero: { size: 78, lift: -8 },
    /** Gap between the flanking pair, so the hero overlaps both by ~10pt. */
    spread: 58,
    /** Tall enough to contain every lift and tilt — a clipped medal is a broken one. */
    height: 108,
} as const;


interface Props {
    achievements: Achievement[];
    summary: AchievementSummary;
    onOpen: () => void;
    onOpenBadge: (key: string) => void;
}

export function TrophyCase({ achievements, summary, onOpen, onOpenBadge }: Props) {
    const shelf = pickShelf(achievements);
    if (!shelf.length) return null;

    // The newest is the raised one; the next two flank it.
    const hero = shelf[0];
    const flankLeft = shelf[1] ?? shelf[0];
    const flankRight = shelf[2] ?? shelf[1] ?? shelf[0];
    const target = nextUp(achievements);
    const glow = toneColour(hero.tone, !hero.unlocked);

    return (
        <View style={styles.block}>
            <View style={styles.head}>
                <Text style={styles.groupTitle}>Collection</Text>
                <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="link">
                    <Text style={styles.seeMore}>See all</Text>
                </Pressable>
            </View>

            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={
                    `Your collection. ${summary.unlocked} of ${summary.total} badges, `
                    + `${summary.points} points.`
                }
            >
                <LinearGradient
                    colors={[Palette.primaryDeep, Palette.primaryDark, Palette.indigo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.case}
                >
                    {/*
                      * The case light.
                      *
                      * A single top-anchored fade in the hero badge's own tone, so the shelf
                      * looks lit from above and the newest medal is the brightest thing on the
                      * card. It was three concentric discs first — the substitution
                      * `app/achievements/[key].tsx` makes for the badge halo — and on a dark
                      * ground that banded into three visible rings rather than reading as
                      * light. On white it works; here it does not, and a gradient with no edge
                      * in it cannot band.
                      */}
                    <LinearGradient
                        colors={[`${glow}3D`, `${glow}00`]}
                        style={styles.bloom}
                        pointerEvents="none"
                    />

                    <View style={styles.caseHead}>
                        <Text style={styles.kicker}>YOUR COLLECTION</Text>
                        <View style={styles.pointsPill}>
                            <Ionicons name="diamond" size={11} color={Palette.primaryPale} />
                            <Text style={styles.pointsText}>{summary.points.toLocaleString()} pts</Text>
                        </View>
                    </View>

                    {/*
                      * Paint order is structural, not `zIndex`.
                      *
                      * The hero has to sit in front of the two it overlaps, and a stack of
                      * siblings ordered by `zIndex` renders correctly on iOS and less
                      * predictably on Android — the same class of problem `AppTabBar` records
                      * about a child drawn outside its parent's bounds. Rendering the flanking
                      * pair first and the hero last, absolutely positioned over them, makes the
                      * order a fact about the tree instead of a request.
                      */}
                    <View style={styles.fan}>
                        <View style={styles.fanBack}>
                            {[flankLeft, flankRight].map((a, i) => (
                                <Pressable
                                    key={`${a.key}-${i}`}
                                    onPress={() => onOpenBadge(a.key)}
                                    style={{
                                        transform: [
                                            { rotate: `${i === 0 ? -FAN.flank.tilt : FAN.flank.tilt}deg` },
                                            { translateY: FAN.flank.lift },
                                        ],
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${a.name}, ${a.unlocked ? 'unlocked' : 'locked'}`}
                                >
                                    <BadgeMedal
                                        shape={a.shape}
                                        glyph={a.glyph}
                                        tone={a.tone}
                                        locked={!a.unlocked}
                                        size={FAN.flank.size}
                                        label={a.name}
                                    />
                                </Pressable>
                            ))}
                        </View>

                        <Pressable
                            style={styles.fanFront}
                            onPress={() => onOpenBadge(hero.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`${hero.name}, ${hero.unlocked ? 'unlocked' : 'locked'}`}
                        >
                            <BadgeMedal
                                shape={hero.shape}
                                glyph={hero.glyph}
                                tone={hero.tone}
                                locked={!hero.unlocked}
                                size={FAN.hero.size}
                                label={hero.name}
                            />
                        </Pressable>
                    </View>

                    {/* Only the raised one is named. Three captions would make the fan a list. */}
                    <Text style={styles.heroName} numberOfLines={1}>
                        {hero.unlocked ? hero.plainName : 'No badges yet'}
                    </Text>
                    <Text style={styles.heroMeta} numberOfLines={1}>
                        {hero.unlocked
                            ? `${hero.categoryLabel} · Level ${hero.level} of ${hero.maxLevel}`
                            : 'Log anything at all and the first one is yours'}
                    </Text>

                    {/* The mosaic. This *is* "12 of 24" — drawn, not written twice. */}
                    <Mosaic achievements={achievements} />
                    <Text style={styles.mosaicLabel}>
                        {summary.unlocked} of {summary.total} unlocked
                    </Text>

                    {target ? (
                        <View style={styles.next}>
                            {/*
                              * Two lines, not three columns. "Next up · Well Rested · 5 of 7
                              * nights in a row" fits on a 375pt screen and collides on a 320pt
                              * one, and the unit string comes from the catalogue, so the next
                              * badge somebody adds can make it longer without warning.
                              */}
                            <Text style={styles.nextLabel}>NEXT UP</Text>
                            <View style={styles.nextHead}>
                                <Text style={styles.nextName} numberOfLines={1}>{target.plainName}</Text>
                                <Text style={styles.nextValue} numberOfLines={1}>{progressLabel(target)}</Text>
                            </View>
                            <View style={styles.nextTrack}>
                                <View
                                    style={[
                                        styles.nextFill,
                                        {
                                            width: `${Math.max(3, Math.round(target.progress * 100))}%`,
                                            backgroundColor: BADGE_TONES[target.tone],
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ) : (
                        // Every ladder topped out. Rare, and worth saying — an absent footer
                        // would read as a card that failed to finish loading.
                        <View style={styles.next}>
                            <Text style={styles.nextLabel}>Every badge is at its top level.</Text>
                        </View>
                    )}
                </LinearGradient>
            </Pressable>
        </View>
    );
}

/**
 * One mark per achievement in the catalogue, filled when it is held.
 *
 * Diamonds rather than dots because the badges themselves are angular, and because a row of
 * circles reads as a progress dot-strip — a thing you step through — where this is an
 * inventory you fill in.
 *
 * **The marks are sized from the measured width, not fixed.** Twenty-four 8pt marks with 5pt
 * gaps need 307pt; the card gives them 295 on a 375pt screen and 240 on a 320pt one. So a
 * fixed size wraps, and wrapping 24 into 23-plus-1 leaves a single orphan diamond on a second
 * row — the failure `lib/quickActions.ts` records about a grid, where a row of one reads as a
 * mistake rather than as a list. Measuring costs one extra layout pass on a card that is
 * already deferred, and in exchange the strip is one row at any width and stays one row when
 * the catalogue grows.
 *
 * **Every held mark is the same white**, not its badge's tone. Tone was the first version and
 * it turned twenty-four 8pt marks into confetti that competed with the medals above them for
 * the eye — and category is not legible at 8pt anyway, so the colour was decoration paying no
 * rent. One job each: the fan carries the colour, this carries the count.
 *
 * Order is the catalogue's own, not sorted by unlocked: a mosaic that re-sorts itself as
 * badges arrive is one nobody can recognise the shape of from one visit to the next.
 */
/**
 * Space between marks. A rotated square's diagonal is 1.41× its side, so this is also the
 * floor on how tightly they can sit before the corners touch.
 */
const MOSAIC_GAP = 4;
/** Big enough to see on a phone, small enough that a short catalogue is not a row of tiles. */
const MOSAIC_TILE = { min: 5, max: 10 };

function Mosaic({ achievements }: { achievements: Achievement[] }) {
    const [width, setWidth] = React.useState(0);
    const count = achievements.length;

    const tile = width > 0 && count > 0
        ? Math.max(
            MOSAIC_TILE.min,
            Math.min(MOSAIC_TILE.max, (width - MOSAIC_GAP * (count - 1)) / count),
        )
        : 0;

    return (
        <View
            style={styles.mosaic}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            accessibilityRole="image"
            accessibilityLabel={`${achievements.filter((a) => a.unlocked).length} of ${achievements.length} badges collected`}
        >
            {/* Nothing until measured — one blank frame beats one frame at the wrong size,
                which lands as a visible twitch under somebody's thumb. */}
            {tile > 0 ? achievements.map((a) => (
                <View
                    key={a.key}
                    style={[
                        styles.tile,
                        { width: tile, height: tile },
                        a.unlocked ? styles.tileHeld : styles.tileEmpty,
                    ]}
                />
            )) : null}
        </View>
    );
}

/**
 * The collection arc, drawn around the profile avatar.
 *
 * The avatar already carried a 4pt canvas-coloured ring whose only job was to separate it
 * from the cover behind it. This adds a second, outer ring that *means* something: how much
 * of the catalogue is held. It costs no vertical space on a screen that has none to spare,
 * and it turns the one element every profile screen has into a status.
 *
 * Three details are load-bearing:
 *
 *   - **It starts at twelve o'clock**, via the -90° rotation. An arc that starts at three
 *     looks like a gauge somebody forgot to zero.
 *   - **There is always a track under it**, in `borderStrong` rather than `borderSlate`. A
 *     lone 8% arc floating on nothing reads as a rendering artefact; the same arc on a faint
 *     full ring reads as a beginning. The colour matters because this ring **straddles two
 *     backgrounds** — the avatar sits half on the purple cover and half on the pale canvas, so
 *     the track crosses both. `borderSlate` disappears against the canvas and leaves a track
 *     that exists only on its top half, which reads as a rendering fault rather than as a
 *     gauge. `borderStrong` is the token for exactly this: an outline that has to stay visible
 *     on white, and it is still a quiet grey against the purple.
 *   - **Zero draws the track and no arc.** Not a dot, not a minimum sliver — nothing held is
 *     nothing shown, the distinction a null pillar makes on the score.
 */
export function CollectionRing({
    size, unlocked, total,
}: { size: number; unlocked: number; total: number }) {
    const stroke = 3;
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const fraction = total > 0 ? Math.min(1, Math.max(0, unlocked / total)) : 0;

    return (
        <Svg
            width={size}
            height={size}
            style={styles.ring}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <Defs>
                <SvgGradient id="collection-arc" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={BADGE_TONES.amber} />
                    <Stop offset="0.55" stopColor={BADGE_TONES.rose} />
                    <Stop offset="1" stopColor={Palette.primary} />
                </SvgGradient>
            </Defs>

            <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={Palette.borderStrong}
                strokeWidth={stroke}
                fill="none"
            />
            {fraction > 0 ? (
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="url(#collection-arc)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * fraction} ${circumference}`}
                    fill="none"
                    // Twelve o'clock, not three.
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            ) : null}
        </Svg>
    );
}

/**
 * The newest badge, pinned to the avatar like a lapel pin.
 *
 * Bottom-left, because bottom-right is the edit pencil and the two must not stack. It is
 * drawn only for a badge actually held — a padlock pinned to somebody's face is a strange
 * thing to tell them about themselves, and the trophy case below already handles the
 * nothing-yet case with room to explain it.
 */
export function AvatarMedal({ achievement, onPress }: { achievement: Achievement; onPress: () => void }) {
    if (!achievement.unlocked) return null;

    return (
        <Pressable
            style={styles.pin}
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Newest badge: ${achievement.name}. Open it.`}
        >
            <BadgeMedal
                shape={achievement.shape}
                glyph={achievement.glyph}
                tone={achievement.tone}
                size={28}
                label={achievement.name}
            />
        </Pressable>
    );
}

/**
 * The case's own skeleton.
 *
 * The profile paints before the collection arrives — `GET /achievements` reads every
 * tracker's history, and gating a settings screen on that would be the mistake
 * `app/nutrition/index.tsx` documents. So the slot is held rather than left to pop in and
 * shove the settings groups down the page under somebody's thumb.
 */
export function TrophyCaseSkeleton() {
    return (
        <View style={styles.block}>
            <View style={styles.head}>
                <Text style={styles.groupTitle}>Collection</Text>
            </View>
            <View style={styles.skeleton}>
                {/* The same fan, in grey. A skeleton that is not the shape of the thing it
                    stands in for makes the real card look like it moved when it lands. */}
                <View style={styles.fan}>
                    <View style={styles.fanBack}>
                        {[-1, 1].map((side) => (
                            <View
                                key={side}
                                style={[
                                    styles.skeletonMedal,
                                    { width: FAN.flank.size, height: FAN.flank.size },
                                    {
                                        transform: [
                                            { rotate: `${side * FAN.flank.tilt}deg` },
                                            { translateY: FAN.flank.lift },
                                        ],
                                    },
                                ]}
                            />
                        ))}
                    </View>
                    <View
                        style={[
                            styles.fanFront,
                            styles.skeletonMedal,
                            { width: FAN.hero.size, height: FAN.hero.size },
                        ]}
                    />
                </View>
                <View style={styles.skeletonLine} />
                <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    block: { marginTop: Spacing.xxl },
    head: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    groupTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    seeMore: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    case: {
        borderRadius: Radius.xl,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.lg,
        overflow: 'hidden',
    },
    // Anchored to the top so the light has a source, and stopped well above the mosaic so
    // those marks sit on the plinth's own colour rather than in a wash.
    bloom: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },

    caseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    kicker: {
        fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6,
        color: 'rgba(255,255,255,0.62)',
    },
    pointsPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    pointsText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.white },

    fan: {
        height: FAN.height,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.sm,
    },
    fanBack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: FAN.spread,
    },
    // Centred over the pair by the parent's own alignment, so no width has to be guessed.
    fanFront: { position: 'absolute', transform: [{ translateY: FAN.hero.lift }] },

    heroName: {
        fontSize: 17, fontFamily: Fonts.bold, color: Palette.white,
        textAlign: 'center', marginTop: Spacing.sm,
    },
    heroMeta: {
        fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.66)',
        textAlign: 'center', marginTop: 2,
    },

    mosaic: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: MOSAIC_GAP,
        // Held even before the marks are measured, so the card does not jump on the second
        // layout pass. Comfortably clears a 10pt tile's 14pt diagonal.
        height: MOSAIC_TILE.max * 1.5,
        marginTop: Spacing.lg,
    },
    tile: {
        borderRadius: 2,
        // Rotated so the marks echo the badges' angles rather than reading as a dot strip.
        transform: [{ rotate: '45deg' }],
    },
    tileHeld: { backgroundColor: 'rgba(255,255,255,0.92)' },
    tileEmpty: { backgroundColor: 'rgba(255,255,255,0.16)' },
    mosaicLabel: {
        fontSize: 11, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.62)',
        textAlign: 'center', marginTop: Spacing.md,
    },

    next: {
        marginTop: Spacing.lg,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.16)',
        gap: Spacing.sm,
    },
    nextHead: {
        flexDirection: 'row', alignItems: 'baseline',
        justifyContent: 'space-between', gap: Spacing.md,
    },
    nextLabel: {
        fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2,
        color: 'rgba(255,255,255,0.52)',
    },
    nextName: { flexShrink: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
    nextValue: { fontSize: 11, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.66)' },
    nextTrack: {
        height: 5, borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.18)',
        overflow: 'hidden',
    },
    nextFill: { height: 5, borderRadius: 3 },

    ring: { position: 'absolute', top: 0, left: 0 },

    pin: {
        position: 'absolute', left: -2, bottom: -2,
        borderRadius: 16,
        borderWidth: 3, borderColor: Palette.canvas,
        backgroundColor: Palette.canvas,
    },

    skeleton: {
        borderRadius: Radius.xl,
        backgroundColor: Palette.borderLight,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.md,
    },
    skeletonMedal: { borderRadius: Radius.md, backgroundColor: Palette.border },
    skeletonLine: {
        height: 10, width: '52%', borderRadius: 5, backgroundColor: Palette.border,
    },
    skeletonLineShort: { width: '34%' },
});
