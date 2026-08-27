/**
 * The answer tables the assessment offers, in one place.
 *
 * These lived inside the screens that render them, which was fine while the screens were
 * the only thing that needed them. The review screen has to turn a *saved* answer back
 * into the words the person picked — `balanced` reads as "Balanced Diet", `4` reads as
 * "Athletic" — and a second copy of these tables would drift the moment an option is
 * renamed. Both the questions and the summary now read from here.
 *
 * The ids are what gets persisted (as `healthGoals`, `lifestyle.dietType`,
 * `lifestyle.exerciseTypes`, and so on), so renaming an id orphans existing data. Change
 * labels freely; change ids only with a migration.
 */
import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export interface HealthGoal {
    id: string;
    icon: IconName;
    label: string;
}

export const healthGoals: HealthGoal[] = [
    { id: 'improve_health', icon: 'fitness-outline', label: 'Improve my overall health' },
    { id: 'predict_health', icon: 'analytics-outline', label: 'I wanna predict my health' },
    { id: 'manage_medications', icon: 'medkit-outline', label: 'Manage my medications' },
    { id: 'try_ai', icon: 'chatbubble-ellipses-outline', label: 'I wanna try Dr. T AI assistant' },
    { id: 'track_activity', icon: 'footsteps-outline', label: 'I want to track activity' },
    { id: 'just_try', icon: 'phone-portrait-outline', label: 'Just wanna try the app' },
];

export interface ExerciseType {
    id: string;
    icon: IconName;
    label: string;
}

export const exerciseTypes: ExerciseType[] = [
    { id: 'jogging', icon: 'walk-outline', label: 'Jogging' },
    { id: 'cardio', icon: 'heart-outline', label: 'Cardio' },
    { id: 'swimming', icon: 'water-outline', label: 'Swimming' },
    { id: 'walking', icon: 'footsteps-outline', label: 'Walking' },
    { id: 'cycling', icon: 'bicycle-outline', label: 'Cycling' },
    { id: 'aerobics', icon: 'body-outline', label: 'Aerobics' },
    { id: 'other', icon: 'fitness-outline', label: 'Other' },
];

export interface EatingHabit {
    id: string;
    icon: IconName;
    label: string;
    description: string;
}

export const eatingHabits: EatingHabit[] = [
    {
        id: 'balanced',
        icon: 'restaurant-outline',
        label: 'Balanced Diet',
        description: "I'm eating a very balanced diet"
    },
    {
        id: 'vegetarian',
        icon: 'leaf-outline',
        label: 'Vegetarian',
        description: "I was a rabbit on my previous life"
    },
    {
        id: 'low_carb',
        icon: 'nutrition-outline',
        label: 'Low Carb',
        description: "I am allergic to carbohydrates"
    },
    {
        id: 'gluten_free',
        icon: 'ban-outline',
        label: 'Gluten Free',
        description: "I hate glutens with all of my life"
    },
];

export const checkupFrequencies = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'bi-weekly', label: 'Bi-weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'bi-monthly', label: 'Bi-monthly' },
    { id: 'yearly', label: 'Yearly' },
];

export interface FitnessLevel {
    level: number;
    label: string;
    description: string;
    color: string;
}

export const fitnessLevels: FitnessLevel[] = [
    { level: 1, label: 'Sedentary', description: 'I rarely exercise', color: '#EF4444' },
    { level: 2, label: 'Light', description: 'I exercise 1 - 2 times weekly', color: '#F97316' },
    { level: 3, label: 'Moderate', description: 'I exercise 2 - 3 times weekly', color: '#EAB308' },
    { level: 4, label: 'Athletic', description: 'I exercise 3 - 4 times weekly', color: '#22C55E' },
    { level: 5, label: 'Elite', description: 'I exercise 5+ times weekly', color: '#10B981' },
];

export interface SleepLevel {
    level: number;
    label: string;
    hours: string;
    /** Midpoint of `hours`, saved as healthAssessment.lifestyle.sleepHoursPerNight */
    hoursValue: number;
}

export const sleepLevels: SleepLevel[] = [
    { level: 1, label: 'Very Poor', hours: 'Less than 4 hours daily', hoursValue: 3.5 },
    { level: 2, label: 'Poor', hours: '4 - 5 hours daily', hoursValue: 4.5 },
    { level: 3, label: 'Fair', hours: '5 - 6 hours daily', hoursValue: 5.5 },
    { level: 4, label: 'Good', hours: '6 - 7 hours daily', hoursValue: 6.5 },
    { level: 5, label: 'Moderate', hours: '6 - 7 hours daily', hoursValue: 6.5 },
];

export interface MoodOption {
    id: string;
    emoji: string;
    label: string;
    color: string;
}

export const moodOptions: MoodOption[] = [
    { id: 'very_sad', emoji: '😢', label: "I'm feeling very sad", color: '#3B82F6' },
    { id: 'sad', emoji: '😔', label: "I'm feeling sad", color: '#6B7280' },
    { id: 'neutral', emoji: '😐', label: "I'm feeling okay", color: '#9CA3AF' },
    { id: 'happy', emoji: '😊', label: "I'm feeling happy", color: '#F59E0B' },
    { id: 'very_happy', emoji: '😄', label: "I'm feeling very happy", color: '#EAB308' },
];

/** Look a label up by id, falling back to the raw stored value rather than to nothing. */
export const labelFor = (
    table: { id: string; label: string }[],
    id: string | undefined | null
): string | undefined => (id ? table.find(o => o.id === id)?.label ?? id : undefined);

/** The same, for the two ladders keyed by a 1–5 level instead of an id. */
export const labelForLevel = (
    table: { level: number; label: string }[],
    level: number | string | undefined | null
): string | undefined => {
    const value = Number(level);
    if (!Number.isFinite(value)) return undefined;
    return table.find(o => o.level === value)?.label ?? String(level);
};
