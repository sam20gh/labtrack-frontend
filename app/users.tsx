/**
 * Retired — this route now redirects to `app/settings/profile.tsx`.
 *
 * It was the profile edit form, and the last screen in the app still drawing itself with
 * `react-native-paper` `Card`/`Button` on the default Material palette rather than the
 * turing kit tokens in `constants/theme.ts`. `Design/profile.svg` frame 11 replaced it.
 *
 * Kept as a redirect rather than deleted: it is a public route name that a saved link, a
 * notification payload or an older build could still target, and a removed expo-router
 * route renders the +not-found screen rather than the thing the person was looking for.
 */
import { Redirect } from 'expo-router';

export default function UsersRedirect() {
    return <Redirect href="/settings/profile" />;
}
