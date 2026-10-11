/**
 * Biomarker client — the time-series half of the product.
 */
import { api } from './api';
import type { BiomarkerSummary, BiomarkerTrend, BiomarkerFlag, BiomarkerExplainer } from '@/types/api';
import { schemed, tone } from '@/constants/theme';

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
}> = schemed((Palette, scheme) => ({
    critical_low: { label: 'Critically low', color: Palette.danger, bg: Palette.dangerSurface, value: Palette.danger, chipBg: Palette.dangerFill, chipText: Palette.white, border: tone('#F6D6D6', scheme) },
    low: { label: 'Low', color: Palette.warning, bg: Palette.warningSurface, value: Palette.warning, chipBg: Palette.warningFill, chipText: Palette.white, border: tone('#F0E0C4', scheme) },
    normal: { label: 'Normal', color: Palette.success, bg: Palette.successSurface, value: Palette.successDeep, chipBg: Palette.successDeep, chipText: Palette.white, border: tone('#CDE9DC', scheme) },
    high: { label: 'High', color: Palette.warning, bg: Palette.warningSurface, value: Palette.warning, chipBg: Palette.warningFill, chipText: Palette.white, border: tone('#F0E0C4', scheme) },
    critical_high: { label: 'Critically high', color: Palette.danger, bg: Palette.dangerSurface, value: Palette.danger, chipBg: Palette.dangerFill, chipText: Palette.white, border: tone('#F6D6D6', scheme) },
    unknown: { label: 'Not evaluated', color: Palette.textSecondary, bg: tone('#F9FAFB', scheme), value: Palette.textSecondary, chipBg: Palette.textSecondary, chipText: Palette.white, border: Palette.border },
}));

/** Whether a flag is the crisis tier, which gets an icon as well as a colour. */
export const isCriticalFlag = (f: BiomarkerFlag) => f === 'critical_low' || f === 'critical_high';

/**
 * Which body system a marker belongs to: the home rail's card surface and watermark.
 *
 * The rail used to draw every card on the same warm surface with the same blood drop, so
 * five cards about five different systems read as one card printed five times. The family
 * says *what* is being measured; `FLAG_META` still says *how it came back*. They live on
 * different layers on purpose. The family owns the card's surface, hairline and
 * secondary ink. The flag owns the filled pill and the number. So no family colour can be
 * mistaken for a verdict, and a rose card for haemoglobin is not a red flag.
 *
 * Keys are the canonical names `unitNormaliser` emits, plus the uncatalogued slugs
 * `biomarkerController.canonicalise` falls back to (the differential, MCH/MCHC, the
 * derived lipids). Anything else is matched by pattern, and failing that it is
 * `chemistry`, the old warm card. An unknown analyte looks the way every analyte used to.
 */
export type MarkerFamily = 'red_cells' | 'immune' | 'metabolic' | 'hormones' | 'chemistry';

const FAMILY_OF: Record<string, MarkerFamily> = {
    haemoglobin: 'red_cells', rbc: 'red_cells', haematocrit: 'red_cells', mcv: 'red_cells',
    mch: 'red_cells', mchc: 'red_cells', rdw: 'red_cells', iron: 'red_cells', ferritin: 'red_cells',

    wbc: 'immune', lymphocytes_pct: 'immune', lymphocytes_abs: 'immune', neutrophils: 'immune',
    monocytes: 'immune', eosinophils: 'immune', basophils: 'immune', platelets: 'immune', crp: 'immune',

    total_cholesterol: 'metabolic', ldl_cholesterol: 'metabolic', hdl_cholesterol: 'metabolic',
    triglycerides: 'metabolic', nonhdlcholesterol: 'metabolic', cholesteroltohdlratio: 'metabolic',
    hba1c: 'metabolic', fasting_glucose: 'metabolic', estimatedaverageglucose: 'metabolic',
    uric_acid: 'metabolic',

    tsh: 'hormones', free_t4: 'hormones', psa: 'hormones', vitamin_d: 'hormones',
    vitamin_b12: 'hormones', folate: 'hormones',
};

/** Checked in order, so the specific patterns come first ("haemoglobin a1c" is metabolic). */
const FAMILY_PATTERNS: [RegExp, MarkerFamily][] = [
    [/a1c|glucose|cholesterol|lipid|triglycer|\bldl|\bhdl|insulin/, 'metabolic'],
    [/neutro|lympho|mono|eosino|baso|leuko|white|platelet|\bcrp|reactive/, 'immune'],
    [/\bhaem|\bhem|erythro|red ?cell|ferrit|transferrin|\biron/, 'red_cells'],
    [/vitamin|folate|\bt3|\bt4|thyro|tsh|testost|oestr|estr|cortisol|prolactin|psa/, 'hormones'],
];

export const markerFamily = (name: string): MarkerFamily => {
    const key = name.toLowerCase();
    if (FAMILY_OF[key]) return FAMILY_OF[key];
    const words = key.replace(/_/g, ' ');
    return FAMILY_PATTERNS.find(([re]) => re.test(words))?.[1] ?? 'chemistry';
};

/**
 * Every ink here is checked against its own surface and against that surface under the
 * watermark's most saturated pixel at its own opacity. `ink` stays at or above 5.3:1 there
 * in both schemes, and `chemistry` keeps its original 4.6:1. The flag inks drawn on these
 * cards (`danger`, `warning`, `successDeep`) stay at or above 4.5:1 on every light surface,
 * the bar `surfaceWarm` was held to. `danger` is the tightest of them, at 4.51 on
 * `red_cells`. A new surface has to clear the same bar for `danger` before it ships.
 */
export const FAMILY_META: Record<MarkerFamily, {
    /** Spoken after the value, so the grouping the colour shows is also heard. */
    label: string;
    surface: string;
    border: string;
    /** Unit and lay-name ink, tinted to the family rather than the warm grey. */
    ink: string;
    /** The watermark's opacity. Higher in dark, where a coloured PNG on near-black fades. */
    art: number;
}> = schemed((Palette, scheme) => {
    const dark = scheme === 'dark';
    return {
        red_cells: {
            label: 'red cells and iron',
            surface: dark ? '#2A1B1C' : '#FFF5F3', border: dark ? '#4A2C2C' : '#F7D5CF',
            ink: dark ? '#E8BDB7' : '#7A4B45', art: dark ? 0.22 : 0.13,
        },
        immune: {
            label: 'immune and inflammation',
            surface: dark ? '#16262A' : '#F0F9FA', border: dark ? '#24434A' : '#C6E6EA',
            ink: dark ? '#A9D3D8' : '#3F5F63', art: dark ? 0.22 : 0.15,
        },
        metabolic: {
            label: 'heart and metabolism',
            surface: dark ? '#1C2618' : '#F5FAEF', border: dark ? '#33452A' : '#D5E8C0',
            ink: dark ? '#C4D9AE' : '#4E5E3C', art: dark ? 0.22 : 0.14,
        },
        hormones: {
            label: 'hormones and vitamins',
            surface: dark ? '#1D2033' : '#F6F7FE', border: dark ? '#33395C' : '#D3D9F5',
            ink: dark ? '#BFC5EC' : '#4C5277', art: dark ? 0.22 : 0.12,
        },
        chemistry: {
            label: 'blood chemistry',
            surface: Palette.surfaceWarm, border: dark ? '#3A352F' : '#EDE6DA',
            ink: Palette.textOnWarm, art: dark ? 0.2 : 0.1,
        },
    };
});

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
export const describeMovement = (
    b: BiomarkerSummary,
): { text: string; label: string; tone: 'good' | 'bad' | 'neutral' } | null => {
    if (b.delta == null || !b.direction || b.direction === 'flat') return null;

    const arrow = b.direction === 'up' ? '↑' : '↓';
    const amount = Math.abs(b.delta).toFixed(Math.abs(b.delta) >= 10 ? 0 : 1);
    const magnitude = `${arrow} ${amount}`;
    // `text` is drawn; `label` is spoken. A screen reader given "↑ 0.3" reads the arrow as
    // its character name or skips it, which turns the one piece of trend information on
    // the tile into a bare number with no direction attached.
    const label = `${b.direction} ${amount} since the last test`;

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

    return { text: magnitude, label, tone };
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
