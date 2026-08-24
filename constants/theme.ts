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

    // Clinical status. These are semantic, not decorative: a person reads them to
    // understand a result, so they must stay distinguishable and consistent everywhere.
    success: '#059669',
    successSurface: '#ECFDF5',
    warning: '#B45309',
    warningSurface: '#FFFBEB',
    danger: '#DC2626',
    dangerSurface: '#FEF2F2',
    info: '#1D4ED8',
    infoSurface: '#EFF6FF',

    // Neutrals
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    surface: '#FAFAFA',
    background: '#FFFFFF',

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
