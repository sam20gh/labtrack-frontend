/**
 * The recorder and its journal.
 *
 * The property this feature cannot lose is "a run somebody did is a run they have", so the
 * tests that matter most are the ones that throw the recorder's memory away mid-run and
 * check the journal brings it back — which is what an Android JS restart under a live
 * foreground service, or an iOS relaunch into the background, does to it.
 *
 * `expo-file-system` is replaced with an in-memory tree, so the real `journal.ts` runs:
 * chunk naming, torn chunks, the active pointer, deletion.
 */
/* eslint-disable import/first -- jest.mock must precede the imports it replaces */

// ---- an in-memory expo-file-system -------------------------------------------------------
const mockFs = new Map<string, string | 'DIR'>();
jest.mock('expo-file-system', () => {
    const join = (parts: any[]) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/\/+/g, '/');
    class Directory {
        uri: string;
        constructor(...parts: any[]) { this.uri = join(parts); }
        get name() { return this.uri.split('/').pop()!; }
        get exists() { return mockFs.get(this.uri) === 'DIR'; }
        create() {
            const segs = this.uri.split('/');
            for (let i = 1; i <= segs.length; i += 1) mockFs.set(segs.slice(0, i).join('/'), 'DIR');
        }
        list() {
            const out: any[] = [];
            for (const [path, v] of mockFs) {
                if (path.startsWith(`${this.uri}/`) && !path.slice(this.uri.length + 1).includes('/')) {
                    out.push(v === 'DIR' ? new Directory(path) : new File(path));
                }
            }
            return out;
        }
        delete() { for (const k of [...mockFs.keys()]) if (k === this.uri || k.startsWith(`${this.uri}/`)) mockFs.delete(k); }
    }
    class File {
        uri: string;
        constructor(...parts: any[]) { this.uri = join(parts); }
        get name() { return this.uri.split('/').pop()!; }
        get exists() { return typeof mockFs.get(this.uri) === 'string'; }
        write(s: string) { mockFs.set(this.uri, s); }
        textSync() { return mockFs.get(this.uri) as string; }
        delete() { mockFs.delete(this.uri); }
    }
    return { Directory, File, Paths: { document: new Directory('doc') } };
});

// ---- the device --------------------------------------------------------------------------
let mockTracking = false;
jest.mock('../gps', () => ({
    RUN_LOCATION_TASK: 'predyqt-run-location',
    startTracking: jest.fn(async () => { mockTracking = true; }),
    stopTracking: jest.fn(async () => { mockTracking = false; }),
    isTracking: jest.fn(async () => mockTracking),
}));
jest.mock('../steps', () => ({ prepareSteps: jest.fn(async () => undefined), stepsForWindow: jest.fn(async () => 4321) }));
jest.mock('expo-task-manager', () => {
    const tasks: Record<string, (body: any) => Promise<void>> = {};
    return { tasks, defineTask: (name: string, fn: any) => { tasks[name] = fn; } };
});
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `run-${(mockUuid += 1).toString().padStart(4, '0')}` }));

import * as recorder from '../recorder';
import * as journal from '../journal';
import { computeTrack } from '../trackMath';

const mockTasks: Record<string, (body: any) => Promise<void>> = jest.requireMock('expo-task-manager').tasks;

const T0 = Date.UTC(2026, 8, 20, 6, 30, 0);
/** A straight run east at 3 m/s from `startS` for `n` seconds, as the OS delivers it. */
const locations = (startS: number, n: number, speed = 3) => Array.from({ length: n }, (_, i) => {
    const s = startS + i;
    return {
        timestamp: T0 + s * 1000,
        coords: {
            latitude: 25.08,
            longitude: 55.14 + (s * speed) / (111_320 * Math.cos((25.08 * Math.PI) / 180)),
            altitude: 10, accuracy: 5, altitudeAccuracy: null, heading: null, speed,
        },
    };
});

let now = T0;
beforeEach(() => {
    mockFs.clear();
    mockTracking = false;
    recorder.__resetForTests();
    now = T0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

describe('replay', () => {
    const meta: journal.RunMeta = { v: 1, clientId: 'x', type: 'jogging', startedAt: 1000, weightKg: 70 };

    it('turns events into the upload shape, closing a pause left open at the finish', () => {
        const r = journal.replay(meta, [
            { k: 'f', t: 1000, la: 1, ln: 2, al: 3, ac: 4 },
            { k: 'pause', t: 2000 },
            { k: 'resume', t: 3000 },
            { k: 'f', t: 3500, la: 1, ln: 2 },
            { k: 'pause', t: 4000 },
            { k: 'finish', t: 5000 },
        ]);
        expect(r.track.t).toEqual([1000, 3500]);
        expect(r.track.alt).toEqual([3, null]);
        expect(r.track.pauses).toEqual([[2000, 3000], [4000, 5000]]);
        expect(r.track.hr).toBeUndefined(); // no column at all rather than a column of nulls
        expect(r.finished).toBe(true);
        expect(r.endedAt).toBe(5000);
    });

    it('reports an unfinished journal as unfinished, ending at its last event', () => {
        const r = journal.replay(meta, [{ k: 'f', t: 1000, la: 1, ln: 2 }, { k: 'f', t: 9000, la: 1, ln: 2 }]);
        expect(r.finished).toBe(false);
        expect(r.endedAt).toBe(9000);
        expect(r.track.pauses).toBeUndefined();
    });

    it('takes the highest count per pedometer segment and adds the segments', () => {
        const r = journal.replay(meta, [
            { k: 'steps', t: 1, seg: 0, n: 100 }, { k: 'steps', t: 2, seg: 0, n: 250 },
            { k: 'steps', t: 3, seg: 1, n: 40 },
        ]);
        expect(r.steps).toBe(290);
    });
});

describe('recording', () => {
    it('records, pauses, resumes and finishes, leaving a finished journal for the upload', async () => {
        const id = await recorder.start({ type: 'jogging', weightKg: 70 });
        expect(recorder.getState().phase).toBe('recording');
        expect(journal.activeRunId()).toBe(id);

        recorder.ingest(locations(0, 300) as any);
        now = T0 + 300_000;
        recorder.pause();
        now = T0 + 360_000;
        recorder.resume();
        recorder.ingest(locations(360, 300) as any);
        now = T0 + 660_000;
        await recorder.finish();

        const state = recorder.getState();
        expect(state.phase).toBe('finished');
        expect(state.activeSec).toBe(600); // 660 s on the clock, 60 s paused
        expect(state.live!.distanceM).toBeGreaterThan(1700);
        expect(state.kcal).toBeGreaterThan(0);

        const saved = journal.readRun(id)!;
        expect(saved.status).toEqual({ state: 'finished' });
        expect(journal.activeRunId()).toBeNull();
        const replayed = journal.replay(saved.meta, saved.events);
        expect(replayed.track.t).toHaveLength(600);
        expect(replayed.steps).toBe(4321);
        // What the phone showed is what the upload will make of the journal.
        const m = computeTrack(replayed.track, { type: 'jogging' });
        expect(m.distanceM).toBe(state.live!.distanceM);
    });

    it('comes back from the journal when its memory is thrown away mid-run', async () => {
        const id = await recorder.start({ type: 'jogging', weightKg: 70 });
        recorder.ingest(locations(0, 125) as any);
        now = T0 + 125_000;
        recorder.pause();
        const before = recorder.getState();

        // What an Android JS restart does: module state gone, service still running.
        recorder.__resetForTests();
        expect(recorder.getState().phase).toBe('idle');

        // The next fix from the background task wakes it.
        now = T0 + 130_000;
        await mockTasks['predyqt-run-location']({ data: { locations: locations(130, 1) } });
        const after = recorder.getState();
        expect(after.clientId).toBe(id);
        expect(after.phase).toBe('paused');
        // Everything written before the restart survived; the last partial chunk may not
        // have been flushed yet, which is at most FLUSH_EVERY fixes.
        expect(after.live!.distanceM).toBeGreaterThan(before.live!.distanceM - 35);
    });

    it('loses only the torn chunk when one is corrupted, not the run', async () => {
        const id = await recorder.start({ type: 'jogging', weightKg: null });
        for (let b = 0; b < 10; b += 1) recorder.ingest(locations(b * 10, 10) as any);
        const chunk = [...mockFs.keys()].find((k) => k.endsWith('chunk-000002.json'))!;
        mockFs.set(chunk, '[{"k":"f","t":'); // a write cut off mid-way
        recorder.__resetForTests();
        expect(recorder.hydrate()).toBe(true);
        const events = journal.readRun(id)!.events;
        expect(events.length).toBe(90);
        expect(recorder.getState().kcal).toBeNull(); // no weight, no number
    });

    it('refuses a second start while one is recording', async () => {
        await recorder.start({ type: 'walking', weightKg: null });
        await expect(recorder.start({ type: 'walking', weightKg: null })).rejects.toBeInstanceOf(recorder.RunAlreadyActiveError);
    });

    it('leaves nothing behind when the radio cannot start', async () => {
        const gps = jest.requireMock('../gps');
        gps.startTracking.mockRejectedValueOnce(new Error('permission'));
        await expect(recorder.start({ type: 'walking', weightKg: null })).rejects.toThrow('permission');
        expect(journal.listRuns()).toEqual([]);
        expect(recorder.getState().phase).toBe('idle');
    });

    it('names a run the journal says is recording but the radio is not', async () => {
        const id = await recorder.start({ type: 'hiking', weightKg: null });
        recorder.ingest(locations(0, 20) as any);
        expect(await recorder.interruptedRun()).toBeNull();

        mockTracking = false; // force-quit on iOS stops updates
        expect((await recorder.interruptedRun())?.clientId).toBe(id);
    });

    it('discards the journal with the run', async () => {
        await recorder.start({ type: 'walking', weightKg: null });
        recorder.ingest(locations(0, 30) as any);
        await recorder.discard();
        expect(journal.listRuns()).toEqual([]);
        expect(journal.activeRunId()).toBeNull();
    });

    it('ignores fixes once finished', async () => {
        await recorder.start({ type: 'jogging', weightKg: null });
        recorder.ingest(locations(0, 60) as any);
        await recorder.finish();
        const d = recorder.getState().live!.distanceM;
        recorder.ingest(locations(60, 60) as any);
        expect(recorder.getState().live!.distanceM).toBe(d);
    });
});
