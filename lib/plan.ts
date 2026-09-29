/**
 * Health-plan client.
 *
 * Reads `/api/plan-items` (dated, individually actionable) rather than the legacy
 * `/api/plans` shape, which carried age/year pairs inside one embedded array and could not
 * express "this specific screening is now overdue and here is who to book".
 */
import { api, apiFetch } from './api';
import type { PlanItem, GroupedPlanItems, Professional, TrackedMedication } from '@/types/api';
import { schemed, tone } from '@/constants/theme';

export interface PlanResponse {
    items: PlanItem[];
    /** Keyed by 'urgent' or a four-digit year. */
    grouped: GroupedPlanItems;
}

export const getPlan = () => api.get<PlanResponse>('/plan-items');

/**
 * Ordering lives in `lib/basket.tsx` and `lib/orders.ts`.
 *
 * This module used to export `orderPlanItem(item)`, which posted a one-line order the
 * moment the plan's button was tapped. It committed someone to a purchase in a single tap,
 * with no total shown and no way to order a second screening on the same delivery. The
 * plan screen now calls `useBasket().add(product, item._id)`; `createOrder` carries the
 * `planItemId` through checkout, so the plan item is still linked and closed off.
 */

/**
 * Booking lives in `lib/appointments.ts`.
 *
 * This module used to export `bookPlanItem(item, scheduledFor)`, which the plan screen
 * called with a fixed slot a week out. Now that there is a screen where a person picks the
 * day and the time, a second path that posts a time nobody chose is just a way to create
 * appointments the user did not agree to. `createAppointment` takes a `planItemId`, so the
 * plan link survives.
 */

export const dismissPlanItem = (id: string) =>
    apiFetch<{ item: PlanItem }>(`/plan-items/${id}/status`, {
        method: 'PATCH',
        body: { status: 'dismissed' },
    });

/** Undo a dismissal. The server picks the status: advice goes back to ongoing. */
export const restorePlanItem = (id: string) =>
    apiFetch<{ item: PlanItem }>(`/plan-items/${id}/status`, {
        method: 'PATCH',
        body: { status: 'restore' },
    });

/**
 * What dismissing a piece of advice switches off, said before it happens.
 *
 * Diet, exercise and sleep advice are read by their tracker while open. Dismissing the only
 * diet item on a plan once removed the on-plan / off-plan verdict from every meal after it,
 * behind nothing but a "Dismissed" toast, and nobody could tell why the card had gone.
 */
export const DISMISS_CONSEQUENCE: Record<string, { before: string; after: string }> = {
    diet: {
        before: 'Your nutrition log will stop checking meals against this advice, and your daily targets may change.',
        after: 'Your nutrition log is not checking meals against this advice.',
    },
    exercise: {
        before: 'Your activity targets will no longer take this advice into account.',
        after: 'Your activity targets are not taking this advice into account.',
    },
    sleep: {
        before: 'Your sleep goal will no longer take this advice into account.',
        after: 'Your sleep goal is not taking this advice into account.',
    },
};

export const dismissConsequenceFor = (item: PlanItem) =>
    isAdvice(item) && item.condition ? DISMISS_CONSEQUENCE[item.condition] ?? null : null;

/**
 * Advice is finished rather than dismissed — "I asked my prescriber" is a thing done, not
 * a recommendation declined. Lifestyle items carry no frequency, so completing one never
 * schedules a next occurrence.
 */
export const completePlanItem = (id: string) =>
    apiFetch<{ item: PlanItem }>(`/plan-items/${id}/status`, {
        method: 'PATCH',
        body: { status: 'completed' },
    });

export const getProfessionalsFor = async (speciality: string): Promise<Professional[]> => {
    const all = await api.get<Professional[]>('/professionals');
    return (all || []).filter((p) => (p.speciality || []).includes(speciality));
};

/** Generate a fresh interpretation and rebuild the plan from it. */
export const regenerateFromInterpretation = (dnaReportId?: string, testResultId?: string) =>
    apiFetch<{
        interpretation: any;
        plan: { created: number; replaced: number; unmatched: { test: string; reason: string }[] };
        aiGenerated: boolean;
        pendingSpecialistReview: boolean;
    }>('/interpretation/generate', {
        method: 'POST',
        body: { dnaReportId, testResultId, force: true },
    });

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = schemed((Palette, scheme) => ({
    urgent: { label: 'Overdue', color: Palette.danger, bg: Palette.dangerSurface },
    due: { label: 'Due now', color: tone('#EA580C', scheme), bg: Palette.orangeSurface },
    upcoming: { label: 'Scheduled', color: Palette.textSecondary, bg: tone('#F9FAFB', scheme) },
    ordered: { label: 'Ordered', color: Palette.primary, bg: Palette.primaryTint },
    booked: { label: 'Booked', color: Palette.primary, bg: Palette.primaryTint },
    completed: { label: 'Done', color: Palette.success, bg: Palette.successSurface },
    dismissed: { label: 'Dismissed', color: Palette.textMuted, bg: tone('#F9FAFB', scheme) },
}));

export const TYPE_ICON: Record<string, string> = {
    test: 'flask-outline',
    scan: 'scan-outline',
    consultation: 'person-outline',
    assessment: 'clipboard-outline',
    lifestyle: 'heart-outline',
};

/**
 * Lifestyle items are advice, not appointments.
 *
 * The generator writes them with `dueDate: today`, and the daily sweep used to roll that
 * into `urgent` the next morning — so "ask your prescriber about zinc" read "Overdue" and
 * the home screen offered to "Order it". The sweep now leaves them alone; this predicate is
 * the client's half, so rows already swept read correctly without a data migration.
 */
export const isAdvice = (item: Pick<PlanItem, 'type'>) => item.type === 'lifestyle';

/** Open means the person has not ordered, booked, finished or dismissed it. */
export const isOpen = (item: Pick<PlanItem, 'status'>) =>
    ['urgent', 'due', 'upcoming'].includes(item.status);

/** An item asking for something *now* — never advice, which has no deadline. */
export const needsAction = (item: PlanItem) =>
    !isAdvice(item) && (item.status === 'urgent' || item.status === 'due');

/** `INTERPRETATION_SCHEMA.lifestyle_recommendations[].area`, written for a person. */
export const AREA_LABEL: Record<string, string> = {
    diet: 'Diet',
    exercise: 'Exercise',
    sleep: 'Sleep',
    alcohol: 'Alcohol',
    smoking: 'Smoking',
    stress: 'Stress',
    supplementation: 'Supplements & medicines',
    other: 'General',
};

/**
 * Where a piece of advice can be acted on, day to day.
 *
 * Only areas with a tracker behind them. Alcohol, smoking and stress have none, and a link
 * to a screen that cannot help is the dummy control this app keeps removing — those stay
 * on the plan, which is still their home.
 */
export const ADVICE_HOME: Record<string, { route: string; label: string; icon: string }> = {
    diet: { route: '/nutrition', label: 'Track this in your nutrition log', icon: 'restaurant-outline' },
    exercise: { route: '/activity', label: 'Track this in your activity', icon: 'walk-outline' },
    sleep: { route: '/sleep', label: 'Track this in your sleep', icon: 'moon-outline' },
    supplementation: { route: '/medications', label: 'See your medications', icon: 'medkit-outline' },
};

export const adviceHomeFor = (item: PlanItem) =>
    isAdvice(item) && item.condition ? ADVICE_HOME[item.condition] ?? null : null;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that put general advice about medicine-taking on the medications screen. */
const MEDICINE_WORDS = /\b(prescriber|prescription|prescribed|medications?|medicines?|supplements?|tablets?|capsules?)\b/i;

/**
 * The plan items the medications hub should carry.
 *
 * Three ways in, all deterministic: advice the interpretation filed under
 * `supplementation`; any open item naming a medicine the person tracks (a word match, and
 * only names of four letters or more, so "Zinc" matches and "D3" cannot match everything);
 * and `other` advice that talks about prescriptions or supplements. The plan stays the
 * record — this is the same row shown where it is acted on, never a copy.
 */
export const planItemsForMedications = (items: PlanItem[], medications: Pick<TrackedMedication, 'name' | 'brandName'>[] = []) => {
    const names = medications
        .flatMap((m) => [m.name, m.brandName])
        .filter((n): n is string => Boolean(n) && (n as string).trim().length >= 4)
        .map((n) => new RegExp(`\\b${escape(n.trim())}\\b`, 'i'));

    return items.filter((item) => {
        if (!isOpen(item)) return false;
        const text = `${item.title} ${item.description ?? ''}`;
        if (isAdvice(item) && item.condition === 'supplementation') return true;
        if (names.some((re) => re.test(text))) return true;
        return isAdvice(item) && item.condition === 'other' && MEDICINE_WORDS.test(text);
    });
};
