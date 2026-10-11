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
    RECOVERY_GLYPH, VITAL_KEYS, formatSleep, recoveryCaption, signalPill, signalPosition, TARGET_LINE,
    type Readout, type RecoverySignal,
} from '@/lib/readout';

const signal = (over: Partial<RecoverySignal>): RecoverySignal => ({
    key: 'hrv', value: 50, usual: 50, unit: 'ms', direction: 'near', points: 65, ...over,
});

const recovery = (over: Partial<NonNullable<Readout['recovery']>>): NonNullable<Readout['recovery']> => ({
    score: 64, state: 'steady', label: 'Steady', learning: null, signals: [], penalty: 0, held: false, ...over,
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

    it('points at the alert, not the score, while an urgent one is open', () => {
        expect(recoveryCaption(recovery({ state: 'recharged', label: 'Recharged', held: true }))).toBe('See your alert');
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
