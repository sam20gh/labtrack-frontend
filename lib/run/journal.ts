/**
 * The on-disk record of a run in progress — **the source of truth, not memory.**
 *
 * A 90-minute run lost to a memory-pressure kill is the one failure this feature cannot
 * recover from, because the person remembers doing it. So every fix is written here before
 * anything else happens to it, and the recorder's in-memory state is only ever a cache of
 * what this folder says. When Android restarts the JavaScript while the location service
 * keeps running, or iOS relaunches the app into the background for a location event, the
 * recorder rebuilds itself from here and carries on appending.
 *
 * Layout, one folder per run under `documentDirectory/runs/<clientId>/`:
 *
 *   meta.json            written once at start
 *   chunk-000001.json    an array of events, written whole
 *   chunk-000002.json    …
 *   status.json          only once the run is finished: finished | rejected
 *   runs/active.json     which run, if any, is recording right now
 *
 * **Chunks, not one appended file.** A file written whole either exists or does not; an
 * append interrupted mid-write leaves a line that is half JSON. A torn chunk costs the ten
 * seconds in it, and `readRun` skips it and keeps the rest.
 *
 * The folder is deleted only after the server has answered the upload with a 2xx. Until
 * then this is the only copy.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { Track, TrackableType } from './trackMath';
import type { RunGoal } from './goal';

export const JOURNAL_VERSION = 1;

export interface RunMeta {
    v: number;
    clientId: string;
    type: TrackableType;
    /** ms epoch */
    startedAt: number;
    /** Body mass the live calorie estimate is priced with; the server re-prices anyway. */
    weightKg: number | null;
    /** What the runner set out to do. A lens on the live screen; never uploaded. */
    goal?: RunGoal;
    /** Estimated maximum heart rate for the zones, from the server. Null without a birth date. */
    maxHr?: number | null;
    /**
     * True once the server has *answered* the weight question — so a null `weightKg` means
     * "none on record" rather than "not asked yet" or "the request failed". Only the first
     * of those may ever put a "needs your weight" prompt on screen.
     */
    contextLoaded?: boolean;
}

/**
 * Compact on purpose — a two-hour run is ~7,000 fix events.
 *
 * Two kinds of step event, and the difference matters:
 * - `steps` is a **partial** count from one bracelet connection — steps since that connection
 *   began, rising. A dropped connection starts a new `seg`, and the segments add.
 * - `stepsTotal` is an **authoritative** count for the whole window (iOS's motion
 *   coprocessor, read at the finish). When present it replaces the segments outright,
 *   because they can only ever be an undercount of it.
 */
export type RunEvent =
    | { k: 'f'; t: number; la: number; ln: number; al?: number | null; ac?: number | null; hr?: number | null }
    | { k: 'pause'; t: number }
    | { k: 'resume'; t: number }
    | { k: 'steps'; t: number; seg: number; n: number }
    | { k: 'stepsTotal'; t: number; n: number }
    | { k: 'finish'; t: number };

export type RunStatus =
    | { state: 'finished' }
    /** The server refused it as malformed. Kept, never retried, surfaced to the person. */
    | { state: 'rejected'; reason: string };

// ---------------------------------------------------------------------------------------
// Pure: events → the upload shape

export interface ReplayedRun {
    track: Track;
    startedAt: number;
    endedAt: number;
    finished: boolean;
    paused: boolean;
    steps: number | null;
    lastT: number;
}

export const replay = (meta: RunMeta, events: readonly RunEvent[]): ReplayedRun => {
    const track: Track = { t: [], lat: [], lng: [], alt: [], acc: [], hr: [], pauses: [] };
    const stepsBySeg = new Map<number, number>();
    let stepsTotal: number | null = null;
    let pauseStart: number | null = null;
    let finishT: number | null = null;
    let lastT = meta.startedAt;
    let anyHr = false;

    for (const e of events) {
        if (e.t > lastT) lastT = e.t;
        switch (e.k) {
            case 'f':
                track.t.push(e.t);
                track.lat.push(e.la);
                track.lng.push(e.ln);
                track.alt!.push(e.al ?? null);
                track.acc!.push(e.ac ?? null);
                track.hr!.push(e.hr ?? null);
                if (e.hr != null) anyHr = true;
                break;
            case 'pause':
                if (pauseStart == null) pauseStart = e.t;
                break;
            case 'resume':
                if (pauseStart != null) {
                    track.pauses!.push([pauseStart, e.t]);
                    pauseStart = null;
                }
                break;
            case 'steps':
                // Counts only rise within a segment; the highest seen is the segment's total.
                stepsBySeg.set(e.seg, Math.max(stepsBySeg.get(e.seg) ?? 0, e.n));
                break;
            case 'stepsTotal':
                stepsTotal = e.n;
                break;
            case 'finish':
                finishT = e.t;
                break;
        }
    }

    const endedAt = finishT ?? lastT;
    // A run finished while paused: the pause runs to the end, so the tail is not moving time.
    const paused = pauseStart != null;
    if (pauseStart != null) track.pauses!.push([pauseStart, endedAt]);
    if (!track.pauses!.length) delete track.pauses;
    if (!anyHr) delete track.hr;

    const segmentSteps = stepsBySeg.size ? [...stepsBySeg.values()].reduce((a, b) => a + b, 0) : null;
    const steps = stepsTotal ?? (segmentSteps && segmentSteps > 0 ? segmentSteps : null);
    return { track, startedAt: meta.startedAt, endedAt, finished: finishT != null, paused, steps, lastT };
};

// ---------------------------------------------------------------------------------------
// Disk

const runsDir = () => new Directory(Paths.document, 'runs');
const runDir = (clientId: string) => new Directory(Paths.document, 'runs', clientId);
const activeFile = () => new File(Paths.document, 'runs', 'active.json');

const readJson = <T>(file: File): T | null => {
    try {
        if (!file.exists) return null;
        return JSON.parse(file.textSync()) as T;
    } catch {
        return null;
    }
};

export const createRun = (meta: RunMeta) => {
    const dir = runDir(meta.clientId);
    dir.create({ intermediates: true, idempotent: true });
    new File(dir, 'meta.json').write(JSON.stringify(meta));
    activeFile().write(JSON.stringify({ clientId: meta.clientId }));
};

/** Rewrite meta.json — once, when the server's answer about weight arrives mid-run. */
export const updateMeta = (meta: RunMeta) => {
    new File(runDir(meta.clientId), 'meta.json').write(JSON.stringify(meta));
};

/** The number of the next chunk, so a restarted recorder never overwrites one. */
export const nextChunkIndex = (clientId: string): number => {
    const dir = runDir(clientId);
    if (!dir.exists) return 1;
    let max = 0;
    for (const entry of dir.list()) {
        const m = /^chunk-(\d+)\.json$/.exec(entry.name);
        if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
};

export const writeChunk = (clientId: string, index: number, events: RunEvent[]) => {
    if (!events.length) return;
    const name = `chunk-${String(index).padStart(6, '0')}.json`;
    new File(runDir(clientId), name).write(JSON.stringify(events));
};

export const readRun = (clientId: string): { meta: RunMeta; events: RunEvent[]; status: RunStatus | null } | null => {
    const dir = runDir(clientId);
    if (!dir.exists) return null;
    const meta = readJson<RunMeta>(new File(dir, 'meta.json'));
    if (!meta) return null;
    const chunks = dir.list()
        .filter((e): e is File => e instanceof File && /^chunk-\d+\.json$/.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name));
    const events: RunEvent[] = [];
    for (const chunk of chunks) {
        const part = readJson<RunEvent[]>(chunk);
        if (Array.isArray(part)) events.push(...part); // a torn chunk costs its own seconds only
    }
    return { meta, events, status: readJson<RunStatus>(new File(dir, 'status.json')) };
};

export const setStatus = (clientId: string, status: RunStatus) => {
    new File(runDir(clientId), 'status.json').write(JSON.stringify(status));
};

export const activeRunId = (): string | null => readJson<{ clientId: string }>(activeFile())?.clientId ?? null;

export const clearActive = () => {
    const f = activeFile();
    if (f.exists) f.delete();
};

/** Every run still on the phone — finished awaiting upload, rejected, or interrupted. */
export const listRuns = (): string[] => {
    const dir = runsDir();
    if (!dir.exists) return [];
    return dir.list().filter((e) => e instanceof Directory).map((e) => e.name);
};

/** Only after a 2xx from the server, or the person discarding the run. */
export const deleteRun = (clientId: string) => {
    const dir = runDir(clientId);
    if (dir.exists) dir.delete();
    if (activeRunId() === clientId) clearActive();
};
