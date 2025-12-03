import { Stack } from 'expo-router';

export default function HealthAssessmentLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="name" />
            <Stack.Screen name="health-goals" />
            <Stack.Screen name="birth-year" />
            <Stack.Screen name="gender" />
            <Stack.Screen name="weight" />
            <Stack.Screen name="height" />
            <Stack.Screen name="blood-type" />
            <Stack.Screen name="fitness-level" />
            <Stack.Screen name="sleep-level" />
            <Stack.Screen name="exercise-type" />
            <Stack.Screen name="mood" />
            <Stack.Screen name="eating-habits" />
            <Stack.Screen name="calorie-intake" />
            <Stack.Screen name="medications" />
            <Stack.Screen name="medications-list" />
            <Stack.Screen name="allergies" />
            <Stack.Screen name="allergies-list" />
            <Stack.Screen name="conditions" />
            <Stack.Screen name="conditions-list" />
            <Stack.Screen name="checkup-frequency" />
            <Stack.Screen name="health-notes" />
            <Stack.Screen name="voice-analysis" />
            <Stack.Screen name="complete" />
        </Stack>
    );
}
