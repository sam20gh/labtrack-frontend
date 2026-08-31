/**
 * Help &amp; support.
 *
 * Same reason as `app/settings/_layout.tsx`: these screens carry their own header, so the
 * folder needs its own Stack or the root adds a second bar above each one.
 */
import { Stack } from 'expo-router';

export default function HelpLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
