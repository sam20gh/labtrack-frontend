import { Stack } from 'expo-router';

/**
 * The hydration stack.
 *
 * Hydration was one branch of `app/metrics/[kind].tsx` — the same chart, summary and entry
 * list that weight and blood pressure get. `Design/hydration.svg` is seventeen frames and
 * five screens, and the parts that make it a tracker rather than a log (the glass at today's
 * level, the month of ticks, the vessel breakdown, the level ladder) have no counterpart on
 * the other two. Squeezing them into the shared screen would have meant a `kind === 'water'`
 * branch longer than the screen it lived in.
 *
 * `/metrics/water` is a static route, so it wins over `[kind]` without either knowing about
 * the other. Weight and blood pressure still fall through to the generic screen, which is
 * now free of hydration.
 *
 * `headerShown: false` — every screen draws its own header inside a `SafeAreaView`, the rule
 * the whole app follows.
 */
export default function WaterLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="history" />
            <Stack.Screen name="insight" />
            <Stack.Screen name="level" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
