/**
 * The stress indicator and check-ins — the phone's half of `utils/stressLevel.js`.
 *
 * The server decides every level and every colour; this file only names the shapes and
 * says what each level looks like without its colour. Green and red are the pair colour-blind
 * readers lose, so each level also has a glyph and words, and no screen may draw the colour
 * alone.
 */
import { api } from './api';

export type StressLevelKey = 'below' | 'usual' | 'above';

export interface StressLevel {
    key: StressLevelKey;
    label: string;
    /** Light-mode hex from the server, drawn through `tone()`. Null for "near usual". */
    colour: string | null;
}

export interface StressReading {
    at: string;
    value: number;
    level: StressLevelKey | null;
}

export interface StressCheckIn {
    id: string;
    at: string;
    day: string;
    feeling: number;
    feelingLabel: string | null;
    /** The bracelet's nearest reading when they checked in, or null if nothing was close. */
    deviceScore: number | null;
    deviceAt: string | null;
    note: string | null;
}

export interface Feeling {
    value: number;
    key: string;
    label: string;
}

/** What `GET /metrics/stress/history` adds to the shared history shape. */
export interface StressHistoryExtras {
    baseline?: number | null;
    level?: StressLevel | null;
    intraday?: { day: string; readings: StressReading[] } | null;
    checkIns?: StressCheckIn[];
    feelings?: Feeling[];
    /** Every level the server can return, with its colour — what the legend draws. */
    levels?: (StressLevel & { short?: string })[];
}

/** The fallback when an older server sends no `feelings`. Same five as the server's table. */
export const FEELINGS: Feeling[] = [
    { value: 1, key: 'calm', label: 'Calm' },
    { value: 2, key: 'okay', label: 'Okay' },
    { value: 3, key: 'tense', label: 'Tense' },
    { value: 4, key: 'stressed', label: 'Stressed' },
    { value: 5, key: 'overwhelmed', label: 'Overwhelmed' },
];

/** The glyph that carries a level without its colour. */
export const LEVEL_ICON: Record<StressLevelKey, string> = {
    below: 'arrow-down-circle',
    usual: 'remove-circle',
    above: 'arrow-up-circle',
};

export const logStressCheckIn = (feeling: number, note?: string) =>
    api.post<{ checkIn: StressCheckIn }>('/metrics/stress/check-ins', {
        feeling,
        note: note?.trim() || undefined,
        tzOffset: new Date().getTimezoneOffset(),
    });

export const deleteStressCheckIn = (id: string) =>
    api.delete<{ message: string }>(`/metrics/stress/check-ins/${id}`);
