/**
 * The plan item's own Stack.
 *
 * Without this, expo-router registers `plan/[id]` on the root Stack and the screen gets a
 * second native header titled "plan/[id]" above the one it draws — see CLAUDE.md on
 * feature directories.
 */
import { Stack } from 'expo-router';

export default function PlanLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
