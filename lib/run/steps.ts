/**
 * Steps for a finished session — iOS only, and deliberately.
 *
 * `expo-sensors` does not deliver pedometer updates while the app is in the background, and
 * a phone on a run is in a pocket with the screen off. A live Android count would therefore
 * be a large undercount stored as if it were the run's steps. iOS keeps its own history in
 * the motion coprocessor, so `getStepCountAsync(start, end)` over the session window is
 * complete however the app spent the run. Android answers null; the session's steps can be
 * filled from Health Connect over the same window on the next sync (plan, R4), the way
 * `enrich()` joins heart rate to a workout.
 */
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

/**
 * Asked at Start, beside the location prompt — never at the finish line, where a permission
 * sheet is the last thing somebody out of breath wants. Refusing costs the step count only.
 */
export const prepareSteps = async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    try {
        if (!(await Pedometer.isAvailableAsync())) return;
        const permission = await Pedometer.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) await Pedometer.requestPermissionsAsync();
    } catch {
        // No motion hardware or no permission: the run records without steps.
    }
};

export const stepsForWindow = async (start: number, end: number): Promise<number | null> => {
    if (Platform.OS !== 'ios') return null;
    try {
        if (!(await Pedometer.isAvailableAsync())) return null;
        if (!(await Pedometer.getPermissionsAsync()).granted) return null;
        const { steps } = await Pedometer.getStepCountAsync(new Date(start), new Date(end));
        return Number.isFinite(steps) && steps > 0 ? steps : null;
    } catch {
        return null;
    }
};
