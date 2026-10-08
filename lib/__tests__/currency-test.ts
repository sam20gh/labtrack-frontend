/**
 * Reading a price in the chosen currency. The one failure that matters is a GBP figure drawn
 * under another currency's sign — £149 shown as "AED 149.00" is a fifth of the real price —
 * so every fallback is pinned to refuse it.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
}));

import { formatMoney, guessCurrency, priceIn } from '../currency';

describe('priceIn', () => {
    const product = {
        price: 149,
        pricing: {
            GBP: { amount: 149, source: 'base' as const },
            AED: { amount: 699, source: 'set' as const },
            EUR: { amount: 174, source: 'converted' as const },
        },
    };

    it('reads what the server priced', () => {
        expect(priceIn(product, 'AED')).toBe(699);
        expect(priceIn(product, 'EUR')).toBe(174);
    });

    it('lets the GBP price stand in for GBP only', () => {
        expect(priceIn({ price: 149 }, 'GBP')).toBe(149);
        expect(priceIn({ price: 149 }, 'AED')).toBeNull();
        expect(priceIn(product, 'SAR')).toBeNull();
    });
});

describe('formatMoney', () => {
    it('writes each currency with its own sign, and nothing as pounds by accident', () => {
        expect(formatMoney(149, 'GBP')).toBe('£149.00');
        expect(formatMoney(699, 'aed')).toBe('AED 699.00');
        expect(formatMoney(745, 'SAR')).toBe('SAR 745.00');
        expect(formatMoney(174, 'EUR')).toBe('€174.00');
        expect(formatMoney(10, 'CHF')).toBe('10.00 CHF');
        expect(formatMoney(null, 'GBP')).toBe('—');
    });
});

describe('guessCurrency', () => {
    it('reads the time zone, not the language', () => {
        expect(guessCurrency('Asia/Dubai')).toBe('AED');
        expect(guessCurrency('Asia/Riyadh')).toBe('SAR');
        expect(guessCurrency('Europe/Dublin')).toBe('EUR');
        expect(guessCurrency('Europe/London')).toBe('GBP');
        expect(guessCurrency('America/New_York')).toBe('GBP');
    });
});
