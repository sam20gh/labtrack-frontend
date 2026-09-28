import { Stack } from 'expo-router';

export default function ActivityLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="goal" />
            <Stack.Screen name="history" />
            <Stack.Screen name="log" />
            <Stack.Screen name="sources" />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="run/index" />
            {/* No swipe-back mid-run: leaving is allowed, but by a deliberate tap, not an edge swipe. */}
            <Stack.Screen name="run/live" options={{ gestureEnabled: false }} />
        </Stack>
    );
}
