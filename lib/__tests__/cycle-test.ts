/**
 * The cycle tracker's client-side wording and predicates.
 *
 * The numbers are the server's (`utils/cycleForecast.js`, with its own tests). What lives here
 * is what the person reads: that a prediction is always printed as a range, that the late copy
 * names the ordinary causes and never a condition, that every icon is a glyph that exists —
 * Ionicons draws an unknown name as nothing, on every phone, with no error — and when the home
 * screen may draw the card or make its one offer.
 */
jest.mock('../auth', () => ({ getAccessToken: jest.fn(async () => null) }));

import {
    formatRange, headline, homeCardLive, homeOfferLive, flowLabel, SYMPTOMS, MOODS, STATUSES,
    addDays, diffDays, daysBetween, LATE_CAUSES, FERTILE_DISCLAIMER,
    type CycleReading, type CycleOverview,
} from '../cycle';

const reading = (over: Partial<CycleReading> = {}): CycleReading => ({
    state: 'upcoming',
    reason: null,
    cycleDay: 21,
    lastStart: '2026-08-21',
    lastStartSource: 'logged',
    currentPeriod: null,
    prediction: {
        expected: '2026-09-18', window: { from: '2026-09-16', to: '2026-09-20' },
        cycleLength: 28, spread: 2, source: 'observed', cyclesUsed: 4,
    },
    daysUntil: { from: 6, to: 10 },
    daysLate: null,
    daysSinceStart: null,
    periodLength: { length: 5, source: 'observed' },
    luteal: { days: 14, source: 'default' },
    next: null,
    fertile: null,
    ...over,
});

const overview = (over: Partial<CycleOverview> = {}, r: Partial<CycleReading> = {}): CycleOverview => ({
    access: 'enabled',
    plan: {
        enabled: true, onboarded: true,
        seed: { lastPeriodStart: null, periodLength: null, cycleLength: null },
        status: 'none', showFertileWindow: false, fertileAllowed: false,
        reminders: { periodSoon: true, late: true }, discreetPush: true,
    },
    today: '2026-09-10',
    reading: reading(r),
    week: [],
    todayLog: null,
    stats: { cyclesLogged: 4, averageCycle: 28, averagePeriod: 5, variation: 2 },
    notes: [],
    prompt: null,
    temperatureSignal: false,
    ...over,
});

describe('day arithmetic', () => {
    it('stays on the calendar, never on a clock', () => {
        expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
        expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
        expect(diffDays('2026-09-16', '2026-09-20')).toBe(4);
        expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    });
});

describe('a prediction is always a range', () => {
    it('within one month', () => {
        expect(formatRange({ from: '2026-09-16', to: '2026-09-20' })).toMatch(/^16–20 /);
    });
    it('across two months', () => {
        expect(formatRange({ from: '2026-09-29', to: '2026-10-03' })).toMatch(/29.*–.*3/);
    });
    it('upcoming headline prints the window, not a single day', () => {
        const h = headline(reading(), 'none');
        expect(h.title).toBe('Period likely in 6–10 days');
        expect(h.detail).toMatch(/16–20/);
        expect(h.detail).toMatch(/last 4 cycles/);
    });
    it('says where the number came from', () => {
        const h = headline(reading({ prediction: { ...reading().prediction!, source: 'reported', cyclesUsed: 0 } }), 'none');
        expect(h.detail).toMatch(/told us at setup/);
    });
});

describe('the words', () => {
    it('late names the ordinary causes, pregnancy among them', () => {
        const h = headline(reading({ state: 'late', daysLate: 3 }), 'none');
        expect(h.title).toBe('3 days late');
        expect(h.detail).toBe(LATE_CAUSES);
        expect(h.detail).toMatch(/pregnan/);
    });

    it('one day late is singular', () => {
        expect(headline(reading({ state: 'late', daysLate: 1 }), 'none').title).toBe('1 day late');
    });

    it('never names a condition or raises an alarm, in any state', () => {
        const states: CycleReading['state'][] = ['period', 'upcoming', 'due', 'late', 'very_late', 'long_gap', 'paused', 'unknown'];
        for (const state of states) {
            for (const status of ['none', 'pregnant', 'breastfeeding'] as const) {
                const h = headline(reading({ state, daysLate: 9, currentPeriod: { start: '2026-09-08', day: 3, loggedThrough: '2026-09-10', expectedEnd: '2026-09-12' } }), status);
                expect(`${h.title} ${h.detail}`).not.toMatch(/PCOS|polycystic|endometriosis|fibroid|infertil|urgent|emergency|danger|abnormal/i);
            }
        }
    });

    it('asks for what is missing when there is nothing to predict from', () => {
        expect(headline(reading({ state: 'unknown', reason: 'needs_period', prediction: null }), 'none').title).toBe('Log your last period');
        expect(headline(reading({ state: 'unknown', reason: 'needs_length', prediction: null }), 'none').title).toBe('One more period to go');
    });

    it('the fertile window says it is not contraception', () => {
        expect(FERTILE_DISCLAIMER).toMatch(/not a way to avoid pregnancy/);
    });

    it('a period day with no flow recorded reads as a period, not as nothing', () => {
        expect(flowLabel('unspecified')).toBe('Period');
        expect(flowLabel(null)).toBe('None');
    });
});

describe('the home screen', () => {
    it('draws the card only when there is something to report', () => {
        expect(homeCardLive(overview())).toBe(false); // day 21, six days out
        expect(homeCardLive(overview({}, { daysUntil: { from: 3, to: 7 } }))).toBe(true);
        expect(homeCardLive(overview({}, { state: 'late', daysLate: 2 }))).toBe(true);
        expect(homeCardLive(overview({}, { state: 'period' }))).toBe(true);
        expect(homeCardLive(overview({ prompt: { kind: 'confirm_end', start: '2026-09-06', suggestedEnd: '2026-09-09' } }))).toBe(true);
    });

    it('never draws the card for somebody who has not switched it on', () => {
        expect(homeCardLive(overview({ access: 'off' }, { state: 'late', daysLate: 5 }))).toBe(false);
    });

    it('offers the tracker to Female and to not-said, never to Male, and only once', () => {
        expect(homeOfferLive('suggested')).toBe(true);
        expect(homeOfferLive('offer')).toBe(true);
        expect(homeOfferLive('hidden')).toBe(false);
        expect(homeOfferLive('dismissed')).toBe(false);
        expect(homeOfferLive('enabled')).toBe(false);
        expect(homeOfferLive('off')).toBe(false);
        expect(homeOfferLive(null)).toBe(false);
    });
});

describe('glyphs', () => {
    it('every symptom icon is a real Ionicons glyph', () => {
        const { glyphMap } = jest.requireActual('@expo/vector-icons/Ionicons').default;
        for (const s of SYMPTOMS) expect(Object.prototype.hasOwnProperty.call(glyphMap, s.icon)).toBe(true);
    });

    it('every mood face is a real MaterialIcons glyph', () => {
        const { glyphMap } = jest.requireActual('@expo/vector-icons/MaterialIcons').default;
        for (const m of MOODS) expect(Object.prototype.hasOwnProperty.call(glyphMap, m.icon)).toBe(true);
    });

    it('the tables match the server enums', () => {
        // Mirrors `SYMPTOMS` in labtrack-backend/models/CycleDay.js and `STATUSES` in CyclePlan.js.
        expect(SYMPTOMS.map((s) => s.key).sort()).toEqual([
            'acne', 'back_pain', 'bloating', 'breast_tenderness', 'cramps', 'cravings',
            'diarrhoea', 'fatigue', 'headache', 'insomnia', 'mood_swings', 'nausea',
        ]);
        expect(STATUSES.map((s) => s.key)).toEqual(['none', 'hormonal_contraception', 'pregnant', 'breastfeeding', 'perimenopause']);
    });
});
