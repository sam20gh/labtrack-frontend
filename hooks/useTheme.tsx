/**
 * The live theme — which palette is in force, and the styles built from it.
 *
 * `ThemeProvider` resolves the scheme once, at the root: the stored preference from
 * `lib/appearance.ts`, and the phone's own setting when that preference is `'system'`.
 * Everything below reads it from context, so a switch recolours the whole tree in one
 * render with no restart.
 *
 * How a file uses it — the migration is designed so the JSX does not change:
 *
 *     const useStyles = makeStyles((Palette) => ({ card: { backgroundColor: Palette.background } }));
 *
 *     export default function Screen() {
 *         const Palette = usePalette();   // shadows the static import
 *         const styles = useStyles();
 *         return <Ionicons color={Palette.primary} />;
 *     }
 *
 * `makeStyles` builds each scheme's sheet at most once and caches it, so switching costs
 * one `StyleSheet.create` per file, not one per render.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { Palettes, setActiveScheme, type ColorSchemeName, type ThemePalette } from '@/constants/theme';
import { useAppearancePreference, type AppearancePreference } from '@/lib/appearance';

type Theme = {
    scheme: ColorSchemeName;
    palette: ThemePalette;
    preference: AppearancePreference;
};

const ThemeContext = createContext<Theme>({
    scheme: 'light',
    palette: Palettes.light,
    preference: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const preference = useAppearancePreference();
    const system = useColorScheme();
    const scheme: ColorSchemeName = preference === 'system'
        ? (system === 'dark' ? 'dark' : 'light')
        : preference;
    // Before the children render, so a `schemed()` table read during their render sees it.
    setActiveScheme(scheme);
    const value = useMemo(
        () => ({ scheme, palette: Palettes[scheme], preference }),
        [scheme, preference],
    );
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);

export const usePalette = (): ThemePalette => useContext(ThemeContext).palette;

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
    factory: (Palette: ThemePalette) => T & StyleSheet.NamedStyles<any>,
): () => T {
    const cache: Partial<Record<ColorSchemeName, T>> = {};
    return function useStyles(): T {
        const { scheme } = useContext(ThemeContext);
        return (cache[scheme] ??= StyleSheet.create(factory(Palettes[scheme])));
    };
}
