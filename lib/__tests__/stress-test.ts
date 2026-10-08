/**
 * The stress indicator's phone-side tables — `lib/stress.ts` and the stress rows of
 * `lib/metrics.ts`.
 *
 * Ionicons renders an unknown glyph as nothing, so a typo in `LEVEL_ICON` would leave the
 * level pill with a colour and no shape — exactly the colour-only signal the glyph is there to
 * prevent. And the fallback feelings must be the server's five, or a check-in from an older
 * server's screen would post a value it refuses.
 */
jest.mock('@/lib/api', () => ({ api: {} }));

import { FEELINGS, LEVEL_ICON } from '@/lib/stress';
import { METRIC_ICON, METRIC_ROUTE, HISTORY_METRIC, metricRoute } from '@/lib/metrics';

const ionicons = () => jest.requireActual('@expo/vector-icons/Ionicons').default.glyphMap as Record<string, number>;
const has = (name: string) => Object.prototype.hasOwnProperty.call(ionicons(), name);

describe('stress tables', () => {
    it('every level glyph and the metric icon are real Ionicons glyphs', () => {
        for (const name of Object.values(LEVEL_ICON)) expect(has(name)).toBe(true);
        expect(has(METRIC_ICON.stress)).toBe(true);
    });

    it('gives every level a different glyph, so shape alone tells them apart', () => {
        expect(new Set(Object.values(LEVEL_ICON)).size).toBe(3);
    });

    it('the fallback feelings are the server five, 1 to 5', () => {
        expect(FEELINGS.map((f) => f.value)).toEqual([1, 2, 3, 4, 5]);
        expect(FEELINGS.map((f) => f.key)).toEqual(['calm', 'okay', 'tense', 'stressed', 'overwhelmed']);
    });

    it('the card opens its own history screen', () => {
        expect(metricRoute('stress')).toBe('/metrics/stress');
        expect(METRIC_ROUTE.stress).toBe('/metrics/stress');
        expect(HISTORY_METRIC.stress).toBe('stress');
    });
});
