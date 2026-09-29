/**
 * The things a person can do to a plan item: fill the basket, book, finish, dismiss, restore.
 *
 * Shared by the timeline (`app/myplans.tsx`) and one item's page (`app/plan/[id].tsx`), so
 * the two can never disagree about what "Add to basket" does. See the comments that used
 * to live on the timeline for why ordering fills the basket rather than placing an order,
 * and why booking opens the appointment screen rather than posting a slot.
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { api, ApiError } from '@/lib/api';
import { useBasket } from '@/lib/basket';
import {
    completePlanItem, dismissPlanItem, restorePlanItem, dismissConsequenceFor, isOpen,
} from '@/lib/plan';
import type { PlanItem, Product } from '@/types/api';

export function usePlanItemActions(
    products: Record<string, Product>,
    setProducts: (update: (prev: Record<string, Product>) => Record<string, Product>) => void,
    onChanged: () => void | Promise<void>,
) {
    const router = useRouter();
    const { add, has } = useBasket();
    const [busyId, setBusyId] = useState<string | null>(null);

    /**
     * Booking opens the appointment screen. Nobody's Tuesday morning is free by default,
     * and the plan item carries the professional and the clinical reason across, so nothing
     * is retyped.
     */
    const book = useCallback((item: PlanItem) =>
        router.push({
            pathname: '/appointments/book',
            params: {
                professionalId: String(item.professionalId),
                planItemId: item._id,
                ...(item.description ? { reason: item.description } : {}),
            },
        }), [router]);

    /**
     * Ordering from the plan fills the basket; it does not place an order. `createOrder`
     * carries every `planItemId` across, so the timeline still closes off.
     */
    const addToBasket = useCallback(async (item: PlanItem) => {
        if (!item.productId) return;
        setBusyId(item._id);
        try {
            // The catalogue may have failed to load, or the plan may name a product added
            // since it was fetched. Fetching the one product is cheaper than losing the tap.
            const product = products[item.productId]
                ?? await api.get<Product>(`/products/${item.productId}`);
            setProducts((prev) => ({ ...prev, [product._id]: product }));
            await add(product, item._id);
            Toast.show({
                type: 'success',
                text1: 'Added to basket',
                text2: `${product.name} — check out from the Order tab`,
            });
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not add that',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setBusyId(null);
        }
    }, [products, setProducts, add]);

    const transition = useCallback(async (item: PlanItem, to: 'dismissed' | 'completed' | 'restored') => {
        setBusyId(item._id);
        try {
            const call = { completed: completePlanItem, dismissed: dismissPlanItem, restored: restorePlanItem }[to];
            await call(item._id);
            Toast.show({
                type: 'success',
                text1: { completed: 'Marked as done', dismissed: 'Dismissed', restored: 'Back on your plan' }[to],
                ...(to === 'dismissed' ? { text2: 'You can restore it from the item’s page' } : {}),
            });
            await onChanged();
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not complete that',
                text2: error instanceof ApiError ? error.message : 'Please try again',
            });
        } finally {
            setBusyId(null);
        }
    }, [onChanged]);

    /**
     * Advice a tracker reads asks first, and says what stops. Everything else dismisses on
     * one tap, as it always has — a confirmation on every card is one people learn to skip.
     */
    const dismiss = useCallback((item: PlanItem) => {
        const consequence = dismissConsequenceFor(item);
        if (!consequence) return transition(item, 'dismissed');
        Alert.alert('Dismiss this advice?', `${consequence.before} You can restore it later.`, [
            { text: 'Keep it', style: 'cancel' },
            { text: 'Dismiss', style: 'destructive', onPress: () => { transition(item, 'dismissed'); } },
        ]);
    }, [transition]);

    /** What this item offers, worked out once so the card and the page draw the same buttons. */
    const capabilities = useCallback((item: PlanItem) => {
        const actionable = isOpen(item);
        const canOrder = actionable && Boolean(item.productId);
        return {
            actionable,
            canOrder,
            canBook: actionable && Boolean(item.professionalId),
            inBasket: Boolean(item.productId && has(item.productId)),
            price: item.productId ? products[item.productId]?.price : undefined,
        };
    }, [has, products]);

    return {
        busyId,
        book,
        addToBasket,
        dismiss,
        complete: (item: PlanItem) => transition(item, 'completed'),
        restore: (item: PlanItem) => transition(item, 'restored'),
        capabilities,
    };
}
