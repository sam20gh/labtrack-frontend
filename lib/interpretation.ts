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

export type RiskLevel = 'low' | 'moderate' | 'high' | 'unknown';
export type Urgency = 'routine' | 'soon' | 'urgent';

/**
 * The analysis written for the person rather than for a clinician.
 *
 * Optional because it is: `Interpretation` documents generated before this field existed
 * are append-only records and are never rewritten, so a returning user's newest analysis
 * may well predate it. Every consumer falls back to `summary`.
 */
export interface PlainSummary {
    /** One short sentence, safe to read on its own. */
    headline: string;
    overall: 'mostly_good' | 'some_things_to_watch' | 'needs_attention';
    /** Two to four short sentences in everyday words. */
    what_it_means: string;
    key_points: { label: string; detail: string; tone: 'good' | 'watch' | 'act' }[];
    /** One thing they can act on today. */
    next_step: string;
}

export interface Interpretation {
    /**
     * The clinical read. Accurate, and written for a reviewing clinician — which is why it
     * sits behind "Read full analysis" rather than on the home card. Use `plain_summary`
     * for anything a member of the public sees first.
     */
    summary: string;
    risks: { condition: string; level: RiskLevel; basis: string; rationale: string }[];
    recommended_screenings: {
        condition: string; test: string; rationale: string;
        starting_age: number; frequency: string; urgency: Urgency;
    }[];
    specialist_consultations: {
        reason: string; speciality: string; urgency: Urgency; due_within_months: number;
    }[];
    lifestyle_recommendations: { area: string; recommendation: string; rationale: string }[];
    biomarkers_of_concern: { name: string; observation: string; action: string }[];
    /**
     * What moved since the previous interpretation. Absent on anything generated before
     * this field existed, and set to a fixed sentence on a first-ever read.
     */
    changes_since_last?: string;
    follow_up: string;
    limitations: string[];
    /** Absent on anything generated before the plain-language layer existed. */
    plain_summary?: PlainSummary;
}

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
