/**
 * A metric card the server sends before this build knows its key.
 *
 * The API deploys independently of the app, so a new card (HRV was the first) reaches
 * installed builds before the update that teaches them about it. Opening such a card used to
 * be `router.push(undefined)`, which throws in the press handler and white-screens a release
 * build. These helpers are what every screen reads a server key through.
 */
jest.mock('@/lib/api', () => ({ api: {} }));

import {
    metricRoute, metricIcon, metricTint, METRIC_ROUTE, HISTORY_METRIC, METRIC_INSIGHT_ROUTE,
    type MetricKey,
} from '@/lib/metrics';

const palette = { textSecondary: '#6B7280' };

describe('metric lookups by a server-sent key', () => {
    it('answer the table for a key this build knows', () => {
        expect(metricRoute('hrv')).toBe(METRIC_ROUTE.hrv);
        expect(metricIcon('hrv')).toBe('git-compare-outline');
    });

    it('answer something safe for a key it does not', () => {
        expect(metricRoute('glucose')).toBeNull();
        expect(metricIcon('glucose')).toBe('stats-chart-outline');
        expect(metricTint('glucose', palette)).toBe(palette.textSecondary);
    });

    it('never answer undefined, which is what crashed', () => {
        for (const key of ['hrv', 'weight', 'nonsense', '']) {
            expect(metricIcon(key)).toEqual(expect.any(String));
            expect(metricTint(key, palette)).toEqual(expect.any(String));
            expect(metricRoute(key) === undefined).toBe(false);
        }
    });
});

/**
 * Every card on the Health Metrics list opens that metric's own history. Heart rate, HRV and
 * steps used to open Activity, and blood oxygen and temperature the bracelet's pairing screen.
 */
describe('where a metric card goes', () => {
    it('is a history under /metrics for every metric', () => {
        for (const route of Object.values(METRIC_ROUTE)) expect(route).toMatch(/^\/metrics\//);
    });

    it('is a slug the history screen knows, and maps back to the same card', () => {
        for (const [key, route] of Object.entries(METRIC_ROUTE)) {
            if (key === 'hydration') continue; // its own flow at /metrics/water
            const slug = route.replace('/metrics/', '') as keyof typeof HISTORY_METRIC;
            expect(HISTORY_METRIC[slug]).toBe(key);
        }
    });

    it('offers an insight for every metric', () => {
        for (const key of Object.keys(METRIC_ROUTE) as MetricKey[]) {
            expect(METRIC_INSIGHT_ROUTE(key)).toMatch(/insight/);
        }
    });
});
