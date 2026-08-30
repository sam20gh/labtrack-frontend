import { Stack } from 'expo-router';

/**
 * The metrics stack.
 *
 * Without this file the routes registered individually on the root stack, the root's
 * `<Stack.Screen name="metrics">` never matched any of them, and every metrics screen got the
 * default native header — so each one showed two back chevrons and a band of white above its
 * own title. Every other feature directory (`activity/`, `nutrition/`, `medications/`) carries
 * one of these for the same reason.
 *
 * `headerShown: false` because each screen draws its own header inside a
 * `SafeAreaView edges={['top']}`, which is the rule the whole app follows.
 */
export default function MetricsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="[kind]" />
            <Stack.Screen name="log/[kind]" />
        </Stack>
    );
}
