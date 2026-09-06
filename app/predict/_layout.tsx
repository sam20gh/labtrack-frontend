import { Stack } from 'expo-router';

/**
 * The predictions stack.
 *
 * Without this file the routes register individually on the root stack, the root's
 * `<Stack.Screen name="predict">` never matches any of them, and every prediction screen gets
 * the default native header — a band of white with "predict/select" in it and a second back
 * chevron above the one the screen already draws. `metrics/_layout.tsx` carries the same note
 * for the same reason, as do `activity/`, `nutrition/` and `medications/`.
 *
 * `headerShown: false` because each screen draws its own header inside a
 * `SafeAreaView edges={['top']}`, which is the rule the whole app follows.
 */
export default function PredictLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="intro" />
            <Stack.Screen name="select" />
            {/*
              The wait screen has no back gesture and no header. It replaces itself with the
              result, and swiping back out of it mid-request would leave a prediction running
              with nowhere to land.
            */}
            <Stack.Screen name="running" options={{ gestureEnabled: false }} />
            <Stack.Screen name="result" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="score" />
            <Stack.Screen name="past" />
            <Stack.Screen name="accuracy" />
            <Stack.Screen name="how" />
            {/* Last: a dynamic segment registered above the static ones swallows them. */}
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
