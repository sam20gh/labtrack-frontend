/**
 * Getting finished runs off the phone.
 *
 * The journal is deleted only after the server answers 2xx — a retried upload is answered
 * 200 with the stored row (the `clientId` is the idempotency key), so "any success" is safe
 * to treat as "done" and deleting on it can never lose a run. Everything else keeps the
 * journal:
 *
 * - no connection (status 0), a timeout, a 5xx, **a 404** → `pending`. A 404 here means the
 *   server that answered does not have the live-session endpoint — a deployment behind the
 *   app — which is exactly as recoverable as an outage, and is what happened the first time
 *   a real ride was recorded (2026-09-28: the endpoint was on a branch, not on `main`).
 * - 401/403 → `pending` too, and the caller routes to sign-in; the run is not the problem.
 * - **400 → `rejected`**, stored on the journal and never retried, because the same bytes
 *   will be refused the same way forever. It stays on the phone and the screen says so.
 *
 * **Retried whenever it could now work**: at launch, whenever the app comes back to the
 * front, and from the "waiting to upload" card — not only at launch, which left a ride
 * sitting on the phone for as long as the app stayed open. The reason for the last failure
 * is kept, so the screen can say "the server refused it" rather than claiming the phone was
 * offline when it was not.
 */
import { AppState } from 'react-native';
import { ApiError } from '../api';
import { saveLiveSession, type ActivitySession, type LiveSessionMetrics } from '../activity';
import * as journal from './journal';
import type { TrackableType } from './trackMath';

export type FailureKind = 'offline' | 'server' | 'auth';

export type UploadResult =
    | { status: 'saved'; session: ActivitySession; metrics?: LiveSessionMetrics }
    | { status: 'pending'; authError: boolean; kind: FailureKind; httpStatus: number }
    | { status: 'rejected'; reason: string }
    | { status: 'missing' };

const inFlight = new Map<string, Promise<UploadResult>>();
/** Why each waiting run last failed, for the card and the ending screen. In memory only. */
const lastFailure = new Map<string, { kind: FailureKind; httpStatus: number; at: number }>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => { try { l(); } catch { /* a screen's bug */ } });

export const onUploadsChange = (fn: () => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

const attempt = async (clientId: string): Promise<UploadResult> => {
    const saved = journal.readRun(clientId);
    if (!saved) return { status: 'missing' };
    if (saved.status?.state === 'rejected') return { status: 'rejected', reason: saved.status.reason };

    const replayed = journal.replay(saved.meta, saved.events);
    if (!replayed.finished) return { status: 'pending', authError: false, kind: 'offline', httpStatus: 0 };

    try {
        const res = await saveLiveSession({
            clientId,
            type: saved.meta.type,
            startedAt: new Date(replayed.startedAt).toISOString(),
            endedAt: new Date(Math.max(replayed.endedAt, replayed.startedAt + 1000)).toISOString(),
            track: replayed.track,
            steps: replayed.steps ?? undefined,
            // The only live heart-rate source is the bracelet; a column means it was worn.
            hrSource: replayed.track.hr ? 'bracelet_live' : undefined,
        });
        journal.deleteRun(clientId);
        lastFailure.delete(clientId);
        return { status: 'saved', session: res.session, metrics: res.metrics };
    } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
            const reason = err.message || 'The server could not read this session';
            journal.setStatus(clientId, { state: 'rejected', reason });
            lastFailure.delete(clientId);
            console.warn(`🛰️ Live session ${clientId} rejected: ${reason}`);
            return { status: 'rejected', reason };
        }
        const httpStatus = err instanceof ApiError ? err.status : 0;
        const kind: FailureKind = err instanceof ApiError && err.isAuthError ? 'auth' : httpStatus === 0 ? 'offline' : 'server';
        lastFailure.set(clientId, { kind, httpStatus, at: Date.now() });
        console.warn(`🛰️ Live session ${clientId} not uploaded yet (${kind}${httpStatus ? ` ${httpStatus}` : ''})`);
        return { status: 'pending', authError: kind === 'auth', kind, httpStatus };
    }
};

/** Upload one finished run. Concurrent calls for the same run share one request. */
export const uploadRun = (clientId: string): Promise<UploadResult> => {
    const existing = inFlight.get(clientId);
    if (existing) return existing;
    const p = attempt(clientId).finally(() => {
        inFlight.delete(clientId);
        notify();
    });
    inFlight.set(clientId, p);
    return p;
};

export interface WaitingRun {
    clientId: string;
    type: TrackableType;
    startedAt: number;
    rejected: string | null;
    lastFailure: { kind: FailureKind; httpStatus: number; at: number } | null;
    uploading: boolean;
}

/** Finished runs still on this phone — the "waiting to upload" card. */
export const waitingRuns = (): WaitingRun[] => {
    let ids: string[] = [];
    try { ids = journal.listRuns(); } catch { return []; }
    const active = journal.activeRunId();
    const out: WaitingRun[] = [];
    for (const id of ids) {
        if (id === active) continue;
        const saved = journal.readRun(id);
        if (!saved?.status) continue;
        out.push({
            clientId: id,
            type: saved.meta.type,
            startedAt: saved.meta.startedAt,
            rejected: saved.status.state === 'rejected' ? saved.status.reason : null,
            lastFailure: lastFailure.get(id) ?? null,
            uploading: inFlight.has(id),
        });
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
};

/**
 * Every finished run still on the phone. Never throws — a failed upload is a run that waits,
 * not an error at startup.
 */
export const uploadPending = async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    for (const run of waitingRuns()) {
        if (run.rejected) continue;
        results.push(await uploadRun(run.clientId).catch(() => ({
            status: 'pending', authError: false, kind: 'offline', httpStatus: 0,
        }) as UploadResult));
    }
    return results;
};

let attached = false;
let lastSweep = 0;
const SWEEP_EVERY_MS = 30_000;

/**
 * Once, from `app/_layout.tsx`: sweep at launch and whenever the app comes back to the front,
 * at most every 30 s.
 */
export const attachUploadRetry = () => {
    if (attached) return;
    attached = true;
    const sweep = () => {
        if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
        lastSweep = Date.now();
        uploadPending().catch(() => undefined);
    };
    sweep();
    AppState.addEventListener('change', (next) => { if (next === 'active') sweep(); });
};
