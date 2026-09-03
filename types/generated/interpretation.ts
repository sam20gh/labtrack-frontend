/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Emitted by `labtrack-shared/generate.mjs` from `INTERPRETATION_SCHEMA` in
 * `labtrack-backend/utils/interpretationSchema.js`, which is the JSON schema the model's
 * output is constrained to. Editing this by hand reintroduces exactly the drift it exists to
 * prevent — three fields in the portal were wrong at once before it did.
 *
 * To change anything here, change the schema and run `npm run generate` in
 * `labtrack-shared`. `npm run check` fails if this file is out of date.
 */

/** ACMG-style banding used across risks. */
export type RiskLevel = 'low' | 'moderate' | 'high' | 'unknown';

export type RiskBasis = 'genetic' | 'biomarker' | 'lifestyle' | 'family_history' | 'combined';

/**
 * Interpretation urgency.
 *
 * NOTE: `PlanItem.urgency` is a **different** three-value enum (`low`/`moderate`/`high`).
 * Same word, two unrelated vocabularies on two models — an easy 400 to get in return.
 */
export type Urgency = 'routine' | 'soon' | 'urgent';

export type ScreeningFrequency = 'once' | 'annually' | 'every_6_months' | 'every_2_years' | 'every_3_years' | 'every_5_years' | 'as_advised';

export type LifestyleArea = 'diet' | 'exercise' | 'sleep' | 'alcohol' | 'smoking' | 'stress' | 'supplementation' | 'other';

/**
 * The 48 values of `Professional.speciality`.
 *
 * Read from the Mongoose enum by the schema itself, so this cannot drift from the
 * directory. Use the enum spelling — "Cardiology", never "Cardiologist": the plan generator
 * matches by substring in both directions and neither contains the other.
 */
export type Speciality = 'Allergy and Immunology' | 'Anesthesiology' | 'Cardiology' | 'Cardiothoracic Surgery' | 'Colorectal Surgery' | 'Critical Care Medicine' | 'Dermatology' | 'Emergency Medicine' | 'Endocrinology' | 'Family Medicine' | 'Gastroenterology' | 'General Surgery' | 'Geriatrics' | 'Hematology' | 'Hepatology' | 'Hospital Medicine' | 'Infectious Disease' | 'Internal Medicine' | 'Interventional Radiology' | 'Medical Genetics' | 'Neonatology' | 'Nephrology' | 'Neurology' | 'Neurosurgery' | 'Nuclear Medicine' | 'Obstetrics and Gynaecology (OB/GYN)' | 'Oncology' | 'Ophthalmology' | 'Orthopaedic Surgery' | 'Otolaryngology (ENT)' | 'Pain Management' | 'Palliative Care' | 'Pathology' | 'Paediatrics' | 'Physical Medicine and Rehabilitation (PM&R)' | 'Plastic Surgery' | 'Psychiatry' | 'Pulmonology' | 'Radiation Oncology' | 'Radiology' | 'Rheumatology' | 'Sleep Medicine' | 'Sports Medicine' | 'Thoracic Surgery' | 'Transplant Surgery' | 'Trauma Surgery' | 'Urology' | 'Vascular Surgery';

export type PlainSummaryTone = 'good' | 'watch' | 'act';

export type PlainSummaryOverall = 'mostly_good' | 'some_things_to_watch' | 'needs_attention';

export type Risk = {
    condition: string;
    level: RiskLevel;
    /** What the assessment rests on */
    basis: RiskBasis;
    rationale: string;
};

export type Screening = {
    /** Condition being screened for, e.g. "Hereditary Breast Cancer" */
    condition: string;
    /** Name of the test or scan, e.g. "Breast MRI" */
    test: string;
    /** Why this is recommended for THIS person, referencing their specific findings */
    rationale: string;
    /** Age at which surveillance should begin */
    starting_age: number;
    frequency: ScreeningFrequency;
    /** urgent = the recommended start age has already passed or a result demands prompt action */
    urgency: Urgency;
};

export type Consultation = {
    /** Why this person needs this specialist, citing the specific variant, value, or history. Write this BEFORE choosing the speciality. */
    reason: string;
    /** The speciality that best fits the reason above. Must be one of the listed values. */
    speciality: Speciality;
    urgency: Urgency;
    /** Months from today by which the consultation should happen */
    due_within_months: number;
};

export type LifestyleRecommendation = {
    area: LifestyleArea;
    recommendation: string;
    rationale: string;
};

export type BiomarkerOfConcern = {
    name: string;
    /** What the value and its trend show */
    observation: string;
    action: string;
};

/**
 * The analysis written for the person rather than for a clinician.
 *
 * A translation, never a second opinion: it carries no finding the clinical fields do not,
 * and softens none that they do.
 */
export type PlainSummary = {
    /** Two to four short sentences a 12-year-old could read aloud and understand. Everyday words only. Say what was looked at, what it showed, and whether it is something to act on. No test abbreviations, no numbers with clinical units, no hedging chains. */
    what_it_means: string;
    /** Two to four things worth knowing, in the order they matter. Fewer, clearer points beat a complete list. */
    key_points: ({
        /** What this point is about, in everyday words, at most 34 characters. Name what the thing does rather than what it is called: "Long-term blood sugar", not "HbA1c". */
        label: string;
        /** One sentence, plain words, saying what it shows and why it matters to them. */
        detail: string;
        /** good = doing well and worth knowing; watch = fine now but keep an eye on it; act = do something about this. Chosen to match the detail written above. */
        tone: PlainSummaryTone;
    })[];
    /** The single most useful thing this person can do next, in one plain sentence they could act on today. Not a list, not "consult your physician" unless that genuinely is the next step. */
    next_step: string;
    /** One short sentence, at most 12 words, that could be read on its own. Plain, calm, specific to them. Not a diagnosis and not a slogan. */
    headline: string;
    /** The honest tone of the whole picture, matching what was written above. needs_attention means something here should be acted on soon, not that they are in danger. */
    overall: PlainSummaryOverall;
};

/**
 * One interpretation's content.
 *
 * `plain_summary` and `changes_since_last` are optional **on the client** even though the
 * schema requires them: `Interpretation` is append-only, so rows written before those fields
 * existed are never rewritten. Every consumer falls back to `summary`.
 */
export type InterpretationContent = Omit<{
    /** Two to four sentences a non-clinician can understand. No alarmism, no false reassurance. */
    summary: string;
    risks: Risk[];
    recommended_screenings: Screening[];
    specialist_consultations: Consultation[];
    lifestyle_recommendations: LifestyleRecommendation[];
    /** Specific measured values worth attention, referencing the data provided */
    biomarkers_of_concern: BiomarkerOfConcern[];
    /** How the picture has changed since the previous interpretation, naming the values that moved and in which direction. When no previous interpretation is supplied, write exactly: "First interpretation — no previous assessment to compare against." */
    changes_since_last: string;
    /** When the person should next review their health overall */
    follow_up: string;
    /** What this interpretation could NOT assess, e.g. missing data or findings needing clinical correlation */
    limitations: string[];
    plain_summary: PlainSummary;
}, 'plain_summary' | 'changes_since_last'> & {
    /** Absent on anything generated before the plain-language layer existed. */
    plain_summary?: PlainSummary;
    /** Absent on a first-ever read, and on anything generated before this field existed. */
    changes_since_last?: string;
};

/** Every speciality, for a picker that must not offer an unmatchable value. */
export const SPECIALITIES = [
    "Allergy and Immunology",
    "Anesthesiology",
    "Cardiology",
    "Cardiothoracic Surgery",
    "Colorectal Surgery",
    "Critical Care Medicine",
    "Dermatology",
    "Emergency Medicine",
    "Endocrinology",
    "Family Medicine",
    "Gastroenterology",
    "General Surgery",
    "Geriatrics",
    "Hematology",
    "Hepatology",
    "Hospital Medicine",
    "Infectious Disease",
    "Internal Medicine",
    "Interventional Radiology",
    "Medical Genetics",
    "Neonatology",
    "Nephrology",
    "Neurology",
    "Neurosurgery",
    "Nuclear Medicine",
    "Obstetrics and Gynaecology (OB/GYN)",
    "Oncology",
    "Ophthalmology",
    "Orthopaedic Surgery",
    "Otolaryngology (ENT)",
    "Pain Management",
    "Palliative Care",
    "Pathology",
    "Paediatrics",
    "Physical Medicine and Rehabilitation (PM&R)",
    "Plastic Surgery",
    "Psychiatry",
    "Pulmonology",
    "Radiation Oncology",
    "Radiology",
    "Rheumatology",
    "Sleep Medicine",
    "Sports Medicine",
    "Thoracic Surgery",
    "Transplant Surgery",
    "Trauma Surgery",
    "Urology",
    "Vascular Surgery"
] as const;

/**
 * The fields a clinician may amend at sign-off — `AMENDABLE` in `reviewController.js`.
 *
 * An editor for a field absent from this list silently drops the edit: the server ignores an
 * unrecognised amendment rather than rejecting it, so nothing anywhere would say so.
 */
export const AMENDABLE_FIELDS = [
    "summary",
    "risks",
    "recommended_screenings",
    "specialist_consultations",
    "lifestyle_recommendations",
    "follow_up",
    "limitations"
] as const;

export type AmendableField = (typeof AMENDABLE_FIELDS)[number];
