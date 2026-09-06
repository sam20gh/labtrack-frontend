/**
 * The "Recent Checks" list behind the home screen's Symptom Checker card.
 *
 * **This stores what the person asked, never an answer to it.** `Design/sympt.svg` labels
 * each row "High Risk" / "Low Risk", and there is nothing in this product that could write
 * those words honestly — no diagnosis engine, no risk model, and deliberately so; see
 * **Symptom checker** in CLAUDE.md. A row therefore carries the three things the person
 * themselves supplied on `app/symptoms`: which symptoms, when they started, and how bad
 * they said it felt. `severityLabel()` is what fills the design's right-hand slot, and it
 * is quoting them rather than grading them.
 *
 * **Local, not server-side.** The check is already sent to the assistant, and
 * `Conversation` is the record of that — a second copy on the API would be the same
 * special-category data stored twice, which is the argument `AccessLog` makes about
 * content it audits. What lives here is a convenience for one device: a list of what you
 * last looked up, so the card can offer it back.
 *
 * Every function swallows its own storage failures and answers empty. A card that cannot
 * list your last two checks is a card that shows the browse link instead, which is a state
 * the design already has — it must never be a home screen that fails to paint.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEVERITIES, symptomById, type OnsetId, type SymptomDraft } from './symptoms';

const STORAGE_KEY = 'symptomChecks';

/** How many are kept. The card draws two, as the design does; the rest are history. */
const KEEP = 10;

export interface SymptomCheck {
    /** Millisecond timestamp of the check, and the row's key. */
    id: string;
    checkedAt: string;
    symptomIds: string[];
    onset: OnsetId | null;
    /** 1–5, as the person picked on the severity faces. Null when they skipped it. */
    severity: number | null;
}

/** Newest first. Never throws, and never returns a row whose symptoms have all been renamed away. */
export const listChecks = async (): Promise<SymptomCheck[]> => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isCheck).filter((c) => c.symptomIds.some((id) => symptomById(id)));
    } catch {
        return [];
    }
};

/**
 * Records a check that was actually sent. Called from `app/symptoms` *after* the assistant
 * has accepted the message — the same checkpoint `POST /nutrition/meals` puts between an
 * estimate and the record, so a check that was composed and abandoned leaves no trace.
 */
export const recordCheck = async (draft: SymptomDraft): Promise<void> => {
    const symptomIds = draft.symptomIds.filter((id) => symptomById(id));
    if (!symptomIds.length) return;

    try {
        const existing = await listChecks();
        const check: SymptomCheck = {
            id: String(Date.now()),
            checkedAt: new Date().toISOString(),
            symptomIds,
            onset: draft.onset,
            severity: draft.severity,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([check, ...existing].slice(0, KEEP)));
    } catch {
        /* A lost history entry must not cost the person the answer they just asked for. */
    }
};

export const clearChecks = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
        /* nothing to report */
    }
};

/** The row's title: the first symptom the person listed, in the catalogue's own wording. */
export const checkTitle = (check: SymptomCheck): string =>
    symptomById(check.symptomIds.find((id) => symptomById(id)) ?? '')?.label ?? 'Symptom check';

/**
 * The design's right-hand slot. It is the severity *they* chose, which is why it can be
 * written at all — "Severe" here means "they told us it was severe", not "this is severe".
 * Null severity reads as unrated rather than as mild: an unanswered question is not a low
 * score, the distinction `alignment: 'unassessed'` makes in nutrition.
 */
export const severityLabel = (check: SymptomCheck): string =>
    SEVERITIES.find((s) => s.level === check.severity)?.label ?? 'Not rated';

/**
 * Whether the row draws in the design's rose treatment rather than its violet one. The kit
 * uses the two to separate "High Risk" from "Low Risk"; here they separate a severity the
 * person called hard to ignore from one they did not. Nothing else in the card is coloured
 * by it, so it cannot read as a verdict on its own.
 */
export const isPressing = (check: SymptomCheck): boolean => (check.severity ?? 0) >= 4;

const isCheck = (value: unknown): value is SymptomCheck => {
    if (!value || typeof value !== 'object') return false;
    const c = value as Partial<SymptomCheck>;
    return typeof c.id === 'string'
        && typeof c.checkedAt === 'string'
        && Array.isArray(c.symptomIds)
        && c.symptomIds.every((id) => typeof id === 'string');
};
