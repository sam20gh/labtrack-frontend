/**
 * The shortcuts that appear both in the home page's grid and in the tab bar's centre sheet.
 *
 * One list, two surfaces. They were never going to be maintained as two copies — adding a
 * tracker and remembering to add it in both places is exactly the kind of drift the
 * `GLOSSARY`/`UNCATALOGUED` split in `biomarkerGlossary.js` has a test for.
 *
 * **Nothing on the tab bar belongs here.** These are the screens that have no permanent
 * home in the bar, which is the whole reason the sheet exists — a shortcut to Orders inside
 * a sheet you open from the bar that already shows Orders is a tap that saves nothing.
 * `Consult` earns its place for the opposite reason: professionals used to be a tab and is
 * not one any more, so this list is now the way people reach it.
 *
 * **The count is a layout constraint, not a preference.** The sheet lays them out in three
 * fixed columns, so nine was a clean 3×3 and a tenth alone would leave a final row of one,
 * which reads as a mistake rather than as a list. Hydration arrived with the water tracker's
 * own screens; Appointments is what makes the last row two rather than one, and it earns the
 * slot on the same grounds Consult does — the diary at `/appointments` is a whole feature
 * reachable today only from the home screen. Predict makes twelve, which closes the grid at a
 * clean 3×4. Badges would have been a thirteenth alone on its own row, so it arrives paired
 * with Score — which had no shortcut of its own, and is the number every badge sits beside.
 * Fourteen leaves a final row of two, which reads as a list; fifteen closes the grid again,
 * which is what Sleep does — the sleep tracker is a whole feature whose only other way in is
 * the home screen's own card. The next single addition leaves an orphan and has to wait for a
 * partner.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { Router } from 'expo-router';
import { openResourcesHub } from './resources';
import { openPredictions } from './prediction';
import { openAchievements } from './achievements';

export interface QuickAction {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    /** Kept short enough to sit under a 48pt icon in a three-column grid without wrapping. */
    label: string;
    route: string;
    /**
     * True when the destination is gated by a first-run screen, so `openQuickAction` has to
     * resolve where to send someone rather than the caller hard-coding it. Resources and
     * Predict both do; the flag exists so neither puts its AsyncStorage read into a component.
     */
    gated?: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
    { id: 'add-result', icon: 'add-circle-outline', label: 'Add result', route: '/add-result' },
    { id: 'metrics', icon: 'analytics-outline', label: 'Metrics', route: '/metrics' },
    { id: 'symptoms', icon: 'pulse-outline', label: 'Symptoms', route: '/symptoms' },
    { id: 'nutrition', icon: 'restaurant-outline', label: 'Nutrition', route: '/nutrition' },
    { id: 'activity', icon: 'fitness-outline', label: 'Activity', route: '/activity' },
    { id: 'sleep', icon: 'moon-outline', label: 'Sleep', route: '/sleep' },
    { id: 'medications', icon: 'medkit-outline', label: 'Medications', route: '/medications' },
    { id: 'hydration', icon: 'water-outline', label: 'Hydration', route: '/metrics/water' },
    { id: 'plan', icon: 'calendar-outline', label: 'My plan', route: '/myplans' },
    { id: 'consult', icon: 'people-outline', label: 'Consult', route: '/(tabs)/professionals' },
    { id: 'appointments', icon: 'today-outline', label: 'Diary', route: '/appointments' },
    { id: 'resources', icon: 'library-outline', label: 'Resources', route: '/resources', gated: true },
    { id: 'predict', icon: 'sparkles-outline', label: 'Predict', route: '/predict', gated: true },
    { id: 'achievements', icon: 'trophy-outline', label: 'Badges', route: '/achievements', gated: true },
    { id: 'score', icon: 'speedometer-outline', label: 'Score', route: '/score' },
];

/**
 * Navigate to one of them.
 *
 * The first-run gates read AsyncStorage and therefore have to be awaited, which is why every
 * caller goes through here rather than pushing `action.route` itself. Each gate lives beside
 * the key it reads — `lib/resources.ts` and `lib/prediction.ts`.
 */
export const openQuickAction = async (router: Router, action: QuickAction): Promise<void> => {
    if (action.gated) {
        // Each gate lives beside the key it reads, so this only has to know which one to call.
        const gates: Record<string, (r: Router) => Promise<void>> = {
            predict: openPredictions,
            achievements: openAchievements,
            resources: openResourcesHub,
        };
        await (gates[action.id] ?? openResourcesHub)(router);
        return;
    }
    router.push(action.route as never);
};
