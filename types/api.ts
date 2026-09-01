/**
 * Shared shapes for everything the LabTrack API returns.
 *
 * These mirror the Mongoose schemas in `labtrack-backend/models/`. Keeping them in one
 * place means screens stop writing `useState([])` — which TypeScript infers as `never[]`,
 * making every later `item.someField` an error and every `setState` a cast. That pattern
 * was the single largest source of type errors in this codebase.
 *
 * When a backend model changes, update the matching interface here in the same commit.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Mongo ObjectId as serialised over the wire. */
export type Id = string;

/** ISO-8601 timestamp as serialised over the wire. */
export type IsoDate = string;

export interface Timestamped {
    createdAt?: IsoDate;
    updatedAt?: IsoDate;
}

// ---------------------------------------------------------------------------
// User & health assessment
// ---------------------------------------------------------------------------

export type Sex = 'Male' | 'Female' | 'Other';

export interface Medication {
    _id?: Id;
    name: string;
    dosage?: string;
    frequency?: string;
    startDate?: IsoDate;
    endDate?: IsoDate;
    isCurrentlyTaking?: boolean;
    notes?: string;
}

export interface Allergy {
    _id?: Id;
    allergen: string;
    reaction?: string;
    severity?: 'Mild' | 'Moderate' | 'Severe';
    diagnosedDate?: IsoDate;
}

export interface Condition {
    _id?: Id;
    name: string;
    diagnosedDate?: IsoDate;
    status?: 'Active' | 'Managed' | 'Resolved';
    notes?: string;
}

export interface Checkup {
    _id?: Id;
    type: string;
    date: IsoDate;
    provider?: string;
    location?: string;
    findings?: string;
    nextScheduled?: IsoDate;
}

export interface HealthNote {
    _id?: Id;
    title?: string;
    content: string;
    category?: 'General' | 'Symptom' | 'Question' | 'Reminder' | 'Other';
    createdAt?: IsoDate;
}

export interface MoodEntry {
    _id?: Id;
    mood: 'Excellent' | 'Good' | 'Okay' | 'Poor' | 'Bad';
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    sleepHours?: number;
    notes?: string;
    date?: IsoDate;
}

export interface Lifestyle {
    smokingStatus?: 'Never' | 'Former' | 'Current' | 'Occasional';
    alcoholConsumption?: 'None' | 'Occasional' | 'Moderate' | 'Heavy';
    exerciseFrequency?: 'None' | 'Light' | 'Moderate' | 'Active' | 'Very Active';
    exerciseTypes?: string[];
    dietType?: string;
    occupation?: string;
    stressLevel?: 'Low' | 'Moderate' | 'High' | 'Very High';
    fitnessLevel?: string;
    sleepQuality?: number;
    sleepHoursPerNight?: number;
    checkupFrequency?: string;
}

export interface HealthAssessment {
    completedAt?: IsoDate;
    isComplete?: boolean;
    healthGoals?: string[];
    moodHistory?: MoodEntry[];
    nutritionGoals?: {
        dailyCalorieGoal?: number;
        dailyProteinGoal?: number;
        dailyCarbsGoal?: number;
        dailyFatGoal?: number;
        dailyWaterGoal?: number;
    };
    medications?: Medication[];
    allergies?: Allergy[];
    conditions?: Condition[];
    checkups?: Checkup[];
    notes?: HealthNote[];
    familyHistory?: { condition?: string; relation?: string; notes?: string }[];
    lifestyle?: Lifestyle;
    analysisPreferences?: {
        receiveAIRecommendations?: boolean;
        focusAreas?: string[];
        geneticFactorsConsidered?: boolean;
    };
}

export interface User extends Timestamped {
    _id: Id;
    supabaseId?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email: string;
    phone?: string;
    /**
     * Cloudflare delivery URL for the avatar, or null. Never image bytes — see
     * `lib/avatar.ts` and the field comment on `models/userModel.js`.
     */
    profileImage?: string | null;
    dob?: string;
    gender?: Sex | null;
    height?: number | null;
    weight?: number | null;
    bloodType?: string | null;
    healthAssessment?: HealthAssessment;
}

// ---------------------------------------------------------------------------
// Biomarkers
// ---------------------------------------------------------------------------

export type BiomarkerFlag =
    | 'critical_low' | 'low' | 'normal' | 'high' | 'critical_high' | 'unknown';

export interface AppliedRange {
    min?: number;
    max?: number;
    unit?: string;
    referenceRangeId?: Id;
    /** True when the band was narrowed for a variant in the user's DNA report. */
    geneAdjusted?: boolean;
}

export interface Biomarker extends Timestamped {
    _id: Id;
    userId: Id;
    /** Canonical key, e.g. 'ferritin'. Use `displayName` for UI. */
    name: string;
    displayName?: string;
    value: number;
    unit: string;
    measuredAt: IsoDate;
    testResultId?: Id;
    source?: 'lab_report' | 'manual_entry' | 'device' | 'imported';
    flag: BiomarkerFlag;
    appliedRange?: AppliedRange;
    reportedRange?: { min?: number; max?: number; raw?: string };
    needsReview?: boolean;
    notes?: string;
}

/** Row in the results grid: latest value plus movement since the previous one. */
/**
 * Plain-language explanation of one analyte, served by the API.
 *
 * Server-owned rather than bundled: this is clinical copy, and a description that turns out
 * to mislead has to be fixable without an app-store release. Absent for analytes outside
 * the catalogue, so every reader must handle `undefined`.
 */
export interface BiomarkerExplainer {
    /**
     * Properly spelled medical name. Present only for analytes outside the normaliser's
     * catalogue, whose stored `displayName` is the same run-together slug as `name`
     * ("redcelldistributionwidth"). Preferred over that slug as the row title.
     */
    label?: string;
    /** Lay label — "Iron stores", "Average red blood cell size". */
    plainName: string;
    whatItIs: string;
    whyItMatters: string;
    /** What an out-of-range value can point to. Hedged, never a diagnosis. */
    low: string;
    high: string;
}

export interface BiomarkerSummary {
    _id: Id;
    name: string;
    displayName?: string;
    explainer?: BiomarkerExplainer | null;
    value: number;
    unit: string;
    measuredAt: IsoDate;
    flag: BiomarkerFlag;
    appliedRange?: AppliedRange;
    previous?: { value: number; measuredAt: IsoDate };
    measurementCount: number;
    delta: number | null;
    direction: 'up' | 'down' | 'flat' | null;
}

export interface BiomarkerTrend {
    name: string;
    displayName?: string;
    unit?: string;
    explainer?: BiomarkerExplainer | null;
    series: Pick<Biomarker, 'value' | 'unit' | 'measuredAt' | 'flag' | 'appliedRange' | 'testResultId'>[];
    range: AppliedRange | null;
    summary: {
        count: number;
        first: number;
        last: number;
        change: number;
        direction: 'up' | 'down' | 'flat';
        min: number;
        max: number;
        outOfRangeCount: number;
    } | null;
}

export interface ReferenceRange {
    _id: Id;
    biomarker: string;
    displayName?: string;
    unit: string;
    sex: 'male' | 'female' | 'any';
    ageMin: number;
    ageMax: number;
    min?: number;
    max?: number;
    criticalMin?: number;
    criticalMax?: number;
    source?: string;
}

// ---------------------------------------------------------------------------
// DNA
// ---------------------------------------------------------------------------

export type VariantSignificance =
    | 'pathogenic' | 'likely_pathogenic' | 'vus' | 'likely_benign' | 'benign' | 'unknown';

export interface Mutation {
    _id?: Id;
    gene: string;
    variant?: string;
    rsid?: string;
    zygosity?: 'heterozygous' | 'homozygous' | 'hemizygous' | 'unknown';
    significance: VariantSignificance;
    condition?: string;
    notes?: string;
}

export type DnaReportStatus =
    | 'uploaded' | 'parsing' | 'ai_interpreted' | 'specialist_reviewed' | 'failed';

export interface DnaReport extends Timestamped {
    _id: Id;
    userId: Id;
    labName?: string;
    reportDate?: IsoDate;
    documentUrl?: string;
    mutations: Mutation[];
    status: DnaReportStatus;
    aiInterpretation?: {
        summary?: string;
        risks?: { condition?: string; level?: 'low' | 'moderate' | 'high' | 'unknown'; rationale?: string }[];
        /**
         * The complete structured output, kept so an interpretation can be re-read or
         * amended without another model call. Loosely typed on purpose: the schema in
         * `interpretationSchema.js` is the contract, and mirroring it here would be a
         * second definition to keep in step.
         */
        raw?: Record<string, any>;
        model?: string;
        generatedAt?: IsoDate;
    };
    specialistReview?: {
        professionalId?: Id;
        reviewedAt?: IsoDate;
        approved?: boolean;
        notes?: string;
    };
    /** True only once a professional has signed the interpretation off. */
    isClinicallyReviewed?: boolean;
    failureReason?: string;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type PlanItemStatus =
    | 'upcoming' | 'due' | 'urgent' | 'ordered' | 'booked' | 'completed' | 'dismissed';

export type PlanItemType = 'test' | 'scan' | 'consultation' | 'assessment' | 'lifestyle';

export interface PlanItem extends Timestamped {
    _id: Id;
    userId: Id;
    planId?: Id;
    type: PlanItemType;
    title: string;
    description?: string;
    condition?: string;
    frequency?: string;
    dueDate: IsoDate;
    status: PlanItemStatus;
    urgency?: 'low' | 'moderate' | 'high';
    source?: 'ai' | 'specialist' | 'user' | 'system';
    productId?: Id;
    productName?: string;
    professionalId?: Id;
    professionalName?: string;
    speciality?: string;
    image?: string | null;
    orderId?: Id;
    appointmentId?: Id;
    resultingTestResultId?: Id;
    completedAt?: IsoDate;
}

/** Keyed by 'urgent' or a four-digit year. */
export type GroupedPlanItems = Record<string, PlanItem[]>;

// ---------------------------------------------------------------------------
// Catalogue, orders, appointments
// ---------------------------------------------------------------------------

export interface Product {
    _id: Id;
    name: string;
    sku: string;
    description?: string;
    image?: string;
    type?: string;
    price: number;
}

export type OrderStatus =
    | 'pending_payment' | 'placed' | 'kit_sent' | 'sample_received'
    | 'processing' | 'resulted' | 'cancelled' | 'refunded';

export interface OrderItem {
    _id?: Id;
    productId: Id;
    name: string;
    price: number;
    quantity: number;
    planItemId?: Id;
}

export interface Order extends Timestamped {
    _id: Id;
    userId: Id;
    items: OrderItem[];
    currency: string;
    subtotal: number;
    total: number;
    status: OrderStatus;
    payment?: { provider?: string; status?: 'unpaid' | 'paid' | 'refunded' | 'failed'; paidAt?: IsoDate };
    shippingAddress?: {
        line1?: string; line2?: string; city?: string; postcode?: string; country?: string;
    };
    trackingReference?: string;
    statusHistory?: { status: string; at: IsoDate; note?: string }[];
    testResultId?: Id;
    dnaReportId?: Id;
}

export interface Professional {
    _id: Id;
    firstname: string;
    lastname: string;
    /** Constrained to the 48-value enum in `models/Professional.js`. */
    speciality: string[];
    hourly_rate: number;
    profile_image?: string;
    description?: string;
    address?: string;
    postcode?: string;
    country?: string;
}

export type AppointmentStatus =
    | 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Appointment extends Timestamped {
    _id: Id;
    userId: Id;
    /** Populated on list endpoints, a bare id elsewhere. */
    professionalId: Id | Professional;
    planItemId?: Id;
    scheduledFor: IsoDate;
    durationMinutes?: number;
    mode?: 'video' | 'phone' | 'in_person';
    status: AppointmentStatus;
    priceAtBooking?: number;
    currency?: string;
    reasonForVisit?: string;
    outcomeNotes?: string;
}

// ---------------------------------------------------------------------------
// Test results
// ---------------------------------------------------------------------------

export interface TestResult extends Timestamped {
    _id: Id;
    patient: {
        user_id: Id;
        date_of_test: IsoDate;
        lab_name: string;
        test_type: string;
    };
    results: Record<string, unknown>;
    interpretation?: string;
    documentUrl?: string;
    source?: 'manual_entry' | 'document_upload' | 'lab_integration' | 'imported';
    parseStatus?: 'not_parsed' | 'parsing' | 'parsed' | 'needs_review' | 'failed';
    biomarkerCount?: number;
    orderId?: Id;
    planItemId?: Id;
}

/** Output of `utils/feedbackParser.js` — keyword extraction over AI feedback text. */
export interface StructuredPlan {
    recommended_screenings?: {
        condition?: string;
        test?: string;
        starting_age?: number;
        frequency?: string;
    }[];
    lifestyle_recommendations?: string[];
    specialist_consultations?: { speciality?: string; urgency?: string }[];
    follow_up?: string;
}

/** Legacy plan document. Superseded by PlanItem; still returned by /api/plans. */
export interface Plan extends Timestamped {
    _id: Id;
    structured_plan?: StructuredPlan | null;
    plan: {
        type: string;
        test?: string;
        speciality?: string;
        age?: number;
        year?: number;
        productID?: Id;
        productName?: string;
        professionalID?: Id;
        professionalName?: string;
        image?: string | null;
    }[];
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export interface BiomarkersResponse { biomarkers: BiomarkerSummary[] }
export interface PlanItemsResponse { items: PlanItem[]; grouped: GroupedPlanItems }
export interface OrdersResponse { orders: Order[] }
export interface AppointmentsResponse { appointments: Appointment[] }
export interface DnaReportsResponse { reports: DnaReport[] }
export interface PlansResponse { plans: Plan[] }
export interface HealthAssessmentResponse { healthAssessment: HealthAssessment }

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/**
 * One dietary directive, derived from a `PlanItem` of type 'lifestyle' with
 * condition 'diet'. `directive` is the interpretation's own wording — the tracker shows it
 * verbatim rather than paraphrasing clinical advice.
 */
export interface NutritionGuidance {
    planItemId?: Id;
    key: string;
    kind: 'pattern' | 'emphasise' | 'reduce' | 'other';
    label?: string;
    directive: string;
    rationale?: string;
    emphasise?: string[];
    reduce?: string[];
}

export interface NutritionTargets {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    water?: number | null;
}

export interface NutritionPlan extends Timestamped {
    _id: Id;
    userId: Id;
    targets: NutritionTargets;
    split?: { protein: number; carbs: number; fat: number };
    basis?: {
        method: 'mifflin_st_jeor' | 'user';
        bmr?: number;
        activity?: string;
        activityFactor?: number;
        calories?: number;
    };
    guidance: NutritionGuidance[];
    calorieOverride?: number | null;
    mealsPerDay?: number;
    dietaryPreferences?: string[];
    notes?: string;
    allergies?: string[];
    guidanceSyncedAt?: IsoDate;
}

export type MealAlignment = 'aligned' | 'partial' | 'off_plan' | 'unassessed';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealSource = 'photo' | 'description' | 'manual' | 'swap';

export interface MealItem {
    name: string;
    quantity?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

export interface MealAnalysis {
    confidence?: number;
    alignment: MealAlignment;
    rationale?: string;
    guidanceKeys?: string[];
    swap?: {
        name: string;
        why: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    model?: string;
}

export interface MealLog extends Timestamped {
    _id: Id;
    userId: Id;
    eatenAt: IsoDate;
    /** Local calendar day, `YYYY-MM-DD`. */
    day: string;
    mealType: MealType;
    name: string;
    servings: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre?: number;
    sodium?: number;
    items?: MealItem[];
    source: MealSource;
    imageUrl?: string | null;
    analysis?: MealAnalysis;
}

/** A meal the analyser proposed. Not saved until the person confirms it. */
export type MealDraft = Omit<MealLog, '_id' | 'userId' | 'eatenAt' | 'day' | 'createdAt' | 'updatedAt'>;

export interface NutritionAdherence {
    assessed: number;
    aligned: number;
    partial: number;
    offPlan: number;
    /** Null when no meal had guidance to be measured against — not the same as zero. */
    score: number | null;
}

export interface NutritionDay {
    day: string;
    plan: NutritionPlan | null;
    meals: MealLog[];
    totals: { calories: number; protein: number; carbs: number; fat: number };
    targets: NutritionTargets | Record<string, never>;
    remaining: number | null;
    overBy: number;
    adherence: NutritionAdherence;
}

export interface NutritionHistoryEntry extends Omit<NutritionDay, 'plan' | 'meals'> {
    mealCount: number;
}

/**
 * One photographed meal, as the gallery lists it.
 *
 * A projection of `MealLog`, not the whole document: the gallery draws a tile and a caption
 * and never needs `items[]` or the analyser's rationale, and a hundred tiles carrying them
 * is a payload nobody reads.
 */
export interface NutritionGalleryItem {
    _id: Id;
    imageUrl: string;
    name: string;
    mealType: MealType;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Local calendar day, `YYYY-MM-DD` — what the grid groups on. */
    day: string;
    eatenAt: IsoDate;
    source: MealSource;
    alignment: MealAlignment;
}

export interface NutritionGallery {
    items: NutritionGalleryItem[];
    /** Every photograph on record, so a rail can caption itself without fetching them all. */
    total: number;
    /** Pass back as `before` for the next page. Null when this was the last one. */
    nextCursor: IsoDate | null;
}

export interface NutritionStatus {
    photoAnalysis: boolean;
    descriptionAnalysis: boolean;
    manualEntry: boolean;
    model: string | null;
    acceptedTypes: string[];
    maxBytes: number;
}

/**
 * One meal, as the Nutrition Details screen reads it.
 *
 * `percentOfDay` is null per macro when the plan has no target for it — a bar drawn
 * against a target nobody set is a number with no denominator, so the screen omits it.
 */
export interface NutritionMealDetail {
    meal: MealLog;
    targets: NutritionTargets | null;
    percentOfDay: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
    dayContext: NutritionHistoryEntry;
    /** The person's own photographs of meals by this name. Never stock imagery. */
    photos: { _id: Id; imageUrl: string; eatenAt: IsoDate; day: string }[];
    /** The plan guidance this meal was actually judged against. */
    guidance: NutritionGuidance[];
}

/** Average intake for one weekday over the window. Null where that weekday was never logged. */
export interface NutritionWeekday {
    label: string;
    days: number;
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
}

export interface NutritionGoalProgress {
    key: 'protein' | 'carbs' | 'fat';
    average: number | null;
    target: number | null;
    /** average / target, uncapped so an overshoot is visible. Null when either is missing. */
    ratio: number | null;
    reached: boolean | null;
}

/**
 * The Nutrition Insight window.
 *
 * `averages` divides by `loggedDays`, not by `windowDays`. A blank day is absent from
 * `days[]` rather than present as a zero, so a fortnight's gap does not read as a
 * fortnight of starvation.
 */
export interface NutritionInsight {
    from: string;
    to: string;
    windowDays: number;
    loggedDays: number;
    mealCount: number;
    targets: NutritionTargets | null;
    guidance: NutritionGuidance[];
    totals: { calories: number; protein: number; carbs: number; fat: number; fibre: number };
    averages: {
        calories: number; protein: number; carbs: number; fat: number; fibre: number; meals: number;
    } | null;
    days: { day: string; mealCount: number; totals: { calories: number; protein: number; carbs: number; fat: number; fibre: number } }[];
    weekdays: NutritionWeekday[];
    goals: NutritionGoalProgress[];
    averageCalories: number | null;
    calorieTarget: number | null;
}

/** One day that had meals on it. Days with nothing logged are absent, never zeroed. */
export interface NutritionCalendarDay {
    day: string;
    mealCount: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealTypes: MealType[];
    /** Null, not false, when no calorie target is set. */
    meetsTarget: boolean | null;
}

export interface NutritionCalendar {
    from: string;
    to: string;
    target: number | null;
    days: NutritionCalendarDay[];
}

/**
 * One suggested meal.
 *
 * Every one of these has already passed `nutritionSafety.screen()` on the server, which
 * drops rather than flags: a suggestion that reaches the client is one the person can eat.
 * `ingredients` is listed on the detail sheet so they can check for themselves anyway.
 */
export interface MealSuggestion {
    name: string;
    mealType: MealType;
    why?: string;
    ingredients: string[];
    tags: string[];
    prepMinutes?: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre?: number;
    guidanceKeys: string[];
}

export interface NutritionRecommendations {
    /** False when the model is unreachable. The rail then draws a reason, not an error. */
    available: boolean;
    reason?: string;
    headline?: string;
    suggestions: MealSuggestion[];
    /**
     * Whether the person's health plan actually had dietary advice behind this set. When
     * false the rail says the suggestions are general — generic advice must not borrow the
     * plan's authority, the same line `alignment: 'unassessed'` holds.
     */
    grounded: boolean;
    day?: string;
    cached?: boolean;
    createdAt?: IsoDate;
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export type MedicationForm =
    | 'tablet' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'patch' | 'drops' | 'cream' | 'other';

export type MedicationFrequency =
    | 'once' | 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'specific_days' | 'as_needed';

export type MedicationShape =
    | 'round' | 'oval' | 'oblong' | 'capsule' | 'square' | 'triangle' | 'diamond' | 'pentagon'
    | 'hexagon' | 'teardrop' | 'shield' | 'trapezoid' | 'long' | 'rectangle' | 'circle' | 'other';

export type DoseStatus = 'scheduled' | 'taken' | 'skipped';

/** Worst first. There is no "none" — an absent severity is `null`, and never means "safe". */
export type InteractionSeverity = 'severe' | 'moderate' | 'mild';

export type InteractionKind = 'drug' | 'food' | 'condition' | 'timing' | 'duplicate';

/**
 * Where a finding came from.
 *
 * `rule` is the deterministic table in `medicationCatalogue.js` and is reproducible.
 * `model` was added by Claude on top of it. The UI labels them differently: someone
 * deciding whether to ring their pharmacy is entitled to know which they are reading.
 */
export type FindingSource = 'rule' | 'model';

/** Plain-language copy for one drug, served from the backend catalogue. */
export interface MedicationCatalogueEntry {
    key: string;
    plainName: string;
    brandNames: string[];
    treats?: string;
    whatItIs?: string;
    whyItMatters?: string;
    form?: MedicationForm;
    prescriptionOnly?: boolean;
    storage?: string;
    sideEffects?: { minor: string[]; serious: string[] };
    classes?: string[];
}

export interface MedicationIdentification {
    confidence?: number;
    basis?: string;
    surface?: string;
    alternatives?: { name: string; why: string }[];
    warnings?: string[];
    model?: string;
}

/**
 * A medicine on the person's tracked list — the medication checker's own collection.
 *
 * Deliberately NOT the `Medication` interface above. That one mirrors
 * `User.healthAssessment.medications`: free text captured once during onboarding, a snapshot
 * of what someone typed in a form. This one has a schedule, a dose history and an
 * interaction check hanging off it, and is authoritative for the checker.
 *
 * They are reconciled in one direction only, by `importFromAssessment`. See the note at the
 * bottom of `labtrack-backend/models/Medication.js`.
 */
export interface TrackedMedication extends Timestamped {
    _id: Id;
    userId: Id;
    name: string;
    brandName?: string | null;
    strength?: string | null;
    form: MedicationForm;
    shape?: MedicationShape | null;
    colour?: string | null;
    imprint?: string | null;

    frequency: MedicationFrequency;
    times: string[];
    daysOfWeek: number[];
    intervalDays?: number;
    startDay: string;
    endDay?: string | null;
    tzOffset: number;

    dose?: string | null;
    withFood?: 'before_meal' | 'with_meal' | 'after_meal' | 'any' | null;

    remainingDoses?: number | null;
    refillReminder: boolean;
    refillThreshold: number;

    source: 'scan' | 'search' | 'catalogue' | 'manual' | 'assessment';
    identification?: MedicationIdentification;
    imageUrl?: string | null;
    notes?: string | null;

    active: boolean;
    archivedAt?: IsoDate | null;
    remindersEnabled: boolean;

    /** Attached by the API where the catalogue knows the drug. Absent is normal. */
    catalogue?: MedicationCatalogueEntry | null;
    needsRefill?: boolean;
}

/** A medication the scanner proposed. Not saved until the person confirms it. */
export interface TrackedMedicationDraft {
    name: string;
    brandName?: string | null;
    strength?: string | null;
    form: MedicationForm;
    shape?: MedicationShape | null;
    colour?: string | null;
    imprint?: string | null;
    source: 'scan';
    identification: MedicationIdentification;
    imageUrl?: string | null;
}

export interface MedicationDose {
    _id: Id;
    userId: Id;
    medicationId: Id;
    day: string;
    time: string;
    scheduledFor: IsoDate;
    status: DoseStatus;
    takenAt?: IsoDate | null;
    rescheduledTo?: IsoDate | null;
    note?: string | null;
    medicationName: string;
    /** Computed server-side from `takenAt` against `scheduledFor`. Null unless taken. */
    punctuality?: 'on_time' | 'late' | null;
    medication?: {
        _id: Id;
        name: string;
        brandName?: string | null;
        strength?: string | null;
        form: MedicationForm;
        shape?: MedicationShape | null;
        colour?: string | null;
        dose?: string | null;
        withFood?: string | null;
        plainName?: string | null;
    } | null;
}

/**
 * Adherence over a set of doses.
 *
 * `score` is null, never 0, when nothing has come due — the same distinction
 * `NutritionAdherence` makes. Rendering 0% tells someone they failed at something that has
 * not happened yet.
 */
export interface MedicationAdherence {
    assessed: number;
    taken: number;
    onTime: number;
    late: number;
    skipped: number;
    missed: number;
    pending: number;
    score: number | null;
    onTimeRate: number | null;
    lateRate: number | null;
    missedRate: number | null;
}

export interface MedicationScheduleDay {
    day: string;
    doses: MedicationDose[];
    adherence: MedicationAdherence;
}

export interface CalendarDay {
    day: string;
    total: number;
    taken: number;
    skipped: number;
    missed: number;
    pending: number;
    status: 'taken' | 'partial' | 'missed' | 'skipped' | 'upcoming';
}

export interface MedicationCalendar {
    from: string;
    to: string;
    days: CalendarDay[];
    adherence: MedicationAdherence;
}

export interface InteractionFinding {
    id?: string;
    kind: InteractionKind;
    severity: InteractionSeverity;
    source: FindingSource;
    /** Exactly two: two medicines, or a medicine and a food, condition or activity. */
    between: string[];
    effect: string;
    action: string;
}

export interface MedicationCheck extends Timestamped {
    _id: Id;
    userId: Id;
    medicationNames: string[];
    summary: string;
    findings: InteractionFinding[];
    /**
     * Medicines the catalogue could not classify.
     *
     * Must be rendered. These were not tested against anything, and findings shown without
     * them imply a completeness the check does not have.
     */
    uncheckable: string[];
    checkedCount: number;
    timingAdvice: { medication: string; advice: string }[];
    questionsForClinician: string[];
    worstSeverity: InteractionSeverity | null;
    /** The check ran on rules alone because no model was available. Still valid, still labelled. */
    degraded: boolean;
    model?: string | null;
    generatedAt: IsoDate;
}

export interface MedicationCheckResponse {
    check: MedicationCheck | null;
    /** The medication list has changed since this check ran. Offer to re-run it. */
    stale: boolean;
    medicationCount: number;
    safetyNote: string;
}

/** "What if I added this?" — rules only, instant, writes nothing. */
export interface InteractionPreview {
    name: string;
    known: boolean;
    catalogue: MedicationCatalogueEntry | null;
    /** Only what this addition would introduce, not what the person already had. */
    introduced: InteractionFinding[];
    worstSeverity: InteractionSeverity | null;
    /** True when the candidate could not be classified — an empty list is NOT reassurance. */
    uncheckable: boolean;
    safetyNote: string;
}

export interface MedicationIdentifyResult {
    detected: boolean;
    message?: string;
    hint?: string;
    draft?: TrackedMedicationDraft;
    catalogue?: MedicationCatalogueEntry | null;
    confidence?: number;
    /** The identification rests on appearance alone; show alternatives, not one answer. */
    needsConfirmation?: boolean;
    alternatives?: { name: string; why: string }[];
    warnings?: string[];
    basis?: string;
    model?: string;
}

export interface MedicationInsight {
    from: string;
    to: string;
    days: number;
    totalTaken: number;
    adherence: MedicationAdherence;
    mostConsumed: { medicationId: Id; name: string; taken: number } | null;
    perMedication: {
        medicationId: Id;
        name: string;
        plainName: string | null;
        taken: number;
        adherence: MedicationAdherence;
    }[];
    weekdays: { taken: number; late: number; missed: number }[];
}

export interface MedicationStatus {
    scan: boolean;
    /** True even without an API key — the rule table needs no model. */
    interactionCheck: boolean;
    aiReview: boolean;
    catalogueSize: number;
    identifyModel: string | null;
    reviewModel: string | null;
    acceptedTypes: string[];
    maxBytes: number;
    confidenceThreshold: number;
}
