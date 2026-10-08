/**
 * Continuous heart rate, posted per record and freed on the band — `mapping.heartStreamRecords`
 * and `reader.ts`.
 *
 * It was ~860 packets replayed on every sync because it could never be deleted. What has to
 * hold now that it can:
 *
 *   - Zeros (off the wrist) and impossible readings never reach a record's figures.
 *   - The band is freed of it only when the server's reply says it stores the stream. A server
 *     that predates it is the only other copy's absence, and must leave the band untouched.
 *   - The first stream read drops its oldest day: the ring buffer's start is overwritten.
 *     Later reads drop nothing.
 *   - A record the band writes between the read and the delete keeps the series on the band.
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

const stamp = (day: number, hh: number, mm = 0) =>
    `2026.10.${String(day).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;

let mockStream: { date: string; arrayDynamicHR: string }[] = [];
jest.mock('../session', () => ({
    makePacketHandler: () => () => undefined,
    reset: jest.fn(),
    ask: jest.fn(async () => ({ packets: [], complete: true })),
    readSeries: jest.fn(async (_variant: string, command: string) => ({
        packets: command === 'getDynamicHr'
            ? [{ type: 'dynamicHr', rawType: 0, end: true, data: { dicData: mockStream } }]
            : [],
        complete: true,
    })),
    acknowledge: jest.fn(async () => undefined),
}));

jest.mock('../live', () => ({ isLive: () => false }));
jest.mock('../clock', () => ({
    checkAndSetClock: async () => ({ bandAt: null, phoneAt: new Date().toISOString(), lastSetAt: null }),
    readClock: async () => ({ bandAt: null, phoneAt: new Date().toISOString() }),
    isWrong: () => false,
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

import type { JstylePacket } from '@/modules/jstyle-ble';
import * as session from '../session';
import * as map from '../mapping';
import { reader, acknowledgeSynced, release } from '../reader';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('../store');

const ctx: map.MapContext = { deviceId: 'band-1', variant: 'v8', device: { name: 'V8' } };
const freed = () => (session.acknowledge as jest.Mock).mock.calls.map((c) => c[1]);

beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.id = null;
    mockStream = [
        { date: stamp(5, 22), arrayDynamicHR: '70 72 0 0' },
        { date: stamp(6, 8), arrayDynamicHR: '55 60 65 0' },
        { date: stamp(7, 9), arrayDynamicHR: '80 90 0 100' },
    ];
    store.__set({ id: 'band-1', variant: 'v8', label: 'V8', pairedAt: '2026-09-01', monitoringVersion: 99, nameSetTo: 'Predyqt 2' });
});

describe('heartStreamRecords', () => {
    const packets = (records: unknown[]) => [{ type: 'dynamicHr', rawType: 0, end: true, data: { dicData: records } } as JstylePacket];

    it('drops zeros and impossible readings before taking the figures', () => {
        const rows = map.heartStreamRecords(packets([
            { date: stamp(6, 8), arrayDynamicHR: '0 55 300 65 12' },
        ]), ctx);
        expect(rows).toHaveLength(1);
        expect(rows[0].tuple).toEqual([2, 120, 55, 65]);
        expect(rows[0].externalId).toMatch(/^jstyle:band-1:hr_stream:\d+$/);
    });

    it('maps a record with nothing on the wrist to nothing', () => {
        expect(map.heartStreamRecords(packets([{ date: stamp(6, 8), arrayDynamicHR: '0 0 0' }]), ctx)).toEqual([]);
    });

    it('reads the iOS spelling', () => {
        const rows = map.heartStreamRecords(packets([{ date: stamp(6, 8), arrayHR: [60, 70] }]), ctx);
        expect(rows[0].tuple).toEqual([2, 130, 60, 70]);
    });

    it('groups records into one row per local day, keyed by start ms', () => {
        const rows = map.toHeartStream(map.heartStreamRecords(packets(mockStream), ctx));
        expect(rows.map((r) => r.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
        const key = String(new Date(2026, 9, 6, 8).getTime());
        expect(rows[1].blocks[key]).toEqual([3, 180, 55, 65]);
    });
});

describe('the transition read', () => {
    it('drops the oldest day from the stream and the day figures, once', async () => {
        const batch = await reader.readSince(null);
        expect(batch.heartStream!.map((r) => r.day)).toEqual(['2026-10-06', '2026-10-07']);
        expect(batch.days.filter((d) => d.avgBpm != null).map((d) => d.day)).toEqual(['2026-10-06', '2026-10-07']);
        await acknowledgeSynced({ heartStream: true });
        expect(store.__get().heartStreamSince).toBeDefined();

        mockStream = [{ date: stamp(7, 22), arrayDynamicHR: '60' }, { date: stamp(8, 7), arrayDynamicHR: '58' }];
        const next = await reader.readSince(null);
        expect(next.heartStream!.map((r) => r.day)).toEqual(['2026-10-07', '2026-10-08']);
        await release();
    });
});

describe('freeing the band', () => {
    it('frees the stream when the server says it stores it', async () => {
        await reader.readSince(null);
        await acknowledgeSynced({ heartStream: true });
        expect(freed()).toContain('getDynamicHr');
    });

    it('keeps it on the band for a server that does not', async () => {
        await reader.readSince(null);
        await acknowledgeSynced({ heartStream: false });
        expect(freed()).not.toContain('getDynamicHr');
        expect(store.__get().heartStreamSince).toBeUndefined();
    });

    it('keeps it when a record landed between the read and the delete', async () => {
        await reader.readSince(null);
        mockStream = [...mockStream, { date: stamp(7, 9, 2), arrayDynamicHR: '81 82' }];
        await acknowledgeSynced({ heartStream: true });
        expect(freed()).not.toContain('getDynamicHr');
    });
});
