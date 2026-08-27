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

import type { User } from '@/types/api';

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

/**
 * A single param, or undefined when the step was skipped. expo-router hands back
 * `string | string[]`, and an empty string means "no answer" rather than "empty answer".
 */
export const paramString = (param: unknown): string | undefined => {
    const value = Array.isArray(param) ? param[0] : param;
    if (value === undefined || value === null) return undefined;
    const text = String(value);
    return text.length > 0 ? text : undefined;
};

/** A numeric param, falling back to the screen's own default on a first run. */
export const paramNumber = (param: unknown, fallback: number): number => {
    const text = paramString(param);
    const value = text !== undefined ? Number(text) : NaN;
    return Number.isFinite(value) ? value : fallback;
};

/** Booleans travel as the strings 'true' / 'false'. */
export const parseBooleanParam = (param: unknown): boolean => String(param) === 'true';

/**
 * True when the user affirmed the gate question, or when the list has entries anyway.
 * The fallback means a missing `has*` flag can no longer discard data the user typed.
 */
export const hasListEntries = (flag: unknown, list: unknown): boolean =>
    parseBooleanParam(flag) || parseArrayParam(list).length > 0;

// ---------------------------------------------------------------------------
// Re-entry: turning a saved assessment back into params
// ---------------------------------------------------------------------------

/**
 * `mood.tsx` uses its own option ids; `MoodEntrySchema.mood` is a required enum of
 * Excellent | Good | Okay | Poor | Bad. Sending an id straight through fails the
 * backend's `runValidators` check, which rejects the entire assessment.
 */
export const MOOD_ID_TO_ENUM: Record<string, string> = {
    very_sad: 'Bad',
    sad: 'Poor',
    neutral: 'Okay',
    happy: 'Good',
    very_happy: 'Excellent',
};

/** The same table read backwards, so a saved mood can seed the screen it came from. */
export const MOOD_ENUM_TO_ID: Record<string, string> = Object.fromEntries(
    Object.entries(MOOD_ID_TO_ENUM).map(([id, label]) => [label, id])
);

/** Drop keys with nothing behind them — a param present but empty still counts as an answer. */
const defined = (params: AssessmentParams): AssessmentParams =>
    Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ) as AssessmentParams;

/**
 * Rebuild the flow's params from what was saved, so "update my answers" starts from the
 * existing ones instead of the screens' hardcoded defaults.
 *
 * This is the inverse of the mapping in `complete.tsx`, and the two have to stay in step:
 * a key that seeds under one name and is read under another silently reverts to the
 * default, which looks like the app forgot the answer.
 *
 * Units are canonical here — weight in kg, height in cm, exactly as `userModel.js` stores
 * them — and the two screens that offer imperial seed themselves into metric.
 */
export const seedParamsFromUser = (user: User | null | undefined): AssessmentParams => {
    if (!user) return {};
    const ha = user.healthAssessment;
    const l = ha?.lifestyle;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const latestMood = ha?.moodHistory?.[ha.moodHistory.length - 1]?.mood;
    const latestNote = ha?.notes?.[ha.notes.length - 1]?.content;

    const medications = (ha?.medications ?? []).map(m => m.name).filter(Boolean);
    const allergies = (ha?.allergies ?? []).map(a => a.allergen).filter(Boolean);
    const conditions = (ha?.conditions ?? []).map(c => c.name).filter(Boolean);

    return defined({
        fullName,
        healthGoals: (ha?.healthGoals ?? []).join(','),

        // dob is stored as 'YYYY-MM-DD'; the flow only ever asked for the year.
        birthYear: user.dob ? String(user.dob).slice(0, 4) : undefined,
        gender: user.gender ?? undefined,

        weight: user.weight != null ? String(user.weight) : undefined,
        weightUnit: user.weight != null ? 'kg' : undefined,
        height: user.height != null ? String(user.height) : undefined,
        heightUnit: user.height != null ? 'cm' : undefined,
        bloodType: user.bloodType ?? undefined,

        fitnessLevel: l?.fitnessLevel,
        sleepLevel: l?.sleepQuality != null ? String(l.sleepQuality) : undefined,
        sleepHours: l?.sleepHoursPerNight != null ? String(l.sleepHoursPerNight) : undefined,
        exerciseTypes: (l?.exerciseTypes ?? []).join(','),
        mood: latestMood ? MOOD_ENUM_TO_ID[latestMood] : undefined,
        eatingHabits: l?.dietType,
        calorieIntake: ha?.nutritionGoals?.dailyCalorieGoal != null
            ? String(ha.nutritionGoals.dailyCalorieGoal)
            : undefined,

        // An empty list is a real answer ("no medications"), so the flag is sent either
        // way once an assessment exists — otherwise the gate screens reopen as unanswered.
        hasMedications: ha ? String(medications.length > 0) : undefined,
        medications: medications.join(','),
        hasAllergies: ha ? String(allergies.length > 0) : undefined,
        allergies: allergies.join(','),
        hasConditions: ha ? String(conditions.length > 0) : undefined,
        conditions: conditions.join(','),

        checkupFrequency: l?.checkupFrequency,
        healthNotes: latestNote,
    });
};
