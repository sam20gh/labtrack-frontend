/**
 * Clinician-side client.
 *
 * Professionals authenticate through the legacy `/api/auth/login` (their credentials live
 * on the `Professional` model, not Supabase), receiving a token whose `role` claim is
 * `professional`. That token is stored separately from the patient session so a device can
 * hold both without one silently overriding the other.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import type { Id, IsoDate, DnaReport, PlanItem, Professional } from '@/types/api';

const CLINICIAN_TOKEN_KEY = 'clinicianToken';

export interface QueueEntry {
    _id: Id;
    patient: { _id: Id; firstName?: string; lastName?: string; dob?: string; gender?: string; email?: string };
    labName?: string;
    reportDate?: IsoDate;
    mutationCount: number;
    /** Pathogenic + likely-pathogenic, so the urgent cases can be picked first. */
    pathogenicCount: number;
    summary?: string;
    generatedAt?: IsoDate;
    waitingSince: IsoDate;
}

export const getClinicianToken = () => AsyncStorage.getItem(CLINICIAN_TOKEN_KEY);
export const clearClinicianToken = () => AsyncStorage.removeItem(CLINICIAN_TOKEN_KEY);

/** Requests carry the clinician token explicitly rather than the patient one. */
type ClinicianOptions = Omit<RequestInit, 'body'> & { body?: unknown };

const clinicianFetch = async <T = any>(path: string, options: ClinicianOptions = {}): Promise<T> => {
    const token = await getClinicianToken();
    const { body, headers, ...rest } = options;

    const response = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers as Record<string, string> | undefined),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
    return data as T;
};

export const clinicianSignIn = async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await response.json();
    if (!response.ok) return { ok: false as const, error: data.message || 'Sign in failed' };

    await AsyncStorage.setItem(CLINICIAN_TOKEN_KEY, data.token);
    return { ok: true as const, professional: data.professional };
};

export const getClinicianProfile = () => clinicianFetch<{ professional: Professional }>('/reviews/profile');
export const getReviewQueue = () => clinicianFetch<{ count: number; reports: QueueEntry[] }>('/reviews/queue');
export const getReportForReview = (id: Id) => clinicianFetch<{ report: DnaReport & { userId: any } }>(`/reviews/${id}`);
export const getMyReviews = () => clinicianFetch<{ count: number; reports: DnaReport[] }>('/reviews/mine');

export const submitReview = (id: Id, payload: {
    approved: boolean;
    notes?: string;
    amendments?: Record<string, unknown>;
}) => clinicianFetch<{ message: string; amendmentCount: number; report: DnaReport }>(`/reviews/${id}`, {
    method: 'POST',
    body: payload,
});

export const addFollowUp = (id: Id, payload: {
    type: string;
    title: string;
    description?: string;
    condition?: string;
    frequency?: string;
    startingAge?: number;
    dueDate?: string;
    urgency?: string;
    speciality?: string;
    productId?: Id;
}) => clinicianFetch<{ item: PlanItem }>(`/reviews/${id}/plan-items`, { method: 'POST', body: payload });

/** Products, for attaching an orderable test to a follow-up. */
export const getCatalogue = () => clinicianFetch<any[]>('/products');
