/**
 * The notification centre's stack.
 *
 * Without this file expo-router registers `notifications/index` on the **root** Stack, so
 * `<Stack.Screen name="notifications">` in `app/_layout.tsx` matches nothing, the screen
 * falls through to the root's default native header, and it renders a band of white titled
 * `notifications/index` above the header it already draws itself. Nothing errors. The same
 * omission has now caught `nutrition/`, `symptoms/`, `medications/`, `activity/`,
 * `predict/`, `metrics/`, `achievements/` and `sleep/` — see the frontend conventions in
 * CLAUDE.md.
 */
import { Stack } from 'expo-router';

export default function NotificationsLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
