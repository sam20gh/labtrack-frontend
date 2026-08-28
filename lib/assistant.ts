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

/**
 * How a message arrived, when it arrived as more than typed text.
 *
 * `image` carries the stored copy so the transcript can redraw the picture on reopen; `url`
 * is null when the server could not store it, and the bubble then says a photo was sent
 * without showing it. `voice` carries nothing — the words in `text` are the transcript, and
 * the recording itself is not kept. See `AttachmentSchema` in the backend's Conversation model.
 */
export type Attachment = {
    kind: 'image' | 'voice';
    url: string | null;
    mimeType: string | null;
};

export type AssistantMessage = {
    role: 'user' | 'assistant';
    text: string;
    attachment: Attachment | null;
    widget: AssistantWidget | null;
    suggestions: string[];
    /** The assistant judged this warrants speaking to a clinician promptly. */
    escalate: boolean;
    createdAt: string;
};

export type AssistantMode = 'chat' | 'immersive';

/**
 * Which inputs the composer may offer.
 *
 * Read from the server rather than assumed, because both depend on keys the app cannot
 * see: `vision` on the Claude key, `voice` on a separate transcription key that is
 * frequently unset. A microphone that looks live and fails on tap is worse than one that
 * arrives disabled with a reason — the line `nutrition/log.tsx` already takes.
 */
export type AssistantCapabilities = {
    text: boolean;
    vision: boolean;
    voice: boolean;
};

export type Conversation = {
    mode: AssistantMode;
    acceptedPrecautions: boolean;
    lifetimeMessages: number;
    clearedAt: string | null;
    messages: AssistantMessage[];
    /** False when the server has no model key configured. */
    available?: boolean;
    capabilities?: AssistantCapabilities;
};

/** A picture chosen from the camera or the library, in the shape `FormData` wants. */
export type ImageUpload = { uri: string; name: string; mimeType: string };

export const getConversation = () => api.get<Conversation>('/assistant/conversation');

export const getCapabilities = () => api.get<AssistantCapabilities>('/assistant/status');

type ChatResponse = { message: AssistantMessage; lifetimeMessages: number };

/**
 * Send one message.
 *
 * JSON when it is only words, multipart when a photograph comes with it. Kept as one
 * function because the caller's concern is the same either way — the branch is a transport
 * detail, and every screen that sends would otherwise have to know about it.
 *
 * `spoken` marks a transcript from Voice Mode. It changes nothing about the answer; it is
 * recorded so the bubble can show the words were spoken, which is what makes a
 * mis-transcription legible rather than baffling.
 */
export const sendMessage = (
    message: string,
    options: { image?: ImageUpload | null; spoken?: boolean } = {}
) => {
    const { image, spoken } = options;

    if (!image) {
        return api.post<ChatResponse>('/assistant/chat', { message, spoken: Boolean(spoken) });
    }

    const form = new FormData();
    form.append('message', message);
    if (spoken) form.append('spoken', 'true');
    // React Native's FormData takes this shape for file parts.
    form.append('image', { uri: image.uri, name: image.name, type: image.mimeType } as any);

    return api.post<ChatResponse>('/assistant/chat', form);
};

/**
 * Turn a recording into text. Writes nothing to the conversation.
 *
 * The separation is the point: Voice Mode shows the person their transcript and lets them
 * discard it, and that choice is only real if transcribing has not already sent anything.
 */
export const transcribe = async (
    recording: { uri: string; name: string; mimeType: string }
): Promise<string> => {
    const form = new FormData();
    form.append('audio', { uri: recording.uri, name: recording.name, type: recording.mimeType } as any);

    const { text } = await api.post<{ text: string }>('/assistant/transcribe', form);
    return text;
};

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
