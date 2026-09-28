/**
 * The map SDK, loaded only where it exists.
 *
 * `@rnmapbox/maps` is a native module, and an over-the-air bundle carrying this feature can
 * reach a build made before it was added — the fingerprint policy stops *that* build being
 * offered the update, but a development client or a mismatched local bundle is not so
 * protected, and importing the SDK against a binary without it throws at module load. So
 * nothing imports `@rnmapbox/maps` at the top of a file: `components/run/RunMap.tsx` gets
 * it from `loadMapbox()`, which is the one place a provider swap (MapLibre speaks the same
 * style spec) would have to change. Same stance as `modules/jstyle-ble`'s `isAvailable()`.
 */
import { NativeModules } from 'react-native';
import { MAPBOX_PUBLIC_TOKEN } from '@/constants/config';

type MapboxModule = typeof import('@rnmapbox/maps');

let loaded: MapboxModule | null | undefined;

/** Why the map cannot be shown, or null when it can. */
export type MapUnavailable = 'not_in_build' | 'no_token';

export const mapUnavailableReason = (): MapUnavailable | null => {
    if (NativeModules.RNMBXModule == null) return 'not_in_build';
    if (!MAPBOX_PUBLIC_TOKEN) return 'no_token';
    return null;
};

/** The SDK with its token set, or null — see `mapUnavailableReason()` for why. */
export const loadMapbox = (): MapboxModule | null => {
    if (loaded !== undefined) return loaded;
    if (mapUnavailableReason()) {
        loaded = null;
        return loaded;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox: MapboxModule = require('@rnmapbox/maps');
    Mapbox.default.setAccessToken(MAPBOX_PUBLIC_TOKEN);
    // No usage telemetry from a health app's map. Mapbox's own SDK otherwise reports
    // location-derived usage events.
    Mapbox.default.setTelemetryEnabled?.(false);
    loaded = Mapbox;
    return loaded;
};
