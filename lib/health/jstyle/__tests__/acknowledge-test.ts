/**
 * The one path in the app that destroys data on its source.
 *
 * The bracelet's delete wipes a whole series and the bracelet is the only copy until the
 * server has it, so what is pinned here is every way a reading could be deleted unsent:
 * a reading that lands while the POST is in flight, a read that did not finish, packets this
 * build cannot name, a POST that failed, and live view taking the mockConnection over. And the
 * series that must never be deleted at all, because the server stores them per day.
 */
jest.mock('@/modules/jstyle-ble', () => ({
    capabilities: () => ({ commands: [] }),
    isAvailable: () => true,
    supports: () => false,
}));

const mockConnection = { id: null as string | null };
jest.mock('../transport', () => ({
    connect: jest.fn(async (id: string) => { mockConnection.id = id; }),
    disconnect: jest.fn(async () => { mockConnection.id = null; }),
    connectedId: () => mockConnection.id,
    isConnected: () => mockConnection.id !== null,
}));

// What the bracelet holds, per series. Tests change it between the read and the re-read.
let mockHeld: Record<string, { packets: unknown[]; complete?: boolean; reason?: string }> = {};
jest.mock('../session', () => ({
    makePacketHandler: () => () => undefined,
    reset: jest.fn(),
    ask: jest.fn(async () => ({ packets: [], complete: true })),
    readSeries: jest.fn(async (_variant: string, command: string) => ({
        packets: mockHeld[command]?.packets ?? [],
        complete: mockHeld[command]?.complete ?? true,
        reason: mockHeld[command]?.reason,
    })),
    acknowledge: jest.fn(async () => undefined),
}));

let mockLive = false;
jest.mock('../live', () => ({ isLive: () => mockLive }));

jest.mock('../store', () => {
    let paired: Record<string, unknown> | null = null;
    return {
        getPaired: async () => paired,
        updatePaired: async (patch: Record<string, unknown>) => { paired = { ...paired, ...patch }; },
        __set: (value: Record<string, unknown>) => { paired = value; },
    };
});

import * as session from '../session';
import * as transport from '../transport';
import { reader, acknowledgeSynced, release } from '../reader';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('../store');

const packet = (type: string, records: Record<string, unknown>[]) => ({
    type, rawType: 0, end: true, data: { dicData: records },
});
const hr = (time: string, bpm: number) => ({ date: `2026.09.28 ${time}`, onceHeartValue: String(bpm) });
const spo2 = (time: string, pct: number) => ({ date: `2026.09.28 ${time}`, Blood_oxygen: String(pct) });

const deleted = () => (session.acknowledge as jest.Mock).mock.calls.map((c) => c[1]);

beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.id = null;
    mockLive = false;
    store.__set({ id: 'band-1', variant: 'v8', label: 'V8', pairedAt: '2026-09-01', monitoringSetAt: '2026-09-01' });
    mockHeld = {
        getStaticHr: { packets: [packet('staticHr', [hr('10:00:00', 62), hr('10:10:00', 64)])] },
        getAutoSpo2: { packets: [packet('autoSpo2', [spo2('10:00:00', 97)])] },
        getTotalActivity: { packets: [packet('totalActivity', [{ date: '2026.09.28', step: '4000' }])] },
        getDetailSleep: { packets: [packet('detailSleep', [{ date: '2026.09.28 00:00:00', arraySleepQuality: '1 2 2', sleepUnitLength: '1' }])] },
        getDynamicHr: { packets: [packet('dynamicHr', [{ date: '2026.09.28 10:00:00', arrayDynamicHR: '60 61 0 62' }])] },
        getHrv: { packets: [packet('hrv', [{ date: '2026.09.28 10:00:00', hrv: '40' }])] },
    };
});

describe('what a successful sync deletes', () => {
    it('deletes the per-reading series once the re-read holds nothing unsent', async () => {
        const batch = await reader.readSince(null);
        expect(batch.heart).toHaveLength(2);
        expect(batch.spo2).toHaveLength(1);

        await acknowledgeSynced();

        expect(deleted().sort()).toEqual(['getAutoSpo2', 'getStaticHr']);
        expect(transport.disconnect).toHaveBeenCalled();
    });

    it('never deletes a series the server stores per day or per night', async () => {
        await reader.readSince(null);
        await acknowledgeSynced();
        for (const kept of ['getTotalActivity', 'getDynamicHr', 'getHrv', 'getDetailSleep']) {
            expect(deleted()).not.toContain(kept);
        }
    });

    it('sends everything it read — nothing is filtered by the cursor any more', async () => {
        const batch = await reader.readSince('v2:2099-01-01T00:00:00.000Z');
        expect(batch.heart).toHaveLength(2);
        expect(batch.spo2).toHaveLength(1);
    });
});

describe('what keeps a series on the bracelet', () => {
    it('a reading taken while the POST was in flight', async () => {
        await reader.readSince(null);
        // The bracelet takes a reading between the read and the delete.
        mockHeld.getStaticHr = { packets: [packet('staticHr', [hr('10:00:00', 62), hr('10:10:00', 64), hr('10:20:00', 66)])] };

        await acknowledgeSynced();

        expect(deleted()).not.toContain('getStaticHr');
        expect(deleted()).toContain('getAutoSpo2');
    });

    it('a read that did not finish', async () => {
        mockHeld.getStaticHr = { ...mockHeld.getStaticHr, complete: false };
        await reader.readSince(null);
        await acknowledgeSynced();
        expect(deleted()).not.toContain('getStaticHr');
    });

    it('packets this build cannot name — how the SpO2 history was lost once already', async () => {
        mockHeld.getAutoSpo2 = { packets: [packet('unknown', [spo2('10:00:00', 97)])] };
        await reader.readSince(null);
        await acknowledgeSynced();
        expect(deleted()).not.toContain('getAutoSpo2');
    });

    it('a POST that failed: release without acknowledging deletes nothing', async () => {
        await reader.readSince(null);
        await release();
        expect(deleted()).toEqual([]);
        expect(transport.disconnect).toHaveBeenCalled();
        // And a late acknowledge after the release has nothing to act on.
        await acknowledgeSynced();
        expect(deleted()).toEqual([]);
    });

    it('live view taking the bracelet over mid-POST', async () => {
        await reader.readSince(null);
        mockLive = true;
        await acknowledgeSynced();
        expect(deleted()).toEqual([]);
        // Nor does the sync close live view's mockConnection on its way out.
        expect(mockConnection.id).toBe('band-1');
    });
});
