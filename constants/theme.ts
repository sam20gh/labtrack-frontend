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

const LightPalette = {
    /**
     * Primary accent — **Predyqt violet**, `#853AAB`, OKLCH 0.50 / 0.18 / 312°.
     *
     * It replaced `#7C3AED`, which is Tailwind's stock violet-600 — the same colour as every
     * "AI product" launch page, and 8.7 ΔE from the sleep metric's indigo. Chosen by search
     * against five requirements: ≥5 ΔE from every stock Tailwind violet/purple/fuchsia step
     * (6.4); clear of the data and status colours (nearest, sleep, now 14.5); ≥5.5:1 both as
     * text on white and as a fill under white text (6.6:1 each way, up from 5.7); a dark-mode
     * counterpart ≥4.5:1 on the dark card (7.7:1); and a calmer chroma (0.18 against 0.25).
     * The hue moved *away* from blue on purpose — towards red-violet — which is what freed the
     * blues and indigos for data. Every step below is the same hue at a different lightness.
     */
    primary: '#853AAB',
    primaryDark: '#6C2B8D',
    /**
     * A **fill and decoration** weight, never text on a light ground: 2.8:1 on white, under
     * both AA text (4.5:1) and non-text (3:1). Fine as a chart mark beside a label, a gradient
     * stop, a border on a card whose fill already defines it, or anything on a dark surface.
     * For text, an icon that means something, or the outline that alone marks a selected
     * state, use `primary` (6.6:1).
     */
    primaryLight: '#B788D4',
    /**
     * One stop paler than `primaryLight`, and the kit's own value for a violet that has to
     * read as an *outline* rather than as a fill — the Symptom Checker card's calm badge
     * ring, and the soft halo behind the pillow in its illustration. `primaryLight` at
     * `#A78BFA` is a fill weight: drawn as a 1pt ring at 24pt it reads as a second accent
     * competing with the purple button above it.
     */
    primaryPale: '#D1B3E5',
    /** Tinted surface behind icons and badges. */
    primarySurface: '#F6ECFD',
    /**
     * Deep violet and indigo from the turing kit. The kit uses `#4F46E5` for primary
     * buttons and `#2E1065` as the darkest point of its hero gradients.
     */
    primaryDeep: '#300B42',
    indigo: '#4F46E5',
    /**
     * Hero *surfaces* — every gradient header and hero card. Deep and single-hue, top-left to
     * bottom-right: the brand hue at OKLCH lightness 0.37 → 0.25.
     *
     * The kit draws these as bright violet into indigo, which is `actionGradient` below, and
     * across fifteen screens that made the loudest colour in the app the background of the
     * most important news on each: "3 markers outside your range" printed on something that
     * looks like a promotion. Deep, it reads as a plinth rather than a shout — the argument
     * `TrophyCase` makes for its dark card — and the bright purple is left meaning *act here*.
     * Every colour drawn on a hero gets more legible, not less: white is ≥11:1 on it, and the
     * amber, green and rose the rings use clear 4:1.
     *
     * Only something *darker* than this can be lost on it. A purple button on a hero now
     * reads as a button, where on the old gradient it was the same colour as its background.
     */
    heroGradient: ['#582174', '#44165B', '#310C43'] as [string, string, string],
    /**
     * The bright gradient, for the one control that *is* the brand's action: the raised button
     * in the tab bar. The brand hue from OKLCH 0.56 to 0.43 — no longer the kit's violet into
     * indigo. Not for surfaces — see `heroGradient`.
     */
    actionGradient: ['#9949C3', '#853AAB', '#6C2B8D'] as [string, string, string],

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
    /**
     * Running and jogging. They were the brand purple — 1.3 ΔE from weightlifting's indigo for a
     * deuteranope, and brand colour used as data. Searched against the other activity tints and
     * the brand and status colours: nearest activity 11.9 normal / 6.2 colour-blind, which
     * clears the 6.0 floor because every type also has its own glyph and label. An icon weight
     * (3.3:1 on `goldSurface`) — activity labels are drawn in text colour, never in the tint.
     */
    gold: '#968739',
    goldSurface: '#F8F4DE',

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
    primaryTint: '#F9F5FD',
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

    /**
     * Fills behind white text. In light mode each is its base colour; in dark mode the base
     * colour is lightened to read as *text* on a near-black card, which puts it under 4.5:1
     * with white on top — so a button keeps the saturated value. See `DarkPalette`.
     */
    primaryFill: '#853AAB',
    primaryDarkFill: '#6C2B8D',
    successFill: '#059669',
    warningFill: '#B45309',
    dangerFill: '#DC2626',
};

export type ThemePalette = typeof LightPalette;
export type ColorSchemeName = 'light' | 'dark';

/**
 * The dark set — same keys, same meanings.
 *
 * Built on three rules, each the dark-mode form of one the light set already follows:
 *
 * 1. **Surfaces step up in lightness, not down in shadow.** `canvas` is the page, `background`
 *    the card on it, `surface` a well inside a card. Shadows are near-invisible on black, so
 *    the step between them is what separates a card from the page.
 * 2. **Every foreground colour is lightened until it reads as text on `background`.** The
 *    brand purple becomes `#A78BFA`, the clinical green, amber and red their 300–400 steps.
 *    That is why the `…Fill` tokens exist: the lightened values fail under white text.
 * 3. **Tinted surfaces are dark tints, not pastels.** A `dangerSurface` of `#FEF2F2` on a
 *    black page is a lamp; a flag has to stay a quiet wash behind a coloured word.
 *
 * `white` and `black` are literal in both modes: `white` is text on a fill. A *card* is
 * `background`, never `white` — the one confusion this split cannot absorb for you.
 */
const DarkPalette: ThemePalette = {
    primary: '#C797E5',
    primaryDark: '#DCBCF1',
    primaryLight: '#853AAB',
    primaryPale: '#5D3075',
    primarySurface: '#2F1F38',
    primaryDeep: '#300B42',
    indigo: '#818CF8',
    heroGradient: LightPalette.heroGradient,
    actionGradient: LightPalette.actionGradient,

    success: '#34D399',
    successDeep: '#6EE7B7',
    successSurface: '#0F2A20',
    successBand: '#14503C',
    warning: '#FBBF24',
    warningSurface: '#2B2110',
    danger: '#F87171',
    dangerSurface: '#2D1515',
    info: '#60A5FA',
    infoSurface: '#14203A',
    amber: '#F59E0B',

    flameLight: '#FBBF24',
    flame: '#F59E0B',
    flameDeep: '#FB923C',
    macroFat: '#F472B6',
    macroFatDeep: '#F9A8D4',

    teal: '#2DD4BF',
    tealSurface: '#0E2A27',
    sky: '#38BDF8',
    skySurface: '#0C2233',
    pink: '#F472B6',
    pinkSurface: '#2E1424',
    lime: '#A3E635',
    limeSurface: '#1B2610',
    orange: '#FB923C',
    orangeSurface: '#2E1D10',
    indigoSurface: '#1C1F3A',
    gold: '#E4E495',
    goldSurface: '#28280F',

    text: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#7A7A85',
    textOnWarm: '#B5AC9E',
    border: '#2E2E3A',
    borderLight: '#23232D',
    surface: '#1D1D27',
    surfaceWarm: '#1F1D22',
    background: '#16161E',
    canvas: '#0D0D13',
    borderSlate: '#2A2A35',
    borderStrong: '#6E6E82',

    alert: '#FB7185',
    alertSurface: '#2E1419',
    alertBorder: '#5A2130',
    primaryTint: '#1F1625',
    meterWeak: '#FB7185',
    meterStrong: '#34D399',
    black: '#000000',
    white: '#FFFFFF',

    primaryFill: '#853AAB',
    primaryDarkFill: '#6C2B8D',
    successFill: '#059669',
    warningFill: '#B45309',
    dangerFill: '#DC2626',
};

export const Palettes: Record<ColorSchemeName, ThemePalette> = { light: LightPalette, dark: DarkPalette };

/**
 * The scheme in force, mirrored here by `ThemeProvider` before its children render.
 *
 * For colour that lives in a **table** rather than in a component — a stage's tint, a band's
 * tone — read by helpers that are called during render but are not components, so cannot
 * take a hook. Anything that can call `usePalette()` should: this exists so thirty call
 * sites of `STAGE_META.deep.tint` do not each have to become one.
 */
let activeScheme: ColorSchemeName = 'light';
export const setActiveScheme = (scheme: ColorSchemeName) => { activeScheme = scheme; };
export const activePalette = (): ThemePalette => Palettes[activeScheme];

/**
 * A table that follows the theme. `build` runs at most once per scheme; reads go to the
 * active scheme's copy, so `STAGE_META.deep.tint` read during a render in dark mode is the
 * dark tint, and the call site does not change. Keys, `in` and `Object.entries` all see the
 * active copy.
 *
 * Read it during render. A value copied out at module load is frozen at the light scheme,
 * which is the mistake this exists to avoid.
 */
export function schemed<T extends object>(
    build: (palette: ThemePalette, scheme: ColorSchemeName) => T,
): T {
    // Light is built now, once, both to seed the cache and to learn the table's shape: an array
    // table behind a plain-object proxy answers `Array.isArray` with false, and a FlatList
    // handed one renders nothing.
    const cache: Partial<Record<ColorSchemeName, T>> = { light: build(Palettes.light, 'light') };
    const current = (): T => (cache[activeScheme] ??= build(Palettes[activeScheme], activeScheme));
    const target = (Array.isArray(cache.light) ? [] : {}) as T;
    return new Proxy(target, {
        get: (_target, key) => (current() as Record<PropertyKey, unknown>)[key],
        has: (_target, key) => key in current(),
        ownKeys: () => Reflect.ownKeys(current()),
        getOwnPropertyDescriptor: (t, key) => {
            const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
            // An array's `length` is non-configurable on the target too; everything else is
            // reported configurable because the target does not actually hold it.
            if (descriptor && Reflect.getOwnPropertyDescriptor(t, key)?.configurable !== false) {
                descriptor.configurable = true;
            }
            return descriptor;
        },
    });
}

/* ------------------------------------------------------------------ *
 * tone() — a dark counterpart for a colour that is not a token
 * ------------------------------------------------------------------ */

type Oklch = [number, number, number];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

const hexToOklch = (hex: string): Oklch => {
    const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI];
};

const oklchToHex = ([L, C, h]: Oklch): string | null => {
    const A = C * Math.cos((h * Math.PI) / 180);
    const B = C * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.some((v) => v < -0.0005 || v > 1.0005)) return null;
    return '#' + rgb.map((v) => Math.round(fromLinear(Math.min(1, Math.max(0, v))) * 255)
        .toString(16).padStart(2, '0')).join('').toUpperCase();
};

const toneCache = new Map<string, string>();

/**
 * The colour to draw `hex` in under `scheme`. Light returns it untouched; dark keeps its hue
 * and moves its lightness to the role it plays:
 *
 * - a pastel **surface** (L ≥ 0.9, the `#FEF2F2` kind) becomes a dark tint of the same hue;
 * - a pastel **border or chip** (0.78–0.9, `#FECACA`) becomes a mid-dark tint;
 * - a **foreground** (anything darker) is lightened until it reads on a dark card;
 * - a **grey** is mirrored, so a light grey rule becomes a dark one;
 * - white and black are left alone — white on a fill is still white.
 *
 * For semantic colour that is not a token — a flag's border, a status tint. **Not for data
 * colours**: a categorical palette needs its own dark set validated as a set, which a per-colour
 * mapping cannot guarantee. See `STAGE_META` in `lib/sleep.ts`.
 */
export const tone = (hex: string, scheme: ColorSchemeName = activeScheme): string => {
    if (scheme === 'light' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
    const key = hex.toUpperCase();
    if (key === '#FFFFFF' || key === '#000000') return key;
    const cached = toneCache.get(key);
    if (cached) return cached;
    const [L, C, h] = hexToOklch(key);
    let target: Oklch;
    if (C < 0.02) target = [Math.min(0.92, Math.max(0.22, 1.08 - L)), C, h];
    else if (L >= 0.9) target = [0.27, Math.min(C, 0.05), h];
    else if (L >= 0.78) target = [0.38, Math.min(C, 0.08), h];
    else target = [Math.max(L, 0.76), C, h];
    // Pull chroma in until the colour exists in sRGB; lightness is the property that matters.
    let out = oklchToHex(target);
    for (let c = target[1]; !out && c > 0; c -= 0.01) out = oklchToHex([target[0], Math.max(0, c), target[2]]);
    const result = out ?? key;
    toneCache.set(key, result);
    return result;
};

/** The active scheme, for a module-level helper that has to pick a colour at call time. */
export const activeSchemeName = (): ColorSchemeName => activeScheme;

/**
 * The light set, read statically.
 *
 * **Migration shim.** A file that imports this renders light whatever the person chose. A
 * migrated file takes the palette from `usePalette()` / `makeStyles()` in `hooks/useTheme.ts`
 * instead, and shadows this import inside its components so the JSX does not change.
 */
export const Palette = LightPalette;

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
