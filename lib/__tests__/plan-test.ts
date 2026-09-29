/**
 * Which plan items count as advice, and which the medications screen carries. Both are
 * placement rules — a wrong one either buries advice again or shows it somewhere it does
 * not belong — so they are pinned here rather than trusted to the screens.
 */
jest.mock('../auth', () => ({ getAccessToken: jest.fn(async () => null) }));

import { isAdvice, needsAction, planItemsForMedications, adviceHomeFor } from '../plan';
import type { PlanItem } from '@/types/api';

const item = (over: Partial<PlanItem>): PlanItem => ({
    _id: Math.random().toString(36).slice(2),
    userId: 'u',
    type: 'lifestyle',
    title: 'Something',
    dueDate: '2026-09-01T00:00:00.000Z',
    status: 'upcoming',
    ...over,
} as PlanItem);

describe('advice', () => {
    it('is never overdue, whatever the sweep wrote', () => {
        expect(needsAction(item({ type: 'lifestyle', status: 'urgent' }))).toBe(false);
        expect(needsAction(item({ type: 'test', status: 'urgent' }))).toBe(true);
        expect(needsAction(item({ type: 'test', status: 'due' }))).toBe(true);
        expect(isAdvice(item({ type: 'lifestyle' }))).toBe(true);
    });

    it('links only to trackers that exist', () => {
        expect(adviceHomeFor(item({ condition: 'diet' }))?.route).toBe('/nutrition');
        expect(adviceHomeFor(item({ condition: 'supplementation' }))?.route).toBe('/medications');
        expect(adviceHomeFor(item({ condition: 'alcohol' }))).toBeNull();
        expect(adviceHomeFor(item({ type: 'test', condition: 'diet' }))).toBeNull();
    });
});

describe('planItemsForMedications', () => {
    const zinc = item({
        condition: 'supplementation',
        title: 'Do not change anything yourself, but ask your prescriber whether 25 mg of zinc is still right',
    });

    it('carries supplementation advice even with no medicines tracked', () => {
        expect(planItemsForMedications([zinc], [])).toEqual([zinc]);
    });

    it('carries any open item that names a tracked medicine', () => {
        const statin = item({ type: 'test', condition: 'Lipids', title: 'Lipid panel', description: 'Check how Atorvastatin is working' });
        expect(planItemsForMedications([statin], [{ name: 'Atorvastatin', brandName: null }])).toEqual([statin]);
    });

    it('carries general advice about prescriptions, but not other areas', () => {
        const general = item({ condition: 'other', title: 'Bring your medicines to your next review' });
        const diet = item({ condition: 'diet', title: 'Take your tablets with food and eat more fibre' });
        expect(planItemsForMedications([general, diet], [])).toEqual([general]);
    });

    it('drops finished items and ignores names too short to match safely', () => {
        const done = { ...zinc, _id: 'done', status: 'completed' } as PlanItem;
        const vitD = item({ condition: 'exercise', title: 'D3 walks' });
        expect(planItemsForMedications([done, vitD], [{ name: 'D3', brandName: null }])).toEqual([]);
    });

    it('matches whole words, so "Iron" does not catch "environment"', () => {
        const env = item({ condition: 'stress', title: 'Change your environment before bed' });
        expect(planItemsForMedications([env], [{ name: 'Iron', brandName: null }])).toEqual([]);
    });
});
