/**
 * The live session — one recorder for the whole app, not React state.
 *
 * A screen subscribes to it and draws; the screen can unmount, the phone can lock, the
 * JavaScript can be torn down and restarted, and the run carries on. What makes that true:
 *
 * 1. **The background task is defined here, at module scope.** `TaskManager.defineTask` has
 *    to run when the bundle loads, before any location event is delivered. Defined inside a
 *    component, a background wake finds no task and the fix is dropped silently.
 *    `app/_layout.tsx` imports this module for that reason alone.
 * 2. **The journal is the record and this is a cache of it.** Every fix is buffered and
 *    written to `journal.ts` within `FLUSH_EVERY` fixes or `FLUSH_MS`; pauses, resumes and
 *    the finish are written at once. `hydrate()` rebuilds the whole state from the journal,
 *    and runs whenever a fix arrives with nothing in memory — which is exactly what an
 *    Android JS restart under a live foreground service looks like.
 * 3. **Raw fixes are journalled, filtered fixes are drawn.** The server does its own
 *    filtering from the raw track and its figures are the record, so the journal keeps
 *    everything the OS delivered, and only the accumulator applies the rules.
 *
 * Phases: `idle → recording ⇄ paused → finished`. The countdown is the screen's business;
 * GPS is already warm from the lock ring by then.
 */
import * as TaskManager from 'expo-task-manager';
import { randomUUID } from 'expo-crypto';
import type { LocationObject } from 'expo-location';
import { createAccumulator, type Accumulator, type Fix, type LiveSnapshot, type TrackableType } from './trackMath';
import { segmentKcal } from './energy';
import * as journal from './journal';
import { RUN_LOCATION_TASK, isTracking, startTracking, stopTracking } from './gps';
import { stepsForWindow } from './steps';
import type { RunGoal } from './goal';

export type RunPhase = 'idle' | 'recording' | 'paused' | 'finished';

const FLUSH_EVERY = 10;
const FLUSH_MS = 10_000;

interface ActiveRun {
    meta: journal.RunMeta;
    phase: Exclude<RunPhase, 'idle'>;
    acc: Accumulator;
    buffer: journal.RunEvent[];
    chunk: number;
    lastFlush: number;
    /** Closed pauses, summed. The open one, if any, is `pausedAt`. */
    pausedMs: number;
    pausedAt: number | null;
    finishedAt: number | null;
    lastFix: Fix | null;
    /** Live calories, priced per segment as they land (grade 0 — see energy.ts). */
    kcal: number | null;
    pricedSegments: number;
    /** Recent bracelet step readings, for live cadence: [ms, steps since connection]. */
    stepSamples: [number, number][];
    /** When each bracelet segment last reached the journal. */
    stepsLoggedAt: Map<number, number>;
}

/**
 * The newest heart rate from a live source, and the link's state. Module-level rather than
 * per run: the bracelet is connected by `lib/run/heart.ts`, which lives for the app.
 */
let heart: { bpm: number; at: number } | null = null;
export type HeartLink = 'none' | 'connecting' | 'live' | 'lost';
let heartLink: HeartLink = 'none';
/** A reading older than this is not attached to a fix — it describes a moment already gone. */
const HEART_FRESH_MS = 5000;

let run: ActiveRun | null = null;
const listeners = new Set<() => void>();
/** Bumped on every change, so a screen can re-render on a pause as well as on a fix. */
let version = 0;

const notify = () => {
    version += 1;
    for (const l of listeners) {
        try { l(); } catch { /* a screen's bug must not stop the recorder */ }
    }
};

const fixFromLocation = (loc: LocationObject): Fix => ({
    t: loc.timestamp,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    alt: loc.coords.altitude,
    acc: loc.coords.accuracy,
});

const priceNewSegments = (r: ActiveRun) => {
    const segments = r.acc.segments();
    for (; r.pricedSegments < segments.length; r.pricedSegments += 1) {
        const k = segmentKcal(segments[r.pricedSegments], r.meta.type, r.meta.weightKg);
        if (k != null) r.kcal = (r.kcal ?? 0) + k;
    }
};

const flush = (r: ActiveRun, force = false) => {
    if (!r.buffer.length) return;
    if (!force && r.buffer.length < FLUSH_EVERY && Date.now() - r.lastFlush < FLUSH_MS) return;
    journal.writeChunk(r.meta.clientId, r.chunk, r.buffer);
    r.chunk += 1;
    r.buffer = [];
    r.lastFlush = Date.now();
};

const record = (r: ActiveRun, event: journal.RunEvent, force = false) => {
    r.buffer.push(event);
    flush(r, force);
};

/** Rebuild from a journal. Pure with respect to the recorder: returns the run, sets nothing. */
const rebuild = (meta: journal.RunMeta, events: readonly journal.RunEvent[]): ActiveRun => {
    const r: ActiveRun = {
        meta,
        phase: 'recording',
        acc: createAccumulator(meta.type),
        buffer: [],
        chunk: journal.nextChunkIndex(meta.clientId),
        lastFlush: Date.now(),
        pausedMs: 0,
        pausedAt: null,
        finishedAt: null,
        lastFix: null,
        kcal: meta.weightKg != null ? 0 : null,
        pricedSegments: 0,
        stepSamples: [],
        stepsLoggedAt: new Map(),
    };
    for (const e of events) {
        if (e.k === 'f') {
            const fix: Fix = { t: e.t, lat: e.la, lng: e.ln, alt: e.al, acc: e.ac, hr: e.hr };
            r.acc.push(fix, { paused: r.phase === 'paused' });
            r.lastFix = fix;
        } else if (e.k === 'pause' && r.phase === 'recording') {
            r.phase = 'paused';
            r.pausedAt = e.t;
        } else if (e.k === 'resume' && r.phase === 'paused') {
            r.phase = 'recording';
            r.pausedMs += e.t - (r.pausedAt ?? e.t);
            r.pausedAt = null;
            r.acc.resume();
        } else if (e.k === 'finish') {
            if (r.phase === 'paused') {
                r.pausedMs += e.t - (r.pausedAt ?? e.t);
                r.pausedAt = null;
            }
            r.phase = 'finished';
            r.finishedAt = e.t;
        }
    }
    priceNewSegments(r);
    return r;
};

/**
 * Bring the recorder back from the journal if it has nothing in memory. Cheap when it does.
 * Returns whether a run is loaded.
 */
export const hydrate = (): boolean => {
    if (run) return true;
    const id = journal.activeRunId();
    if (!id) return false;
    const saved = journal.readRun(id);
    if (!saved) {
        journal.clearActive(); // pointer to a folder that is gone
        return false;
    }
    run = rebuild(saved.meta, saved.events);
    notify();
    return true;
};

/** Fixes from the background task. Also callable directly, which is what the tests do. */
export const ingest = (locations: readonly LocationObject[]) => {
    if (!hydrate() || !run || run.phase === 'finished') return;
    const r = run;
    const paused = r.phase === 'paused';
    for (const loc of locations) {
        const fix = fixFromLocation(loc);
        // Heart rate rides on the fix it was measured beside, and only if it is fresh.
        if (heart && Math.abs(fix.t - heart.at) <= HEART_FRESH_MS) fix.hr = heart.bpm;
        // Journal the raw fix whatever the filter makes of it; the server re-filters.
        r.buffer.push({
            k: 'f', t: fix.t, la: fix.lat, ln: fix.lng, al: fix.alt ?? null, ac: fix.acc ?? null,
            ...(fix.hr != null ? { hr: fix.hr } : {}),
        });
        r.acc.push(fix, { paused });
        r.lastFix = fix;
    }
    flush(r);
    priceNewSegments(r);
    notify();
};

TaskManager.defineTask(RUN_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.warn('🛰️ Location task error:', error.message);
        return;
    }
    const locations = (data as { locations?: LocationObject[] } | undefined)?.locations;
    if (locations?.length) ingest(locations);
});

// ---------------------------------------------------------------------------------------
// Commands

export class RunAlreadyActiveError extends Error {
    constructor() {
        super('A session is already being recorded');
        this.name = 'RunAlreadyActiveError';
    }
}

/**
 * Begin recording. Permissions — location and motion — are the launch pad's to ask before
 * this is called: by now a countdown has run, and a system sheet over "GO" is the worst
 * moment to ask for anything.
 */
export const start = async ({ type, weightKg, goal, maxHr }: {
    type: TrackableType; weightKg: number | null; goal?: RunGoal; maxHr?: number | null;
}): Promise<string> => {
    if (hydrate() && run && run.phase !== 'finished') throw new RunAlreadyActiveError();

    const meta: journal.RunMeta = {
        v: journal.JOURNAL_VERSION,
        clientId: randomUUID(),
        type,
        startedAt: Date.now(),
        weightKg,
        goal: goal && goal.kind !== 'free' ? goal : undefined,
        maxHr: maxHr ?? null,
    };
    journal.createRun(meta);
    run = rebuild(meta, []);
    try {
        await startTracking();
    } catch (err) {
        journal.deleteRun(meta.clientId);
        run = null;
        notify();
        throw err;
    }
    notify();
    return meta.clientId;
};

export const pause = () => {
    if (!hydrate() || !run || run.phase !== 'recording') return;
    const now = Date.now();
    run.phase = 'paused';
    run.pausedAt = now;
    record(run, { k: 'pause', t: now }, true);
    notify();
};

export const resume = () => {
    if (!hydrate() || !run || run.phase !== 'paused') return;
    const now = Date.now();
    run.pausedMs += now - (run.pausedAt ?? now);
    run.pausedAt = null;
    run.phase = 'recording';
    run.acc.resume();
    record(run, { k: 'resume', t: now }, true);
    notify();
};

/**
 * End the session and leave it on disk, finished, for `upload.ts`. Returns the client id —
 * the key the upload and the summary screen use.
 */
export const finish = async (): Promise<string | null> => {
    if (!hydrate() || !run || run.phase === 'finished') return run?.meta.clientId ?? null;
    const r = run;
    const now = Date.now();
    if (r.phase === 'paused') {
        r.pausedMs += now - (r.pausedAt ?? now);
        r.pausedAt = null;
    }
    // Stop the radio first: a fix arriving after `finish` would be journalled past the end.
    await stopTracking().catch(() => undefined);
    record(r, { k: 'finish', t: now }, true);
    r.phase = 'finished';
    r.finishedAt = now;

    // iOS's own count for the whole window, which replaces any partial bracelet segments.
    const steps = await stepsForWindow(r.meta.startedAt, now);
    if (steps != null) record(r, { k: 'stepsTotal', t: now, n: steps }, true);

    journal.setStatus(r.meta.clientId, { state: 'finished' });
    journal.clearActive();
    notify();
    return r.meta.clientId;
};

/** Throw the session away. The journal goes too; there is no undo. */
export const discard = async () => {
    const id = hydrate() && run ? run.meta.clientId : journal.activeRunId();
    await stopTracking().catch(() => undefined);
    if (id) journal.deleteRun(id);
    run = null;
    notify();
};

/** Forget a finished run in memory once its summary has been shown. The journal is upload.ts's. */
export const reset = () => {
    if (run?.phase === 'finished') {
        run = null;
        notify();
    }
};

/**
 * A run the journal says is recording while the location service is not — the app was
 * force-quit (which stops updates on iOS), the phone restarted, or the OS killed the
 * service. The launch pad offers to resume it, save it as it stands, or discard it.
 */
export const interruptedRun = async (): Promise<{ clientId: string; type: TrackableType; startedAt: number; lastT: number } | null> => {
    if (!hydrate() || !run || run.phase === 'finished') return null;
    if (await isTracking()) return null;
    return {
        clientId: run.meta.clientId,
        type: run.meta.type,
        startedAt: run.meta.startedAt,
        lastT: run.lastFix?.t ?? run.meta.startedAt,
    };
};

/** Restart the radio for an interrupted run. The gap is not bridged — the 60 s rule applies. */
export const restartTracking = async () => {
    if (!hydrate() || !run || run.phase === 'finished') return;
    await startTracking();
};

// ---------------------------------------------------------------------------------------
// The bracelet — fed by lib/run/heart.ts

/** A live heart-rate reading. Held for the next fix; never stored on its own. */
export const recordHeart = (bpm: number, at = Date.now()) => {
    if (!Number.isFinite(bpm) || bpm < 30 || bpm > 230) return;
    heart = { bpm: Math.round(bpm), at };
    notify();
};

/**
 * The bracelet's step count since this connection began (`seg`). Journalled as it rises,
 * at most every 15 s, so a restart loses little; kept in memory for live cadence.
 */
export const recordBraceletSteps = (seg: number, stepsSinceConnect: number, at = Date.now()) => {
    if (!hydrate() || !run || run.phase === 'finished' || !Number.isFinite(stepsSinceConnect)) return;
    const r = run;
    r.stepSamples.push([at, stepsSinceConnect]);
    while (r.stepSamples.length && at - r.stepSamples[0][0] > 60_000) r.stepSamples.shift();
    if (at - (r.stepsLoggedAt.get(seg) ?? 0) >= 15_000) {
        r.stepsLoggedAt.set(seg, at);
        record(r, { k: 'steps', t: at, seg, n: stepsSinceConnect });
    }
};

export const setHeartLink = (state: HeartLink) => {
    if (heartLink === state) return;
    heartLink = state;
    if (state !== 'live') heart = null;
    notify();
};

/** Steps per minute over the last 30 s of bracelet readings, or null. */
const cadenceOf = (samples: [number, number][], now: number): number | null => {
    const recent = samples.filter(([t]) => now - t <= 30_000);
    if (recent.length < 2) return null;
    const [t0, s0] = recent[0];
    const [t1, s1] = recent[recent.length - 1];
    if (t1 - t0 < 10_000 || s1 < s0) return null;
    return Math.round(((s1 - s0) / (t1 - t0)) * 60_000);
};

// ---------------------------------------------------------------------------------------
// Reading

export interface RecorderState {
    phase: RunPhase;
    clientId: string | null;
    type: TrackableType | null;
    startedAt: number | null;
    /** Seconds on the clock, excluding manual pauses. Auto-pause still counts; moving time does not. */
    activeSec: number;
    live: LiveSnapshot | null;
    /** Live estimate, grade 0. Null without a weight — never a guess. */
    kcal: number | null;
    weightKnown: boolean;
    /** Metres, from the last fix the OS delivered, filtered or not. */
    accuracyM: number | null;
    lastFixAt: number | null;
    goal: RunGoal | null;
    maxHr: number | null;
    /** The newest live heart rate, if it is fresh. */
    heartRate: number | null;
    heartLink: HeartLink;
    /** Steps per minute from the bracelet, or null. */
    cadence: number | null;
}

export const getState = (now = Date.now()): RecorderState => {
    if (!run) {
        return {
            phase: 'idle', clientId: null, type: null, startedAt: null, activeSec: 0, live: null,
            kcal: null, weightKnown: false, accuracyM: null, lastFixAt: null, goal: null,
            maxHr: null, heartRate: null, heartLink, cadence: null,
        };
    }
    const openPause = run.pausedAt != null ? now - run.pausedAt : 0;
    const end = run.finishedAt ?? now;
    return {
        phase: run.phase,
        clientId: run.meta.clientId,
        type: run.meta.type,
        startedAt: run.meta.startedAt,
        activeSec: Math.max(0, Math.floor((end - run.meta.startedAt - run.pausedMs - openPause) / 1000)),
        live: run.acc.snapshot(),
        kcal: run.kcal == null ? null : Math.round(run.kcal),
        weightKnown: run.meta.weightKg != null,
        accuracyM: run.lastFix?.acc ?? null,
        lastFixAt: run.lastFix?.t ?? null,
        goal: run.meta.goal ?? null,
        maxHr: run.meta.maxHr ?? null,
        heartRate: heart && now - heart.at <= 10_000 ? heart.bpm : null,
        heartLink,
        cadence: cadenceOf(run.stepSamples, now),
    };
};

/** `[lng, lat]` of every kept fix, for the map. Read-only; rebuild the line from it. */
export const routeCoordinates = (): number[][] => (run ? run.acc.points().map((p) => [p.lng, p.lat]) : []);

/** The kept fixes and moving segments, for the Afterglow trail and the pace ribbon. Read-only. */
export const trackView = () => ({
    points: run ? run.acc.points() : [],
    segments: run ? run.acc.segments() : [],
});

export const getVersion = () => version;

export const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

/** Tests only. */
export const __resetForTests = () => {
    run = null;
    heart = null;
    heartLink = 'none';
    listeners.clear();
};
