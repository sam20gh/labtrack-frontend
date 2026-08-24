/**
 * LabTrack Health Score.
 *
 * The turing kit calls this the "nightingale score" — one number summarising overall
 * health, with an explainer sheet because an unexplained number is not trustworthy.
 *
 * The old home screen computed a score from BMI plus "do you have any test at all",
 * which meant a person with three critical biomarkers and a normal BMI scored 100. This
 * version reads the data the app actually holds and says which part of it is weak, so the
 * number is defensible and the pillars are individually actionable.
 *
 * Nothing here is a clinical instrument. It is an engagement summary over the user's own
 * records, and `SCORE_DISCLAIMER` says so wherever the score is shown.
 */
import type { BiomarkerSummary, PlanItem, HealthAssessment } from '@/types/api';

export type PillarKey = 'biomarkers' | 'body' | 'plan' | 'profile' | 'recency' | 'lifestyle';

export interface Pillar {
    key: PillarKey;
    /** Short axis label — the radar has no room for more than one word. */
    label: string;
    /** 0–100, or null when we hold no data for it. */
    value: number | null;
    /** Why it scored what it scored, shown in the explainer sheet. */
    detail: string;
}

export interface HealthScore {
    /** 0–100 overall, or null when there is not enough data to be meaningful. */
    value: number | null;
    band: 'excellent' | 'good' | 'fair' | 'attention' | 'unknown';
    headline: string;
    pillars: Pillar[];
    /** Pillars carrying data, i.e. the ones the radar can plot. */
    coverage: number;
}

export const SCORE_DISCLAIMER =
    'Your score summarises the records in LabTrack — it is not a diagnosis. Always discuss results with a clinician.';

export const BAND_META: Record<HealthScore['band'], { label: string; color: string }> = {
    excellent: { label: 'Excellent', color: '#34D399' },
    good: { label: 'Good', color: '#A78BFA' },
    fair: { label: 'Fair', color: '#FBBF24' },
    attention: { label: 'Needs attention', color: '#FB7185' },
    unknown: { label: 'Not enough data', color: '#CBD5E1' },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (iso?: string | null) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY);
};

/**
 * Biomarkers in range, weighted so a critical flag hurts more than a borderline one.
 * Unknown flags are excluded rather than scored as passes — an unevaluated analyte is
 * absence of evidence, and counting it as a pass inflates the score.
 */
const scoreBiomarkers = (biomarkers: BiomarkerSummary[]): Pillar => {
    const evaluated = biomarkers.filter((b) => b.flag !== 'unknown');
    if (!evaluated.length) {
        return {
            key: 'biomarkers', label: 'Markers', value: null,
            detail: 'Upload a lab report to score this.',
        };
    }

    const WEIGHT: Record<string, number> = {
        normal: 1, low: 0.55, high: 0.55, critical_low: 0, critical_high: 0,
    };
    const total = evaluated.reduce((sum, b) => sum + (WEIGHT[b.flag] ?? 0), 0);
    const outOfRange = evaluated.filter((b) => b.flag !== 'normal').length;

    return {
        key: 'biomarkers',
        label: 'Markers',
        value: clamp((total / evaluated.length) * 100),
        detail: outOfRange
            ? `${outOfRange} of ${evaluated.length} markers outside your range.`
            : `All ${evaluated.length} markers within your range.`,
    };
};

/**
 * BMI, scored as a curve rather than a cliff — 24.9 and 25.1 are the same person, so they
 * should not be 30 points apart.
 */
const scoreBody = (heightCm?: number | null, weightKg?: number | null): Pillar => {
    if (!heightCm || !weightKg) {
        return { key: 'body', label: 'Body', value: null, detail: 'Add your height and weight.' };
    }
    const bmi = weightKg / (heightCm / 100) ** 2;
    // Full marks across 18.5–25, tapering by 6 points per BMI unit outside it.
    const distance = bmi < 18.5 ? 18.5 - bmi : bmi > 25 ? bmi - 25 : 0;
    return {
        key: 'body',
        label: 'Body',
        value: clamp(100 - distance * 6),
        detail: `BMI ${bmi.toFixed(1)} — ${bmiLabel(bmi)}.`,
    };
};

export const bmiLabel = (bmi: number) =>
    bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy range' : bmi < 30 ? 'overweight' : 'obese';

/** Plan adherence: what share of what was due has been done rather than left to lapse. */
const scorePlan = (items: PlanItem[]): Pillar => {
    if (!items.length) {
        return { key: 'plan', label: 'Plan', value: null, detail: 'No health plan yet.' };
    }
    const overdue = items.filter(
        (i) => i.status !== 'completed' && i.status !== 'dismissed' && new Date(i.dueDate).getTime() < Date.now(),
    ).length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const actionable = items.filter((i) => i.status !== 'dismissed').length || 1;

    return {
        key: 'plan',
        label: 'Plan',
        value: clamp(((completed + (actionable - completed - overdue) * 0.75) / actionable) * 100),
        detail: overdue ? `${overdue} plan item${overdue > 1 ? 's' : ''} overdue.` : 'Plan is on track.',
    };
};

/** Profile completeness — the assessment is what personalises everything downstream. */
const scoreProfile = (assessment?: HealthAssessment | null, hasBasics?: boolean): Pillar => {
    const filled = assessment ? Object.values(assessment).filter(isAnswered).length : 0;
    // The assessment writes roughly a dozen top-level groups; treat that as "complete".
    const value = clamp((filled / 12) * 90 + (hasBasics ? 10 : 0));
    return {
        key: 'profile',
        label: 'Profile',
        value,
        detail: value >= 90 ? 'Health profile complete.' : 'Finish your health assessment for sharper insights.',
    };
};

const isAnswered = (v: unknown): boolean => {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.values(v as object).some(isAnswered);
    return true;
};

/** How current the data is. A two-year-old panel does not describe you today. */
const scoreRecency = (biomarkers: BiomarkerSummary[]): Pillar => {
    const newest = biomarkers.reduce<number | null>((best, b) => {
        const d = daysSince(b.measuredAt);
        return d == null ? best : best == null ? d : Math.min(best, d);
    }, null);

    if (newest == null) {
        return { key: 'recency', label: 'Recency', value: null, detail: 'No dated results yet.' };
    }
    // Full marks inside 90 days, decaying to zero at roughly two years.
    return {
        key: 'recency',
        label: 'Recency',
        value: clamp(newest <= 90 ? 100 : 100 - ((newest - 90) / 640) * 100),
        detail: newest <= 1 ? 'Updated today.' : `Last result ${newest} days ago.`,
    };
};

/**
 * Self-reported lifestyle from the assessment.
 *
 * Field shapes come from `complete.tsx`: sleep and fitness are the 1–5 ladders the
 * assessment screens write (fitness arrives as a *string*), stress and smoking are the
 * enums in `Lifestyle`, and mood is the newest `moodHistory` entry.
 */
const STRESS_SCORE: Record<string, number> = { Low: 100, Moderate: 70, High: 40, 'Very High': 15 };
const SMOKING_SCORE: Record<string, number> = { Never: 100, Former: 75, Occasional: 45, Current: 15 };
const MOOD_SCORE: Record<string, number> = { Excellent: 100, Good: 80, Okay: 60, Poor: 35, Bad: 15 };

const scoreLifestyle = (assessment?: HealthAssessment | null): Pillar => {
    const l = assessment?.lifestyle;
    const parts: number[] = [];

    // Both ladders run 1–5; fitnessLevel is persisted as a string.
    const sleep = Number(l?.sleepQuality);
    if (Number.isFinite(sleep) && sleep > 0) parts.push(clamp(((sleep - 1) / 4) * 100));

    const fitness = Number(l?.fitnessLevel);
    if (Number.isFinite(fitness) && fitness > 0) parts.push(clamp(((fitness - 1) / 4) * 100));

    if (l?.stressLevel && STRESS_SCORE[l.stressLevel] != null) parts.push(STRESS_SCORE[l.stressLevel]);
    if (l?.smokingStatus && SMOKING_SCORE[l.smokingStatus] != null) parts.push(SMOKING_SCORE[l.smokingStatus]);

    const latestMood = assessment?.moodHistory?.[assessment.moodHistory.length - 1]?.mood;
    if (latestMood && MOOD_SCORE[latestMood] != null) parts.push(MOOD_SCORE[latestMood]);

    if (!parts.length) {
        return { key: 'lifestyle', label: 'Lifestyle', value: null, detail: 'Tell us about sleep and activity.' };
    }
    return {
        key: 'lifestyle',
        label: 'Lifestyle',
        value: clamp(parts.reduce((sum, p) => sum + p, 0) / parts.length),
        detail: `From ${parts.length} lifestyle answer${parts.length > 1 ? 's' : ''} you gave.`,
    };
};

/**
 * Weights reflect clinical signal, not data volume: measured biomarkers outrank
 * self-reported lifestyle, and profile completeness is a nudge rather than a score.
 */
const WEIGHTS: Record<PillarKey, number> = {
    biomarkers: 3, recency: 1.5, body: 1.5, plan: 1.5, lifestyle: 1, profile: 0.75,
};

export interface ScoreInput {
    biomarkers: BiomarkerSummary[];
    planItems: PlanItem[];
    heightCm?: number | null;
    weightKg?: number | null;
    assessment?: HealthAssessment | null;
}

export const computeHealthScore = ({
    biomarkers, planItems, heightCm, weightKg, assessment,
}: ScoreInput): HealthScore => {
    const pillars: Pillar[] = [
        scoreBiomarkers(biomarkers),
        scoreRecency(biomarkers),
        scoreBody(heightCm, weightKg),
        scorePlan(planItems),
        scoreLifestyle(assessment),
        scoreProfile(assessment, !!(heightCm && weightKg)),
    ];

    const scored = pillars.filter((p) => p.value != null);
    // Below three pillars the average says more about what is missing than about health.
    if (scored.length < 3) {
        return {
            value: null, band: 'unknown', pillars, coverage: scored.length,
            headline: 'Add a result to unlock your score',
        };
    }

    const weight = scored.reduce((sum, p) => sum + WEIGHTS[p.key], 0);
    const value = clamp(scored.reduce((sum, p) => sum + p.value! * WEIGHTS[p.key], 0) / weight);

    const band: HealthScore['band'] =
        value >= 85 ? 'excellent' : value >= 70 ? 'good' : value >= 50 ? 'fair' : 'attention';

    // Lead with the weakest pillar — the number alone tells nobody what to do next.
    const weakest = [...scored].sort((a, b) => a.value! - b.value!)[0];
    const headline =
        band === 'excellent' ? 'Your health score is great. Keep it up!'
            : band === 'good' ? `Looking good. ${weakest.detail}`
                : `${weakest.detail} Worth a look.`;

    return { value, band, headline, pillars, coverage: scored.length };
};
