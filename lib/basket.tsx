/**
 * Basket state.
 *
 * Persisted to AsyncStorage so a half-built order survives an app restart — abandoning a
 * £649 scan because the phone rang would be a poor experience.
 *
 * The basket holds product ids and quantities only. Prices come from the server at
 * checkout, never from here: a client-held price is a client-controlled price.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types/api';

const STORAGE_KEY = 'basket';

export interface BasketLine {
    productId: string;
    quantity: number;
    /** Set when the line was added from a plan item, so fulfilment can close that item. */
    planItemId?: string;
    /** Snapshot for display only — the server re-prices at checkout. */
    name: string;
    price: number;
    image?: string | null;
}

interface BasketContextValue {
    lines: BasketLine[];
    count: number;
    /** Indicative only; the order total comes back from the server. */
    estimatedTotal: number;
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

    const add = useCallback(async (product: Product, planItemId?: string) => {
        const existing = lines.find((l) => l.productId === product._id);
        const next = existing
            ? lines.map((l) => l.productId === product._id ? { ...l, quantity: l.quantity + 1 } : l)
            : [...lines, {
                productId: product._id,
                quantity: 1,
                planItemId,
                name: product.name,
                price: product.price,
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

    const value = useMemo<BasketContextValue>(() => ({
        lines,
        count: lines.reduce((n, l) => n + l.quantity, 0),
        estimatedTotal: lines.reduce((n, l) => n + l.price * l.quantity, 0),
        add,
        remove,
        setQuantity,
        clear,
        has: (id: string) => lines.some((l) => l.productId === id),
        ready,
    }), [lines, add, remove, setQuantity, clear, ready]);

    return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
};

export const useBasket = () => {
    const ctx = useContext(BasketContext);
    if (!ctx) throw new Error('useBasket must be used inside a BasketProvider');
    return ctx;
};
