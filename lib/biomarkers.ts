/**
 * Biomarker client — the time-series half of the product.
 */
import { api } from './api';
import type { BiomarkerSummary, BiomarkerTrend, BiomarkerFlag, BiomarkerExplainer } from '@/types/api';

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


// ─────────────────────────────────────────────────────────────────────────────
// Plain language
//
// The people using this app are not clinicians. "MCV 88 fL · Normal" is three
// pieces of information and none of them are readable without a medical
// education, so every surface that prints an analyte name also offers the lay
// version the server sends alongside it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What to print as the row's title.
 *
 * The medical name stays primary on purpose: it is what is printed on the sheet the person
 * is holding, and renaming "Ferritin" to "Iron stores" outright would leave them unable to
 * match the app to their own report. The plain name goes underneath instead.
 */
export const medicalName = (b: { explainer?: BiomarkerExplainer | null; displayName?: string; name: string }) => {
    // An analyte outside the normaliser's catalogue is stored with `displayName` set to the
    // same run-together slug as `name`, so the row would title as "redcelldistributionwidth"
    // — less readable than the medical term this whole layer exists to translate. The
    // glossary's spelled-out label wins in exactly that case.
    if (b.explainer?.label && (!b.displayName || b.displayName === b.name)) return b.explainer.label;
    return b.displayName || b.name;
};

/** The lay label, when the server has one and it is not just the medical name again. */
export const plainName = (b: { explainer?: BiomarkerExplainer | null; displayName?: string; name: string }) => {
    const plain = b.explainer?.plainName;
    if (!plain) return null;
    return plain.toLowerCase() === medicalName(b).toLowerCase() ? null : plain;
};

/**
 * The sentence a flagged result should carry: what *this* direction can mean.
 *
 * Returns null for in-range and unevaluated values — someone whose results are fine does
 * not need a paragraph per row explaining what would have been wrong.
 */
export const explainFlag = (b: BiomarkerSummary | { explainer?: BiomarkerExplainer | null; flag: BiomarkerFlag }) => {
    if (!b.explainer) return null;
    if (['low', 'critical_low'].includes(b.flag)) return b.explainer.low;
    if (['high', 'critical_high'].includes(b.flag)) return b.explainer.high;
    return null;
};
