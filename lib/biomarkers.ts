/**
 * Biomarker client — the time-series half of the product.
 */
import { api } from './api';
import type { BiomarkerSummary, BiomarkerTrend, BiomarkerFlag } from '@/types/api';

export const getLatestBiomarkers = () => api.get<{ biomarkers: BiomarkerSummary[] }>('/biomarkers/latest');

export const getBiomarkerTrend = (name: string, limit = 100) =>
    api.get<BiomarkerTrend>(`/biomarkers/${encodeURIComponent(name)}/trend?limit=${limit}`);

export const FLAG_META: Record<BiomarkerFlag, { label: string; color: string; bg: string }> = {
    critical_low: { label: 'Critically low', color: '#DC2626', bg: '#FEF2F2' },
    low: { label: 'Low', color: '#B45309', bg: '#FFFBEB' },
    normal: { label: 'Normal', color: '#059669', bg: '#ECFDF5' },
    high: { label: 'High', color: '#B45309', bg: '#FFFBEB' },
    critical_high: { label: 'Critically high', color: '#DC2626', bg: '#FEF2F2' },
    unknown: { label: 'Not evaluated', color: '#6B7280', bg: '#F9FAFB' },
};

/** Out-of-range values sort first: they are what the person needs to see. */
export const byClinicalPriority = (a: BiomarkerSummary, b: BiomarkerSummary) => {
    const rank: Record<BiomarkerFlag, number> = {
        critical_low: 0, critical_high: 0, low: 1, high: 1, normal: 2, unknown: 3,
    };
    const diff = rank[a.flag] - rank[b.flag];
    return diff !== 0 ? diff : (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name);
};

/**
 * Whether a movement is good or bad depends on the analyte and which way it was wrong.
 * "Up" is not inherently improvement — rising ferritin is good when it was low and bad
 * when it was already high.
 */
export const describeMovement = (b: BiomarkerSummary): { text: string; tone: 'good' | 'bad' | 'neutral' } | null => {
    if (b.delta == null || !b.direction || b.direction === 'flat') return null;

    const arrow = b.direction === 'up' ? '↑' : '↓';
    const magnitude = `${arrow} ${Math.abs(b.delta).toFixed(Math.abs(b.delta) >= 10 ? 0 : 1)}`;

    const min = b.appliedRange?.min;
    const max = b.appliedRange?.max;

    let tone: 'good' | 'bad' | 'neutral' = 'neutral';
    if (b.flag === 'normal' && b.previous) {
        // Moved into range
        const wasOut = (typeof min === 'number' && b.previous.value < min) ||
                       (typeof max === 'number' && b.previous.value > max);
        if (wasOut) tone = 'good';
    } else if (['low', 'critical_low'].includes(b.flag)) {
        tone = b.direction === 'up' ? 'good' : 'bad';
    } else if (['high', 'critical_high'].includes(b.flag)) {
        tone = b.direction === 'down' ? 'good' : 'bad';
    }

    return { text: magnitude, tone };
};

export const formatValue = (v: number) =>
    Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '');
