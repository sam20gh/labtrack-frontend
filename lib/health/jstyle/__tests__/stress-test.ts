/**
 * The bracelet's stress score — `mapping.toStress`.
 *
 * It rides in the HRV records and was read and discarded until 2026-10-08. What has to hold:
 *
 *   - Both reply shapes produce one row per record, with a stable id.
 *   - A failed measurement (zero HRV, zero stress) maps to nothing, never to a calm reading.
 *   - A value off the 1–100 scale is dropped rather than charted.
 */
import type { JstylePacket } from '@/modules/jstyle-ble';
import * as map from '../mapping';

const ctx: map.MapContext = {
    deviceId: 'AA:BB',
    variant: 'v8',
    device: { name: 'J-Style V8', model: 'J-Style V8', manufacturer: 'J-Style' },
};

const packet = (data: unknown): JstylePacket =>
    ({ type: 'hrv', rawType: 0, end: true, data } as JstylePacket);

describe('toStress', () => {
    it('reads the iOS shape, nested under arrayHrvData', () => {
        const rows = map.toStress([packet({
            arrayHrvData: [
                { date: '2026.10.07 10:00:00', hrv: 42, stress: 30 },
                { date: '2026.10.07 14:00:00', hrv: 28, stress: 61 },
            ],
        })], ctx);
        expect(rows.map((r) => r.score)).toEqual([30, 61]);
        expect(rows[0].externalId).toMatch(/^jstyle:AA:BB:stress:\d+$/);
        expect(rows[0].sourceDevice).toEqual(ctx.device);
    });

    it('reads the Android shape, a list under dicData', () => {
        const rows = map.toStress([packet({
            dicData: [{ date: '2026-10-07 10:00:00', hrv: '42', stress: '30' }],
        })], ctx);
        expect(rows).toEqual([expect.objectContaining({ score: 30 })]);
    });

    it('falls back to numberStress', () => {
        const rows = map.toStress([packet({
            arrayHrvData: [{ date: '2026.10.07 10:00:00', hrv: 42, numberStress: 25 }],
        })], ctx);
        expect(rows).toEqual([expect.objectContaining({ score: 25 })]);
    });

    it('drops a failed measurement rather than recording a calm one', () => {
        expect(map.toStress([packet({
            arrayHrvData: [
                { date: '2026.10.07 10:00:00', hrv: 0, stress: 0 },
                { date: '2026.10.07 11:00:00', hrv: 0, stress: 40 },
                { date: '2026.10.07 12:00:00', hrv: 40, stress: 0 },
            ],
        })], ctx)).toEqual([]);
    });

    it('drops a value off the scale, and a record with no time', () => {
        expect(map.toStress([packet({
            arrayHrvData: [
                { date: '2026.10.07 10:00:00', hrv: 42, stress: 140 },
                { hrv: 42, stress: 30 },
            ],
        })], ctx)).toEqual([]);
    });

    it('gives a re-read record the same id, so a re-sync upserts', () => {
        const once = map.toStress([packet({
            arrayHrvData: [{ date: '2026.10.07 10:00:00', hrv: 42, stress: 30 }],
        })], ctx);
        const again = map.toStress([packet({
            arrayHrvData: [{ date: '2026.10.07 10:00:00', hrv: 42, stress: 30 }],
        })], ctx);
        expect(again[0].externalId).toBe(once[0].externalId);
    });
});
