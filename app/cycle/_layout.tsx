import { Stack } from 'expo-router';

/**
 * The cycle tracker's stack.
 *
 * Without this file expo-router registers every screen in this folder as its own route on
 * the **root** Stack, and each one draws the root's default native header above the header
 * it already draws itself. Nothing errors. See the note in `CLAUDE.md` under "Frontend
 * conventions".
 */
export default function CycleLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="log" />
            <Stack.Screen name="history" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="settings" />
        </Stack>
    );
}
