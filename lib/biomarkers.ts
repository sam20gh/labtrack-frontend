/**
 * Biomarker client — the time-series half of the product.
 */
import { api } from './api';
import type { BiomarkerSummary, BiomarkerTrend, BiomarkerFlag, BiomarkerExplainer } from '@/types/api';

export const getLatestBiomarkers = () => api.get<{ biomarkers: BiomarkerSummary[] }>('/biomarkers/latest');

export const getBiomarkerTrend = (name: string, limit = 100) =>
    api.get<BiomarkerTrend>(`/biomarkers/${encodeURIComponent(name)}/trend?limit=${limit}`);

/**
 * Clinical status colours.
 *
 * `color` and `bg` are the original pair — a tone and the pale surface it sits on. The
 * three fields after them exist because that pair cannot, on its own, say how bad a
 * result is:
 *
 * - **`bg` tones are 1.05:1 apart.** Amber `#FFFBEB` and red `#FEF2F2` are both a hair off
 *   white, so a pale chip is barely visible against a card and a flag-tinted *card* cannot
 *   separate "High" from "Critically high" at all. Severity is therefore carried by a
 *   filled pill (`chipBg` + `chipText`), never by a wash.
 * - **Amber and red are 1.04:1 apart in luminance.** They differ in hue and almost nothing
 *   else, which is the one pair red-green colour blindness collapses. Crisis consequently
 *   has two non-colour carriers and the colour is the third: the label says "Critically
 *   high" where the others say "High", and the tile draws an alert icon inside the pill.
 *   This is the same rule `utils/bloodPressure.js` states as "crisis is not a colour".
 * - **`color` is not always legible as text.** `#DC2626` reaches 4.4:1 on a warm card and
 *   `#059669` only 3.7:1, both under AA. `value` is the same hue darkened until it clears
 *   4.5:1, so the number a person actually reads is never the failing one.
 *
 * Every pair below is verified against `Palette.surfaceWarm`; see the header of the
 * markers rail in `app/(tabs)/index.tsx`.
 */
export const FLAG_META: Record<BiomarkerFlag, {
    label: string;
    color: string;
    bg: string;
    /** The tone for the value itself — `color` darkened where `color` fails AA as text. */
    value: string;
    /** Filled pill behind the label. Solid on purpose: a pale chip is invisible here. */
    chipBg: string;
    chipText: string;
    /** The card's hairline, tinted to the flag so the edge agrees with the pill. */
    border: string;
}> = {
    critical_low: { label: 'Critically low', color: '#DC2626', bg: '#FEF2F2', value: '#DC2626', chipBg: '#DC2626', chipText: '#FFFFFF', border: '#F6D6D6' },
    low: { label: 'Low', color: '#B45309', bg: '#FFFBEB', value: '#B45309', chipBg: '#B45309', chipText: '#FFFFFF', border: '#F0E0C4' },
    normal: { label: 'Normal', color: '#059669', bg: '#ECFDF5', value: '#047857', chipBg: '#047857', chipText: '#FFFFFF', border: '#CDE9DC' },
    high: { label: 'High', color: '#B45309', bg: '#FFFBEB', value: '#B45309', chipBg: '#B45309', chipText: '#FFFFFF', border: '#F0E0C4' },
    critical_high: { label: 'Critically high', color: '#DC2626', bg: '#FEF2F2', value: '#DC2626', chipBg: '#DC2626', chipText: '#FFFFFF', border: '#F6D6D6' },
    unknown: { label: 'Not evaluated', color: '#6B7280', bg: '#F9FAFB', value: '#6B7280', chipBg: '#6B7280', chipText: '#FFFFFF', border: '#E5E7EB' },
};

/** Whether a flag is the crisis tier, which gets an icon as well as a colour. */
export const isCriticalFlag = (f: BiomarkerFlag) => f === 'critical_low' || f === 'critical_high';

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

/**
 * A marker that was outside its range last time and is inside it now.
 *
 * This is the best news this layer can produce, and the home screen has never been able to
 * show it. `attention` there keeps only out-of-range values, so a marker that recovers is
 * not moved to the back of the rail — it is removed from the page, on the one visit the
 * person most deserves to be told. The good news survives only as a line on a movement
 * chart one tab away, which is not where anybody looks to find out that something got
 * better.
 *
 * `describeMovement` already scores this case as `good`; it simply had nothing on the home
 * screen left to score. This is the predicate that lets a tile ask.
 */
export const hasReturnedToRange = (b: BiomarkerSummary) => {
    if (b.flag !== 'normal' || !b.previous) return false;
    const min = b.appliedRange?.min;
    const max = b.appliedRange?.max;
    return (typeof min === 'number' && b.previous.value < min)
        || (typeof max === 'number' && b.previous.value > max);
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

/**
 * Words that cannot carry the lay label on their own.
 *
 * Grammar, plus the measurement nouns a lab title already implies — a reader looking at a
 * row of results knows it is a count of something without the word "count". "Red Blood
 * Cells" subtitled "Red blood cell count" reduces to nothing new under this list, which is
 * the point: it spent the card's only explanatory line restating the title.
 */
const LABEL_FILLER = new Set([
    'a', 'an', 'and', 'for', 'in', 'is', 'of', 'that', 'the', 'your',
    'count', 'level', 'measure', 'reading', 'test', 'total', 'value',
]);

/** Significant words, singular-folded so "cells" and "cell" are one word. */
const significantWords = (s: string) =>
    (s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        .map((w) => w.replace(/s$/, ''))
        .filter((w) => !LABEL_FILLER.has(w));

/**
 * The lay label, when the server has one and it actually says something new.
 *
 * The guard used to be exact equality, which only caught "Total Cholesterol" / "Total
 * cholesterol" and let "Red Blood Cells" / "Red blood cell count" through — a subtitle
 * that reads as an explanation and explains nothing. The test is now whether the label
 * introduces a word the title does not already carry; if it does not, there is nothing to
 * print and the row is better off one line shorter.
 */
export const plainName = (b: { explainer?: BiomarkerExplainer | null; displayName?: string; name: string }) => {
    const plain = b.explainer?.plainName;
    if (!plain) return null;

    const inTitle = new Set(significantWords(medicalName(b)));
    return significantWords(plain).some((w) => !inTitle.has(w)) ? plain : null;
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
