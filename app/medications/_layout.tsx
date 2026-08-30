/**
 * The medication checker's own Stack.
 *
 * Without this, expo-router nests the folder under the root Stack and every screen gets a
 * second header titled "medications/index" above the one it draws itself — the same reason
 * `nutrition/_layout.tsx` and `activity/_layout.tsx` exist.
 */
import { Stack } from 'expo-router';

export default function MedicationsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="add" />
            <Stack.Screen name="search" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="scan-result" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="interactions" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
