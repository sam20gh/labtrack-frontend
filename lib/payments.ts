/**
 * Stripe payment client.
 *
 * Payment availability is a server property, not a build-time constant: `getPaymentStatus()`
 * reports whether Stripe is configured, so a deployment without keys degrades to
 * place-order-unpaid instead of showing a checkout that cannot complete.
 */
import { api, apiFetch } from './api';
import type { Order } from '@/types/api';

export interface PaymentStatus {
    available: boolean;
    testMode: boolean;
    currency: string;
    publishableKey: string | null;
}

export interface PaymentIntentBundle {
    clientSecret: string;
    ephemeralKey: string;
    customerId: string;
    publishableKey: string;
    amount: number;
    currency: string;
    testMode: boolean;
}

export const getPaymentStatus = () => api.get<PaymentStatus>('/payments/status');

export const createPaymentIntent = (orderId: string) =>
    apiFetch<PaymentIntentBundle>(`/payments/orders/${orderId}/intent`, { method: 'POST' });

/**
 * Tell the server the PaymentSheet succeeded so the UI can move on immediately.
 * The server re-checks with Stripe rather than trusting this, and the webhook remains the
 * authoritative record — this only avoids making the user wait on it.
 */
export const confirmPayment = (orderId: string) =>
    apiFetch<{ order: Order }>(`/payments/orders/${orderId}/confirm`, { method: 'POST' });

export const formatMoney = (amount: number, currency = 'gbp') => {
    const symbols: Record<string, string> = { gbp: '£', usd: '$', eur: '€', aed: 'AED ' };
    return `${symbols[currency.toLowerCase()] ?? ''}${amount.toFixed(2)}`;
};
