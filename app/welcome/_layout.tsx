import { Stack } from 'expo-router';

/**
 * The welcome hub a new account lands on after its first sign-in.
 *
 * A feature directory needs its own layout: without one its screens register individually on
 * the root stack, the root's `<Stack.Screen name="welcome">` matches none of them, and each gets
 * the default native header above the one it draws itself. See `predict/_layout.tsx`.
 */
export default function WelcomeLayout() {
    return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
