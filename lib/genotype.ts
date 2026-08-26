/**
 * Genotype report client.
 *
 * Mirrors `models/GenotypeFile.js`. Note what is *not* here: there is no client-side tier
 * filtering. The server decides what a user may see and never serialises anything else, so
 * a bug in this file cannot expose a risk result someone chose not to receive.
 *
 * A withheld finding arrives with `withheld: true` and no interpretation — enough to render
 * an honest "being reviewed" row, not enough to read the result early.
 */
import { api } from './api';

export type Tier = 'release' | 'clinician' | 'opt_in' | 'suppressed';
export type Tone = 'typical' | 'reduced' | 'increased' | 'carrier' | 'attention';
export type Category = 'medication' | 'nutrition' | 'carrier' | 'trait' | 'risk';
export type FindingStatus =
    | 'called' | 'not_covered' | 'no_call' | 'rejected_indel' | 'unmatched' | 'ambiguous';

export interface Finding {
    rsid: string;
    gene?: string;
    alleleName?: string | null;
    name: string;
    category: Category;
    tier: Tier;
    status: FindingStatus;
    genotype?: string | null;
    tone?: Tone;
    label?: string;
    detail?: string;
    evidence?: string;
    counselling?: string;
    affectsBiomarker?: string | null;
    incomplete?: string | null;
    /** True when the server held this back pending clinician sign-off. */
    withheld?: boolean;
    withheldReason?: string;
    strandFlipped?: boolean;
    strandAmbiguous?: boolean;
}

export interface NotTested {
    key: string;
    title: string;
    genes: string[];
    detail: string;
    upgrade?: string;
}

export interface GenotypeQc {
    totalCalls: number;
    noCalls: number;
    callRate: number;
    indelCalls: number;
    inferredSex: 'male' | 'female' | 'undetermined';
    xHeterozygosity: number;
    yCalls: number;
    hasMitochondrial: boolean;
}

export interface GenotypeFile {
    _id: string;
    labName?: string;
    assayType: 'array' | 'targeted_panel' | 'exome' | 'genome';
    vendor?: string;
    chip?: string;
    chipManifestVersion?: string;
    referenceBuild?: string;
    qc?: GenotypeQc;
    panelVersion: string;
    findings: Finding[];
    notTested: NotTested[];
    consent?: { riskResultsOptIn: boolean; optedInAt?: string | null };
    status: 'received' | 'extracting' | 'extracted' | 'failed';
    passedQc?: boolean;
    reportedAt?: string;
    createdAt: string;
    summary: { total: number; shown: number; withheld: number; notCovered: number };
    clinicianReleased: boolean;
    /** Whether any opt-in result exists, without revealing what it is. */
    riskResultsAvailable: boolean;
}

export const listGenotypeFiles = () =>
    api.get<{ files: Omit<GenotypeFile, 'findings' | 'notTested' | 'summary'>[] }>('/genotypes')
        .then((r) => r.files);

export const getGenotypeFile = (id: string) =>
    api.get<{ file: GenotypeFile }>(`/genotypes/${id}`).then((r) => r.file);

export const setRiskConsent = (id: string, optIn: boolean) =>
    api.post<{ message: string; findings: Finding[]; consent: GenotypeFile['consent'] }>(
        `/genotypes/${id}/consent`,
        { optIn },
    );

/** Section order is deliberate: useful and low-anxiety first, risk last. */
export const CATEGORY_ORDER: Category[] = ['medication', 'nutrition', 'carrier', 'trait', 'risk'];

export const CATEGORY_META: Record<Category, { title: string; blurb: string; icon: string }> = {
    medication: {
        title: 'Medication response',
        blurb: 'How your body is likely to handle certain medicines.',
        icon: 'medkit-outline',
    },
    nutrition: {
        title: 'Nutrition & metabolism',
        blurb: 'Variants that affect how you process food, vitamins and minerals.',
        icon: 'nutrition-outline',
    },
    carrier: {
        title: 'Carrier status',
        blurb: 'Inherited variants worth knowing about for you and your family.',
        icon: 'people-outline',
    },
    trait: {
        title: 'Traits',
        blurb: 'Harmless inherited characteristics.',
        icon: 'sparkles-outline',
    },
    risk: {
        title: 'Health risk',
        blurb: 'Associations with conditions that develop later in life.',
        icon: 'pulse-outline',
    },
};

export const TONE_META: Record<Tone, { label: string; color: string; bg: string }> = {
    typical: { label: 'Typical', color: '#059669', bg: '#ECFDF5' },
    reduced: { label: 'Reduced', color: '#B45309', bg: '#FFFBEB' },
    increased: { label: 'Increased', color: '#B45309', bg: '#FFFBEB' },
    carrier: { label: 'Carrier', color: '#1D4ED8', bg: '#EFF6FF' },
    attention: { label: 'Worth discussing', color: '#DC2626', bg: '#FEF2F2' },
};

export const groupByCategory = (findings: Finding[]) => {
    const groups = new Map<Category, Finding[]>();
    for (const f of findings) {
        if (!groups.has(f.category)) groups.set(f.category, []);
        groups.get(f.category)!.push(f);
    }
    return CATEGORY_ORDER
        .filter((c) => groups.has(c))
        .map((c) => ({ category: c, ...CATEGORY_META[c], findings: groups.get(c)! }));
};
