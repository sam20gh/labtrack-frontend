/**
 * Reading a chart with a finger — `lib/chartScrub.ts`.
 *
 * The gesture itself cannot be tested without a device; what can be is every decision it
 * hands off: which slot a touch means, which slots a long range lets it land on, where the
 * callout goes so it never hides the point, and how a value is printed in it.
 */
import {
    SPARSE_SNAP_ABOVE, columnCentres, formatChartNumber, formatChartValue,
    nearestIndex, placeCallout, scrubDayLabel, scrubTimeLabel, stepIndex,
} from '@/lib/chartScrub';

describe('nearestIndex', () => {
    const xs = [10, 20, 30, 40];

    it('snaps to the nearest slot, never between two', () => {
        expect(nearestIndex(xs, 24)).toBe(1);
        expect(nearestIndex(xs, 26)).toBe(2);
        expect(nearestIndex(xs, -50)).toBe(0);
        expect(nearestIndex(xs, 500)).toBe(3);
    });

    it('skips slots the chart does not allow — a gap on a long range', () => {
        const hasData = (i: number) => i !== 1 && i !== 2;
        expect(nearestIndex(xs, 21, hasData)).toBe(0);
        expect(nearestIndex(xs, 29, hasData)).toBe(3);
    });

    it('answers null when there is nothing to land on', () => {
        expect(nearestIndex([], 10)).toBeNull();
        expect(nearestIndex(xs, 10, () => false)).toBeNull();
    });

    it('snaps sparsely only past a month', () => {
        expect(SPARSE_SNAP_ABOVE).toBe(31);
    });
});

describe('stepIndex — the screen reader\'s swipe', () => {
    it('lands on the newest slot first, from either direction', () => {
        expect(stepIndex(5, null, 1)).toBe(4);
        expect(stepIndex(5, null, -1)).toBe(4);
    });

    it('steps through allowed slots and stops at the ends', () => {
        const allowed = (i: number) => i !== 2;
        expect(stepIndex(5, 3, -1, allowed)).toBe(1);
        expect(stepIndex(5, 0, -1, allowed)).toBe(0);
        expect(stepIndex(5, 4, 1, allowed)).toBe(4);
    });
});

describe('columnCentres', () => {
    it('centres equal columns across the width, gaps included', () => {
        expect(columnCentres(4, 100)).toEqual([12.5, 37.5, 62.5, 87.5]);
        // (100 - 3×4) / 4 = 22 wide, 26 apart
        expect(columnCentres(4, 100, 4)).toEqual([11, 37, 63, 89]);
    });

    it('is empty before the row has been laid out', () => {
        expect(columnCentres(7, 0)).toEqual([]);
    });
});

describe('placeCallout', () => {
    const base = { chartWidth: 300, calloutWidth: 100, calloutHeight: 50 };

    it('centres over the crosshair when the point is clear of it', () => {
        expect(placeCallout({ ...base, x: 150, pointY: 120 })).toEqual({ left: 100, top: 0 });
    });

    it('stays inside the chart at either edge', () => {
        expect(placeCallout({ ...base, x: 10, pointY: 120 }).left).toBe(0);
        expect(placeCallout({ ...base, x: 295, pointY: 120 }).left).toBe(200);
    });

    it('steps aside rather than covering a high point', () => {
        const right = placeCallout({ ...base, x: 100, pointY: 20 });
        expect(right.left).toBeGreaterThan(100);
        const left = placeCallout({ ...base, x: 250, pointY: 20 });
        expect(left.left + base.calloutWidth).toBeLessThan(250);
    });

    it('drops below the point when neither side has room', () => {
        const placed = placeCallout({ ...base, chartWidth: 150, x: 75, pointY: 20 });
        expect(placed.top).toBeGreaterThan(20);
    });

    it('centres over an empty day, which has no point to cover', () => {
        expect(placeCallout({ ...base, x: 150, pointY: null })).toEqual({ left: 100, top: 0 });
    });
});

describe('labels', () => {
    const now = new Date(2026, 9, 11, 15, 0); // Sat 11 Oct 2026

    it('names today and yesterday, and the weekday otherwise', () => {
        expect(scrubDayLabel('2026-10-11', now)).toBe('Today');
        expect(scrubDayLabel('2026-10-10', now)).toBe('Yesterday');
        expect(scrubDayLabel('2026-10-06', now)).toBe('Tue 6 Oct');
    });

    it('adds the year only outside the current one', () => {
        expect(scrubDayLabel('2025-12-29', now)).toBe('Mon 29 Dec 2025');
    });

    it('reads YYYY-MM-DD as a local day, never shifted by the UTC offset', () => {
        expect(scrubDayLabel('2026-10-01', now).startsWith('Thu 1 Oct')).toBe(true);
    });

    it('prints an intraday reading on the 24-hour clock', () => {
        expect(scrubTimeLabel(new Date(2026, 9, 11, 9, 5).toISOString())).toBe('09:05');
    });
});

describe('formatChartValue', () => {
    it('never prints a trailing ".0", and rounds by magnitude', () => {
        expect(formatChartNumber(97)).toBe('97');
        expect(formatChartNumber(36.64)).toBe('36.6');
        expect(formatChartNumber(128.4)).toBe('128');
        expect(formatChartNumber(12345)).toBe((12345).toLocaleString());
    });

    it('writes % and ° against the number, other units after a space', () => {
        expect(formatChartValue(97, '%')).toBe('97%');
        expect(formatChartValue(36.6, '°C')).toBe('36.6°C');
        expect(formatChartValue(62, 'bpm')).toBe('62 bpm');
        expect(formatChartValue(42)).toBe('42');
    });

    it('prints hours as hours and minutes', () => {
        expect(formatChartValue(7.4, 'h')).toBe('7h 24m');
        expect(formatChartValue(8, 'h')).toBe('8h');
        expect(formatChartValue(0.5, 'h')).toBe('30m');
    });
});
