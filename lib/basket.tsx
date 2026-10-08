/**
 * Basket state.
 *
 * Persisted to AsyncStorage so a half-built order survives an app restart — abandoning a
 * £649 scan because the phone rang would be a poor experience.
 *
 * The basket holds product ids and quantities only. Prices come from the server at
 * checkout, never from here: a client-held price is a client-controlled price.
 *
 * Each line keeps the product's `pricing` — every currency the server priced it in — so the
 * indicative total follows the currency picker without a refetch. The order is still priced
 * by the server, in the currency `createOrder` sends.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types/api';
import { priceIn, useCurrency, type CurrencyCode, type Pricing } from './currency';

const STORAGE_KEY = 'basket';

export interface BasketLine {
    productId: string;
    quantity: number;
    /** Set when the line was added from a plan item, so fulfilment can close that item. */
    planItemId?: string;
    /** Snapshot for display only — the server re-prices at checkout. */
    name: string;
    /** GBP. Read through `linePrice`, which picks the currency in force. */
    price: number;
    /** Every currency, as the server priced it when the line was added. Absent on old baskets. */
    pricing?: Pricing;
    image?: string | null;
}

interface BasketContextValue {
    lines: BasketLine[];
    count: number;
    /** The currency the basket is shown and will be ordered in. */
    currency: CurrencyCode;
    /**
     * Indicative only; the order total comes back from the server. Null when a line has no
     * price in this currency — a basket saved before currencies existed, shown in AED.
     */
    estimatedTotal: number | null;
    /** One unit of a line, in `currency`, or null. */
    linePrice: (line: BasketLine) => number | null;
    add: (product: Product, planItemId?: string) => Promise<void>;
    remove: (productId: string) => Promise<void>;
    setQuantity: (productId: string, quantity: number) => Promise<void>;
    clear: () => Promise<void>;
    has: (productId: string) => boolean;
    ready: boolean;
}

const BasketContext = createContext<BasketContextValue | null>(null);

export const BasketProvider = ({ children }: { children: React.ReactNode }) => {
    const [lines, setLines] = useState<BasketLine[]>([]);
    const [ready, setReady] = useState(false);
    const currency = useCurrency();

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((raw) => {
                if (raw) setLines(JSON.parse(raw));
            })
            .catch(() => { /* a corrupt basket is not worth failing over */ })
            .finally(() => setReady(true));
    }, []);

    const persist = useCallback(async (next: BasketLine[]) => {
        setLines(next);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // In-memory state still works if the write fails
        }
    }, []);

    /**
     * Add one of `product`, or increment the line that is already there.
     *
     * Adding from a plan item is deliberately idempotent: tapping "Add to basket" twice on
     * the same screening must not order two of them, and the second tap on the plan screen
     * is far more likely to be someone checking it registered than someone wanting a pair.
     * The shop's `+` has no plan item and keeps incrementing, which is what it is for.
     *
     * A line added from the shop and then again from the plan picks up the `planItemId`,
     * so checkout can still close that item off the timeline.
     */
    const add = useCallback(async (product: Product, planItemId?: string) => {
        const existing = lines.find((l) => l.productId === product._id);
        if (existing?.planItemId && existing.planItemId === planItemId) return;

        const next = existing
            ? lines.map((l) => l.productId === product._id
                ? {
                    ...l,
                    quantity: planItemId ? l.quantity : l.quantity + 1,
                    planItemId: l.planItemId ?? planItemId,
                }
                : l)
            : [...lines, {
                productId: product._id,
                quantity: 1,
                planItemId,
                name: product.name,
                price: product.price,
                pricing: product.pricing,
                image: product.image ?? null,
            }];
        await persist(next);
    }, [lines, persist]);

    const remove = useCallback(async (productId: string) => {
        await persist(lines.filter((l) => l.productId !== productId));
    }, [lines, persist]);

    const setQuantity = useCallback(async (productId: string, quantity: number) => {
        if (quantity < 1) return remove(productId);
        await persist(lines.map((l) => l.productId === productId ? { ...l, quantity } : l));
    }, [lines, persist, remove]);

    const clear = useCallback(async () => { await persist([]); }, [persist]);

    const value = useMemo<BasketContextValue>(() => {
        const linePrice = (line: BasketLine) => priceIn(line, currency);
        const prices = lines.map((l) => linePrice(l));
        return {
        lines,
        count: lines.reduce((n, l) => n + l.quantity, 0),
        currency,
        estimatedTotal: prices.some((p) => p === null)
            ? null
            : lines.reduce((n, l, i) => n + (prices[i] as number) * l.quantity, 0),
        linePrice,
        add,
        remove,
        setQuantity,
        clear,
        has: (id: string) => lines.some((l) => l.productId === id),
        ready,
        };
    }, [lines, currency, add, remove, setQuantity, clear, ready]);

    return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
};

export const useBasket = () => {
    const ctx = useContext(BasketContext);
    if (!ctx) throw new Error('useBasket must be used inside a BasketProvider');
    return ctx;
};
