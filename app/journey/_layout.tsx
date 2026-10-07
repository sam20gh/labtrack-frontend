import { Stack } from 'expo-router';

/**
 * Journey screens reached from the home card and from notifications — today, what changed in the analysis.
 *
 * A feature directory needs its own layout: without one its screens register individually on
 * the root stack, the root's `<Stack.Screen name="journey">` matches none of them, and each gets
 * the default native header above the one it draws itself. See `predict/_layout.tsx`.
 */
export default function JourneyLayout() {
    return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
