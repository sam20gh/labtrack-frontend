import { Stack } from 'expo-router';

/**
 * The recovery stack.
 *
 * One screen today, and the file still has to exist: without it expo-router registers
 * `recovery/index` on the root Stack, which draws its default white header above the one the
 * screen draws itself. See "A new feature directory needs its own `_layout.tsx`" in CLAUDE.md.
 */
export default function RecoveryLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
        </Stack>
    );
}
