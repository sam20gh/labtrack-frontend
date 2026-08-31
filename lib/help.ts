/**
 * Help centre content.
 *
 * The FAQ is a local catalogue, not an endpoint, for the same reason `lib/symptoms.ts`
 * carries its symptom list locally: there is no CMS behind it, and a help screen that
 * shows a spinner and then an error when the network is down is a help screen that fails
 * exactly when someone needs it.
 *
 * The trade-off is the one `utils/biomarkerGlossary.js` names in reverse — that glossary
 * is server-side *because* misleading clinical copy has to be fixable the same day. These
 * answers are about how the app behaves, not about anybody's results, so shipping them in
 * the bundle is the right side of that line. **Do not put clinical guidance here.**
 *
 * Every answer below is checked against the behaviour it describes. If one of them stops
 * being true, it is a bug in this file, not a stale doc.
 */

/** The address the password-reset screens already point people at. One place, now. */
export const SUPPORT_EMAIL = 'help@labtrackhealth.ai';

export interface FaqEntry {
    id: string;
    question: string;
    answer: string;
    /** Where the answer lives in the app, when there is somewhere to go. */
    route?: string;
    routeLabel?: string;
}

export interface FaqSection {
    id: string;
    title: string;
    entries: FaqEntry[];
}

export const FAQ: FaqSection[] = [
    {
        id: 'results',
        title: 'Results and interpretation',
        entries: [
            {
                id: 'upload',
                question: 'How do I add a test result?',
                answer:
                    'Open Results and choose Add result. You can photograph a printed report or pick a PDF. '
                    + 'We read the values off it and show you what we found before anything is saved — nothing '
                    + 'goes into your record until you have checked the numbers.',
                route: '/add-result',
                routeLabel: 'Add a result',
            },
            {
                id: 'wrong-value',
                question: 'A value was read incorrectly. What now?',
                answer:
                    'Correct it on the confirmation screen before you save. That checkpoint exists precisely '
                    + 'because a misread digit that reaches your record would then be read by everything else — '
                    + 'your score, your plan and the assistant.',
            },
            {
                id: 'explainer',
                question: 'What do the biomarker names mean?',
                answer:
                    'Every marker we recognise carries a plain-language title and a short explanation, shown '
                    + 'under the medical name on the results and trend screens. Where a marker arrives that we '
                    + 'do not yet have a reference range for, it is shown without a range rather than guessed at.',
                route: '/(tabs)/results',
                routeLabel: 'Open results',
            },
            {
                id: 'ranges',
                question: 'Why is my normal range different from the lab sheet?',
                answer:
                    'Ranges are adjusted for sex and age where the evidence supports it, so they can differ from '
                    + 'a single sheet printed for the general population. The band you were shown at the time is '
                    + 'kept with the reading — a result never silently restages itself when a guideline is revised.',
            },
        ],
    },
    {
        id: 'score',
        title: 'Your LabTrack score',
        entries: [
            {
                id: 'no-score',
                question: 'Why does my score show no number?',
                answer:
                    'A score needs at least three areas with data in them. Below that we show nothing rather than '
                    + 'a flattering guess — an area we have measured nothing for scores nothing at all, never zero.',
                route: '/score',
                routeLabel: 'Score breakdown',
            },
            {
                id: 'score-stuck',
                question: 'I answered the questionnaire but my score has not moved.',
                answer:
                    'The score is built from what has actually been measured — synced sessions, logged meals, '
                    + 'recorded doses, uploaded results. Questionnaire answers count until something measures the '
                    + 'same thing, then they are set aside. Connecting a watch or logging a week is what moves it.',
            },
            {
                id: 'score-sources',
                question: 'What does "measured" versus "self-reported" mean on a pillar?',
                answer:
                    'Measured means it came from a device, a lab report or something you logged. Self-reported '
                    + 'means it came from your onboarding answers, which carry less weight and fade over about '
                    + 'four months. Each pillar says which it is.',
            },
        ],
    },
    {
        id: 'devices',
        title: 'Devices and data',
        entries: [
            {
                id: 'watch',
                question: 'Will it work with my Apple Watch?',
                answer:
                    'Yes, through Apple Health on iPhone and Health Connect on Android. We read workouts, steps, '
                    + 'sleep and heart rate. We cannot show a watch\'s battery level or whether it is currently '
                    + 'connected — neither health store reports that to an app.',
                route: '/activity/sources',
                routeLabel: 'Connected sources',
            },
            {
                id: 'weight-device',
                question: 'Can my scale or blood-pressure cuff sync automatically?',
                answer:
                    'Not yet. Weight, hydration and blood pressure are entered by hand, and what you enter is the '
                    + 'record. When device sync arrives those readings land in the same place, so nothing you log '
                    + 'now is wasted.',
                route: '/metrics',
                routeLabel: 'Health metrics',
            },
            {
                id: 'units',
                question: 'Can I use pounds and miles?',
                answer:
                    'Yes — Units & Metrics on your profile. Your records stay stored in metric, so switching '
                    + 'units changes what you see and never rewrites anything you have already logged.',
                route: '/settings/units',
                routeLabel: 'Units & Metrics',
            },
        ],
    },
    {
        id: 'privacy',
        title: 'Privacy and account',
        entries: [
            {
                id: 'data-safe',
                question: 'Is my health data safe?',
                answer:
                    'Your records sit behind your account and every request is authenticated. Voice notes to the '
                    + 'assistant are transcribed and the audio is discarded — we keep the text you confirmed, '
                    + 'never a recording of you describing your symptoms.',
            },
            {
                id: 'password',
                question: 'How do I change my password?',
                answer:
                    'Security Settings sends a reset link to the email address on your account. We deliberately '
                    + 'do not take a new password inside the app — the link proves it is you, a signed-in phone '
                    + 'left on a table does not.',
                route: '/settings/security',
                routeLabel: 'Security settings',
            },
            {
                id: 'delete',
                question: 'How do I delete my account?',
                answer:
                    'Delete account, at the bottom of your profile. It removes your account and cannot be undone, '
                    + 'so export or screenshot anything you want to keep first.',
            },
        ],
    },
    {
        id: 'assistant',
        title: 'The AI assistant',
        entries: [
            {
                id: 'assistant-what',
                question: 'What can the assistant actually see?',
                answer:
                    'Your biomarkers, your plan, your logged activity, meals, doses and metrics — the same view '
                    + 'the rest of the app draws from. That is why its answers reference your own numbers rather '
                    + 'than general advice.',
                route: '/(tabs)/assistant',
                routeLabel: 'Open the assistant',
            },
            {
                id: 'assistant-diagnose',
                question: 'Can it diagnose me?',
                answer:
                    'No, and it will not try. It explains what your records show and when something is worth '
                    + 'taking to a clinician. Anything urgent — chest pain, breathlessness, a reading in the '
                    + 'crisis range — needs medical help now, not an app.',
            },
            {
                id: 'symptoms-percent',
                question: 'The symptom checker shows a percentage. Is that a likelihood?',
                answer:
                    'No. It measures how much you have told us, not how certain anything is. The caption under it '
                    + 'names the next thing that would help.',
            },
        ],
    },
];

/** Flattened, for search and for counting. */
export const allFaqEntries = (): FaqEntry[] => FAQ.flatMap((section) => section.entries);

/** Case-insensitive match across question and answer. */
export const searchFaq = (query: string): FaqSection[] => {
    const needle = query.trim().toLowerCase();
    if (!needle) return FAQ;
    return FAQ
        .map((section) => ({
            ...section,
            entries: section.entries.filter(
                (entry) =>
                    entry.question.toLowerCase().includes(needle)
                    || entry.answer.toLowerCase().includes(needle),
            ),
        }))
        .filter((section) => section.entries.length > 0);
};

/** The topics the kit's feedback screen offers as chips (frame 19). */
export const FEEDBACK_TOPICS = [
    { id: 'bug', label: 'Bug', icon: 'bug-outline' },
    { id: 'ui', label: 'Design', icon: 'color-palette-outline' },
    { id: 'performance', label: 'Speed', icon: 'speedometer-outline' },
    { id: 'ux', label: 'Confusing', icon: 'help-buoy-outline' },
    { id: 'data', label: 'Wrong data', icon: 'analytics-outline' },
    { id: 'feature', label: 'Feature idea', icon: 'bulb-outline' },
    { id: 'account', label: 'Account', icon: 'person-outline' },
    { id: 'other', label: 'Something else', icon: 'ellipsis-horizontal' },
] as const;
