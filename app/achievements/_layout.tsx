import { Stack } from 'expo-router';

/**
 * The achievements stack.
 *
 * Without this file the routes register individually on the root stack, the root's
 * `<Stack.Screen name="achievements">` never matches any of them, and every screen in the
 * folder gets the default native header — a band of white reading "achievements/index" or
 * "achievements/[key]", with a second back chevron above the one the screen already draws.
 * `predict/_layout.tsx` and `metrics/_layout.tsx` carry the same note for the same reason, as
 * do `activity/`, `nutrition/` and `medications/`. It is the most-repeated mistake in this
 * app's routing and it looks like a styling bug rather than a missing file.
 *
 * `headerShown: false` because each screen draws its own header inside a
 * `SafeAreaView edges={['top']}`, which is the rule the whole app follows.
 */
export default function AchievementsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="intro" />
            <Stack.Screen name="all" />
            {/* Declared last, after the static routes, matching `predict/_layout.tsx` and
                `metrics/_layout.tsx`. Keeping the dynamic segment at the bottom is the
                convention every feature directory here follows. */}
            <Stack.Screen name="[key]" />
        </Stack>
    );
}
