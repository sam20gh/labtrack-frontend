/**
 * Medication checker client.
 *
 * Three things this module exists to keep true, each mirroring a guarantee the backend
 * makes. A screen that ignores one of them turns a safe design into an unsafe one:
 *
 *   1. **`identify` saves nothing.** It returns a draft for the person to confirm, and
 *      `createMedication` is the only call that writes. A drug name that reaches a
 *      medication list without a human confirming it reaches their interaction check too.
 *   2. **An empty findings list is not an all-clear.** Every check carries `uncheckable`
 *      and a `safetyNote`, and `interactionVerdict` below refuses to produce reassuring
 *      copy from an empty list. Render the verdict, not your own summary of the array.
 *   3. **`getCheck` never runs a check.** It reads the stored one and reports `stale`.
 *      Running one costs money and several seconds; a GET that did it would be called from
 *      a `useFocusEffect` and billed on every tab switch.
 */
import { api, apiFetch } from './api';
import { getAccessToken } from './auth';
import { API_URL } from '@/constants/config';
import type {
    TrackedMedication, TrackedMedicationDraft, MedicationDose, MedicationScheduleDay,
    MedicationCalendar, MedicationCheckResponse, MedicationCheck, InteractionPreview,
    MedicationIdentifyResult, MedicationInsight, MedicationStatus, MedicationCatalogueEntry,
    InteractionSeverity, InteractionFinding, MedicationFrequency, MedicationForm,
} from '@/types/api';

/**
 * Minutes west of UTC, as `Date.getTimezoneOffset()` reports it.
 *
 * Sent with every call that resolves a calendar day. The server cannot infer it, and
 * defaulting to UTC files an 11pm dose in the Americas under tomorrow — on the one screen
 * the feature is built around.
 */
const tzOffset = () => new Date().getTimezoneOffset();

/** Local `YYYY-MM-DD`, matching how the server stores `MedicationDose.day`. */
export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const addDays = (day: string, n: number): string =>
    new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const getStatus = () => api.get<MedicationStatus>('/medications/status');

// ── The list ─────────────────────────────────────────────────────────────────────────

export const listMedications = (includeArchived = false) =>
    api.get<{ medications: TrackedMedication[] }>(
        `/medications${includeArchived ? '?includeArchived=true' : ''}`
    );

/** The only call that writes a medication. */
export const createMedication = (medication: Partial<TrackedMedication> & { name: string }) =>
    api.post<{ medication: TrackedMedication }>('/medications', {
        ...medication,
        tzOffset: tzOffset(),
        startDay: medication.startDay || today(),
    });

export const updateMedication = (id: string, updates: Partial<TrackedMedication>) =>
    api.put<{ medication: TrackedMedication; rescheduled: boolean }>(`/medications/${id}`, {
        ...updates,
        tzOffset: updates.tzOffset ?? tzOffset(),
    });

/**
 * Archive a medication. The dose history survives.
 *
 * `purge` destroys it and everything taken under it. Only offer that where the person is
 * removing something added by mistake — "what was I on in March" is a question both they
 * and their clinician ask.
 */
export const deleteMedication = (id: string, purge = false) =>
    api.delete<{ deleted: boolean; purged: boolean }>(`/medications/${id}${purge ? '?purge=true' : ''}`);

// ── Schedule ─────────────────────────────────────────────────────────────────────────

export const getSchedule = (day?: string) =>
    api.get<MedicationScheduleDay>(
        `/medications/schedule?tzOffset=${tzOffset()}${day ? `&day=${day}` : ''}`
    );

export const getCalendar = (from?: string, to?: string) => {
    const params = new URLSearchParams({ tzOffset: String(tzOffset()) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return api.get<MedicationCalendar>(`/medications/calendar?${params}`);
};

export const getInsight = (days = 30) =>
    api.get<MedicationInsight>(`/medications/insight?days=${days}&tzOffset=${tzOffset()}`);

/** Take, skip, reschedule or undo one dose. */
export const updateDose = (
    id: string,
    action: 'take' | 'skip' | 'reschedule' | 'undo',
    options: { at?: string; note?: string } = {}
) =>
    apiFetch<{ dose: MedicationDose; remainingDoses: number | null; needsRefill: boolean }>(
        `/medications/doses/${id}`,
        { method: 'PATCH', body: { action, ...options } }
    );

// ── The catalogue ────────────────────────────────────────────────────────────────────

export const searchCatalogue = (q: string, limit = 25) =>
    api.get<{ query: string; count: number; results: MedicationCatalogueEntry[] }>(
        `/medications/catalogue?q=${encodeURIComponent(q)}&limit=${limit}`
    );

export const getCatalogueEntry = (name: string) =>
    api.get<MedicationCatalogueEntry & { foodInteractions: InteractionFinding[]; safetyNote: string }>(
        `/medications/catalogue/${encodeURIComponent(name)}`
    );

// ── Identification ───────────────────────────────────────────────────────────────────

/**
 * Photograph a pill, a blister strip or a box. Saves nothing.
 *
 * A box beats a loose tablet every time — thousands of generic tablets are round and white,
 * and the server sets `needsConfirmation` when the identification rests on appearance alone.
 * The scan-result screen must show `alternatives` in that case rather than one answer.
 */
export const identifyMedication = async (
    file: { uri: string; name: string; mimeType: string },
    note?: string
): Promise<MedicationIdentifyResult> => {
    const token = await getAccessToken();
    const form = new FormData();

    // React Native's FormData takes this shape for file parts
    form.append('image', { uri: file.uri, name: file.name, type: file.mimeType } as any);
    if (note) form.append('note', note);

    const response = await fetch(`${API_URL}/medications/identify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not analyse that photo');
    return data;
};

// ── Interaction checking ─────────────────────────────────────────────────────────────

/** Read the stored check. Never runs one — see `stale`. */
export const getCheck = () => api.get<MedicationCheckResponse>('/medications/check');

/** Run a fresh check. Costs a model call; only from an explicit tap. */
export const runCheck = () =>
    api.post<{ check: MedicationCheck; safetyNote: string; stale: false }>('/medications/check', {});

/**
 * "What would adding this introduce?" — rules only, instant, writes nothing.
 * Shown on the scan result before anything is added, because that is the moment the answer
 * changes what the person does.
 */
export const previewInteractions = (name: string) =>
    api.post<InteractionPreview>('/medications/check/preview', { name });

// ── Import from the health assessment ────────────────────────────────────────────────

export const previewImport = () =>
    api.post<{ candidates: { name: string; strength: string | null; notes: string | null }[]; count: number }>(
        '/medications/import',
        { dryRun: true }
    );

export const importMedications = (names?: string[]) =>
    api.post<{ imported: number; medications: TrackedMedication[] }>('/medications/import', {
        names,
        tzOffset: tzOffset(),
    });

// ── Presentation ─────────────────────────────────────────────────────────────────────

/**
 * How each severity is drawn.
 *
 * Three levels, no fourth for "fine". There is deliberately no green in this map: green on
 * an interaction screen reads as clearance, and clearance is the one thing this feature is
 * never in a position to give.
 */
export const SEVERITY_META: Record<InteractionSeverity, {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: string;
    /** What the person should do about it, in two words, for the card's header. */
    urgency: string;
}> = {
    severe: {
        label: 'Serious',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'warning',
        urgency: 'Ask before your next dose',
    },
    moderate: {
        label: 'Worth checking',
        color: '#B45309',
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: 'alert-circle',
        urgency: 'Raise it at your next appointment',
    },
    mild: {
        label: 'Good to know',
        color: '#1D4ED8',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        icon: 'information-circle',
        urgency: 'Usually solved by timing',
    },
};

export const KIND_LABEL: Record<string, string> = {
    drug: 'With another medicine',
    food: 'With food or drink',
    condition: 'With a condition on your record',
    timing: 'Timing',
    duplicate: 'Possible duplicate',
};

/**
 * The headline for an interaction check.
 *
 * **This function is the reason the screen cannot accidentally reassure anyone.** It never
 * returns a positive verdict from an empty findings array: with nothing found it reports
 * what was checked and what was not, and its `tone` is `neutral` rather than `clear`. There
 * is no `clear`.
 *
 * A screen that reads `findings.length === 0` and writes "No interactions found" has said
 * something the backend was careful never to say — the rule table only knows the medicines
 * the person entered, and only the ones in a catalogue of a few dozen drugs.
 */
export const interactionVerdict = (check: MedicationCheck | null): {
    title: string;
    detail: string;
    tone: 'severe' | 'moderate' | 'mild' | 'neutral';
} => {
    if (!check) {
        return {
            title: 'Not checked yet',
            detail: 'Run a check to see how your medicines sit together.',
            tone: 'neutral',
        };
    }

    const severe = check.findings.filter((f) => f.severity === 'severe').length;
    const moderate = check.findings.filter((f) => f.severity === 'moderate').length;
    const unchecked = check.uncheckable.length;

    const caveat = unchecked
        ? ` We could not check ${check.uncheckable.join(', ')}.`
        : '';

    if (severe) {
        return {
            title: severe === 1 ? '1 serious finding' : `${severe} serious findings`,
            detail: `Worth raising with a pharmacist before your next dose.${caveat}`,
            tone: 'severe',
        };
    }
    if (moderate) {
        return {
            title: moderate === 1 ? '1 thing to check' : `${moderate} things to check`,
            detail: `Worth mentioning at your next appointment.${caveat}`,
            tone: 'moderate',
        };
    }
    if (check.findings.length) {
        return {
            title: 'A few things to know',
            detail: `Mostly about when to take things.${caveat}`,
            tone: 'mild',
        };
    }

    // Nothing found. Deliberately not phrased as good news.
    return {
        title: `Nothing found in ${check.checkedCount} ${check.checkedCount === 1 ? 'medicine' : 'medicines'}`,
        detail: unchecked
            ? `We could not check ${check.uncheckable.join(', ')} at all. This is not an all-clear.`
            : 'Nothing came up among the medicines we could check. This is not an all-clear — your pharmacist sees things we cannot.',
        tone: 'neutral',
    };
};

export const FREQUENCY_LABEL: Record<MedicationFrequency, string> = {
    once: 'One time',
    daily: 'Once a day',
    twice_daily: 'Twice a day',
    three_times_daily: 'Three times a day',
    weekly: 'Once a week',
    specific_days: 'On chosen days',
    as_needed: 'When needed',
};

export const FORM_LABEL: Record<MedicationForm, string> = {
    tablet: 'Tablet',
    capsule: 'Capsule',
    liquid: 'Liquid',
    injection: 'Injection',
    inhaler: 'Inhaler',
    patch: 'Patch',
    drops: 'Drops',
    cream: 'Cream',
    other: 'Other',
};

export const WITH_FOOD_LABEL: Record<string, string> = {
    before_meal: 'Before food',
    with_meal: 'With food',
    after_meal: 'After food',
    any: 'Any time',
};

/** Su-first, matching the design's week strip and `Date.getUTCDay()`. */
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "09:00" → "9:00 AM", for display only. Storage stays 24h. */
export const formatTime = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h)) return time;
    const period = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

/** A one-line summary of when a medication is taken, for a list row. */
export const scheduleSummary = (m: TrackedMedication): string => {
    if (m.frequency === 'as_needed') return 'When needed';

    const times = (m.times || []).map(formatTime).join(', ');

    if (m.frequency === 'specific_days') {
        const days = (m.daysOfWeek || []).map((d) => WEEKDAY_NAMES[d]?.slice(0, 3)).join(', ');
        return days ? `${days}${times ? ` at ${times}` : ''}` : 'No days chosen yet';
    }
    if (m.frequency === 'weekly') {
        return `Weekly${times ? ` at ${times}` : ''}`;
    }
    if (m.frequency === 'once') {
        return `Once on ${m.startDay}${times ? ` at ${times}` : ''}`;
    }

    const every = m.intervalDays && m.intervalDays > 1 ? ` every ${m.intervalDays} days` : '';
    return `${FREQUENCY_LABEL[m.frequency]}${every}${times ? ` at ${times}` : ''}`;
};

/** The label under a medication's name: what it is, in the person's language. */
export const plainNameFor = (m: TrackedMedication): string | null =>
    m.catalogue?.plainName || null;
