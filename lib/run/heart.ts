/**
 * The bracelet during a run — heart rate and steps, live.
 *
 * Connects when a run starts recording and a bracelet that can stream is paired; lets go the
 * moment the run finishes or is discarded, because a stream left running keeps the band's
 * radio awake and blocks every later sync (the rule `live.ts` holds). Readings go to the
 * recorder, which attaches heart rate to the fix it was measured beside and journals the
 * step count — the recorder, not this module, is what survives a restart.
 *
 * **What is stored.** `live.ts` says the stream is shown and never stored, and that still
 * holds for `HeartRateSample`: nothing here writes a per-second heart-rate row. The run keeps
 * its own heart rate on its `ActivityTrack.hr` column — the heart rate *of this run*, beside
 * the positions it happened at — and the session keeps the derived average and peak.
 *
 * **Known limit in this build (iOS).** iOS keeps a Bluetooth link alive in the background
 * only with the `bluetooth-central` background mode, which this build does not declare. With
 * the screen locked the link drops, the status says "reconnecting", and it reconnects when
 * the app comes back to the front; fixes recorded meanwhile simply carry no heart rate.
 * Android keeps it under the location foreground service. Adding the mode is an `app.json`
 * change — the next native build.
 */
import { AppState } from 'react-native';
import * as recorder from './recorder';
import * as live from '@/lib/health/jstyle/live';
import { getPaired } from '@/lib/health/jstyle/store';
import { isAvailable, supports } from '@/modules/jstyle-ble';

const RETRY_MS = 20_000;

let attached = false;
let connecting = false;
let checkedRun: string | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

const wanted = () => {
    const { phase } = recorder.getState();
    return phase === 'recording' || phase === 'paused';
};

const clearRetry = () => {
    if (retry) clearTimeout(retry);
    retry = null;
};

const scheduleRetry = () => {
    clearRetry();
    if (!wanted()) return;
    retry = setTimeout(() => { retry = null; connect(); }, RETRY_MS);
};

const connect = async () => {
    if (connecting || live.isLive() || !wanted() || !isAvailable()) return;
    const paired = await getPaired().catch(() => null);
    if (!paired || !supports(paired.variant, 'liveData')) return;

    connecting = true;
    recorder.setHeartLink('connecting');
    // One segment per connection: the bracelet's step count is the day's, so steps for this
    // run are counted from the first reading of each connection.
    const seg = Date.now();
    let base: number | null = null;
    try {
        await live.start({
            onReading: (reading) => {
                recorder.setHeartLink('live');
                if (reading.heartRate) recorder.recordHeart(reading.heartRate, reading.at);
                if (reading.steps != null) {
                    if (base == null) base = reading.steps;
                    if (reading.steps >= base) recorder.recordBraceletSteps(seg, reading.steps - base, reading.at);
                }
            },
            onMeasurement: () => undefined,
            onLost: () => {
                recorder.setHeartLink('lost');
                scheduleRetry();
            },
        });
    } catch {
        recorder.setHeartLink('lost');
        scheduleRetry();
    } finally {
        connecting = false;
    }
};

const disconnect = async () => {
    clearRetry();
    if (live.isLive()) await live.stop().catch(() => undefined);
    recorder.setHeartLink('none');
};

/** Subscribe once, from `app/_layout.tsx`. Does nothing without a paired bracelet. */
export const attachRunHeart = () => {
    if (attached) return;
    attached = true;

    recorder.subscribe(() => {
        const state = recorder.getState();
        if (!wanted()) {
            if (live.isLive() || state.heartLink !== 'none') disconnect();
            checkedRun = null;
            return;
        }
        // Try once per run on start; after that only the retry timer and the app coming
        // back to the front reconnect, so a missing bracelet costs one look, not one a second.
        if (state.clientId && state.clientId !== checkedRun) {
            checkedRun = state.clientId;
            connect();
        }
    });

    AppState.addEventListener('change', (next) => {
        if (next === 'active' && wanted() && recorder.getState().heartLink === 'lost') {
            clearRetry();
            connect();
        }
    });
};
