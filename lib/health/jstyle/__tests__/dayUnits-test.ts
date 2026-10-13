import * as map from '../mapping';
import type { JstylePacket } from '@/modules/jstyle-ble';

const packet = (data: Record<string, unknown>): JstylePacket =>
    ({ type: 'totalActivity', rawType: 0, end: true, data } as JstylePacket);

describe('day totals arrive in seconds and kilometres', () => {
    it('reads an Android history record as seconds and kilometres', () => {
        // A real V8 day from 2026-10-05: 7,766 steps, stored as 3,925 "minutes" and 5.47 "m"
        const [day] = map.toDays([packet({
            dicData: [{ date: '2026.10.05', step: 7766, calories: 227.36, distance: 5.47, exerciseMinutes: 3925 }],
        })]);
        expect(day.exerciseMin).toBe(65);
        expect(day.distanceM).toBe(5470);
    });

    it('converts a short Android day too, where the figure would have looked plausible', () => {
        const [day] = map.toDays([packet({ dicData: [{ date: '2026.10.13', step: 817, exerciseMinutes: 455 }] })]);
        expect(day.exerciseMin).toBe(8);
    });

    it('leaves an iOS figure that fits in a day as minutes', () => {
        const [day] = map.toDays([packet({
            arrayTotalActivityData: [{ date: '2026.10.07', step: 2140, distance: 1.4, exerciseMinutes: 18 }],
        })]);
        expect(day.exerciseMin).toBe(18);
        expect(day.distanceM).toBe(1400);
    });

    it('treats an iOS figure larger than a day as seconds', () => {
        const [day] = map.toDays([packet({
            arrayTotalActivityData: [{ date: '2026.10.07', step: 6000, exerciseMinutes: 3000 }],
        })]);
        expect(day.exerciseMin).toBe(50);
    });

    it('keeps an iOS distance already in metres', () => {
        const [day] = map.toDays([packet({
            arrayTotalActivityData: [{ date: '2026.10.07', step: 2140, distance: 1500 }],
        })]);
        expect(day.distanceM).toBe(1500);
    });
});
