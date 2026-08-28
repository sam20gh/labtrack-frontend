/**
 * Nutrition tracker client.
 *
 * The tracker is not a standalone calorie counter. Its targets and its coaching both come
 * from the person's health plan — the diet advice on their interpretation, surfaced as
 * `plan.guidance` — so screens should render that guidance rather than inventing generic
 * advice of their own.
 *
 * Analysis never writes. `analysePhoto` and `estimateFromDescription` return a draft the
 * person reviews; `logMeal` is the only call that saves, the same checkpoint report
 * ingestion uses between a misread estimate and the record.
 */
import { api, apiFetch } from './api';
import { getAccessToken } from './auth';
import { API_URL } from '@/constants/config';
import type {
    MealDraft, MealLog, NutritionDay, NutritionHistoryEntry,
    NutritionPlan, NutritionStatus, MealAlignment,
} from '@/types/api';

/**
 * Minutes west of UTC, as `Date.getTimezoneOffset()` reports it.
 *
 * Sent with every call that resolves a calendar day. The server cannot infer it, and
 * defaulting to UTC files an evening meal in the Americas under the following day — on the
 * one screen the whole feature is built around.
 */
const tzOffset = () => new Date().getTimezoneOffset();

/** Local `YYYY-MM-DD`, matching how the server stores `MealLog.day`. */
export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const getStatus = () => api.get<NutritionStatus>('/nutrition/status');

export interface NutritionPlanResponse {
    plan: NutritionPlan | null;
    explanation: string;
    /** Profile fields the server needs before it can estimate a target. */
    missingProfile: string[];
}

export const getNutritionPlan = () => api.get<NutritionPlanResponse>('/nutrition/plan');

export const saveNutritionPlan = (body: {
    /** Null clears an override and returns to the estimated figure. */
    calorieTarget?: number | null;
    mealsPerDay?: number;
    dietaryPreferences?: string[];
    notes?: string;
}) => api.put<{ plan: NutritionPlan; explanation: string }>('/nutrition/plan', body);

export const getDay = (date?: string) =>
    api.get<NutritionDay>(`/nutrition/day?tzOffset=${tzOffset()}${date ? `&date=${date}` : ''}`);

export const getHistory = (days = 14) =>
    api.get<{ from: string; days: number; history: NutritionHistoryEntry[] }>(
        `/nutrition/history?days=${days}&tzOffset=${tzOffset()}`
    );

export interface AnalysisResult {
    draft: MealDraft;
    /** The estimate was low-confidence; the review screen asks the person to check it. */
    needsConfirmation: boolean;
    uncertainties: string[];
}

/** Photograph a meal. Saves nothing — returns a draft to review. */
export const analysePhoto = async (
    file: { uri: string; name: string; mimeType: string },
    note?: string
): Promise<AnalysisResult> => {
    const token = await getAccessToken();
    const form = new FormData();

    // React Native's FormData takes this shape for file parts
    form.append('image', { uri: file.uri, name: file.name, type: file.mimeType } as any);
    if (note) form.append('note', note);

    const response = await fetch(`${API_URL}/nutrition/analyse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not analyse that photo');
    return data;
};

/** Describe a meal in words. Also saves nothing. */
export const estimateFromDescription = (description: string) =>
    api.post<AnalysisResult>('/nutrition/estimate', { description });

/** The only call that writes a meal to the record. */
export const logMeal = (meal: Partial<MealLog> & { name: string; calories: number }) =>
    api.post<{ meal: MealLog }>('/nutrition/meals', {
        ...meal,
        eatenAt: meal.eatenAt || new Date().toISOString(),
        day: meal.day || today(),
        tzOffset: tzOffset(),
    });

export const updateMeal = (id: string, updates: Partial<MealLog>) =>
    apiFetch<{ meal: MealLog }>(`/nutrition/meals/${id}`, {
        method: 'PATCH',
        body: { ...updates, tzOffset: tzOffset() },
    });

export const deleteMeal = (id: string) => api.delete(`/nutrition/meals/${id}`);

/**
 * How each alignment verdict is presented.
 *
 * Neutral wording throughout. Someone logging an honest record of what they ate is doing
 * the thing the app wants, and a screen that scolds them teaches them to stop logging.
 * `unassessed` reads as informational, never as a failure — it means their plan says
 * nothing about diet yet, which is not their doing.
 */
export const ALIGNMENT_META: Record<MealAlignment, {
    label: string;
    color: string;
    bg: string;
    icon: string;
}> = {
    aligned: { label: 'On plan', color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
    partial: { label: 'Part way', color: '#B45309', bg: '#FFFBEB', icon: 'contrast-outline' },
    off_plan: { label: 'Off plan', color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle-outline' },
    unassessed: { label: 'Logged', color: '#6B7280', bg: '#F9FAFB', icon: 'ellipse-outline' },
};

export const MEAL_TYPE_LABEL: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
};

/** Which meal slot a time of day most likely belongs to, for pre-filling the log form. */
export const mealTypeForNow = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
};

/** The multi-select on the setup screen. Values are stored verbatim on the plan. */
export const DIETARY_PREFERENCES = [
    { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf-outline' },
    { id: 'vegan', label: 'Vegan', icon: 'nutrition-outline' },
    { id: 'pescatarian', label: 'Pescatarian', icon: 'fish-outline' },
    { id: 'halal', label: 'Halal', icon: 'moon-outline' },
    { id: 'kosher', label: 'Kosher', icon: 'star-outline' },
    { id: 'gluten_free', label: 'Gluten free', icon: 'ban-outline' },
    { id: 'dairy_free', label: 'Dairy free', icon: 'water-outline' },
    { id: 'low_fodmap', label: 'Low FODMAP', icon: 'medkit-outline' },
] as const;
