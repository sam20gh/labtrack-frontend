import { Stack } from 'expo-router';

export default function NutritionLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="log" />
            <Stack.Screen name="review" />
            <Stack.Screen name="history" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="recommendations" />
            <Stack.Screen name="gallery" />
            {/* One logged meal. Registered last so it cannot shadow a named route above. */}
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
