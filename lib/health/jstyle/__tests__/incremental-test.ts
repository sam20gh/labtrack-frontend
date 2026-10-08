/**
 * Reading the never-deleted series from a start date — `reader.ts`.
 *
 * Day totals, sleep, continuous heart rate and HRV are never deleted from the band, so until
 * 2026-10-08 every sync replayed weeks of each, and a sync took minutes. What has to hold:
 *
 *   - Nothing reads from a date until the band has proved, for that series, that it returns
 *     exactly the records from that date on. A band that ignores it stays on full reads.
 *   - A start date is a whole local day, the day before the newest record, so a day's
 *     figures are never posted from half a day.
 *   - Nothing about where to start is saved until the server has the rows.
 *   - A full replay still happens every day, and after a wrong clock.
 *   - The deletable series are never read from a date.
 */
jest.mock('@/modules/jstyle-ble', () => ({
    capabilities: () => ({ commands: [] }),
    isAvailable: () => true,
    supports: () => true,
}));

const mockConnection = { id: null as string | null };
jest.mock('../transport', () => ({
    connect: jest.fn(async (id: string) => { mockConnection.id = id; }),
    disconnect: jest.fn(async () => { mockConnection.id = null; }),
    connectedId: () => mockConnection.id,
    isConnected: () => mockConnection.id !== null,
}));

/** Local instants, as the band stamps them. */
const at = (day: number, hh = 10) => new Date(2026, 9, day, hh, 0, 0);
const stamp = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
};
/** Either SDK's start-date string back to an instant. */
const parseStart = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T'));

let mockHonours = true;
let mockDays = [1, 2, 3, 4, 5, 6, 7];
const records = (command: string) => mockDays.map((d) => {
    const date = stamp(at(d));
    if (command === 'getTotalActivity') return { date: date.slice(0, 10), step: '4000' };
    if (command === 'getDetailSleep') return { date, arraySleepQuality: '1 2 2', sleepUnitLength: '1' };
    if (command === 'getDynamicHr') return { date, arrayDynamicHR: '60 61 62' };
    if (command === 'getHrv') return { date, hrv: '40', stress: '30' };
    return { date, onceHeartValue: '62' };
});

jest.mock('../session', () => ({
    makePacketHandler: () => () => undefined,
    reset: jest.fn(),
    ask: jest.fn(async () => ({ packets: [], complete: true })),
    readSeries: jest.fn(async (_variant: string, command: string, opts: { startDate?: string } = {}) => {
        let list = records(command);
        if (opts.startDate && mockHonours) {
            const from = parseStart(opts.startDate).getTime();
            list = list.filter((r) => new Date(String(r.date).replace(/\./g, '-').replace(' ', 'T')).getTime() >= from);
        }
        return { packets: [{ type: 'x', rawType: 0, end: true, data: { dicData: list } }], complete: true };
    }),
    acknowledge: jest.fn(async () => undefined),
}));

jest.mock('../live', () => ({ isLive: () => false }));

let mockClockWrong = false;
jest.mock('../clock', () => ({
    checkAndSetClock: async () => ({ bandAt: null, phoneAt: new Date().toISOString(), lastSetAt: null }),
    readClock: async () => ({ bandAt: null, phoneAt: new Date().toISOString() }),
    isWrong: () => mockClockWrong,
}));

jest.mock('../store', () => {
    let paired: Record<string, unknown> | null = null;
    return {
        getPaired: async () => paired,
        updatePaired: async (patch: Record<string, unknown>) => { paired = { ...paired, ...patch }; },
        __set: (value: Record<string, unknown>) => { paired = value; },
        __get: () => paired,
    };
});

import * as session from '../session';
import {
    reader, acknowledgeSynced, release, whenIdle, judgeProbe, incrementalStart, startDateArg,
} from '../reader';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('../store');

const calls = () => (session.readSeries as jest.Mock).mock.calls
    .map(([, command, opts]) => ({ command, startDate: opts?.startDate as string | undefined }));
const callsFor = (command: string) => calls().filter((c) => c.command === command);

const sync = async () => {
    await reader.readSince(null);
    await acknowledgeSynced();
};

beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.id = null;
    mockHonours = true;
    mockClockWrong = false;
    mockDays = [1, 2, 3, 4, 5, 6, 7];
    store.__set({ id: 'band-1', variant: 'v8', label: 'V8', pairedAt: '2026-09-01', monitoringSetAt: '2026-09-01', monitoringVersion: 99, nameSetTo: 'Predyqt 2' });
});

describe('the pieces', () => {
    it('starts at the local midnight the day before the newest record', () => {
        const start = incrementalStart(at(7, 10).toISOString());
        expect(start.getTime()).toBe(new Date(2026, 9, 6, 0, 0, 0).getTime());
    });

    it('writes the date each SDK reads', () => {
        const d = new Date(2026, 9, 6, 0, 0, 0);
        expect(startDateArg(d, 'android')).toBe('2026-10-06 00:00:00');
        expect(startDateArg(d, 'ios')).toBe(d.toISOString().replace('.000Z', 'Z'));
        expect(startDateArg(d, 'ios')).not.toMatch(/\.\d{3}/);
    });

    it('judges a probe', () => {
        const full = [at(1), at(5), at(6), at(7)];
        const from = new Date(2026, 9, 6);
        expect(judgeProbe(full, [at(6), at(7)], from)).toBe('verified');
        // A reading taken between the two reads is allowed.
        expect(judgeProbe(full, [at(6), at(7), at(7, 11)], from)).toBe('verified');
        expect(judgeProbe(full, full, from)).toBe('unsupported');
        expect(judgeProbe(full, [at(7)], from)).toBe('unsupported');
        expect(judgeProbe(full, [], from)).toBe('unsupported');
        expect(judgeProbe([at(6), at(7)], [at(6), at(7)], from)).toBe('inconclusive');
    });
});

describe('a band that honours a start date', () => {
    it('reads in full and probes once, then reads from the day before the newest record', async () => {
        await sync();
        expect(callsFor('getHrv').map((c) => !!c.startDate)).toEqual([false, true]);
        expect(store.__get().incremental.getHrv).toMatchObject({ verdict: 'verified' });

        jest.clearAllMocks();
        await sync();
        const second = callsFor('getHrv');
        expect(second).toHaveLength(1);
        expect(parseStart(second[0].startDate!).getTime()).toBe(new Date(2026, 9, 6).getTime());
    });

    it('posts whole days from an incremental read', async () => {
        await sync();
        mockDays = [1, 2, 3, 4, 5, 6, 7, 8];
        const batch = await reader.readSince(null);
        const days = batch.days.filter((d) => d.hrvMs != null).map((d) => d.day);
        // The cursor was the 7th, so the read starts at midnight on the 6th: the 6th and 7th
        // whole, and the 8th that is new. Nothing from before the 6th.
        expect(days).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
        await release();
    });

    it('never reads a deletable series from a date', async () => {
        await sync();
        jest.clearAllMocks();
        await sync();
        for (const command of ['getStaticHr', 'getAutoSpo2', 'getTemperature', 'getDetailActivity']) {
            expect(callsFor(command).every((c) => !c.startDate)).toBe(true);
        }
    });
});

describe('a band that ignores it', () => {
    it('is marked unsupported and stays on full reads without probing again', async () => {
        mockHonours = false;
        await sync();
        expect(store.__get().incremental.getHrv.verdict).toBe('unsupported');

        jest.clearAllMocks();
        await sync();
        expect(callsFor('getHrv')).toEqual([{ command: 'getHrv', startDate: undefined }]);
    });
});

describe('a band that replays everything anyway', () => {
    it('posts only the window once its verdict is known, and everything on a full read', async () => {
        mockHonours = false;
        await sync();
        mockDays = [1, 2, 3, 4, 5, 6, 7, 8];
        const batch = await reader.readSince(null);
        // The cursor was the 7th: the window starts at midnight on the 6th.
        expect(batch.days.filter((d) => d.hrvMs != null).map((d) => d.day))
            .toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
        expect(batch.stress!.map((r) => new Date(r.measuredAt).getDate())).toEqual([6, 7, 8]);
        expect(batch.sleep.length).toBe(3);
        await acknowledgeSynced();
        // The cursor moved on with what was read.
        expect(new Date(store.__get().incremental.getHrv.newest).getDate()).toBe(8);

        store.__set({ ...store.__get(), lastFullReadAt: new Date(Date.now() - 25 * 3600_000).toISOString() });
        const full = await reader.readSince(null);
        expect(full.days.filter((d) => d.hrvMs != null)).toHaveLength(8);
        await release();
    });
});

describe('nothing is saved before the server has the rows', () => {
    it('a POST that failed leaves no cursor and no verdict', async () => {
        await reader.readSince(null);
        await release();
        expect(store.__get().incremental).toBeUndefined();
        expect(store.__get().lastFullReadAt).toBeUndefined();
    });
});

describe('the full replay', () => {
    it('runs again after a day, whatever the band has proved', async () => {
        await sync();
        store.__set({ ...store.__get(), lastFullReadAt: new Date(Date.now() - 25 * 3600_000).toISOString() });
        jest.clearAllMocks();
        await sync();
        expect(callsFor('getHrv')).toEqual([{ command: 'getHrv', startDate: undefined }]);
    });

    it('runs after a wrong clock', async () => {
        await sync();
        mockClockWrong = true;
        jest.clearAllMocks();
        await sync();
        expect(callsFor('getHrv')).toEqual([{ command: 'getHrv', startDate: undefined }]);
    });

    it('does not probe while there is too little history to tell', async () => {
        mockDays = [6, 7];
        await sync();
        expect(store.__get().incremental.getHrv).toMatchObject({ verdict: 'unverified' });
        // Nothing older than the start date: no probe was even worth sending.
        expect(callsFor('getHrv').every((c) => !c.startDate)).toBe(true);
    });
});

describe('the bracelet is held until a sync lets go', () => {
    it('whenIdle waits for release', async () => {
        await reader.readSince(null);
        let idle = false;
        const waiting = whenIdle().then(() => { idle = true; });
        await Promise.resolve();
        expect(idle).toBe(false);
        await release();
        await waiting;
        expect(idle).toBe(true);
    });
});
