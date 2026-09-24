/**
 * Health-plan client.
 *
 * Reads `/api/plan-items` (dated, individually actionable) rather than the legacy
 * `/api/plans` shape, which carried age/year pairs inside one embedded array and could not
 * express "this specific screening is now overdue and here is who to book".
 */
import { api, apiFetch } from './api';
import type { PlanItem, GroupedPlanItems, Professional } from '@/types/api';
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
