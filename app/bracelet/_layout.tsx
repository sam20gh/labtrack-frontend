import { Stack } from 'expo-router';

/**
 * The bracelet stack.
 *
 * Every feature directory needs one of these, and forgetting it does not error — it makes
 * expo-router register each file as a separate route on the **root** Stack, where
 * `<Stack.Screen name="bracelet">` matches none of them. Each screen then falls through to
 * the root's default native header and draws a band of white titled `bracelet/index` above
 * the header it already draws for itself.
 *
 * It has caught `nutrition/`, `symptoms/`, `medications/`, `activity/`, `predict/`,
 * `metrics/`, `achievements/` and `sleep/` before this one.
 */
export default function BraceletLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
