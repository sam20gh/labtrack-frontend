import { Stack } from 'expo-router';

/**
 * The sleep stack.
 *
 * Without this file expo-router registers every screen in this folder as its own route on
 * the **root** Stack, and each one draws the root's default native header above the header
 * it already draws itself — a band of white titled `sleep/index` with a second back chevron.
 * Nothing errors. See the note in `CLAUDE.md` under "Frontend conventions"; this has now
 * caught eight feature directories.
 */
export default function SleepLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="goal" />
            <Stack.Screen name="history" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="score" />
            <Stack.Screen name="log" />
            <Stack.Screen name="schedule/index" />
            <Stack.Screen name="schedule/[id]" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
