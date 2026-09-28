export const API_URL = 'https://labtrack-backend.onrender.com/api'; // Replace with actual backend URL
// export const API_URL = 'http://localhost:5002/api'; // Replace with actual backend URL


/**
 * Mapbox **public** token (`pk.…`) for the live-session map.
 *
 * Public by design — it ships inside every app binary, which is what a `pk.` token is for.
 * Still read from the environment rather than written here, so it can be rotated without a
 * commit: `EXPO_PUBLIC_MAPBOX_TOKEN` in `.env.local` for local bundles and `eas update`, and
 * as an EAS environment variable (plaintext visibility) for builds. `EXPO_PUBLIC_*` is
 * inlined when the bundle is made, so an update published without it ships a map that
 * cannot load tiles. Empty means the map says so rather than drawing a grey rectangle.
 */
export const MAPBOX_PUBLIC_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
