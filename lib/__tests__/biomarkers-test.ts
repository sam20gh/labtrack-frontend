import { hasReturnedToRange, plainName, isCriticalFlag, FLAG_META } from '../biomarkers';
import type { BiomarkerSummary } from '@/types/api';

// `biomarkers.ts` pulls in the API client for its fetchers, which reaches AsyncStorage
// through the auth layer. None of the pure helpers under test touch it.
jest.mock('../api', () => ({ api: {} }));

const marker = (over: Partial<BiomarkerSummary>): BiomarkerSummary => ({
    _id: 'x', name: 'ferritin', displayName: 'Ferritin',
    value: 45, unit: 'ng/mL', measuredAt: '2026-09-01T00:00:00.000Z',
    flag: 'normal', appliedRange: { min: 30, max: 300 },
    measurementCount: 2, delta: 20, direction: 'up',
    ...over,
} as BiomarkerSummary);

describe('hasReturnedToRange', () => {
    it('is true when the previous reading was below the range and this one is in it', () => {
        expect(hasReturnedToRange(marker({ previous: { value: 12, measuredAt: '2026-06-01T00:00:00.000Z' } }))).toBe(true);
    });

    it('is true when the previous reading was above the range', () => {
        expect(hasReturnedToRange(marker({
            value: 200, previous: { value: 420, measuredAt: '2026-06-01T00:00:00.000Z' },
        }))).toBe(true);
    });

    it('is false when the marker was already in range — nothing recovered', () => {
        expect(hasReturnedToRange(marker({ previous: { value: 44, measuredAt: '2026-06-01T00:00:00.000Z' } }))).toBe(false);
    });

    it('is false for a marker that is still out of range', () => {
        expect(hasReturnedToRange(marker({
            flag: 'low', value: 12, previous: { value: 8, measuredAt: '2026-06-01T00:00:00.000Z' },
        }))).toBe(false);
    });

    it('is false on a first-ever reading, which recovered from nothing', () => {
        expect(hasReturnedToRange(marker({ previous: undefined }))).toBe(false);
    });

    it('is false when no range applies, rather than guessing', () => {
        expect(hasReturnedToRange(marker({
            appliedRange: undefined, previous: { value: 12, measuredAt: '2026-06-01T00:00:00.000Z' },
        }))).toBe(false);
    });
});

describe('plainName drops a label that repeats the title', () => {
    const withPlain = (displayName: string, plain: string) =>
        plainName({ displayName, name: 'x', explainer: { plainName: plain } as never });

    it.each([
        ['Red Blood Cells', 'Red blood cell count'],
        ['Total Cholesterol', 'Total cholesterol'],
        ['Ferritin', 'Ferritin level'],
    ])('drops %s / "%s"', (title, plain) => {
        expect(withPlain(title, plain)).toBeNull();
    });

    it.each([
        ['Red Blood Cells', 'Number of oxygen-carrying cells'],
        ['MCV', 'Average red blood cell size'],
        ['Triglycerides', 'Blood fats'],
        ['Ferritin', 'Iron stores'],
    ])('keeps %s / "%s"', (title, plain) => {
        expect(withPlain(title, plain)).toBe(plain);
    });
});

describe('flag tokens', () => {
    it('marks both crisis flags and nothing else', () => {
        expect(isCriticalFlag('critical_low')).toBe(true);
        expect(isCriticalFlag('critical_high')).toBe(true);
        expect(isCriticalFlag('high')).toBe(false);
    });

    it('gives every flag a filled pill and a value tone', () => {
        for (const meta of Object.values(FLAG_META)) {
            expect(meta.chipBg).toMatch(/^#[0-9A-F]{6}$/i);
            expect(meta.chipText).toBe('#FFFFFF');
            expect(meta.value).toMatch(/^#[0-9A-F]{6}$/i);
        }
    });
});
