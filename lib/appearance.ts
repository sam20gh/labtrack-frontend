/**
 * Appearance — Light, Dark, or whatever the phone is set to.
 *
 * The same shape as `lib/units.ts`: a per-device preference in AsyncStorage, a synchronous
 * module cache, and subscribers who redraw when it moves. Per-device on purpose — the API
 * has no field for it, and somebody who wants their phone dark and their tablet light has
 * said so by setting them differently.
 *
 * `hydrateAppearance()` is awaited before the first paint in `app/_layout.tsx`, unlike the
 * units: a unit shown in the default for one frame is invisible, a white flash on a dark
 * phone at midnight is not.
 *
 * The native side is told too, via `Appearance.setColorScheme`, so what React Native does
 * not draw — date pickers, alerts, the keyboard — matches what it does. `'system'` hands
 * control back to the phone. That, and `'system'` reporting dark at all, needs
 * `userInterfaceStyle: "automatic"` in `app.json`; a build made before that change reports
 * light whatever the phone says, and an explicit choice still recolours everything JS draws.
 */
import { Appearance } from 'react-native';
import { useEffect, useState } from 'react';

export type AppearancePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'appearancePreference';

/**
 * AsyncStorage, loaded on first use rather than at import. Every component reaches this module
 * through the theme hook, so a module-scope import made the native storage module a dependency
 * of rendering anything — and a component test, which has no native modules, failed before it
 * drew a pixel. The preference is only read or written from `hydrateAppearance` and
 * `setAppearance`, both of which run in the app.
 */
const storage = () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
const VALID: AppearancePreference[] = ['system', 'light', 'dark'];

export const APPEARANCE_OPTIONS: {
    value: AppearancePreference; label: string; hint: string; icon: string;
}[] = [
    { value: 'system', label: 'Match phone', hint: 'Follows your phone’s light or dark setting', icon: 'phone-portrait-outline' },
    { value: 'light', label: 'Light', hint: 'Always light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', hint: 'Always dark — easier on the eyes at night', icon: 'moon-outline' },
];

let current: AppearancePreference = 'system';
let hydrated = false;
const listeners = new Set<(pref: AppearancePreference) => void>();

const applyNative = (pref: AppearancePreference) => {
    try {
        Appearance.setColorScheme(pref === 'system' ? null : pref);
    } catch {
        // iOS 12 / Android 9 have no override. The JS palette still follows the choice.
    }
};

/** Synchronous read. `'system'` until `hydrateAppearance()` has resolved. */
export const getAppearance = (): AppearancePreference => current;

/**
 * Load the stored preference. A corrupt value falls back to `'system'` rather than
 * throwing — a bad preference must not be able to keep the app from starting.
 */
export const hydrateAppearance = async (): Promise<AppearancePreference> => {
    if (hydrated) return current;
    try {
        const raw = await storage().getItem(STORAGE_KEY);
        if (raw && (VALID as string[]).includes(raw)) current = raw as AppearancePreference;
    } catch {
        // Storage unavailable: keep the default.
    }
    hydrated = true;
    applyNative(current);
    listeners.forEach((l) => l(current));
    return current;
};

export const setAppearance = async (pref: AppearancePreference): Promise<void> => {
    if (!VALID.includes(pref) || pref === current) return;
    current = pref;
    applyNative(pref);
    listeners.forEach((l) => l(pref));
    try {
        await storage().setItem(STORAGE_KEY, pref);
    } catch {
        // Applied for this session; it just won't survive a restart.
    }
};

export const onAppearanceChange = (listener: (pref: AppearancePreference) => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

/** The stored preference, live. For the settings screen — screens want `useTheme()`. */
export const useAppearancePreference = (): AppearancePreference => {
    const [pref, setPref] = useState(current);
    useEffect(() => onAppearanceChange(setPref), []);
    return pref;
};
