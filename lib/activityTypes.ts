/**
 * The one answer to "what does this kind of activity look like".
 *
 * Four screens used to carry their own copy of a type → icon map — the session card, the
 * breakdown, the totals card and the log form — and each was Ionicons, which has no runner,
 * no swimmer and no yoga pose, so a jog and a walk drew the same figure and a swim was a
 * water drop. `MaterialCommunityIcons` ships in the same `@expo/vector-icons` package (no
 * native module, so no fingerprint change) and has a glyph for every type the kit draws.
 *
 * Each type also gets a **categorical** tint from `Palette`. Colour here says *which kind*,
 * never *how well*: none of the tints is a clinical status colour, and nothing may pick a
 * tint from a figure. See the note on the tints in `constants/theme.ts`.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';

export type ActivityGlyph = keyof typeof MaterialCommunityIcons.glyphMap;

export interface ActivityTypeStyle {
    icon: ActivityGlyph;
    /** Icon and label colour. Every value is AA on its own `surface`. */
    tint: string;
    /** The pale tile or pill the icon sits on. */
    surface: string;
}

const TYPES: Record<string, ActivityTypeStyle> = {
    walking: { icon: 'walk', tint: Palette.teal, surface: Palette.tealSurface },
    jogging: { icon: 'run', tint: Palette.primary, surface: Palette.primaryTint },
    running: { icon: 'run-fast', tint: Palette.primary, surface: Palette.primaryTint },
    hiking: { icon: 'hiking', tint: Palette.lime, surface: Palette.limeSurface },
    biking: { icon: 'bike', tint: Palette.orange, surface: Palette.orangeSurface },
    swimming: { icon: 'swim', tint: Palette.sky, surface: Palette.skySurface },
    yoga: { icon: 'yoga', tint: Palette.pink, surface: Palette.pinkSurface },
    meditation: { icon: 'meditation', tint: Palette.pink, surface: Palette.pinkSurface },
    rowing: { icon: 'rowing', tint: Palette.sky, surface: Palette.skySurface },
    weightlifting: { icon: 'weight-lifter', tint: Palette.indigo, surface: Palette.indigoSurface },
    soccer: { icon: 'soccer', tint: Palette.lime, surface: Palette.limeSurface },
};

const FALLBACK: ActivityTypeStyle = { icon: 'dumbbell', tint: Palette.indigo, surface: Palette.indigoSurface };
const OTHER: ActivityTypeStyle = { icon: 'dots-horizontal', tint: Palette.textSecondary, surface: Palette.canvas };

/** The style for a type key as the API sends it. Unknown types get a neutral dumbbell. */
export const typeStyle = (type: string | null | undefined): ActivityTypeStyle => {
    if (!type) return FALLBACK;
    if (type === 'other') return OTHER;
    return TYPES[type] || FALLBACK;
};
