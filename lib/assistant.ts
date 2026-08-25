/**
 * The AI assistant's client half.
 *
 * Types mirror `labtrack-backend/utils/assistantSchema.js` exactly. When the schema there
 * gains a widget kind, this file is the other half of that change — a card the backend can
 * emit and this cannot name renders as nothing at all, silently.
 */
import { api } from './api';

/** Clinical flags, matching `FlagColors` in `constants/theme.ts`. */
export type Flag = 'critical_low' | 'low' | 'normal' | 'high' | 'critical_high' | 'unknown';

/**
 * Which card to draw. Drives icon and accent; every kind shares the same card shell, so a
 * new kind is an entry here plus an icon, not a new component.
 */
export type WidgetKind =
    | 'biomarker'
    | 'trend'
    | 'health_score'
    | 'screenings'
    | 'professionals'
    | 'products'
    | 'medications'
    | 'goal'
    | 'summary';

export type WidgetStat = {
    label: string;
    value: string;
    unit: string | null;
    flag: Flag | null;
};

export type WidgetRow = {
    title: string;
    subtitle: string | null;
    meta: string | null;
    flag: Flag | null;
};

export type AssistantWidget = {
    kind: WidgetKind;
    title: string;
    subtitle: string | null;
    stats: WidgetStat[] | null;
    rows: WidgetRow[] | null;
    progress: { label: string; value: number; max: number } | null;
};

export type AssistantMessage = {
    role: 'user' | 'assistant';
    text: string;
    widget: AssistantWidget | null;
    suggestions: string[];
    /** The assistant judged this warrants speaking to a clinician promptly. */
    escalate: boolean;
    createdAt: string;
};

export type AssistantMode = 'chat' | 'immersive';

export type Conversation = {
    mode: AssistantMode;
    acceptedPrecautions: boolean;
    lifetimeMessages: number;
    clearedAt: string | null;
    messages: AssistantMessage[];
    /** False when the server has no model key configured. */
    available?: boolean;
};

export const getConversation = () => api.get<Conversation>('/assistant/conversation');

export const sendMessage = (message: string) =>
    api.post<{ message: AssistantMessage; lifetimeMessages: number }>('/assistant/chat', { message });

export const clearConversation = () => api.delete<Conversation>('/assistant/conversation');

export const savePreferences = (prefs: { mode?: AssistantMode; acceptedPrecautions?: boolean }) =>
    api.put<Conversation>('/assistant/preferences', prefs);

/**
 * Openers shown on an empty conversation.
 *
 * Hardcoded rather than generated: the empty state must render before any model call, and
 * the point of these is to demonstrate the range of what the assistant can reach — a lab
 * value, the plan, the catalogue, a clinician — which is a product decision, not an
 * inference from the person's data.
 */
export const STARTERS = [
    'How are my latest results looking?',
    "What's coming up on my health plan?",
    'Which of my markers changed the most?',
    'Should I see a specialist about anything?',
];

/** A local, human-readable timestamp for a message bubble. */
export const messageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
