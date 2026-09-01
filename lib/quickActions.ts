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
 * Nine of them, which is a 3×3 grid on any phone. If a tenth is added, add it as part of a
 * pair — a row of one reads as a mistake.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { Router } from 'expo-router';
import { openResourcesHub } from './resources';

export interface QuickAction {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    /** Kept short enough to sit under a 48pt icon in a three-column grid without wrapping. */
    label: string;
    route: string;
    /**
     * True when the destination is gated by a first-run screen, so `openQuickAction` has to
     * resolve where to send someone rather than the caller hard-coding it. Only Resources
     * does this today; the flag exists so the next one does not put its AsyncStorage read
     * into a component.
     */
    gated?: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
    { id: 'add-result', icon: 'add-circle-outline', label: 'Add result', route: '/add-result' },
    { id: 'metrics', icon: 'analytics-outline', label: 'Metrics', route: '/metrics' },
    { id: 'symptoms', icon: 'pulse-outline', label: 'Symptoms', route: '/symptoms' },
    { id: 'nutrition', icon: 'restaurant-outline', label: 'Nutrition', route: '/nutrition' },
    { id: 'activity', icon: 'fitness-outline', label: 'Activity', route: '/activity' },
    { id: 'medications', icon: 'medkit-outline', label: 'Medications', route: '/medications' },
    { id: 'plan', icon: 'calendar-outline', label: 'My plan', route: '/myplans' },
    { id: 'consult', icon: 'people-outline', label: 'Consult', route: '/(tabs)/professionals' },
    { id: 'resources', icon: 'library-outline', label: 'Resources', route: '/resources', gated: true },
];

/**
 * Navigate to one of them.
 *
 * The Resources gate reads AsyncStorage and therefore has to be awaited, which is why every
 * caller goes through here rather than pushing `action.route` itself. The gate itself lives
 * in `lib/resources.ts` beside the key it reads.
 */
export const openQuickAction = async (router: Router, action: QuickAction): Promise<void> => {
    if (action.gated) {
        await openResourcesHub(router);
        return;
    }
    router.push(action.route as never);
};
