/**
 * The currency this phone shops in — GBP, AED, SAR or EUR.
 *
 * **The server prices, the phone only chooses.** Every product read carries `pricing`, what it
 * costs in each currency as `labtrack-backend/utils/currency.js` worked it out (a price set on
 * the product, or GBP converted at the stored rate). This file picks which of those to draw, and
 * `createOrder` sends the choice so the order is priced and charged in it. Nothing here converts
 * a number: a conversion done on the phone is a price the checkout would not charge.
 *
 * Same shape as `lib/units.ts`, for the same reasons: reads are synchronous because formatters
 * run in render, the preference is hydrated once at launch, and a change notifies subscribers so
 * every price on screen redraws without a refetch. Per device, in AsyncStorage — the API has no
 * currency on the account, and an order records its own.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'currencyPreference';

export type CurrencyCode = 'GBP' | 'AED' | 'SAR' | 'EUR';
export type PriceSource = 'base' | 'set' | 'converted';
export type Pricing = Partial<Record<CurrencyCode, { amount: number; source: PriceSource }>>;

export const BASE_CURRENCY: CurrencyCode = 'GBP';

/** In picker order. `deliversTo` mirrors `CURRENCIES[].shipTo` on the API. */
export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string; deliversTo: string }[] = [
    { code: 'GBP', label: 'British pound', deliversTo: 'the United Kingdom' },
    { code: 'AED', label: 'UAE dirham', deliversTo: 'the United Arab Emirates' },
    { code: 'SAR', label: 'Saudi riyal', deliversTo: 'Saudi Arabia' },
    { code: 'EUR', label: 'Euro', deliversTo: 'eurozone countries' },
];

export const asCurrency = (value: unknown): CurrencyCode | null => {
    const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return CURRENCY_OPTIONS.some((o) => o.code === code) ? (code as CurrencyCode) : null;
};

/**
 * A first guess from the phone's time zone, used only until somebody picks.
 *
 * The time zone rather than the locale: an English-language phone in Dubai is the common case,
 * and its locale says en-GB or en-US while its zone says Asia/Dubai. No package is added to ask
 * the OS for a region — a new native module moves the fingerprint and strands every installed
 * build (CLAUDE.md, the fourth trap).
 */
const EURO_ZONES = new Set([
    'Europe/Vienna', 'Europe/Brussels', 'Europe/Sofia', 'Europe/Zagreb', 'Asia/Nicosia', 'Europe/Nicosia',
    'Asia/Famagusta', 'Europe/Tallinn', 'Europe/Helsinki', 'Europe/Mariehamn', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Busingen', 'Europe/Athens', 'Europe/Dublin', 'Europe/Rome', 'Europe/Riga', 'Europe/Vilnius',
    'Europe/Luxembourg', 'Europe/Malta', 'Europe/Amsterdam', 'Europe/Lisbon', 'Atlantic/Madeira',
    'Atlantic/Azores', 'Europe/Bratislava', 'Europe/Ljubljana', 'Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta',
]);

export const guessCurrency = (timeZone?: string): CurrencyCode => {
    let zone = timeZone;
    if (zone === undefined) {
        try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = ''; }
    }
    if (zone === 'Asia/Dubai') return 'AED';
    if (zone === 'Asia/Riyadh') return 'SAR';
    if (zone && EURO_ZONES.has(zone)) return 'EUR';
    return BASE_CURRENCY;
};

/* ------------------------------------------------------------------ *
 * The cache, and the subscribers who redraw when it moves
 * ------------------------------------------------------------------ */

let current: CurrencyCode = guessCurrency();
let hydrated = false;
const listeners = new Set<(code: CurrencyCode) => void>();

export const getCurrency = (): CurrencyCode => current;

/** Called once from `app/_layout.tsx`. A corrupt value keeps the guess rather than throwing. */
export const hydrateCurrency = async (): Promise<CurrencyCode> => {
    if (hydrated) return current;
    try {
        const stored = asCurrency(await AsyncStorage.getItem(STORAGE_KEY));
        if (stored) current = stored;
    } catch {
        // Unreadable storage still gets a currency, not a crash.
    }
    hydrated = true;
    listeners.forEach((fn) => fn(current));
    return current;
};

export const setCurrency = async (code: CurrencyCode): Promise<CurrencyCode> => {
    current = code;
    listeners.forEach((fn) => fn(current));
    try {
        await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch {
        // Applies for this session; it just will not survive a restart.
    }
    return current;
};

export const onCurrencyChange = (fn: (code: CurrencyCode) => void): (() => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

/** Re-renders the calling component whenever the currency is changed anywhere in the app. */
export const useCurrency = (): CurrencyCode => {
    const [code, setCode] = useState<CurrencyCode>(current);
    useEffect(() => {
        setCode(current);
        return onCurrencyChange(setCode);
    }, []);
    return code;
};

/* ------------------------------------------------------------------ *
 * Reading a price
 * ------------------------------------------------------------------ */

/**
 * What something costs in `currency`, or null when the server has not priced it in that
 * currency. `price` is GBP, so it stands in only for GBP — never printed under another sign.
 */
export const priceIn = (
    item: { price?: number; pricing?: Pricing } | null | undefined,
    currency: CurrencyCode = current,
): number | null => {
    const priced = item?.pricing?.[currency]?.amount;
    if (typeof priced === 'number') return priced;
    return currency === BASE_CURRENCY && typeof item?.price === 'number' ? item.price : null;
};

const SYMBOL: Record<string, string> = { gbp: '£', eur: '€', usd: '$', aed: 'AED ', sar: 'SAR ' };

/**
 * "£149.00", "AED 731.00", "€174.00". `.00` is written out so a column of prices aligns.
 * An unknown code is written after the number rather than dropped, so it is never mistaken
 * for pounds.
 */
export const formatMoney = (amount: number | null | undefined, currency: string = current): string => {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
    const symbol = SYMBOL[currency.toLowerCase()];
    return symbol ? `${symbol}${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency.toUpperCase()}`;
};
