/**
 * Push notifications.
 *
 * Registration is deliberately NOT automatic on first launch. Asking for notification
 * permission before someone knows what the app does is the fastest way to a permanent
 * denial — and on iOS a denial cannot be re-prompted, only fixed in Settings. The app asks
 * once there is a plan worth reminding them about.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, apiFetch } from './api';

const ASKED_KEY = 'notificationsAsked';
const TOKEN_KEY = 'expoPushToken';

export interface NotificationPreferences {
    enabled: boolean;
    /** Days before a due date to notify; 0 means on the day. */
    offsetDays: number[];
    overdueReminders: boolean;
    orderUpdates: boolean;
    resultsReady: boolean;
    quietHours: { start: number; end: number };
}

/**
 * Foreground behaviour: show the banner rather than swallowing it silently.
 *
 * `shouldShowAlert` was split into `shouldShowBanner` and `shouldShowList` in expo-notifications
 * for SDK 53+, because the two are separately controllable on iOS — a reminder can appear as a
 * heads-up banner, in Notification Centre, or both. Both are on here: a health reminder that
 * flashes past while the phone is face-down and leaves nothing behind is a reminder that did
 * not happen.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/** Android requires an explicit channel or notifications arrive without sound or heads-up. */
const ensureAndroidChannel = async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('health-reminders', {
        name: 'Health reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
    });
};

export const hasBeenAsked = async () => (await AsyncStorage.getItem(ASKED_KEY)) === 'true';

export const getPermissionStatus = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
};

/**
 * Whether a reminder can actually reach this device.
 *
 *   `ready`        permission granted and a token has been handed to the server
 *   `unregistered` permission granted, but nothing has reached the server yet
 *   `unasked`      never asked, and we still can
 *   `denied`       declined; on iOS this can only be undone in system Settings
 *   `unsupported`  a simulator — push tokens need a physical device
 */
export type ReminderState = 'ready' | 'unregistered' | 'unasked' | 'denied' | 'unsupported' | 'failed';

/**
 * Hand this device's token to the server. Assumes permission is already granted.
 *
 * `POST /notifications/register` is idempotent — re-registering the same token refreshes
 * the row rather than duplicating it — so this is safe to call whenever we are unsure the
 * server knows about this device.
 */
const syncTokenWithServer = async (): Promise<{ ok: boolean; token?: string; reason?: string }> => {
    try {
        // projectId is required in a bare/prebuild workflow — Expo cannot infer it
        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            (Constants as any).easConfig?.projectId;

        const { data: token } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );

        await AsyncStorage.setItem(TOKEN_KEY, token);

        await apiFetch('/notifications/register', {
            method: 'POST',
            body: {
                token,
                platform: Platform.OS === 'ios' ? 'ios' : 'android',
                deviceName: Device.deviceName ?? undefined,
            },
        });

        return { ok: true, token };
    } catch (error) {
        return { ok: false, reason: (error as Error).message };
    }
};

/** What state reminders are in, without asking for anything. Safe to call on render. */
export const reminderState = async (): Promise<ReminderState> => {
    if (!Device.isDevice) return 'unsupported';
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
        return (await AsyncStorage.getItem(TOKEN_KEY)) ? 'ready' : 'unregistered';
    }
    return canAskAgain ? 'unasked' : 'denied';
};

/**
 * Make sure a reminder can arrive, asking for permission if that has not happened yet.
 *
 * Called from the places that *promise* a reminder — saving a medication with "Remind me"
 * on, turning reminders back on for one. A dose reminder is a server push, so a granted OS
 * permission is only half of it: without a token on the account the sweep finds the dose,
 * finds no device, and drops it silently. That was the bug this exists to prevent.
 */
export const ensureRemindersReady = async (): Promise<{
    ready: boolean;
    state: ReminderState;
    reason?: string;
}> => {
    if (!Device.isDevice) {
        return { ready: false, state: 'unsupported', reason: 'Push notifications need a physical device' };
    }

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
        if (!existing.canAskAgain) return { ready: false, state: 'denied' };
        await AsyncStorage.setItem(ASKED_KEY, 'true');
        status = (await Notifications.requestPermissionsAsync()).status;
    }

    if (status !== 'granted') return { ready: false, state: 'denied' };

    const result = await syncTokenWithServer();
    return result.ok
        ? { ready: true, state: 'ready' }
        : { ready: false, state: 'failed', reason: result.reason };
};

/**
 * Re-hand the token to the server at launch, when permission is already granted.
 *
 * Registration can succeed at the OS level and never reach the account — the app was
 * offline, the request failed, the token rotated after a reinstall. Nothing else notices,
 * because a missing token looks exactly like a person who has notifications switched off.
 * One idempotent call per launch heals that.
 */
export const syncRegistration = async () => {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await ensureAndroidChannel();
    await syncTokenWithServer();
};

/**
 * Ask for permission and register this device.
 *
 * @returns `granted` false when the user declined, or when running on a simulator — push
 *   tokens require a physical device, and treating a simulator as a failure would be
 *   misleading during development.
 */
export const registerForPushNotifications = async (): Promise<{
    granted: boolean;
    token?: string;
    reason?: string;
}> => {
    await AsyncStorage.setItem(ASKED_KEY, 'true');

    if (!Device.isDevice) {
        return { granted: false, reason: 'Push notifications need a physical device' };
    }

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
    }

    if (status !== 'granted') {
        return { granted: false, reason: 'Notification permission was declined' };
    }

    const result = await syncTokenWithServer();
    return result.ok
        ? { granted: true, token: result.token }
        : { granted: false, reason: result.reason };
};

/** Stop notifying this device — used on sign-out so the next account is not spammed. */
export const unregisterDevice = async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
        await apiFetch('/notifications/register', { method: 'DELETE', body: { token } });
    } catch {
        // Server-side cleanup will prune it if delivery fails
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
};

export const getPreferences = () =>
    api.get<{ preferences: NotificationPreferences; deviceCount: number }>('/notifications/preferences');

export const updatePreferences = (preferences: Partial<NotificationPreferences>) =>
    apiFetch<{ preferences: NotificationPreferences }>('/notifications/preferences', {
        method: 'PUT',
        body: preferences,
    });

export const sendTestNotification = () =>
    apiFetch<{ message: string; sent: number }>('/notifications/test', { method: 'POST' });

/** Where a tapped notification should take the user. */
export const routeForNotification = (data: any): string | null => {
    if (!data) return null;
    if (typeof data.route === 'string') return data.route;
    switch (data.type) {
        case 'plan_item': return '/myplans';
        case 'order': return '/orders-history';
        case 'review': return '/myplans';
        case 'medication_dose': return '/medications';
        case 'medication_refill': return data.medicationId ? `/medications/${data.medicationId}` : '/medications';
        default: return null;
    }
};
