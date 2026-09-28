/**
 * The phone's location, for a live session.
 *
 * **When-in-use permission is enough on both platforms, and nothing here asks for Always.**
 * Verified in `expo-location`'s source: Android skips the background-permission check when
 * `foregroundService` is set, and iOS checks only foreground permission for
 * `startLocationUpdatesAsync` (Always gates geofencing, which this does not use). Asking for
 * Always would mean a Play background-location declaration and a prompt people rightly
 * refuse. The session keeps recording with the screen locked because of
 * `UIBackgroundModes: location` on iOS and the foreground-service notification on Android.
 *
 * Permission is asked when Start is first pressed — never at launch — because an iOS denial
 * cannot be asked again, and a prompt with no run in front of it reads as surveillance.
 */
import * as Location from 'expo-location';
import { Palette } from '@/constants/theme';

export const RUN_LOCATION_TASK = 'predyqt-run-location';

export type LocationPermission = 'granted' | 'denied' | 'blocked' | 'services_off';

export const ensureLocationPermission = async (): Promise<LocationPermission> => {
    if (!(await Location.hasServicesEnabledAsync())) return 'services_off';
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'blocked';
    const asked = await Location.requestForegroundPermissionsAsync();
    if (asked.granted) return 'granted';
    return asked.canAskAgain ? 'denied' : 'blocked';
};

export const startTracking = () => Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    // Every fix, about once a second. The anchor rule in `trackMath` does the thinning; a
    // distance filter here would starve auto-pause of the fixes that say someone stopped.
    distanceInterval: 0,
    timeInterval: 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
        notificationTitle: 'Recording your activity',
        notificationBody: 'Your route is being recorded. Tap to return.',
        notificationColor: Palette.primary,
        // Swiping the app away must not end somebody's run: the journal rebuilds the
        // recorder when the next fix wakes the JavaScript.
        killServiceOnDestroy: false,
    },
});

export const isTracking = async (): Promise<boolean> => {
    try {
        return await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);
    } catch {
        return false;
    }
};

export const stopTracking = async () => {
    if (await isTracking()) await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
};

/**
 * Fixes for the launch pad's lock ring, before anything is recorded. The ring's radius is
 * the reported accuracy, so it must come from real fixes — a ring that shrank on a timer
 * would be a progress bar that lies.
 */
export const watchLock = (onFix: (fix: Location.LocationObject) => void) =>
    Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        onFix,
    );

export type { LocationObject } from 'expo-location';
