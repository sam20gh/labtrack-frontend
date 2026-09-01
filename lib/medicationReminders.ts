/**
 * What to say when a reminder cannot be delivered.
 *
 * Shared between the add form and the medication detail screen so the two cannot drift, and
 * kept out of both because the wording is the whole point: a person who has just switched
 * "Remind me" on and hears nothing assumes the feature is broken. It is more honest to say
 * the reminder will not arrive, and why, at the moment they asked for it.
 */
import { Alert } from 'react-native';
import type { ReminderState } from './notifications';

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

/** Tell someone their reminder will not arrive, and offer the one fix that exists. */
export const warnRemindersUnavailable = (
    result: { state: ReminderState; reason?: string },
    openSettings: () => void
) => {
    const copy = COPY[result.state];
    if (!copy || !copy.title) return;

    Alert.alert(
        copy.title,
        copy.body,
        copy.canFixInSettings
            ? [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open settings', onPress: openSettings },
            ]
            : [{ text: 'OK' }]
    );
};
