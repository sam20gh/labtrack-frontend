/**
 * The Today readout's phone-side wording — `lib/readout.ts` and the Vitals grid's filter.
 *
 * The server owns every number; what can go wrong here is a word. Recovery's state must never
 * be carried by colour alone, so every state needs its own glyph. A ring with nothing behind it
 * must say why rather than draw a dash and nothing else. And the Vitals grid must leave out what
 * the rings already show, or the same heart rate is on the screen twice.
 */
jest.mock('@/lib/api', () => ({ api: {} }));

import {
    RECOVERY_GLYPH, VITAL_KEYS, readoutTint, effortReason, fuelLines, type Fuel, formatSleep, recoveryCaption, signalPill, signalPosition, TARGET_LINE,
    type Readout, type RecoverySignal,
} from '@/lib/readout';

const signal = (over: Partial<RecoverySignal>): RecoverySignal => ({
    key: 'hrv', value: 50, usual: 50, unit: 'ms', direction: 'near', points: 65, ...over,
});

const recovery = (over: Partial<NonNullable<Readout['recovery']>>): NonNullable<Readout['recovery']> => ({
    score: 64, state: 'steady', label: 'Steady', learning: null, signals: [], penalty: 0, held: false, ...over,
});

import { Palettes } from '@/constants/theme';
import { metricTint } from '@/lib/metrics';

describe('ring colours', () => {
    it('gives the three rings three colours, in both schemes', () => {
        for (const palette of [Palettes.light, Palettes.dark]) {
            const tints = (['sleep', 'recovery', 'effort'] as const).map((k) => readoutTint(k, palette));
            expect(new Set(tints).size).toBe(3);
            // None of them is the brand purple, which means "you can act here".
            expect(tints).not.toContain(palette.primary);
        }
    });

    it('keeps sleep the colour it is on every other sleep surface', () => {
        expect(readoutTint('sleep', Palettes.light)).toBe(metricTint('sleep', Palettes.light));
    });
});

describe('readout wording', () => {
    it('gives every scored state its own glyph', () => {
        const scored = [RECOVERY_GLYPH.recharged, RECOVERY_GLYPH.steady, RECOVERY_GLYPH.low];
        expect(new Set(scored).size).toBe(3);
    });

    it('says why a ring is empty instead of drawing a bare dash', () => {
        expect(recoveryCaption(null)).toBe('Wear your band overnight');
        expect(recoveryCaption(recovery({ score: null, state: 'learning', learning: { have: 3, need: 5 } })))
            .toBe('Learning · 3 of 5');
    });

    it('points at the reading, not the score, while a fresh urgent one holds the card', () => {
        expect(recoveryCaption(recovery({ state: 'recharged', label: 'Recharged', held: true }))).toBe('See the reading');
    });

    it('only makes a pill for a signal off its usual', () => {
        expect(signalPill(signal({ direction: 'near' }))).toBeNull();
        expect(signalPill(signal({ value: 41, usual: 46, direction: 'below' }))).toBe('HRV 41 ms ↓ usual 46');
        expect(signalPill(signal({ key: 'resting', value: 64, usual: 58, unit: 'bpm', direction: 'above' })))
            .toBe('Resting 64 ↑ usual 58');
    });

    it('puts usual in the middle of the track and keeps every marker on it', () => {
        expect(signalPosition(signal({}))).toBeCloseTo(0.5);
        expect(signalPosition(signal({ value: 500 }))).toBe(1);
        expect(signalPosition(signal({ value: 1 }))).toBe(0);
    });

    it('writes sleep the way the ring prints it', () => {
        expect(formatSleep(460)).toBe('7h 40m');
        expect(formatSleep(480)).toBe('8h');
        expect(formatSleep(null)).toBeNull();
    });

    it('has a target line for every reason the server sends', () => {
        for (const reason of ['recharged', 'steady', 'low', 'week_done', 'default'] as const) {
            expect(TARGET_LINE[reason](30)).toMatch(/30 effort minutes/);
        }
    });

    it('keeps what the rings show out of the Vitals grid', () => {
        for (const key of ['heart_rate', 'hrv', 'sleep', 'steps', 'temperature']) {
            expect(VITAL_KEYS as readonly string[]).not.toContain(key);
        }
    });
});

describe('why a workout counted what it did', () => {
    const swim = { id: 's', type: 'swimming', durationMin: 30, effortMin: 0 } as const;

    it('names the rating when the rating decided it, and says light is not counted', () => {
        expect(effortReason({ ...swim, intensity: 'light', basis: 'rating' }))
            .toBe("You rated it light, so it isn't counted");
    });

    it('uses the log form\'s own word for a high rating', () => {
        expect(effortReason({ ...swim, intensity: 'vigorous', basis: 'rating', effortMin: 60 }))
            .toBe('You rated it high effort, so it counts double');
    });

    it('names the band when the band decided it', () => {
        expect(effortReason({ ...swim, type: 'jogging', intensity: 'moderate', basis: 'band', effortMin: 30 }))
            .toBe('Your band read it as moderate');
    });

    it('says when only the type was known', () => {
        expect(effortReason({ ...swim, intensity: 'moderate', basis: 'type', effortMin: 30 }))
            .toBe('Counted as moderate for its type');
    });
});

describe('the Fuel line', () => {
    const fuel = (over: Partial<Fuel> = {}): Fuel => ({
        meals: 2, mealsPerDay: 3, calories: 1240, target: 2100, protein: 50, proteinTarget: 120,
        hasGuidance: true, onPlan: null, allowance: null, ...over,
    });

    it('reads as logged against the target, with the meal count', () => {
        expect(fuelLines(fuel())).toEqual({ main: '1,240 of 2,100 kcal · 2 meals', detail: null });
    });

    it('says nothing is logged rather than drawing zero', () => {
        expect(fuelLines(fuel({ meals: 0, calories: 0 })).main).toBe('Nothing logged yet · 2,100 kcal today');
    });

    it('adds plan alignment and the allowance only when there is something to say', () => {
        const { detail } = fuelLines(fuel({ onPlan: { assessed: 3, aligned: 2, partial: 1, offPlan: 0 }, allowance: 180 }));
        expect(detail).toBe('2 of 3 on plan, 1 partly · +180 kcal for a harder day than usual');
    });

    it('never words an amount to cut', () => {
        for (const f of [fuel({ calories: 3200 }), fuel({ allowance: null }), fuel({ meals: 0, calories: 0 })]) {
            const { main, detail } = fuelLines(f);
            expect(`${main} ${detail ?? ''}`).not.toMatch(/over|too much|cut|less|reduce|-\d/i);
        }
    });
});
