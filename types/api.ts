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
export interface BiomarkerSummary {
    _id: Id;
    name: string;
    displayName?: string;
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
    speciality: string[];
    hourly_rate: number;
    profile_image?: string;
    description?: string;
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
