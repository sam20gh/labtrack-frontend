/**
 * Account settings.
 *
 * Every screen in here draws its own back bar inside a top-inset SafeAreaView, the way the
 * rest of the app does. Without this Stack the routes register individually against the
 * root and each one falls through to a second header titled "settings/units".
 */
import { Stack } from 'expo-router';

export default function SettingsLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
