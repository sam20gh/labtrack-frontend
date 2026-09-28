/**
 * Doctor Appointment, before anything is booked — `Design/doctors.svg`.
 *
 * The empty state of the section `AppointmentCard` fills once something is booked. It replaces
 * the "Book a consultation" row the home screen used to carry in "Get more from Predyqt", which
 * drew the one feature that ends with a person talking to a clinician at the same weight as
 * "log a metric".
 *
 * The kit draws a dark stage: a constellation of doctors around one in the middle, ripples
 * behind it, three gold sparkles, one sentence and one action. The geometry is the export's
 * own — card 343×233, the stage the top 140 of it, every portrait at the kit's centre and
 * diameter — with three departures, each for a reason this codebase keeps giving:
 *
 * 1. **The faces are the directory's.** The export embeds seven stock portraits. On a card
 *    whose whole promise is "these are the doctors you can book", a face the next screen does
 *    not contain is a promise broken one tap later, so every slot draws a real
 *    `Professional.profile_image`, initials where there is none. The caller does not draw the
 *    card at all when the directory is empty — an invitation into an empty list is a dead end
 *    — and while the directory is loading, or if it failed, the slots are empty frames rather
 *    than stand-ins. The tap works either way: the directory screen loads its own.
 * 2. **It is a dark stage in both schemes.** The kit only draws it dark, and it is the call the
 *    trophy case makes on the profile: faces lit against a dark ground read as a spotlight, and
 *    the same composition on a pale card is a contact sheet. Every colour on it is pinned rather
 *    than read from the live palette, and the kit's Tailwind violets become the brand's —
 *    `#8B5CF6` is `actionGradient[0]`, `#7C3AED` is `primary`.
 * 3. **The glows are radial gradients, not blurs.** The export blurs two flat discs (σ 64).
 *    React Native cannot blur without a native module, and a native module is a `package.json`
 *    change that moves the fingerprint — the fourth trap in CLAUDE.md. The stops below are the
 *    blurred disc's own falloff, integrated numerically, so the picture is the same.
 *
 * A wider phone spreads the constellation sideways rather than scaling it, so a portrait is the
 * same size on every screen and the edge portraits stay cropped by the card the way the kit
 * crops them.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
    Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop,
} from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { initialsOf } from '@/lib/appointments';
import { Spacing, Radius, Fonts, BodyFont, Palettes } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import type { Professional } from '@/types/api';

/** The export's card: every coordinate below is in its space, so it diffs against the file. */
const KIT = { x: 16, y: 50, width: 343 };

/** The top of the card the constellation occupies. The sentence starts below it. */
const STAGE_HEIGHT = 140;

/** Taller than the card will ever be, so the card's own edge is what clips the light. */
const LIGHT_HEIGHT = 320;

/**
 * The stage's colours. Pinned: it is dark in both schemes, so nothing on it may follow the
 * live palette — the rule `heroGradient` surfaces follow in the other direction.
 */
const STAGE = {
    ground: Palettes.dark.canvas,
    edge: Palettes.dark.border,
    frame: Palettes.dark.surface,
    initials: Palettes.dark.textSecondary,
    caption: Palettes.dark.textSecondary,
    action: Palettes.dark.primary,
    sparkle: Palettes.dark.amber,
    glowNear: Palettes.light.actionGradient[0],
    glowFar: Palettes.light.primary,
    ring: Palettes.light.primary,
};

/**
 * Where the portraits sit — centre and diameter, in the export's space — ordered by how much
 * of each the card shows. The directory fills them in that order, so a roster of two lights
 * the middle and the one beside it rather than two faces half off the edge.
 */
const SLOTS = [
    { cx: 188, cy: 121, d: 64 },
    { cx: 94, cy: 147, d: 48 },
    { cx: 262, cy: 64, d: 48 },
    { cx: 343, cy: 115, d: 48 },
    { cx: 276, cy: 162, d: 32 },
    { cx: 23, cy: 87, d: 48 },
    { cx: 125, cy: 50, d: 40 },
];

/** The three ripples behind the middle portrait. */
const RINGS = { cx: 188, cy: 121, radii: [90, 68, 48] };

/**
 * The two violet glows: where the export's blurred discs sit and how their light falls off.
 * `r` is where the blur has faded to nothing (disc radius + 2.2σ); each stop is the blurred
 * disc's intensity at that fraction of it.
 */
const GLOWS = [
    {
        id: 'glowNear', cx: 347, cy: 17, r: 196, color: STAGE.glowNear,
        stops: [[0, 0.31], [0.2, 0.26], [0.4, 0.17], [0.6, 0.08], [0.8, 0.025], [1, 0]],
    },
    {
        id: 'glowFar', cx: -51.5, cy: 144.5, r: 215, color: STAGE.glowFar,
        stops: [[0, 0.49], [0.2, 0.42], [0.4, 0.26], [0.6, 0.11], [0.8, 0.034], [1, 0]],
    },
] as const;

/** The gold sparkles, lifted from the export with their own centres. Painted over the faces. */
const SPARKLES = [
    {
        cx: 168, cy: 89,
        d: 'M171.571 85.4268L178.296 88.3096V89.6885L171.571 92.5703L168.689 99.2949H167.311L164.428 92.5703L157.704 89.6885V88.3096L164.428 85.4268L167.311 78.7031H168.689L171.571 85.4268Z',
    },
    {
        cx: 294, cy: 147,
        d: 'M296.381 144.618L300.864 146.54V147.459L296.381 149.38L294.46 153.863H293.54L291.619 149.38L287.136 147.459V146.54L291.619 144.618L293.54 140.135H294.46L296.381 144.618Z',
    },
    {
        cx: 80, cy: 171,
        d: 'M82.976 168.022L88.5799 170.425V171.574L82.976 173.975L80.5745 179.579H79.4254L77.0231 173.975L71.42 171.574V170.425L77.0231 168.022L79.4254 162.419H80.5745L82.976 168.022Z',
    },
];

/**
 * A point in the export's space, on a card `width` wide.
 *
 * Sideways only: the offset from the card's centre stretches with the width, the height does
 * not change. At 343 this is the export exactly.
 */
const place = (width: number, x: number, y: number) => ({
    x: width / 2 + (x - KIT.x - KIT.width / 2) * (width / KIT.width),
    y: y - KIT.y,
});

/**
 * Which professionals take the slots. Photographs first, because initials on a stage built
 * around faces are the fallback rather than the design; otherwise the directory's own order,
 * so the picture does not reshuffle between two visits.
 */
const faces = (roster: Professional[] | null): (Professional | null)[] => {
    if (!roster) return SLOTS.map(() => null);
    return [...roster]
        .sort((a, b) => Number(Boolean(b.profile_image)) - Number(Boolean(a.profile_image)))
        .slice(0, SLOTS.length);
};

interface Props {
    /** The directory. `null` while it loads, or if it could not — the slots draw as frames. */
    professionals: Professional[] | null;
    /** No appointment ever booked, so the sentence says "first" rather than "next". */
    first: boolean;
    onExplore: () => void;
}

export default function ExploreDoctorsCard({ professionals, first, onExplore }: Props) {
    const styles = useStyles();
    const [width, setWidth] = useState(KIT.width);

    const onLayout = (e: LayoutChangeEvent) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
    };

    const caption = `Explore doctors to book your ${first ? 'first' : 'next'} appointment`;
    const rings = place(width, RINGS.cx, RINGS.cy);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onExplore}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={caption}
            accessibilityHint="Opens the list of doctors"
        >
            {/*
              The light: both glows and the ripples, behind everything and the full height of
              the card. The export clips them at the card's edge, not the stage's — the far
              glow's haze runs down behind the sentence, and the outer ripple reaches past the
              faces — so a layer the stage's height cut both off in a hard line.
            */}
            <Svg width={width} height={LIGHT_HEIGHT} style={styles.layer} pointerEvents="none">
                <Defs>
                    {GLOWS.map((glow) => {
                        const at = place(width, glow.cx, glow.cy);
                        return (
                            <RadialGradient
                                key={glow.id}
                                id={glow.id}
                                cx={at.x}
                                cy={at.y}
                                r={glow.r}
                                fx={at.x}
                                fy={at.y}
                                gradientUnits="userSpaceOnUse"
                            >
                                {glow.stops.map(([offset, opacity]) => (
                                    <Stop key={offset} offset={offset} stopColor={glow.color} stopOpacity={opacity} />
                                ))}
                            </RadialGradient>
                        );
                    })}
                    {/* Each ripple fades from violet at its top to nothing at its bottom. */}
                    <LinearGradient id="ripple" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset={0} stopColor={STAGE.ring} stopOpacity={1} />
                        <Stop offset={1} stopColor={STAGE.ring} stopOpacity={0} />
                    </LinearGradient>
                </Defs>

                {/* The export's paint order: the near glow, the ripples, then the far glow. */}
                <Circle {...circleAt(width, GLOWS[0])} fill="url(#glowNear)" />
                {RINGS.radii.map((r) => (
                    <Circle key={r} cx={rings.x} cy={rings.y} r={r} fill="url(#ripple)" opacity={0.08} />
                ))}
                <Circle {...circleAt(width, GLOWS[1])} fill="url(#glowFar)" />
            </Svg>

            {/* Decoration: the sentence and the action below say everything it does. */}
            <View
                style={styles.stage}
                onLayout={onLayout}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
            >
                {faces(professionals).map((professional, i) => {
                    const slot = SLOTS[i];
                    const at = place(width, slot.cx, slot.cy);
                    return (
                        <View
                            key={professional?._id ?? `slot-${i}`}
                            style={[styles.frame, {
                                left: at.x - slot.d / 2,
                                top: at.y - slot.d / 2,
                                width: slot.d,
                                height: slot.d,
                                borderRadius: slot.d / 2,
                            }]}
                        >
                            {professional && (
                                <Avatar
                                    uri={professional.profile_image ?? null}
                                    initials={initialsOf(professional)}
                                    size={slot.d - 2}
                                    style={styles.face}
                                    textStyle={{ color: STAGE.initials, fontSize: Math.round(slot.d * 0.3) }}
                                />
                            )}
                        </View>
                    );
                })}

                <Svg width={width} height={STAGE_HEIGHT} style={styles.layer}>
                    {SPARKLES.map((sparkle) => {
                        const at = place(width, sparkle.cx, sparkle.cy);
                        return (
                            <G key={sparkle.cx} transform={`translate(${at.x - sparkle.cx} ${at.y - sparkle.cy})`}>
                                <Path d={sparkle.d} fill={STAGE.sparkle} />
                            </G>
                        );
                    })}
                </Svg>
            </View>

            <Text style={styles.caption}>{caption}</Text>

            <View style={styles.divider} />

            <View style={styles.action}>
                <Text style={styles.actionText}>Explore Doctors</Text>
                <Ionicons name="search" size={18} color={STAGE.action} />
            </View>
        </TouchableOpacity>
    );
}

/** A glow's disc, in stage coordinates. */
const circleAt = (width: number, glow: (typeof GLOWS)[number]) => {
    const at = place(width, glow.cx, glow.cy);
    return { cx: at.x, cy: at.y, r: glow.r };
};

const useStyles = makeStyles(() => ({
    // The 16pt gutter the rest of the home screen's cards carry on their own container.
    card: {
        marginHorizontal: Spacing.lg,
        borderRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: STAGE.ground,
        borderWidth: 1,
        borderColor: STAGE.edge,
    },
    stage: { height: STAGE_HEIGHT, overflow: 'hidden' },
    layer: { position: 'absolute', left: 0, top: 0 },
    frame: {
        position: 'absolute',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: STAGE.frame,
        borderWidth: 1,
        borderColor: STAGE.edge,
    },
    // The initials disc takes the frame's colour rather than the live palette's pale violet,
    // which on this ground would be a light coin among photographs.
    face: { backgroundColor: STAGE.frame },

    // Export: the sentence at y 150–163, the rule at 182, the action centred in the last 50.
    caption: {
        ...BodyFont.regular,
        fontSize: 15,
        lineHeight: 20,
        color: STAGE.caption,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
        marginTop: Spacing.sm,
    },
    divider: {
        height: 1,
        marginTop: Spacing.lg,
        marginHorizontal: Spacing.lg,
        backgroundColor: STAGE.edge,
    },
    action: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    actionText: { fontFamily: Fonts.semibold, fontSize: 16, color: STAGE.action },
}));
