import { Stack } from 'expo-router';

/**
 * Home sample collection: booking a visit after paying, moving one, and one visit's details.
 *
 * A feature directory needs its own layout: without one its screens register individually on
 * the root stack, the root's `<Stack.Screen name="collection">` matches none of them, and each
 * gets the default native header above the one it draws itself. See `predict/_layout.tsx`.
 */
export default function CollectionLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="book" />
            {/* Last: a dynamic segment registered above a static one swallows it. */}
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
