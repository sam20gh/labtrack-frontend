/**
 * AI interpretation client.
 *
 * Mirrors the contract in `utils/interpretationSchema.js`. The old home screen threw away
 * everything but `summary` and rendered it as markdown; the model actually returns risks,
 * flagged biomarkers, lifestyle advice and stated limitations, all of which are more
 * useful than a paragraph.
 *
 * `raw` on a DNA report keeps the same shape, so this type serves both.
 */
import { api, apiFetch, ApiError } from './api';

/**
 * The interpretation contract is **generated**, not written here.
 *
 * These types used to be hand-transcribed from `utils/interpretationSchema.js`, in this file
 * and again in the staff portal. Two hand-written copies of one contract drift, and drift
 * here is silent: a field the model never writes renders as nothing, and a field it does
 * write that nobody reads is invisible. The portal had three such mistakes at once.
 *
 * `labtrack-shared/generate.mjs` now emits both copies from the schema itself. Re-exported
 * under the names this file already used, so no screen had to change.
 */
export type {
    RiskLevel,
    RiskBasis,
    Urgency,
    ScreeningFrequency,
    LifestyleArea,
    Speciality,
    Risk,
    Screening,
    Consultation,
    LifestyleRecommendation,
    BiomarkerOfConcern,
    PlainSummary,
    /** The clinical read, as stored. Named `Interpretation` here since before it was generated. */
    InterpretationContent as Interpretation,
} from '@/types/generated/interpretation';

import type { InterpretationContent, RiskLevel } from '@/types/generated/interpretation';

type Interpretation = InterpretationContent;

export interface GenerateResult {
    interpretation: Interpretation;
    cached: boolean;
    aiGenerated?: boolean;
    pendingSpecialistReview?: boolean;
    model?: string;
    plan?: { created: number; replaced: number; unmatched: { test: string; reason: string }[] };
}

export interface SourceRef {
    kind: 'test_result' | 'dna_report';
    id: string;
    testType: string | null;
    labName: string | null;
    date: string | null;
}

export interface LatestResultRef {
    id: string;
    testType: string | null;
    labName: string | null;
    date: string | null;
    /** The lab's own wording on the report, distinct from the AI read. */
    labInterpretation: string | null;
    biomarkerCount: number | null;
}

/**
 * Clinician verification state.
 *
 * `withheld` cannot be true under current policy — patients see unverified interpretations,
 * labelled. It exists because that policy is expected to change if regulation requires
 * sign-off first, and that switch must be server-side only. The client handles the state
 * now so the change never needs an app release on a regulatory deadline.
 */
export interface Verification {
    status: 'unverified' | 'approved' | 'amended';
    /** True when policy forbids showing an unreviewed interpretation to the patient. */
    withheld: boolean;
    reviewRequired: boolean;
    reviewedAt: string | null;
}

export interface LatestInterpretation {
    available: boolean;
    interpretation: Interpretation | null;
    generatedAt: string | null;
    source: SourceRef | null;
    latestResult: LatestResultRef | null;
    /** False when the interpretation describes an earlier result than the newest one. */
    isForLatestResult: boolean;
    verification?: Verification;
}

/** A clinician has signed this off, so it is no longer "AI-generated, pending review". */
export const isVerified = (v?: Verification): boolean =>
    v?.status === 'approved' || v?.status === 'amended';

/**
 * Everything the home screen needs about interpretation, in one authenticated call.
 *
 * Replaces fetching `/test-results?user_id=`, sorting it client-side and asking for the
 * newest document's interpretation — which returned nothing at all when the newest result
 * happened to be the uninterpreted one.
 */
export const getLatestInterpretation = () =>
    api.get<LatestInterpretation>('/interpretation/latest');

/** Whether the server has an AI key configured at all — 503 otherwise. */
export const getInterpretationStatus = () =>
    api.get<{ available: boolean; model: string | null }>('/interpretation/status');

/**
 * A previously generated interpretation for one source document.
 *
 * Answers with the newest interpretation that *read* this document, which may be a later
 * whole-person one rather than the generation this document triggered.
 *
 * Resolves to `null` on 404 rather than throwing: "none yet" is the normal state for a
 * freshly uploaded result, not an error the caller should have to catch. A 404 is also how
 * a withheld interpretation presents, so callers must not treat it as "never analysed".
 */
export const getInterpretationFor = async (
    sourceId: string,
): Promise<{ interpretation: Interpretation; generatedAt: string; verification: Verification } | null> => {
    try {
        return await api.get<{ interpretation: Interpretation; generatedAt: string; verification: Verification }>(
            `/interpretation/${sourceId}`,
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
    }
};

/**
 * Generate an interpretation and rebuild the plan from it.
 *
 * Defaults to `force: false` so the server's cache is honoured — regenerating costs a model
 * call, and the same inputs give the same answer. Pass `force` only when the user has
 * explicitly asked for a fresh read.
 */
export const generateInterpretation = (
    params: { testResultId?: string; dnaReportId?: string; force?: boolean },
) =>
    apiFetch<GenerateResult>('/interpretation/generate', {
        method: 'POST',
        body: { force: false, ...params },
    });

/**
 * Whether `changes_since_last` is worth showing.
 *
 * False for interpretations generated before the field existed, and for the first-run
 * sentence the schema asks for — "no previous assessment to compare against" is not news
 * to someone who has only ever had one result.
 */
export const hasMeaningfulChanges = (i: Interpretation | null): boolean => {
    const text = i?.changes_since_last?.trim();
    return Boolean(text) && !/^first interpretation/i.test(text!);
};

export const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
    high: { label: 'High', color: '#DC2626', bg: '#FEF2F2' },
    moderate: { label: 'Moderate', color: '#B45309', bg: '#FFFBEB' },
    low: { label: 'Low', color: '#059669', bg: '#ECFDF5' },
    unknown: { label: 'Unclear', color: '#6B7280', bg: '#F9FAFB' },
};

/** Highest-severity risks first — the reason someone reads this at all. */
export const byRiskSeverity = (a: { level: RiskLevel }, b: { level: RiskLevel }) => {
    const rank: Record<RiskLevel, number> = { high: 0, moderate: 1, low: 2, unknown: 3 };
    return rank[a.level] - rank[b.level];
};
