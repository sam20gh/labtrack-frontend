import { Stack } from 'expo-router';

export default function AddResultLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="manual" />
            <Stack.Screen name="review" />
        </Stack>
    );
}
