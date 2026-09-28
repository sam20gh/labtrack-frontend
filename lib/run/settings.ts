/**
 * Live-session preferences — per device, like `lib/units.ts`, and for the same reasons:
 * the API has no field for them, and they are read synchronously from render, so they are
 * hydrated once at launch into a module cache.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'runSettings';

export type AudioCues = 'off' | 'unit' | 'half';

export interface RunSettings {
    /** The 3·2·1 before recording starts. */
    countdown: boolean;
    /** Spoken splits: every km/mi, every half, or never. */
    audioCues: AudioCues;
    /** Black on white with the day map, for reading the panel in full sun. */
    highContrast: boolean;
    /** Keep the screen on while the Focus face is showing. Costs battery; off by default. */
    keepAwakeOnFocus: boolean;
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
    countdown: true,
    audioCues: 'unit',
    highContrast: false,
    keepAwakeOnFocus: false,
};

let current: RunSettings = { ...DEFAULT_RUN_SETTINGS };
let hydrated = false;
const listeners = new Set<(s: RunSettings) => void>();

export const getRunSettings = (): RunSettings => current;

const sanitise = (raw: Partial<RunSettings>): RunSettings => ({
    countdown: typeof raw.countdown === 'boolean' ? raw.countdown : DEFAULT_RUN_SETTINGS.countdown,
    audioCues: raw.audioCues === 'off' || raw.audioCues === 'unit' || raw.audioCues === 'half'
        ? raw.audioCues : DEFAULT_RUN_SETTINGS.audioCues,
    highContrast: typeof raw.highContrast === 'boolean' ? raw.highContrast : DEFAULT_RUN_SETTINGS.highContrast,
    keepAwakeOnFocus: typeof raw.keepAwakeOnFocus === 'boolean' ? raw.keepAwakeOnFocus : DEFAULT_RUN_SETTINGS.keepAwakeOnFocus,
});

export const hydrateRunSettings = async (): Promise<RunSettings> => {
    if (hydrated) return current;
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) current = sanitise(JSON.parse(raw));
    } catch {
        // Defaults, not a crash.
    }
    hydrated = true;
    listeners.forEach((fn) => fn(current));
    return current;
};

export const setRunSetting = async <K extends keyof RunSettings>(key: K, value: RunSettings[K]) => {
    current = { ...current, [key]: value };
    listeners.forEach((fn) => fn(current));
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // Applies for this session only.
    }
};

export const useRunSettings = (): RunSettings => {
    const [s, setS] = useState(current);
    useEffect(() => {
        setS(current);
        listeners.add(setS);
        return () => { listeners.delete(setS); };
    }, []);
    return s;
};
