import { Stack } from 'expo-router';

/**
 * The Miovix Age stack.
 *
 * **Without this file nothing errors and every screen here looks broken.** expo-router would
 * register `age/index`, `age/intro`, `age/how` and `age/levers` individually on the *root*
 * stack, the root's `<Stack.Screen name="age">` would match none of them, each would fall
 * through to the default native header, and every screen would draw a band of white titled
 * "age/index" with a second back chevron above the one it already has.
 *
 * It has now caught `nutrition/`, `symptoms/`, `medications/`, `activity/`, `predict/`,
 * `metrics/`, `achievements/` and `sleep/`. The cause is a file that is not there rather than
 * a line that is wrong, so it reads as a header that needs styling.
 *
 * `headerShown: false` because every screen draws its own inside a `SafeAreaView
 * edges={['top']}`, which is the rule the whole app follows.
 */
export default function AgeLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="intro" />
            <Stack.Screen name="levers" />
            <Stack.Screen name="how" />
        </Stack>
    );
}
