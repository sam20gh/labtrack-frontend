import { Platform, type TextStyle } from 'react-native';

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
    /**
     * One stop paler than `primaryLight`, and the kit's own value for a violet that has to
     * read as an *outline* rather than as a fill — the Symptom Checker card's calm badge
     * ring, and the soft halo behind the pillow in its illustration. `primaryLight` at
     * `#A78BFA` is a fill weight: drawn as a 1pt ring at 24pt it reads as a second accent
     * competing with the purple button above it.
     */
    primaryPale: '#C4B5FD',
    /** Tinted surface behind icons and badges. */
    primarySurface: '#F3E8FF',
    /**
     * Deep violet and indigo from the turing kit. The kit uses `#4F46E5` for primary
     * buttons and `#2E1065` as the darkest point of its hero gradients.
     */
    primaryDeep: '#2E1065',
    indigo: '#4F46E5',
    /**
     * Hero *surfaces* — every gradient header and hero card. Deep and single-hue, top-left to
     * bottom-right: violet-900 to violet-950.
     *
     * The kit draws these as bright violet into indigo, which is `actionGradient` below, and
     * across fifteen screens that made the loudest colour in the app the background of the
     * most important news on each: "3 markers outside your range" printed on something that
     * looks like a promotion. Deep, it reads as a plinth rather than a shout — the argument
     * `TrophyCase` makes for its dark card — and the bright purple is left meaning *act here*.
     * Every colour drawn on a hero gets more legible, not less: white goes from 5.7:1 to
     * ≥10.9:1, and the amber, green and rose the rings use clear 4:1.
     *
     * Only something *darker* than this can be lost on it. A purple button on a hero now
     * reads as a button, where on the old gradient it was the same colour as its background.
     */
    heroGradient: ['#4C1D95', '#3D177D', '#2E1065'] as [string, string, string],
    /**
     * The kit's bright gradient, for the one control that *is* the brand's action: the raised
     * button in the tab bar. Not for surfaces — see `heroGradient`.
     */
    actionGradient: ['#7C3AED', '#6D28D9', '#4F46E5'] as [string, string, string],

    // Clinical status. These are semantic, not decorative: a person reads them to
    // understand a result, so they must stay distinguishable and consistent everywhere.
    success: '#059669',
    /**
     * The same green with enough weight to be *text*. `success` is a fill colour: it
     * reaches 3.7:1 on `surfaceWarm`, under AA, so a movement arrow drawn in it is a
     * status nobody can read. Verified 5.3:1 on `surfaceWarm`.
     */
    successDeep: '#047857',
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

    /**
     * The streak badge's flame, from `Design/activity.svg` frame 18 — a light-to-deep
     * gradient that reads as something earned. Only for streaks: `amber` stays the one
     * warm accent a figure is drawn in, and none of these is ever a verdict on a result.
     */
    flameLight: '#FBBF24',
    flame: '#F59E0B',
    flameDeep: '#EA580C',

    /**
     * Fat's segment on the weekly macro chart (`MacroWeekChart`), light to deep. A rose,
     * deliberately not `danger`: fat is a nutrient, not a finding, and the clinical red on
     * a third of every meal would read as a verdict on it. Carbohydrate and protein use
     * `flameLight`/`flame` and `primaryLight`/`primary`.
     */
    macroFat: '#F472B6',
    macroFatDeep: '#DB2777',

    /**
     * Categorical tints — one per *kind of activity*, never per outcome. They tell a swim
     * from a walk at a glance on the activity screens and carry no judgement, which is why
     * the clinical `success`/`danger`/`warning` hexes are deliberately not among them: a
     * red run would read as a bad run. `lib/activityTypes.ts` is the only thing that should
     * assign them.
     */
    teal: '#0F766E',
    tealSurface: '#F0FDFA',
    sky: '#0369A1',
    skySurface: '#F0F9FF',
    pink: '#BE185D',
    pinkSurface: '#FDF2F8',
    lime: '#4D7C0F',
    limeSurface: '#F7FEE7',
    orange: '#C2410C',
    orangeSurface: '#FFF7ED',
    indigoSurface: '#EEF2FF',

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
     * System alert — the kit's rose, and the badge tone every error screen in
     * `Design/errors.svg` draws ("Error Code: 404", "Come back in 1h 20m", "Please
     * Reconnect"). It is deliberately **not** `danger`/`dangerSurface`.
     *
     * `danger` is a verdict on a *result*: it is what "your potassium is critically high"
     * is drawn in. A failed request is not a clinical finding, and putting the same red on
     * both teaches people that the colour means nothing in particular. Same argument
     * `meterWeak` records for password strength and `amber` for the finding score — this is
     * the third member of that family, and it shares `meterWeak`'s hex because the kit uses
     * one rose for everything non-clinical.
     */
    alert: '#F43F5E',
    alertSurface: '#FFF1F2',
    alertBorder: '#FECDD3',
    /**
     * The violet badge tone the same screens use where the state is *not* a fault — a
     * feature behind the plus plan, an update that is ready, a tracker with nothing in it
     * yet. `primarySurface` at `#F3E8FF` is a step towards magenta and reads as a second
     * accent beside the purple button below it; this is the kit's own violet-50.
     */
    primaryTint: '#F5F3FF',
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
 * Display face — Chakra Petch, the turing kit's face. **Semibold and above only**: titles,
 * card headings, buttons, badges, the score. Anything somebody *reads* is `BodyFont`.
 *
 * The kit sets everything in it, and that was the problem. A squared, HUD-like face is the
 * brand at 26pt and a strain at 13pt over a paragraph — the interpretation, an article, a
 * medication warning, the assistant's reply — read by people who are often worried and
 * often older. It also has no tabular figures (no `tnum` feature: a "1" is 358 units wide
 * and a "0" 628), so `fontVariant: ['tabular-nums']` does nothing in it.
 *
 * Keyed by weight rather than by role, because **Android ignores `fontWeight` on a custom
 * font**: `fontFamily: 'ChakraPetch_400Regular'` with `fontWeight: '700'` renders regular
 * on Android and synthetically-emboldened regular on iOS. The weight has to be chosen by
 * picking the family. So use `fontFamily: Fonts.bold` and *omit* `fontWeight` entirely —
 * pairing the two is what produces the mismatch.
 *
 * `regular` and `medium` stay registered for display sizes (≥18pt) and nothing else.
 *
 * The families must match the names registered by `useFonts` in `app/_layout.tsx`.
 */
export const Fonts = {
    regular: 'ChakraPetch_400Regular',
    medium: 'ChakraPetch_500Medium',
    semibold: 'ChakraPetch_600SemiBold',
    bold: 'ChakraPetch_700Bold',
} as const;

/**
 * Reading face — the platform's own: SF Pro on iOS, Roboto on Android. Spread it into a
 * style (`...BodyFont.regular`) in place of `fontFamily`; it is a style fragment, not a
 * family name, because iOS can only reach the system face's weights through `fontWeight`.
 *
 * The opposite rule from `Fonts`: on the system face `fontWeight` works on both platforms,
 * except that Android before API 28 has no 500, which is why `medium` names Roboto Medium
 * by family there instead — and carries **no** `fontWeight`, because from API 28 an
 * explicit weight is applied over the family and `'400'` would make it regular again.
 *
 * System rather than bundled on purpose. Nothing to load, the reader's own Dynamic Type
 * and accessibility tuning apply, tabular figures work — and a bundled face would be a
 * `package.json` change, which moves the runtime fingerprint and strands every installed
 * build (the fourth trap in CLAUDE.md).
 */
export const BodyFont = {
    regular: Platform.select<TextStyle>({
        ios: { fontFamily: 'System', fontWeight: '400' },
        default: { fontFamily: 'sans-serif', fontWeight: '400' },
    }),
    medium: Platform.select<TextStyle>({
        ios: { fontFamily: 'System', fontWeight: '500' },
        default: { fontFamily: 'sans-serif-medium' },
    }),
    /**
     * Emphasis inside reading text — a sentence of advice that must stand out from its
     * rationale without becoming a heading. Roboto ships no 600, so Android draws Medium.
     */
    semibold: Platform.select<TextStyle>({
        ios: { fontFamily: 'System', fontWeight: '600' },
        default: { fontFamily: 'sans-serif-medium' },
    }),
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
