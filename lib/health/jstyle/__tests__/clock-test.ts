/**
 * Reading the bracelet's clock before setting it — `clock.ts`.
 *
 * Once set, nothing can show the clock was wrong, and on 2026-10-01 a wrong one filed a
 * morning nap as the evening before without anything noticing. What has to hold:
 *
 *   - The clock is read **before** it is set, and the reading reaches the batch.
 *   - The decoder reads the vendor's `strDeviceTime` the way every stamp is read: local.
 *   - A wrong clock live view found and fixed is kept and sent by the next sync, and cleared
 *     only once a POST carrying it has landed.
 *   - Each sync sends the previous one's end-of-sync readings.
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

/** How far behind the band's clock is. Setting it puts it right, as the real one does. */
let mockBandBehindMs = 0;
const mockLocal = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
jest.mock('../session', () => ({
    makePacketHandler: () => () => undefined,
    reset: jest.fn(),
    ask: jest.fn(async (_variant: string, command: string) => {
        if (command === 'setDeviceTime') mockBandBehindMs = 0;
        if (command !== 'getDeviceTime') return { packets: [], complete: true };
        const band = new Date(Date.now() - mockBandBehindMs);
        return {
            packets: [{ type: 'deviceTime', rawType: 0, end: true, data: { strDeviceTime: mockLocal(band) } }],
            complete: true,
        };
    }),
    readSeries: jest.fn(async () => ({ packets: [], complete: true })),
    acknowledge: jest.fn(async () => undefined),
}));

jest.mock('../live', () => ({ isLive: () => false }));

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
import { readDeviceTime } from '../mapping';
import { checkAndSetClock, isWrong, skewSec } from '../clock';
import { reader, acknowledgeSynced, release } from '../reader';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('../store');

const TEN_AND_A_HALF_HOURS = 38_080_000;
const LAST_SET = '2026-10-01T03:07:00.000Z';

beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.id = null;
    mockBandBehindMs = 0;
    store.__set({
        id: 'band-1', variant: 'v8', label: 'V8', pairedAt: '2026-09-01',
        monitoringSetAt: '2026-09-01', monitoringVersion: 99, clockSetAt: LAST_SET,
    });
});

// The reader holds the connection, with a watchdog, until a sync is acknowledged.
afterEach(() => release());

describe('readDeviceTime', () => {
    it('reads strDeviceTime as phone-local, like every record stamp', () => {
        const at = readDeviceTime([
            { type: 'deviceTime', rawType: 0, end: true, data: { strDeviceTime: '2026-09-30 22:10:00' } },
        ] as never);
        expect(at?.getFullYear()).toBe(2026);
        expect(at?.getMonth()).toBe(8);
        expect(at?.getDate()).toBe(30);
        expect(at?.getHours()).toBe(22);
        expect(at?.getMinutes()).toBe(10);
    });

    it('is null for a reply that carries no time — unknown, never "right"', () => {
        expect(readDeviceTime([])).toBeNull();
        expect(readDeviceTime([{ type: 'battery', rawType: 0, end: true, data: { batteryLevel: 80 } }] as never)).toBeNull();
    });
});

describe('the sync reads the clock before it sets it', () => {
    it('sends the wrong clock it found, and when it was last known right', async () => {
        mockBandBehindMs = TEN_AND_A_HALF_HOURS;
        const batch = await reader.readSince(null);

        const commands = (session.ask as jest.Mock).mock.calls.map((c) => c[1]);
        expect(commands.indexOf('getDeviceTime')).toBeLessThan(commands.indexOf('setDeviceTime'));

        expect(batch.clock).toMatchObject({ deviceId: 'band-1', lastSetAt: LAST_SET });
        // Whole seconds: the vendor's clock has no finer grain.
        expect(Math.abs(skewSec(batch.clock)! - 38_080)).toBeLessThanOrEqual(1);
        // Read again after the reads: the set worked.
        expect(isWrong(batch.clock!.afterRead)).toBe(false);
        expect(store.__get().clockSetAt).not.toBe(LAST_SET);
    });

    it('sends a right clock too — the server needs the reading either way', async () => {
        const batch = await reader.readSince(null);
        expect(isWrong(batch.clock)).toBe(false);
        expect(batch.clock!.bandAt).not.toBeNull();
    });
});

describe('a wrong clock found outside a sync', () => {
    it('is kept, sent by the next sync, and cleared once that POST has landed', async () => {
        mockBandBehindMs = TEN_AND_A_HALF_HOURS;
        // Live view sets the clock — and would otherwise erase the only evidence.
        await checkAndSetClock('v8', { report: false });
        expect(isWrong(store.__get().unreportedClock)).toBe(true);
        expect(store.__get().unreportedClock.lastSetAt).toBe(LAST_SET);

        const batch = await reader.readSince(null);
        expect(Math.abs(skewSec(batch.clock)! - 38_080)).toBeLessThanOrEqual(1);
        expect(batch.clock!.lastSetAt).toBe(LAST_SET);
        expect(store.__get().unreportedClock).toBeDefined();

        await acknowledgeSynced();
        expect(store.__get().unreportedClock).toBeUndefined();
    });

    it('is not kept by a sync, which reports it itself', async () => {
        mockBandBehindMs = TEN_AND_A_HALF_HOURS;
        await checkAndSetClock('v8', { report: true });
        expect(store.__get().unreportedClock).toBeUndefined();
    });
});

describe('the previous sync’s end-of-sync readings', () => {
    it('are recorded after the deletes and sent with the next batch', async () => {
        await reader.readSince(null);
        await acknowledgeSynced();
        const check = store.__get().lastClockCheck;
        expect(check.afterRead.bandAt).not.toBeNull();
        expect(check.afterAck.bandAt).not.toBeNull();

        const next = await reader.readSince(null);
        expect(next.clock!.previous).toEqual(check);
    });
});
