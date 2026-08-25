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
import type { Id, IsoDate, DnaReport, TestResult, PlanItem, Professional } from '@/types/api';
import type { Interpretation } from './interpretation';

const CLINICIAN_TOKEN_KEY = 'clinicianToken';

export interface QueueEntry {
    _id: Id;
    patient: { _id: Id; firstName?: string; lastName?: string; dob?: string; gender?: string; email?: string };
    summary?: string;
    generatedAt?: IsoDate;
    waitingSince: IsoDate;
    /**
     * What the interpretation read. A queue entry may be genetic, blood-only, or both —
     * blood-only patients could not appear here at all before the queue moved onto
     * `Interpretation`.
     */
    sourceKinds: ('test_result' | 'dna_report')[];
    sourceCount: number;
    mutationCount: number;
    /** Pathogenic + likely-pathogenic, so the urgent cases can be picked first. */
    pathogenicCount: number;
    /** Risks the interpretation rated high, for the same reason. */
    highRiskCount: number;
}

/** One row of the queue, expanded for review. */
export interface ReviewSubject {
    _id: Id;
    userId: { _id: Id; firstName?: string; lastName?: string; dob?: string; gender?: string; email?: string };
    generatedAt: IsoDate;
    model?: string;
    content: Interpretation;
    /** The clinician-corrected version, once one exists. */
    amended?: { content: Interpretation; at?: IsoDate; by?: Id };
    review?: {
        status: 'pending' | 'approved' | 'amended' | 'not_required';
        professionalId?: Id;
        reviewedAt?: IsoDate;
        notes?: string;
        edits?: { field: string; previous?: unknown; updated?: unknown; reason?: string }[];
    };
    covers: { kind: 'test_result' | 'dna_report'; id: Id; date?: IsoDate }[];
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
export const getReviewQueue = () =>
    clinicianFetch<{ count: number; interpretations: QueueEntry[] }>('/reviews/queue');

/** The interpretation, every document it read, and the read it supersedes. */
export const getReportForReview = (id: Id) => clinicianFetch<{
    interpretation: ReviewSubject;
    sources: { dnaReports: DnaReport[]; testResults: TestResult[] };
    previous: { content: Interpretation; generatedAt: IsoDate } | null;
}>(`/reviews/${id}`);

export const getMyReviews = () =>
    clinicianFetch<{ count: number; interpretations: ReviewSubject[] }>('/reviews/mine');

export const submitReview = (id: Id, payload: {
    approved: boolean;
    notes?: string;
    amendments?: Record<string, unknown>;
}) => clinicianFetch<{ message: string; amendmentCount: number; interpretation: ReviewSubject }>(`/reviews/${id}`, {
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
