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

/** Foreground behaviour: show the banner rather than swallowing it silently. */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
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

        return { granted: true, token };
    } catch (error) {
        return { granted: false, reason: (error as Error).message };
    }
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
        default: return null;
    }
};
