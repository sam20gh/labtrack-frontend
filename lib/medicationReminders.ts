/**
 * What to say when a reminder cannot be delivered.
 *
 * Shared between the add form and the medication detail screen so the two cannot drift, and
 * kept out of both because the wording is the whole point: a person who has just switched
 * "Remind me" on and hears nothing assumes the feature is broken. It is more honest to say
 * the reminder will not arrive, and why, at the moment they asked for it.
 */
import { Alert, Platform } from 'react-native';
import type { ReminderState, RegistrationStage } from './notifications';

const COPY: Record<ReminderState, { title: string; body: string; canFixInSettings: boolean }> = {
    ready: { title: '', body: '', canFixInSettings: false },
    unregistered: {
        title: 'Reminders are not set up yet',
        body: 'This device is not registered for notifications, so dose reminders will not arrive. Try again from Notification settings.',
        canFixInSettings: false,
    },
    unasked: {
        title: 'Reminders are off',
        body: 'Notifications were not enabled, so dose reminders will not arrive. You can turn them on in Notification settings.',
        canFixInSettings: false,
    },
    denied: {
        title: 'Notifications are turned off',
        body: 'Your medication is saved, but reminders cannot reach you until notifications are allowed for LabTrack in your device settings.',
        canFixInSettings: true,
    },
    unsupported: {
        title: 'Reminders need a real device',
        body: 'Push notifications do not work on a simulator. Your medication and its schedule are saved.',
        canFixInSettings: false,
    },
    failed: {
        title: 'Reminders could not be set up',
        body: 'Your medication is saved, but this device could not be registered for notifications. It will try again next time you open the app.',
        canFixInSettings: false,
    },
};

/**
 * A failure the OS caused, not the network.
 *
 * On Android this is a build without FCM credentials: the system will never issue a push
 * token, so "it will try again next time" is a promise the app cannot keep. Say what is
 * actually true — reminders do not work in this build — rather than implying patience will
 * fix it. The underlying message is carried through because it is the only way anyone
 * looking at this can tell which of the two it was.
 */
const deviceFailureCopy = (reason?: string) => ({
    title: 'Reminders are not available in this build',
    body: Platform.OS === 'android'
        ? 'Your medication and its schedule are saved, but this version of the app cannot receive push notifications. It needs a new build with notification credentials — reopening the app will not fix it.'
        : 'Your medication and its schedule are saved, but this device could not be issued a notification token.',
    canFixInSettings: false,
    reason,
});

/** Tell someone their reminder will not arrive, and offer the one fix that exists. */
export const warnRemindersUnavailable = (
    result: { state: ReminderState; reason?: string; stage?: RegistrationStage },
    openSettings: () => void
) => {
    const copy = result.state === 'failed' && result.stage === 'device'
        ? deviceFailureCopy(result.reason)
        : COPY[result.state];
    if (!copy || !copy.title) return;

    // The underlying error, when there is one. Kept short and last: it means nothing to
    // most people, and everything to whoever is asked why reminders are not arriving.
    const detail = result.state === 'failed' && result.reason
        ? `${copy.body}\n\n(${result.reason})`
        : copy.body;

    Alert.alert(
        copy.title,
        detail,
        copy.canFixInSettings
            ? [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open settings', onPress: openSettings },
            ]
            : [{ text: 'OK' }]
    );
};
