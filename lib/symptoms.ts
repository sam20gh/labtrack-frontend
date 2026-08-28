/**
 * The symptom catalogue behind `app/symptoms`.
 *
 * The turing kit's Symptom Checker browses a 3D anatomy model — muscle mode, organ mode,
 * 44 muscles, 113 conditions per organ. There is no such model in this app and no API
 * behind one, so the browse step is a flat body-area index instead. It answers the same
 * question the model answers ("I know where it hurts, not what it is called") without
 * pretending to an anatomical precision nothing here can back.
 *
 * The list is deliberately lay-worded, for the same reason `biomarkerGlossary.js` is: a
 * member of the public searching "tummy ache" should not have to know the word
 * "abdominal". `aliases` carry those everyday spellings into the search index.
 *
 * **This is not a diagnostic taxonomy.** Nothing here maps to ICD or SNOMED, and nothing
 * downstream treats a selection as a finding. The selections become one sentence for the
 * assistant to read — `buildAssistantMessage` — and the assistant answers under the same
 * precautions every other conversation does.
 */
import type { Ionicons, MaterialIcons } from '@expo/vector-icons';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
/** The five severity faces come from MaterialIcons — Ionicons has two, not five. */
export type FaceName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface BodyArea {
    id: string;
    label: string;
    icon: IconName;
}

export interface Symptom {
    id: string;
    label: string;
    areaId: string;
    /** Everyday phrasings, searched but never displayed. */
    aliases?: string[];
}

export const BODY_AREAS: BodyArea[] = [
    { id: 'head', label: 'Head & face', icon: 'happy-outline' },
    { id: 'senses', label: 'Eyes, ears & throat', icon: 'eye-outline' },
    { id: 'chest', label: 'Chest & breathing', icon: 'fitness-outline' },
    { id: 'heart', label: 'Heart & circulation', icon: 'heart-outline' },
    { id: 'abdomen', label: 'Stomach & digestion', icon: 'nutrition-outline' },
    { id: 'back', label: 'Back & spine', icon: 'body-outline' },
    { id: 'arms', label: 'Arms & hands', icon: 'hand-left-outline' },
    { id: 'legs', label: 'Legs & feet', icon: 'walk-outline' },
    { id: 'skin', label: 'Skin, hair & nails', icon: 'bandage-outline' },
    { id: 'urinary', label: 'Urinary & pelvic', icon: 'water-outline' },
    { id: 'mind', label: 'Mood & sleep', icon: 'moon-outline' },
    { id: 'general', label: 'Whole body', icon: 'thermometer-outline' },
];

export const SYMPTOMS: Symptom[] = [
    // Head & face
    { id: 'headache', label: 'Headache', areaId: 'head', aliases: ['head pain', 'migraine'] },
    { id: 'migraine-aura', label: 'Migraine with visual aura', areaId: 'head' },
    { id: 'dizziness', label: 'Dizziness or light-headedness', areaId: 'head', aliases: ['vertigo', 'faint'] },
    { id: 'face-numbness', label: 'Numbness in the face', areaId: 'head' },
    { id: 'jaw-pain', label: 'Jaw pain or clicking', areaId: 'head' },
    { id: 'sinus-pressure', label: 'Sinus pressure', areaId: 'head', aliases: ['blocked nose'] },
    { id: 'head-injury', label: 'Recent knock to the head', areaId: 'head', aliases: ['concussion'] },

    // Eyes, ears & throat
    { id: 'blurred-vision', label: 'Blurred vision', areaId: 'senses', aliases: ['cant see clearly'] },
    { id: 'eye-pain', label: 'Eye pain or redness', areaId: 'senses', aliases: ['sore eye'] },
    { id: 'light-sensitivity', label: 'Sensitivity to light', areaId: 'senses' },
    { id: 'ear-pain', label: 'Earache', areaId: 'senses', aliases: ['ear pain'] },
    { id: 'ringing-ears', label: 'Ringing in the ears', areaId: 'senses', aliases: ['tinnitus'] },
    { id: 'hearing-loss', label: 'Reduced hearing', areaId: 'senses' },
    { id: 'sore-throat', label: 'Sore throat', areaId: 'senses' },
    { id: 'hoarse-voice', label: 'Hoarse voice', areaId: 'senses' },
    { id: 'trouble-swallowing', label: 'Trouble swallowing', areaId: 'senses' },

    // Chest & breathing
    { id: 'chest-pain', label: 'Chest pain or tightness', areaId: 'chest', aliases: ['chest ache'] },
    { id: 'breathlessness', label: 'Shortness of breath', areaId: 'chest', aliases: ['cant breathe', 'winded'] },
    { id: 'wheezing', label: 'Wheezing', areaId: 'chest' },
    { id: 'dry-cough', label: 'Dry cough', areaId: 'chest' },
    { id: 'productive-cough', label: 'Cough with phlegm', areaId: 'chest', aliases: ['mucus'] },
    { id: 'coughing-blood', label: 'Coughing up blood', areaId: 'chest' },
    { id: 'rib-pain', label: 'Pain when breathing in', areaId: 'chest' },

    // Heart & circulation
    { id: 'palpitations', label: 'Racing or skipped heartbeat', areaId: 'heart', aliases: ['palpitations', 'fluttering'] },
    { id: 'slow-pulse', label: 'Unusually slow pulse', areaId: 'heart' },
    { id: 'ankle-swelling', label: 'Swollen ankles', areaId: 'heart', aliases: ['puffy feet', 'oedema', 'edema'] },
    { id: 'cold-hands', label: 'Cold hands or feet', areaId: 'heart' },
    { id: 'fainting', label: 'Fainting or blackouts', areaId: 'heart', aliases: ['passed out'] },
    { id: 'high-bp-reading', label: 'A high blood pressure reading', areaId: 'heart' },

    // Stomach & digestion
    { id: 'stomach-pain', label: 'Stomach pain', areaId: 'abdomen', aliases: ['tummy ache', 'belly pain', 'abdominal pain'] },
    { id: 'bloating', label: 'Bloating', areaId: 'abdomen' },
    { id: 'nausea', label: 'Nausea', areaId: 'abdomen', aliases: ['feeling sick'] },
    { id: 'vomiting', label: 'Vomiting', areaId: 'abdomen', aliases: ['throwing up'] },
    { id: 'heartburn', label: 'Heartburn or reflux', areaId: 'abdomen', aliases: ['acid', 'indigestion'] },
    { id: 'diarrhoea', label: 'Diarrhoea', areaId: 'abdomen', aliases: ['diarrhea', 'loose stools'] },
    { id: 'constipation', label: 'Constipation', areaId: 'abdomen' },
    { id: 'blood-in-stool', label: 'Blood in the stool', areaId: 'abdomen', aliases: ['rectal bleeding'] },
    { id: 'appetite-loss', label: 'Loss of appetite', areaId: 'abdomen' },

    // Back & spine
    { id: 'lower-back-pain', label: 'Lower back pain', areaId: 'back', aliases: ['lumbar'] },
    { id: 'upper-back-pain', label: 'Upper back pain', areaId: 'back' },
    { id: 'neck-pain', label: 'Neck pain or stiffness', areaId: 'back' },
    { id: 'sciatica', label: 'Pain shooting down the leg', areaId: 'back', aliases: ['sciatica'] },
    { id: 'back-stiffness', label: 'Stiffness after resting', areaId: 'back' },

    // Arms & hands
    { id: 'shoulder-pain', label: 'Shoulder pain', areaId: 'arms' },
    { id: 'shoulder-weakness', label: 'Weakness lifting the arm', areaId: 'arms' },
    { id: 'elbow-pain', label: 'Elbow pain', areaId: 'arms' },
    { id: 'wrist-pain', label: 'Wrist pain', areaId: 'arms' },
    { id: 'hand-tingling', label: 'Tingling in the hand', areaId: 'arms', aliases: ['pins and needles'] },
    { id: 'hand-tremor', label: 'Shaking hands', areaId: 'arms', aliases: ['tremor'] },
    { id: 'joint-swelling-hand', label: 'Swollen finger joints', areaId: 'arms' },

    // Legs & feet
    { id: 'knee-pain', label: 'Knee pain', areaId: 'legs' },
    { id: 'hip-pain', label: 'Hip pain', areaId: 'legs' },
    { id: 'calf-cramp', label: 'Calf cramps', areaId: 'legs', aliases: ['leg cramp'] },
    { id: 'thigh-pain', label: 'Thigh pain', areaId: 'legs' },
    { id: 'leg-weakness', label: 'Weakness in the legs', areaId: 'legs' },
    { id: 'foot-pain', label: 'Foot or heel pain', areaId: 'legs' },
    { id: 'calf-swelling', label: 'One swollen, warm calf', areaId: 'legs', aliases: ['dvt', 'clot'] },

    // Skin, hair & nails
    { id: 'rash', label: 'Rash', areaId: 'skin' },
    { id: 'itching', label: 'Itching', areaId: 'skin', aliases: ['itchy'] },
    { id: 'new-mole', label: 'A new or changing mole', areaId: 'skin' },
    { id: 'bruising', label: 'Bruising easily', areaId: 'skin' },
    { id: 'slow-healing', label: 'Cuts healing slowly', areaId: 'skin' },
    { id: 'hair-loss', label: 'Hair thinning or loss', areaId: 'skin' },
    { id: 'dry-skin', label: 'Very dry skin', areaId: 'skin' },
    { id: 'yellow-skin', label: 'Yellow skin or eyes', areaId: 'skin', aliases: ['jaundice'] },

    // Urinary & pelvic
    { id: 'painful-urination', label: 'Pain when passing urine', areaId: 'urinary', aliases: ['burning pee'] },
    { id: 'frequent-urination', label: 'Passing urine more often', areaId: 'urinary', aliases: ['peeing a lot'] },
    { id: 'blood-in-urine', label: 'Blood in the urine', areaId: 'urinary' },
    { id: 'pelvic-pain', label: 'Pelvic pain', areaId: 'urinary' },
    { id: 'irregular-periods', label: 'Irregular periods', areaId: 'urinary' },
    { id: 'heavy-periods', label: 'Unusually heavy periods', areaId: 'urinary' },

    // Mood & sleep
    { id: 'low-mood', label: 'Low mood', areaId: 'mind', aliases: ['depressed', 'sad'] },
    { id: 'anxiety', label: 'Anxiety or feeling on edge', areaId: 'mind' },
    { id: 'poor-sleep', label: 'Trouble falling asleep', areaId: 'mind', aliases: ['insomnia'] },
    { id: 'waking-night', label: 'Waking through the night', areaId: 'mind' },
    { id: 'brain-fog', label: 'Trouble concentrating', areaId: 'mind', aliases: ['brain fog'] },
    { id: 'memory-lapses', label: 'Forgetfulness', areaId: 'mind', aliases: ['memory'] },
    { id: 'irritability', label: 'Irritability', areaId: 'mind' },

    // Whole body
    { id: 'fever', label: 'Fever', areaId: 'general', aliases: ['temperature', 'hot'] },
    { id: 'fatigue', label: 'Tiredness that rest does not fix', areaId: 'general', aliases: ['fatigue', 'exhausted'] },
    { id: 'night-sweats', label: 'Night sweats', areaId: 'general' },
    { id: 'weight-loss', label: 'Unintended weight loss', areaId: 'general' },
    { id: 'weight-gain', label: 'Unexplained weight gain', areaId: 'general' },
    { id: 'chills', label: 'Chills or shivering', areaId: 'general' },
    { id: 'thirst', label: 'Constant thirst', areaId: 'general' },
    { id: 'swollen-glands', label: 'Swollen glands', areaId: 'general', aliases: ['lymph nodes'] },
];

const byId = new Map(SYMPTOMS.map((s) => [s.id, s]));

export const symptomById = (id: string) => byId.get(id);

export const symptomsInArea = (areaId: string) => SYMPTOMS.filter((s) => s.areaId === areaId);

export const areaById = (id: string) => BODY_AREAS.find((a) => a.id === id);

/**
 * Match on label *and* aliases, ranking a prefix hit above a mid-word one so typing "head"
 * offers "Headache" before "Recent knock to the head". Substring matching is what the
 * product does everywhere else (`planGenerator`, professional lookup); doing something
 * cleverer here would be the only fuzzy search in the app.
 */
export const searchSymptoms = (query: string, limit = 8): Symptom[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const scored: { symptom: Symptom; rank: number }[] = [];
    for (const symptom of SYMPTOMS) {
        const haystacks = [symptom.label.toLowerCase(), ...(symptom.aliases ?? [])];
        let best = Infinity;
        for (const hay of haystacks) {
            const at = hay.indexOf(q);
            if (at === -1) continue;
            // A hit at the start of the phrase or of any word beats one inside a word.
            best = Math.min(best, at === 0 ? 0 : hay[at - 1] === ' ' ? 1 : 2);
        }
        if (best !== Infinity) scored.push({ symptom, rank: best });
    }

    return scored
        .sort((a, b) => a.rank - b.rank || a.symptom.label.localeCompare(b.symptom.label))
        .slice(0, limit)
        .map((s) => s.symptom);
};

// ---------------------------------------------------------------------------
// The detail the assistant actually needs
// ---------------------------------------------------------------------------

/**
 * `label` is what the kit puts on the chip; `phrase` is the same answer as it has to read
 * inside a sentence. "It started Last 7 days" is what happens when a UI label is reused
 * as prose, and the assistant reads prose.
 */
export const ONSETS = [
    { id: 'today', label: 'Today', phrase: 'today' },
    { id: 'week', label: 'Last 7 days', phrase: 'in the last week' },
    { id: 'month', label: 'Last month', phrase: 'in the last month' },
    { id: 'months', label: 'Several months', phrase: 'several months ago' },
    { id: 'years', label: 'A year or more', phrase: 'over a year ago' },
] as const;

export type OnsetId = typeof ONSETS[number]['id'];

/**
 * Five faces, as the kit draws them. The wording under each is the sentence the person is
 * agreeing to — "3/5" means nothing to anyone reading it back a week later.
 */
export const SEVERITIES = [
    { level: 1, icon: 'sentiment-very-satisfied' as FaceName, label: 'Barely noticeable' },
    { level: 2, icon: 'sentiment-satisfied' as FaceName, label: 'Mild' },
    { level: 3, icon: 'sentiment-neutral' as FaceName, label: 'Uncomfortable' },
    { level: 4, icon: 'sentiment-dissatisfied' as FaceName, label: 'Hard to ignore' },
    { level: 5, icon: 'sentiment-very-dissatisfied' as FaceName, label: 'Severe' },
] as const;

export const NOTE_LIMIT = 300;

export interface SymptomDraft {
    symptomIds: string[];
    onset: OnsetId | null;
    severity: number | null;
    note: string;
}

export const EMPTY_DRAFT: SymptomDraft = { symptomIds: [], onset: null, severity: null, note: '' };

/**
 * The kit's "Symptom checker finding score", which it never defines. Here it is the share
 * of the things the assistant needs that the person has actually given it — nothing more.
 * It is a completeness meter, not a confidence score, and the caption under it says so:
 * a number that looked like diagnostic certainty would be the most dangerous element on
 * the screen.
 *
 * Three symptoms is the ceiling on that component because a fourth adds detail, not
 * direction, and a bar that can only be filled by listing everything encourages exactly
 * the over-reporting that makes an answer worse.
 */
export const findingScore = (draft: SymptomDraft): number => {
    const symptoms = Math.min(draft.symptomIds.length, 3) / 3 * 55;
    const onset = draft.onset ? 15 : 0;
    const severity = draft.severity ? 15 : 0;
    const note = draft.note.trim().length >= 10 ? 15 : 0;
    return Math.round(symptoms + onset + severity + note);
};

/** What is still missing, phrased as the next thing to do. */
export const nextStepFor = (draft: SymptomDraft): string => {
    if (!draft.symptomIds.length) return 'Add a symptom to begin.';
    if (draft.symptomIds.length < 3) return 'Add any other symptoms you have noticed.';
    if (!draft.onset || !draft.severity) return 'Add when it started and how bad it feels.';
    if (draft.note.trim().length < 10) return 'A note about what you notice adds the most.';
    return "That's everything the assistant needs.";
};

/**
 * One message, written in the first person, because that is what the assistant is built to
 * read — `assistantEngine` already holds the person's biomarkers, plan and nutrition
 * adherence, so this only has to carry what is new.
 */
export const buildAssistantMessage = (draft: SymptomDraft): string => {
    const names = draft.symptomIds
        .map((id) => symptomById(id)?.label.toLowerCase())
        .filter(Boolean) as string[];

    const parts: string[] = [];
    if (names.length) parts.push(`I have been having ${listOut(names)}.`);

    const onset = ONSETS.find((o) => o.id === draft.onset);
    if (onset) parts.push(`It started ${onset.phrase}.`);

    const severity = SEVERITIES.find((s) => s.level === draft.severity);
    if (severity) parts.push(`At its worst it is ${severity.label.toLowerCase()} (${severity.level} out of 5).`);

    const note = draft.note.trim();
    if (note) parts.push(note.endsWith('.') ? note : `${note}.`);

    parts.push('What could be behind this, and should I see someone about it?');
    return parts.join(' ');
};

const listOut = (items: string[]) => {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};
