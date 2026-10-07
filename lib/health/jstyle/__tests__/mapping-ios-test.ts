/**
 * The iOS SDKs' reply shapes — `mapping.ts`.
 *
 * On 2026-10-07 the first iPhone sync ever (a 2208A) read every history series and mapped
 * none of it: iOS nests each series' records under a named key (`arrayTotalActivityData`)
 * and spells several fields differently from the Android jars. Nothing failed — the batch
 * was simply empty, and the screen said "nothing new to bring over". What has to hold:
 *
 *   - Every series in the iOS shape produces rows.
 *   - Arrays of numbers inside a record are never mistaken for the record list.
 *   - The Android shape still maps exactly as before.
 *
 * Key names are the iOS archives' own, read from `libBleSDK_J2208A.a` / `libBleSDK_V8.a`.
 */
import type { JstylePacket } from '@/modules/jstyle-ble';
import * as map from '../mapping';

const ctx: map.MapContext = {
    deviceId: 'AA:BB',
    variant: 'j2208a',
    device: { name: 'J-Style 2208A', model: 'J-Style 2208A', manufacturer: 'J-Style' },
};

const packet = (type: JstylePacket['type'], data: Record<string, unknown>): JstylePacket =>
    ({ type, rawType: 0, end: true, data } as JstylePacket);

describe('iOS reply shapes', () => {
    it('reads day totals from arrayTotalActivityData', () => {
        const days = map.toDays([packet('totalActivity', {
            arrayTotalActivityData: [{
                date: '2026.10.07', step: 2140, calories: 96, distance: 1.4,
                exerciseMinutes: 18, activeMinutes: 25, goal: 10000,
            }],
        })]);
        expect(days).toEqual([expect.objectContaining({ day: '2026-10-07', steps: 2140, exerciseMin: 18 })]);
    });

    it('reads a night from arrayDetailSleepData, started at startTime_SleepData', () => {
        const nights = map.toSleep([packet('detailSleep', {
            arrayDetailSleepData: [{
                startTime_SleepData: '2026.10.07 00:30:00', totalSleepTime: 3,
                arraySleepQuality: [1, 2, 2], sleepUnitLength: 1,
            }],
        })], ctx);
        expect(nights).toHaveLength(1);
        expect(nights[0].inBedMin).toBe(3);
    });

    it('reads spot heart rate from singleHR and the stream from arrayHR', () => {
        const heart = map.toHeart([packet('staticHr', {
            arraySingleHR: [{ date: '2026.10.07 10:00:00', singleHR: 64 }],
        })], ctx);
        expect(heart).toEqual([expect.objectContaining({ bpm: 64 })]);

        const days = map.toHeartDays([packet('dynamicHr', {
            arrayContinuousHR: [{ date: '2026.10.07 10:00:00', arrayHR: [0, 60, 70, 0] }],
        })]);
        expect(days).toEqual([{ day: '2026-10-07', minBpm: 60, maxBpm: 70, avgBpm: 65 }]);
    });

    it('reads HRV and blood pressure from arrayHrvData', () => {
        const packets = [packet('hrv', {
            arrayHrvData: [{
                date: '2026.10.07 10:00:00', hrv: 42, heartRate: 66,
                systolicBP: 118, diastolicBP: 76, stress: 30, vascularAging: 30,
            }],
        })];
        expect(map.toHrvDays(packets)).toEqual([{ day: '2026-10-07', hrvMs: 42 }]);
        expect(map.toBloodPressure(packets, ctx)).toEqual([
            expect.objectContaining({ systolic: 118, diastolic: 76, pulse: 66 }),
        ]);
    });

    it('reads automatic and manual SpO2 under their own field names', () => {
        expect(map.toSpo2([packet('autoSpo2', {
            arrayAutomaticSpo2Data: [{ date: '2026.10.07 10:00:00', automaticSpo2Data: 97 }],
        })], ctx, 'automatic')).toEqual([expect.objectContaining({ spo2: 97 })]);

        expect(map.toSpo2([packet('manualSpo2', {
            arrayManualSpo2Data: [{ date: '2026.10.07 10:00:00', manualSpo2Data: 95 }],
        })], ctx, 'manual')).toEqual([expect.objectContaining({ spo2: 95 })]);
    });

    it('reads temperature from the vendor-misspelled arrayemperatureData', () => {
        expect(map.toTemperature([packet('temperature', {
            arrayemperatureData: [{ date: '2026.10.07 10:00:00', temperature: 33.4 }],
        })], ctx, 'wrist')).toEqual([expect.objectContaining({ celsius: 33.4 })]);
    });

    it('reads nothing from an empty list rather than a phantom record', () => {
        expect(map.toDays([packet('totalActivity', { arrayTotalActivityData: [] })])).toEqual([]);
    });

    it('still reads a single reply that is not a list', () => {
        expect(map.readBattery([packet('battery', { batteryLevel: 52 })])).toBe(52);
    });
});

describe('Android reply shapes are unchanged', () => {
    it('reads day totals from dicData', () => {
        const days = map.toDays([packet('totalActivity', {
            dicData: [{ date: '2026.10.07', step: 500 }],
        })]);
        expect(days).toEqual([expect.objectContaining({ day: '2026-10-07', steps: 500 })]);
    });

    it('reads spot heart rate from onceHeartValue', () => {
        expect(map.toHeart([packet('staticHr', {
            dicData: [{ date: '2026-10-07 10:00:00', onceHeartValue: 61 }],
        })], ctx)).toEqual([expect.objectContaining({ bpm: 61 })]);
    });
});
