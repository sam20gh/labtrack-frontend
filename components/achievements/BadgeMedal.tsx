/**
 * One achievement badge.
 *
 * Three layers, which is exactly what `Design/achievment.svg` draws for all twelve of its
 * badges: the medal shape in a tone, an inset copy of that shape at 32% carrying a vertical
 * white gradient, and the mark in white. The geometry is in `badgeArt.ts`; this file is the
 * assembly and the colour rules.
 *
 * Three things are load-bearing.
 *
 * 1. **Locked is a state, not a tone.** A locked badge is drawn in slate with the padlock —
 *    never in its own colour dimmed, and never with its own glyph greyed. The mockup is
 *    explicit about this and it is the right call: showing the mark of an achievement
 *    somebody has not earned tells them what it is before they have earned the right to
 *    know, and a dimmed colour reads as "broken" rather than as "not yet".
 * 2. **The tone carries no verdict.** These are engagement colours, not the clinical ramp.
 *    `Palette.success`/`danger` mean "your result is in range" / "out of range" everywhere
 *    else in this app, and a red badge for a sleep streak would put the colour of a critical
 *    lab value on a compliment. The tones below are the kit's own badge palette — one step
 *    lighter and separate from `FlagColors` — the same argument `Palette.amber` and
 *    `Palette.meterWeak` already record.
 * 3. **The gradient is a rim light, not a shadow.** `Shadow.card` under an SVG is a rectangle
 *    on Android, because elevation applies to the view rather than to the path. The raised
 *    look comes from the stroke and the inset panel, which are inside the artwork.
 */
import React from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { Palette } from '@/constants/theme';
import { BADGE_GLYPHS, BADGE_SHAPES, type BadgeGlyph, type BadgeShape } from './badgeArt';

/**
 * The badge palette.
 *
 * Deliberately not `FlagColors`, and deliberately not `Palette.success`/`danger` — see the
 * note above. `locked` is the state every unearned badge is drawn in.
 */
export const BADGE_TONES = {
    amber: '#F59E0B',
    violet: '#A78BFA',
    green: '#4ADE80',
    rose: '#F43F5E',
    locked: '#9CA3AF',
} as const;

export type BadgeTone = Exclude<keyof typeof BADGE_TONES, 'locked'>;

/**
 * How far the inset panel is scaled in from the medal edge.
 *
 * 0.821 is the export's own ratio, measured off the square badge, whose two rects are
 * 44.667 and 36.667 across. Applying it as a scale about the centre rather than as a fixed
 * inset keeps a hexagon's corners the same distance in as a square's, which a constant
 * inset would not.
 */
const INSET = 0.821;

interface Props {
    shape: BadgeShape;
    glyph: BadgeGlyph;
    tone: BadgeTone;
    /** Draws the slate medal and the padlock instead of the badge's own tone and mark. */
    locked?: boolean;
    size?: number;
    /** Turns the diamond on. The mockup's diamond is its square rotated, not an eighth path. */
    rotated?: boolean;
    label?: string;
}

export function BadgeMedal({
    shape, glyph, tone, locked = false, size = 56, rotated = false, label,
}: Props) {
    const fill = locked ? BADGE_TONES.locked : BADGE_TONES[tone] ?? BADGE_TONES.locked;
    /**
     * Fall back rather than draw nothing.
     *
     * The catalogue lives on the server, so a badge added there reaches an app build that has
     * never heard of its shape or its mark. Indexing straight into these tables would render
     * `undefined` as an empty `d` — no error, no warning, a hole in the grid that nobody
     * reports because a transparent SVG is indistinguishable from a layout gap. That is the
     * failure `components/Avatar.tsx` documents at length about a 404'd image URL, in a
     * different shape. A plain square with a cross on it says "a badge is here" and is the
     * right thing for an old build to show.
     */
    const mark = BADGE_GLYPHS[locked ? 'lock' : glyph] ?? BADGE_GLYPHS.cross;
    const outline = BADGE_SHAPES[shape] ?? BADGE_SHAPES.square;
    const id = `${shape}-${glyph}-${locked ? 'l' : tone}`;

    // A rotated square's corners would leave the 64 box, so it is scaled by 1/√2 to fit.
    const medal = rotated ? 'rotate(45 32 32) scale(0.7071) translate(13.25 13.25)' : undefined;

    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            accessibilityRole="image"
            accessibilityLabel={label ?? (locked ? 'Locked badge' : 'Achievement badge')}
        >
            <Defs>
                {/* Top-lit rim, as the export draws it: white at the crown, gone by the foot. */}
                <LinearGradient id={`${id}-rim`} x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
                {/* The inset panel runs the other way — dark at the crown, lit at the foot. */}
                <LinearGradient id={`${id}-panel`} x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
                </LinearGradient>
            </Defs>

            <G transform={medal}>
                <Path d={outline} fill={fill} />
                <Path d={outline} fill="none" stroke={`url(#${id}-rim)`} strokeWidth={1} />
                <G
                    opacity={0.32}
                    transform={`translate(${32 * (1 - INSET)} ${32 * (1 - INSET)}) scale(${INSET})`}
                >
                    <Path d={outline} fill={`url(#${id}-panel)`} />
                </G>
            </G>

            {/* The mark is never rotated with the medal — a sideways padlock is not a padlock. */}
            <G transform="translate(20 20)">
                {mark.map((p, i) => (
                    <Path
                        key={i}
                        d={p.d}
                        fill={Palette.white}
                        fillRule={p.evenOdd ? 'evenodd' : undefined}
                        clipRule={p.evenOdd ? 'evenodd' : undefined}
                    />
                ))}
            </G>
        </Svg>
    );
}
