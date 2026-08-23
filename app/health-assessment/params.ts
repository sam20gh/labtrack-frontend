/**
 * Canonical router-param contract for the health-assessment flow.
 *
 * The flow carries all of its state in expo-router params: every screen reads
 * `useLocalSearchParams()` and forwards `{ ...params, someKey: value }` to the next one.
 * Nothing is persisted until `complete.tsx` reads these keys and POSTs them.
 *
 * That means a key emitted under one name and read under another is silently dropped —
 * no error, no warning, and the user still sees the success screen. Several such
 * mismatches shipped before this file existed (`name` vs `fullName`, `eatingHabit` vs
 * `eatingHabits`, `dailyCalories` vs `calorieIntake`, plus three `has*` flags that no
 * screen ever emitted).
 *
 * Both ends now import `AssessmentParams`, so a typo is a compile error instead of
 * missing data. When adding a step:
 *   1. add its key(s) here,
 *   2. emit them from the producing screen,
 *   3. read them in `complete.tsx`,
 *   4. confirm the destination field exists in the backend `userModel.js`.
 */

/** Every param key the flow may carry. Keys are optional — any step can be skipped. */
export type AssessmentParams = Partial<{
    // Identity & goals
    fullName: string;
    healthGoals: string;

    // Demographics
    birthYear: string;
    birthMonth: string;
    gender: string;
    genderDescription: string;

    // Body metrics
    weight: string;
    weightUnit: string;
    height: string;
    heightUnit: string;
    bloodType: string;

    // Lifestyle
    fitnessLevel: string;
    fitnessLabel: string;
    sleepLevel: string;
    sleepLabel: string;
    sleepHours: string;
    exerciseTypes: string;
    mood: string;
    moodLabel: string;
    eatingHabits: string;
    calorieIntake: string;

    // Medical history. Each `has*` flag distinguishes an explicit "no" from a skipped
    // step; the matching list is a comma-joined string (see `parseArrayParam`).
    hasMedications: string;
    medications: string;
    hasAllergies: string;
    allergies: string;
    hasConditions: string;
    conditions: string;
    checkupFrequency: string;

    // Notes & voice
    healthNotes: string;
    hasVoiceRecording: string;
    voiceDuration: string;
}>;

export type AssessmentParamKey = keyof AssessmentParams;

/**
 * Merge new values into the params being forwarded to the next screen.
 * Typed so an unknown key fails to compile rather than vanishing at runtime.
 */
export const nextParams = (
    current: Record<string, unknown>,
    updates: AssessmentParams
): Record<string, unknown> => ({ ...current, ...updates });

/**
 * Params arrive as strings (or string arrays on re-entry). Lists are comma-joined on the
 * way out, so accept JSON arrays, real arrays, and comma-separated strings on the way in.
 */
export const parseArrayParam = (param: unknown): string[] => {
    if (!param) return [];
    if (Array.isArray(param)) return param.map(String);
    if (typeof param === 'string') {
        try {
            const parsed = JSON.parse(param);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
            // Not JSON — fall through to comma-splitting
        }
        return param.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
};

/** Booleans travel as the strings 'true' / 'false'. */
export const parseBooleanParam = (param: unknown): boolean => String(param) === 'true';

/**
 * True when the user affirmed the gate question, or when the list has entries anyway.
 * The fallback means a missing `has*` flag can no longer discard data the user typed.
 */
export const hasListEntries = (flag: unknown, list: unknown): boolean =>
    parseBooleanParam(flag) || parseArrayParam(list).length > 0;
