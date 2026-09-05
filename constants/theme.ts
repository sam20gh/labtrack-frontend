/**
 * Design tokens.
 *
 * The app grew two palettes: `#FF385C` coral from the original build (tabs, splash, home)
 * and `#7C3AED` purple from the turing kit used by onboarding, the health assessment, and
 * everything built since. Two accent colours in one product reads as an unfinished
 * migration, which is exactly what it was.
 *
 * This file is the single source. Screens import tokens rather than writing hex values, so
 * the next palette change is one edit instead of twenty-seven.
 */

export const Palette = {
    /** Primary accent — the turing kit purple. */
    primary: '#7C3AED',
    primaryDark: '#6D28D9',
    primaryLight: '#A78BFA',
    /** Tinted surface behind icons and badges. */
    primarySurface: '#F3E8FF',
    /**
     * Deep violet and indigo from the turing kit. The kit uses `#4F46E5` for primary
     * buttons and `#2E1065` as the darkest point of its hero gradients.
     */
    primaryDeep: '#2E1065',
    indigo: '#4F46E5',
    /** Hero gradient, top-left to bottom-right, as drawn in the kit's home header. */
    heroGradient: ['#7C3AED', '#6D28D9', '#4F46E5'] as [string, string, string],

    // Clinical status. These are semantic, not decorative: a person reads them to
    // understand a result, so they must stay distinguishable and consistent everywhere.
    success: '#059669',
    successSurface: '#ECFDF5',
    /**
     * The in-range band on a reference gauge. `successSurface` is too pale to separate
     * from the grey track it sits inside, so the band gets its own, stronger mint.
     */
    successBand: '#D1FAE5',
    warning: '#B45309',
    warningSurface: '#FFFBEB',
    danger: '#DC2626',
    dangerSurface: '#FEF2F2',
    info: '#1D4ED8',
    infoSurface: '#EFF6FF',
    /**
     * The kit's amber, used only where a number is being *earned* rather than judged —
     * the symptom checker's finding score. `warning` is the brown-amber a clinical flag
     * is drawn in, and reusing it here would make a progress meter read as a caution.
     */
    amber: '#EA8C00',

    // Neutrals
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    /**
     * Muted text that survives a tinted surface. `textMuted` is `#9CA3AF`, which reaches
     * only 2.5:1 on `surfaceWarm` — below AA and visibly washed out, which is what the
     * marker rail's lay labels were. This is the same role one stop darker and warmed to
     * the surface's hue, so the muted line reads as quiet rather than as broken.
     * Verified 5.5:1 on `surfaceWarm`.
     */
    textOnWarm: '#6F6558',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    surface: '#FAFAFA',
    /**
     * A card surface with warmth in it. `surface` is a neutral grey, and a rail of grey
     * cards carrying amber and red clinical flags reads as though the colour landed on the
     * wrong layer. This is the same value pulled a step towards the flags' hue — enough to
     * stop the card fighting them, not enough to imply a status of its own. Severity is
     * never carried by this surface: `FLAG_META.bg` tones are 1.05:1 apart, so a
     * flag-tinted card cannot separate "High" from "Critically high" and must not pretend
     * to. See `FLAG_META` in `lib/biomarkers.ts`.
     */
    surfaceWarm: '#FDFBF7',
    background: '#FFFFFF',
    /**
     * The turing kit's slate ramp, used for full-page canvases where white cards need to
     * read as raised. `background` stays pure white for the cards themselves — a white
     * card on a white page is just a border, which is what the profile screen used to be.
     */
    canvas: '#F8FAFC',
    borderSlate: '#E2E8F0',
    /**
     * The next step down the kit's slate ramp. `borderSlate` is what separates a card from
     * the canvas behind it; this is what draws a *control* — an input, a meter track — that
     * has to stay visible sitting on pure white. At `#E2E8F0` a 1pt field outline on a white
     * auth screen is invisible on a phone in daylight.
     */
    borderStrong: '#CBD5E1',
    /**
     * The kit's password-strength meter, and the one place a red and a green in this app are
     * *not* clinical. `danger`/`success` are read as a verdict on a result; reusing them to
     * grade a password would put the same colour on "your potassium is high" and "add a
     * digit". Same argument `amber` records for the finding score.
     */
    meterWeak: '#F43F5E',
    meterStrong: '#10B981',
    /** Pure black — the kit's Google button, which is black rather than any of our neutrals. */
    black: '#000000',

    white: '#FFFFFF',
} as const;

/** Spacing scale, 4pt based. */
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
} as const;

export const Radius = {
    sm: 6,
    md: 10,
    lg: 12,
    xl: 14,
    pill: 999,
} as const;

/**
 * Type families — Chakra Petch, the face the turing kit sets everything in.
 *
 * Keyed by weight rather than by role, because **Android ignores `fontWeight` on a custom
 * font**: `fontFamily: 'ChakraPetch_400Regular'` with `fontWeight: '700'` renders regular
 * on Android and synthetically-emboldened regular on iOS. The weight has to be chosen by
 * picking the family. So use `fontFamily: Fonts.bold` and *omit* `fontWeight` entirely —
 * pairing the two is what produces the mismatch.
 *
 * The families must match the names registered by `useFonts` in `app/_layout.tsx`.
 */
export const Fonts = {
    regular: 'ChakraPetch_400Regular',
    medium: 'ChakraPetch_500Medium',
    semibold: 'ChakraPetch_600SemiBold',
    bold: 'ChakraPetch_700Bold',
} as const;

export const Typography = {
    pageTitle: { fontSize: 26, fontWeight: '700' as const, color: Palette.text },
    sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Palette.text },
    cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Palette.text },
    body: { fontSize: 14, color: Palette.text },
    secondary: { fontSize: 13, color: Palette.textSecondary },
    caption: { fontSize: 12, color: Palette.textMuted },
    badge: { fontSize: 11, fontWeight: '700' as const },
} as const;

/**
 * Status colours by clinical flag. Kept here rather than in `lib/biomarkers.ts` so the
 * chart, the results grid, and the plan timeline cannot drift apart.
 */
export const FlagColors = {
    critical_low: { color: Palette.danger, bg: Palette.dangerSurface },
    low: { color: Palette.warning, bg: Palette.warningSurface },
    normal: { color: Palette.success, bg: Palette.successSurface },
    high: { color: Palette.warning, bg: Palette.warningSurface },
    critical_high: { color: Palette.danger, bg: Palette.dangerSurface },
    unknown: { color: Palette.textSecondary, bg: Palette.surface },
} as const;

/** Shared shadow, so cards do not each invent their own elevation. */
export const Shadow = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
} as const;
