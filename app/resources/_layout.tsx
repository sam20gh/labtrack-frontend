import { Stack } from 'expo-router';

/**
 * The health resources stack.
 *
 * Required, not optional. Without it every screen in this directory registers individually
 * on the root stack, the root's `<Stack.Screen name="resources">` matches none of them, and
 * each one gets the default native header — two back chevrons and a white band above its own
 * title. `metrics/`, `nutrition/`, `medications/` and `activity/` all carry one for the same
 * reason.
 *
 * `headerShown: false` because every screen here draws its own header inside a
 * `SafeAreaView edges={['top']}`, which is the rule the whole app follows.
 *
 * The players and the shorts feed use `fade` rather than the horizontal push: they are
 * full-bleed media screens, and sliding a black video in from the right over a white list
 * reads as a glitch rather than as navigation.
 */
export default function ResourcesLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="intro" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="list" />
            <Stack.Screen name="search" />
            <Stack.Screen name="saved" />
            <Stack.Screen name="[slug]" />
            <Stack.Screen name="author/[slug]" />
            <Stack.Screen name="go-pro" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="player/audio" options={{ animation: 'fade' }} />
            <Stack.Screen name="player/video" options={{ animation: 'fade' }} />
            <Stack.Screen name="shorts" options={{ animation: 'fade' }} />
        </Stack>
    );
}
