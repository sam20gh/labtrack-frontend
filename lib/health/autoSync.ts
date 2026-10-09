/**
 * Syncing without being asked.
 *
 * Until 2026-10-08 nothing synced unless somebody opened one of five screens — sleep,
 * activity, connected sources, cycle or the bracelet — so last night's sleep reached the
 * home screen only after a detour to the sleep tracker and a wait. Now a sync starts when
 * the app launches and whenever it comes back to the front.
 *
 * Three rules:
 *
 * 1. **Never awaited by anything on screen.** It runs alongside the first paint; screens that
 *    want the result subscribe with `onSynced` (`lib/health/sync.ts`). A screen that starts
 *    its own sync meanwhile joins this one rather than starting a second — `runSync`
 *    coalesces.
 * 2. **At most every `AUTO_INTERVAL_MS`.** Switching apps to copy a code is not a reason to
 *    reconnect a bracelet. Pull-to-refresh and the screens' own syncs are unaffected.
 * 3. **Signed in or nothing.** Before `syncAccount()` the API answers 403 to everything, and a
 *    sync that cannot post has still connected to the bracelet for nothing.
 *
 * This is foreground only. A sync while the app is closed needs a native background task —
 * a new build — and is a separate piece of work.
 */
import { AppState } from 'react-native';

import { isSignedIn } from '@/lib/auth';
import { hydrateHealthSources, sources } from './index';
import { runSync } from './sync';
import { ensureBackgroundSync } from './backgroundSync';

export const AUTO_INTERVAL_MS = 15 * 60 * 1000;

let attached = false;
let lastAutoAt = 0;

const maybeSync = async (): Promise<void> => {
    if (Date.now() - lastAutoAt < AUTO_INTERVAL_MS) return;
    // At launch the pairing may not be loaded yet, and `sources()` would leave the bracelet out.
    await hydrateHealthSources();
    if (!sources().length || !(await isSignedIn())) return;
    lastAutoAt = Date.now();
    const result = await runSync();
    if (result.perSource?.length) {
        console.log(`🔄 Auto-sync: ${result.perSource
            .map((s) => `${s.platform} ${s.ran ? `${s.days}d` : `skipped${s.reason ? ` (${s.reason})` : ''}`}`)
            .join(', ')}`);
    }
};

/** Called once from the root layout. Never throws. */
export const attachAutoSync = (): void => {
    if (attached) return;
    attached = true;
    // Each foreground also re-checks the background task: it is registered only for a signed-in
    // phone with a bracelet, and either can have changed since the app last came forward.
    const kick = () => { maybeSync().catch(() => undefined); void ensureBackgroundSync(); };
    kick();
    AppState.addEventListener('change', (next) => { if (next === 'active') kick(); });
};
