/**
 * Home sample collection — the app's half.
 *
 * Every time, label and rule comes from the server (`utils/markets.js`,
 * `utils/collectionCentre.js`). Slot labels in particular are formatted there, in the
 * *market's* timezone: somebody in London booking a visit to a flat in Dubai is booking Dubai
 * time, and Hermes' timezone support is not something a booking should depend on. The phone
 * draws what it is given and never converts a slot itself.
 */
import { api, apiFetch } from './api';
import type { CurrencyCode } from './currency';

export type FulfilmentMethod = 'post' | 'home_collection';

export interface FulfilmentOption {
    method: FulfilmentMethod;
    label: string;
    description: string;
    /** In the market's currency. 0 is free. */
    price: number;
    default: boolean;
}

export interface MarketInfo {
    code: string;
    name: string;
    currency: CurrencyCode;
    timezone: string;
    options: FulfilmentOption[];
    visits: {
        price: number;
        slotMinutes: number;
        serviceAreas: string[];
        rescheduleCutoffHours: number;
    } | null;
}

export interface Slot {
    start: string;
    end: string;
    label: string;
    remaining: number;
}

export interface SlotDay {
    date: string;
    label: string;
    closed: boolean;
    slots: Slot[];
}

export interface VisitAddress {
    building: string;
    street?: string;
    area: string;
    city: string;
    landmark?: string;
    makani?: string;
    lat?: number;
    lng?: number;
}

export interface VisitDetails {
    address: VisitAddress;
    phone: string;
    contactName?: string;
    accessNotes?: string;
}

export type VisitStatus =
    | 'held' | 'booked' | 'needs_rebooking' | 'assigned' | 'en_route' | 'arrived'
    | 'completed' | 'missed' | 'cancelled' | 'expired';

export interface Visit {
    _id: string;
    status: VisitStatus;
    market: string;
    timezone: string;
    slot: { start: string; end: string };
    /** "Sun 11 Oct, 08:00–08:30", in the market's own clock. */
    label: string;
    address: VisitAddress & { country?: string };
    phone: string;
    contactName: string | null;
    accessNotes: string | null;
    requiresFasting: boolean;
    assignee: { name: string } | null;
    tasks: { _id: string; kind: 'collect_blood' | 'collect_dna' | 'handover_bracelet'; status: 'pending' | 'done' | 'not_done'; orderId: string }[];
    orderIds: string[];
}

export const getMarket = (currency: CurrencyCode) =>
    api.get<MarketInfo>(`/collection/market?currency=${currency}`);

/** By currency at checkout; by market code when moving a visit that already knows its market. */
export const getSlots = (q: { currency?: CurrencyCode; market?: string }) =>
    api.get<{ market: MarketInfo; days: SlotDay[] }>(
        `/collection/slots?${q.market ? `market=${encodeURIComponent(q.market)}` : `currency=${q.currency ?? 'GBP'}`}`);

export const listVisits = () => api.get<{ visits: Visit[] }>('/collection/visits');

export const getVisit = (id: string) =>
    api.get<{ visit: Visit; canChange: boolean; cutoffHours: number }>(`/collection/visits/${id}`);

export const bookVisit = (orderId: string, slotStart: string, details: VisitDetails) =>
    apiFetch<{ visit: Visit }>('/collection/visits', { method: 'POST', body: { orderId, slotStart, ...details } });

export const rescheduleVisit = (id: string, slotStart: string) =>
    apiFetch<{ visit: Visit }>(`/collection/visits/${id}/reschedule`, { method: 'POST', body: { slotStart } });

export const cancelVisit = (id: string) =>
    apiFetch<{ visit: Visit }>(`/collection/visits/${id}/cancel`, { method: 'POST' });

export const EMPTY_DETAILS: VisitDetails = {
    address: { building: '', street: '', area: '', city: '', landmark: '', makani: '' },
    phone: '',
    contactName: '',
    accessNotes: '',
};

/** The same minimum the server insists on, so the button is disabled rather than refused. */
export const detailsComplete = (d: VisitDetails) =>
    Boolean(d.address.building.trim() && d.address.area.trim() && d.address.city.trim() && /^[+\d][\d\s()-]{6,}$/.test(d.phone.trim()));

/** Drop empty optional fields before sending, so the server stores absent rather than "". */
export const cleanDetails = (d: VisitDetails): VisitDetails => {
    const t = (v?: string) => (v && v.trim() ? v.trim() : undefined);
    return {
        address: {
            building: d.address.building.trim(),
            street: t(d.address.street),
            area: d.address.area.trim(),
            city: d.address.city.trim(),
            landmark: t(d.address.landmark),
            makani: t(d.address.makani),
        },
        phone: d.phone.trim(),
        contactName: t(d.contactName),
        accessNotes: t(d.accessNotes),
    };
};

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
    held: 'Waiting for payment',
    booked: 'Booked',
    needs_rebooking: 'Choose a new time',
    assigned: 'Technician assigned',
    en_route: 'Technician on the way',
    arrived: 'Technician arrived',
    completed: 'Completed',
    missed: 'Missed',
    cancelled: 'Cancelled',
    expired: 'Not completed',
};

export const TASK_LABEL: Record<Visit['tasks'][number]['kind'], string> = {
    collect_blood: 'Blood sample',
    collect_dna: 'DNA sample',
    handover_bracelet: 'Bracelet handover',
};
