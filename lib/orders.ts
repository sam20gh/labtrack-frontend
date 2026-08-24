/**
 * Order client.
 *
 * The server prices every line from the catalogue, so `createOrder` sends product ids and
 * quantities only.
 */
import { api, apiFetch } from './api';
import type { Order, OrderStatus } from '@/types/api';

export interface ShippingAddress {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
    country?: string;
}

export const createOrder = (
    items: { productId: string; quantity: number; planItemId?: string }[],
    shippingAddress?: ShippingAddress,
) => apiFetch<{ order: Order }>('/orders', { method: 'POST', body: { items, shippingAddress } });

export const getOrders = () => api.get<{ orders: Order[] }>('/orders');
export const getOrder = (id: string) => api.get<{ order: Order }>(`/orders/${id}`);
export const cancelOrder = (id: string, reason?: string) =>
    apiFetch<{ order: Order }>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } });

/** Fulfilment stages in order, for the tracker. */
export const ORDER_STAGES: OrderStatus[] = ['placed', 'kit_sent', 'sample_received', 'processing', 'resulted'];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; description: string; color: string }> = {
    pending_payment: { label: 'Awaiting payment', description: 'Payment has not been completed', color: '#F59E0B' },
    placed: { label: 'Order placed', description: 'We have received your order', color: '#7C3AED' },
    kit_sent: { label: 'Kit dispatched', description: 'Your collection kit is on its way', color: '#7C3AED' },
    sample_received: { label: 'Sample received', description: 'The laboratory has your sample', color: '#7C3AED' },
    processing: { label: 'Processing', description: 'Your sample is being analysed', color: '#7C3AED' },
    resulted: { label: 'Results ready', description: 'Your results are in your record', color: '#059669' },
    cancelled: { label: 'Cancelled', description: 'This order was cancelled', color: '#9CA3AF' },
    refunded: { label: 'Refunded', description: 'This order was refunded', color: '#9CA3AF' },
};

export const isCancellable = (status: OrderStatus) => ['pending_payment', 'placed'].includes(status);
