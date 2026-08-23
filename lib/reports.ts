/**
 * Lab-report ingestion client.
 *
 * Two routes into the record, deliberately:
 *   - Scan: photograph or pick a PDF, the server extracts measurements, the user confirms.
 *   - Manual: type values in directly.
 *
 * Manual entry is always available. Automatic parsing depends on server configuration and
 * can be switched off, so screens must check `getIngestionStatus()` rather than assuming.
 *
 * Nothing is written to the record by parsing. `confirmReport` is the only call that saves,
 * which keeps a human checkpoint between a misread digit and a medical record.
 */
import { api, apiFetch } from './api';
import { getAccessToken } from './auth';
import { API_URL } from '@/constants/config';
import type { Biomarker, BiomarkerFlag, TestResult } from '@/types/api';

export interface IngestionStatus {
    automaticParsing: boolean;
    manualEntry: boolean;
    acceptedTypes: string[];
    maxBytes: number;
}

/** A measurement as extracted, before the user has confirmed it. */
export interface ParsedMeasurement {
    name: string;
    value: number;
    unit: string | null;
    reportedRange?: { raw?: string };
    extractionConfidence?: number;
    /** Canonical form the server would store — may differ in unit from what was read. */
    canonicalName: string;
    displayName: string;
    normalisedValue: number;
    normalisedUnit: string;
    recognised: boolean;
    needsReview: boolean;
    normalisationNote?: string;
}

export interface ParseResult {
    message: string;
    report: {
        labName: string | null;
        collectionDate: string | null;
        testType: string | null;
        unreadableRegions: string[];
    };
    measurements: ParsedMeasurement[];
    requiresReviewCount: number;
    confidenceThreshold: number;
}

export interface ConfirmResult {
    message: string;
    testResult: TestResult;
    biomarkers: Biomarker[];
    flagged: {
        name: string;
        displayName: string;
        value: number;
        unit: string;
        flag: BiomarkerFlag;
        geneAdjusted: boolean;
    }[];
}

export interface CatalogueEntry {
    name: string;
    displayName: string;
    unit: string;
    acceptedUnits: string[];
}

export const getIngestionStatus = () => api.get<IngestionStatus>('/reports/status');

/** Canonical analytes and the units the server accepts, for the manual-entry picker. */
export const getBiomarkerCatalogue = async (): Promise<CatalogueEntry[]> => {
    const data = await api.get<{ biomarkers: CatalogueEntry[] }>('/biomarkers/catalogue');
    return data.biomarkers;
};

/**
 * Upload a report for extraction. Returns a preview — nothing is saved yet.
 * Sent as multipart, so the token is attached by hand rather than through `api.post`.
 */
export const parseReportDocument = async (file: {
    uri: string;
    name: string;
    mimeType: string;
}): Promise<ParseResult> => {
    const token = await getAccessToken();
    const form = new FormData();

    // React Native's FormData takes this shape for file parts
    form.append('document', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
    } as any);

    const response = await fetch(`${API_URL}/reports/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not read the document');
    return data;
};

/** Save reviewed measurements. This is the only call that writes to the record. */
export const confirmReport = (payload: {
    labName?: string;
    testType?: string;
    collectionDate?: string;
    documentUrl?: string;
    measurements: {
        name: string;
        value: number;
        unit?: string | null;
        reportedRange?: { raw?: string };
        needsReview?: boolean;
        extractionConfidence?: number;
    }[];
}) => apiFetch<ConfirmResult>('/reports/confirm', { method: 'POST', body: payload });

/** Human-facing labels and colours for a flag. */
export const FLAG_META: Record<BiomarkerFlag, { label: string; color: string }> = {
    critical_low: { label: 'Critically low', color: '#DC2626' },
    low: { label: 'Low', color: '#F59E0B' },
    normal: { label: 'Normal', color: '#10B981' },
    high: { label: 'High', color: '#F59E0B' },
    critical_high: { label: 'Critically high', color: '#DC2626' },
    unknown: { label: 'Not evaluated', color: '#9CA3AF' },
};
