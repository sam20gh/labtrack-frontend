import { Stack } from 'expo-router';

/**
 * The score stack.
 *
 * Present for the same reason `metrics/_layout.tsx` is: the root layout refers to this
 * directory as `name="score"`, and that only matches when the directory owns a navigator.
 * Without it the screen registers as `score/index`, the root's entry never applies, and the
 * default native header appears above the one the screen draws itself.
 */
export default function ScoreLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
        </Stack>
    );
}
