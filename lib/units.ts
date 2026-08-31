/**
 * Display units.
 *
 * The turing kit's "Units & Metrics" screen (`Design/profile.svg`, frame 5) offers six
 * tiles. This module is what makes that screen change anything: without it, picking "mi"
 * would store a string nothing reads, which is the dummy control this codebase keeps
 * refusing to ship.
 *
 * Three rules it follows:
 *
 * 1. **The record stays canonical.** Every value crossing the API is metric — kilograms,
 *    millilitres, metres, mmHg, kcal — exactly as `models/MetricLog.js` and
 *    `models/userModel.js` store it. A preference only changes what is drawn and what a
 *    typed number is converted *from* before it is sent. Nothing is ever written in
 *    display units.
 * 2. **Only units the app actually applies are offered.** Blood pressure is mmHg with no
 *    alternative, because `utils/bloodPressure.js` classifies in mmHg and `MetricLog`
 *    stores the category as it was classified at the time — a kPa display would put a
 *    number next to a band that was never computed for it. The screen says so rather than
 *    drawing a switch that does nothing.
 * 3. **Reads are synchronous.** Formatters are called from render, so the preference is
 *    hydrated once at launch into a module cache and every later read hits that. The
 *    async setter notifies subscribers, so a screen that picked a unit redraws without
 *    a refetch.
 *
 * Persisted on the device, not the server: the API has no unit field, and a preference
 * that silently failed to sync would be worse than one that is honestly per-phone.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'unitPreferences';

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ftin';
export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'ml' | 'floz';
export type EnergyUnit = 'kcal' | 'kJ';

export interface UnitPrefs {
    weight: WeightUnit;
    height: HeightUnit;
    distance: DistanceUnit;
    volume: VolumeUnit;
    energy: EnergyUnit;
}

export type UnitKey = keyof UnitPrefs;

/** Metric throughout — the same system the API stores in, so a fresh install converts nothing. */
export const DEFAULT_UNITS: UnitPrefs = {
    weight: 'kg',
    height: 'cm',
    distance: 'km',
    volume: 'ml',
    energy: 'kcal',
};

/**
 * What each tile offers, in the order the kit draws them.
 *
 * `canonical` names the unit the API speaks, so a reader can tell at a glance which choice
 * is a conversion and which is a pass-through.
 */
export const UNIT_OPTIONS: {
    key: UnitKey;
    label: string;
    icon: string;
    canonical: string;
    choices: { value: string; label: string; hint: string }[];
}[] = [
        {
            key: 'distance', label: 'Distance', icon: 'walk-outline', canonical: 'metres',
            choices: [
                { value: 'km', label: 'km', hint: 'Kilometres' },
                { value: 'mi', label: 'mi', hint: 'Miles' },
            ],
        },
        {
            key: 'weight', label: 'Weight', icon: 'barbell-outline', canonical: 'kg',
            choices: [
                { value: 'kg', label: 'kg', hint: 'Kilograms' },
                { value: 'lb', label: 'lb', hint: 'Pounds' },
            ],
        },
        {
            key: 'height', label: 'Height', icon: 'resize-outline', canonical: 'cm',
            choices: [
                { value: 'cm', label: 'cm', hint: 'Centimetres' },
                { value: 'ftin', label: 'ft/in', hint: 'Feet and inches' },
            ],
        },
        {
            key: 'volume', label: 'Hydration', icon: 'water-outline', canonical: 'ml',
            choices: [
                { value: 'ml', label: 'ml', hint: 'Millilitres' },
                { value: 'floz', label: 'fl oz', hint: 'US fluid ounces' },
            ],
        },
        {
            key: 'energy', label: 'Energy', icon: 'flame-outline', canonical: 'kcal',
            choices: [
                { value: 'kcal', label: 'kcal', hint: 'Calories' },
                { value: 'kJ', label: 'kJ', hint: 'Kilojoules' },
            ],
        },
    ];

/* ------------------------------------------------------------------ *
 * The cache, and the subscribers who redraw when it moves
 * ------------------------------------------------------------------ */

let current: UnitPrefs = { ...DEFAULT_UNITS };
let hydrated = false;
const listeners = new Set<(prefs: UnitPrefs) => void>();

/** Synchronous read. Returns defaults until `hydrateUnits()` has resolved. */
export const getUnits = (): UnitPrefs => current;

/**
 * Load the stored preference into the module cache.
 *
 * Called once from `app/_layout.tsx` before the first screen paints. An unknown or
 * corrupt value falls back to the default for that key rather than throwing — a bad
 * preference must not be able to keep the app from starting.
 */
export const hydrateUnits = async (): Promise<UnitPrefs> => {
    if (hydrated) return current;
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
            const stored = JSON.parse(raw) as Partial<UnitPrefs>;
            const next = { ...DEFAULT_UNITS };
            for (const option of UNIT_OPTIONS) {
                const value = stored[option.key];
                if (value && option.choices.some((c) => c.value === value)) {
                    (next as Record<string, string>)[option.key] = value;
                }
            }
            current = next;
        }
    } catch {
        // A device that cannot read its own preferences still gets metric, not a crash.
    }
    hydrated = true;
    listeners.forEach((fn) => fn(current));
    return current;
};

export const setUnit = async <K extends UnitKey>(key: K, value: UnitPrefs[K]): Promise<UnitPrefs> => {
    current = { ...current, [key]: value };
    listeners.forEach((fn) => fn(current));
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // The choice still applies for this session; it just will not survive a restart.
    }
    return current;
};

/** Subscribe a screen to unit changes. Returns the unsubscribe. */
export const onUnitsChange = (fn: (prefs: UnitPrefs) => void): (() => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

/** Re-renders the calling component whenever a unit is picked anywhere in the app. */
export const useUnits = (): UnitPrefs => {
    const [prefs, setPrefs] = useState<UnitPrefs>(current);
    useEffect(() => {
        setPrefs(current);
        return onUnitsChange(setPrefs);
    }, []);
    return prefs;
};

/* ------------------------------------------------------------------ *
 * Conversion. Canonical in, display out — and back again for input.
 * ------------------------------------------------------------------ */

const LB_PER_KG = 2.2046226218;
const ML_PER_FLOZ = 29.5735295625;
const KJ_PER_KCAL = 4.184;
const M_PER_MILE = 1609.344;

/** Short label for the unit in force — for a "+ 2.4 __" style value/unit pair. */
export const unitLabel = (key: UnitKey, prefs: UnitPrefs = current): string => {
    switch (key) {
        case 'weight': return prefs.weight === 'kg' ? 'kg' : 'lb';
        case 'height': return prefs.height === 'cm' ? 'cm' : 'ft';
        case 'distance': return prefs.distance === 'km' ? 'km' : 'mi';
        case 'volume': return prefs.volume === 'ml' ? 'ml' : 'fl oz';
        case 'energy': return prefs.energy === 'kcal' ? 'kcal' : 'kJ';
    }
};

/** kg (as stored) → the displayed number. Rounded to one decimal, as a scale reads. */
export const displayWeight = (kg: number, prefs: UnitPrefs = current): number =>
    prefs.weight === 'kg' ? Math.round(kg * 10) / 10 : Math.round(kg * LB_PER_KG * 10) / 10;

/** A number the person typed, in whatever unit is showing → kg for the API. */
export const toCanonicalWeight = (value: number, prefs: UnitPrefs = current): number =>
    prefs.weight === 'kg' ? value : value / LB_PER_KG;

export const formatWeight = (kg?: number | null, prefs: UnitPrefs = current): string | null => {
    if (kg == null || !Number.isFinite(kg)) return null;
    return `${displayWeight(kg, prefs)} ${unitLabel('weight', prefs)}`;
};

/**
 * cm → "180 cm" or "5'11\"".
 *
 * Feet and inches is a two-part figure, not a decimal, so it is formatted rather than
 * returned as a number — "5.9 ft" is a value nobody has ever said out loud.
 */
export const formatHeight = (cm?: number | null, prefs: UnitPrefs = current): string | null => {
    if (cm == null || !Number.isFinite(cm)) return null;
    if (prefs.height === 'cm') return `${Math.round(cm)} cm`;
    const totalInches = Math.round(cm / 2.54);
    return `${Math.floor(totalInches / 12)}′ ${totalInches % 12}″`;
};

/**
 * metres → the distance line.
 *
 * Under a kilometre the metric form stays in metres and the imperial form switches to
 * yards, because "0.1 mi" for a walk to the shop is a number with no useful precision.
 */
export const formatDistanceIn = (metres?: number | null, prefs: UnitPrefs = current): string | null => {
    if (metres == null || !Number.isFinite(metres)) return null;
    if (prefs.distance === 'km') {
        const km = metres / 1000;
        return km >= 1 ? `${km.toFixed(km >= 10 ? 0 : 1)} km` : `${Math.round(metres)} m`;
    }
    const miles = metres / M_PER_MILE;
    return miles >= 0.1 ? `${miles.toFixed(miles >= 10 ? 0 : 1)} mi` : `${Math.round(metres * 1.09361)} yd`;
};

/** km typed into a form → metres for the API, in whichever unit the form is showing. */
export const toCanonicalDistanceM = (value: number, prefs: UnitPrefs = current): number =>
    prefs.distance === 'km' ? value * 1000 : value * M_PER_MILE;

export const displayVolume = (ml: number, prefs: UnitPrefs = current): number =>
    prefs.volume === 'ml' ? Math.round(ml) : Math.round((ml / ML_PER_FLOZ) * 10) / 10;

export const toCanonicalMl = (value: number, prefs: UnitPrefs = current): number =>
    prefs.volume === 'ml' ? value : value * ML_PER_FLOZ;

/**
 * ml → "1.8 L" / "62 fl oz".
 *
 * Mirrors `formatMl` in `lib/metrics.ts`, which promotes to litres past a thousand. US
 * fluid ounces have no such promotion in everyday use, so they stay flat.
 */
export const formatVolume = (ml?: number | null, prefs: UnitPrefs = current): string | null => {
    if (ml == null || !Number.isFinite(ml)) return null;
    if (prefs.volume === 'ml') {
        return ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} ml`;
    }
    return `${displayVolume(ml, prefs)} fl oz`;
};

export const displayEnergy = (kcal: number, prefs: UnitPrefs = current): number =>
    prefs.energy === 'kcal' ? Math.round(kcal) : Math.round(kcal * KJ_PER_KCAL);

export const formatEnergy = (kcal?: number | null, prefs: UnitPrefs = current): string | null => {
    if (kcal == null || !Number.isFinite(kcal)) return null;
    return `${displayEnergy(kcal, prefs).toLocaleString()} ${unitLabel('energy', prefs)}`;
};

/* ------------------------------------------------------------------ *
 * Metric cards
 * ------------------------------------------------------------------ */

/**
 * Re-present one `MetricCard` figure in the unit the person picked.
 *
 * `/metrics/overview` returns each card's value with the unit the record is stored in.
 * Only two of the six are convertible — weight (kg) and hydration (ml). Blood pressure,
 * heart rate, sleep and steps pass straight through, and passing through is the *default*
 * rather than a special case, so a metric added later shows its server unit until someone
 * deliberately teaches this function about it.
 *
 * Takes and returns the unit string as well as the number, because a converted value with
 * the original unit label beside it is worse than no conversion at all.
 */
export const presentMetric = (
    key: string,
    value: number | string | null,
    unit: string,
    prefs: UnitPrefs = current,
): { value: number | string | null; unit: string } => {
    if (typeof value !== 'number') return { value, unit };

    if (key === 'weight' && unit === 'kg') {
        return { value: displayWeight(value, prefs), unit: unitLabel('weight', prefs) };
    }
    if (key === 'hydration' && unit === 'ml') {
        return { value: displayVolume(value, prefs), unit: unitLabel('volume', prefs) };
    }
    return { value, unit };
};
