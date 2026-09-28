/**
 * Getting finished runs off the phone.
 *
 * The journal is deleted only after the server answers 2xx — a retried upload is answered
 * 200 with the stored row (the `clientId` is the idempotency key), so "any success" is safe
 * to treat as "done" and deleting on it can never lose a run. Everything else keeps the
 * journal:
 *
 * - no connection, a timeout, a 5xx → `pending`, tried again on the next launch or the next
 *   call to `uploadPending()`;
 * - 401/403 → `pending` too, and the caller routes to sign-in; the run is not the problem;
 * - **400 → `rejected`**, stored on the journal and never retried, because the same bytes
 *   will be refused the same way forever. It stays on the phone and the screen says so, so
 *   that a bug in this client costs a retry after a fix rather than somebody's run.
 */
import { ApiError } from '../api';
import { saveLiveSession, type ActivitySession, type LiveSessionMetrics } from '../activity';
import * as journal from './journal';

export type UploadResult =
    | { status: 'saved'; session: ActivitySession; metrics?: LiveSessionMetrics }
    | { status: 'pending'; authError: boolean }
    | { status: 'rejected'; reason: string }
    | { status: 'missing' };

const inFlight = new Map<string, Promise<UploadResult>>();

const attempt = async (clientId: string): Promise<UploadResult> => {
    const saved = journal.readRun(clientId);
    if (!saved) return { status: 'missing' };
    if (saved.status?.state === 'rejected') return { status: 'rejected', reason: saved.status.reason };

    const replayed = journal.replay(saved.meta, saved.events);
    if (!replayed.finished) return { status: 'pending', authError: false };

    try {
        const res = await saveLiveSession({
            clientId,
            type: saved.meta.type,
            startedAt: new Date(replayed.startedAt).toISOString(),
            endedAt: new Date(Math.max(replayed.endedAt, replayed.startedAt + 1000)).toISOString(),
            track: replayed.track,
            steps: replayed.steps ?? undefined,
        });
        journal.deleteRun(clientId);
        return { status: 'saved', session: res.session, metrics: res.metrics };
    } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
            const reason = err.message || 'The server could not read this session';
            journal.setStatus(clientId, { state: 'rejected', reason });
            console.warn(`🛰️ Live session ${clientId} rejected: ${reason}`);
            return { status: 'rejected', reason };
        }
        return { status: 'pending', authError: err instanceof ApiError && err.isAuthError };
    }
};

/** Upload one finished run. Concurrent calls for the same run share one request. */
export const uploadRun = (clientId: string): Promise<UploadResult> => {
    const existing = inFlight.get(clientId);
    if (existing) return existing;
    const p = attempt(clientId).finally(() => inFlight.delete(clientId));
    inFlight.set(clientId, p);
    return p;
};

/**
 * Every finished run still on the phone. Called at launch; cheap when there are none.
 * Never throws — a failed upload is a run that waits, not an error at startup.
 */
export const uploadPending = async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    let ids: string[] = [];
    try {
        ids = journal.listRuns();
    } catch {
        return results;
    }
    const active = journal.activeRunId();
    for (const id of ids) {
        if (id === active) continue;
        const saved = journal.readRun(id);
        if (saved?.status?.state !== 'finished') continue;
        results.push(await uploadRun(id).catch(() => ({ status: 'pending', authError: false }) as UploadResult));
    }
    return results;
};
