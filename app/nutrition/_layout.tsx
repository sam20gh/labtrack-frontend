import { Stack } from 'expo-router';

export default function NutritionLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="log" />
            <Stack.Screen name="review" />
            <Stack.Screen name="history" />
            <Stack.Screen name="gallery" />
        </Stack>
    );
}
