/**
 * What went wrong, said once.
 *
 * Before this file every screen answered that question for itself. `lib/api.ts` throws a
 * well-shaped `ApiError` carrying a status, and thirty-odd screens then rendered
 * `err.message` as a line of grey text under a cloud icon — so a dropped connection, a
 * record that does not exist, and the backend being down all looked identical, read as the
 * *server's* wording rather than the product's, and offered the same non-answer.
 *
 * **This is a deterministic table, not a judgement** — the eighth in the series with
 * `medicationCatalogue.js`, `bloodPressure.js`, `nutritionSafety.js`, `reviewSla.js`,
 * `predictionForecast.js`, `achievementCatalogue.js` and `sleepTargets.js`, and the argument
 * is the one it always is: a mapping each screen computes for itself is one the screens
 * eventually disagree about. `describeError` is pure, takes no clock and no network, and
 * `lib/__tests__/appState.test.ts` pins every branch of it.
 *
 * Four rules it keeps:
 *
 * 1. **The server's own words are never the headline.** `ApiError.message` is whatever the
 *    API happened to put in `message` or `error` — sometimes a sentence written for a
 *    person, often `Request failed (500)`, occasionally a Mongoose validator naming a field
 *    path. It is carried through as `detail`, below the fold and in smaller type, and the
 *    headline is ours.
 * 2. **Offline is a status, not a guess.** `apiFetch` catches the `fetch` rejection and
 *    throws `status: 0`, which means exactly "the request never reached the server". That
 *    is the only offline signal here, and it is deliberately not dressed up as knowledge of
 *    the radio: `@react-native-community/netinfo` would tell us whether the phone has a
 *    route, at the cost of a native module — and a native module added to `package.json`
 *    moves the fingerprint, which silently strands every build already in someone's hands
 *    (see CLAUDE.md, the fourth trap). "We could not reach LabTrack" is both true and
 *    enough, and the recovery is the same either way.
 * 3. **A recoverable state leads with the recovery.** 404 leads with the way out, because
 *    retrying a record that is not there just fails again. Everything else leads with
 *    "Try again", because it is the action that can actually work.
 * 4. **`unknown` is a state, not a fallback to the worst one.** Anything this table does not
 *    recognise is reported as a fault on our side, which is what an unrecognised failure in
 *    our own client is, rather than as an accusation that the person is offline.
 */
import { ApiError } from './api';

/** The eight states `Design/errors.svg` draws, and the only ones `StateView` can render. */
export type StateKey =
    | 'not_found'
    | 'server_error'
    | 'offline'
    | 'maintenance'
    | 'not_allowed'
    | 'locked'
    | 'update'
    | 'empty';

/** A badge is either a fault (rose) or a fact (violet). The kit draws exactly these two. */
export type StateTone = 'alert' | 'accent';

export type StateDescriptor = {
    key: StateKey;
    tone: StateTone;
    /** The pill above the title. `null` draws no pill — a state with nothing to add. */
    badge: string | null;
    /** Ionicons glyph for the pill. */
    badgeIcon: string;
    title: string;
    body: string;
    /**
     * The API's own message, when it said something a person could act on. Rendered small
     * and last, never as the headline. Null when the API said nothing but a status code.
     */
    detail: string | null;
    /** Whether retrying this request could plausibly succeed. */
    retryable: boolean;
};

/**
 * The copy, verbatim from the export where the export wrote a sentence that is true here.
 *
 * Two departures, both because the kit's own copy is placeholder text:
 *
 * - Frame 4 ("Not Allowed") and frame 6 ("Update Required") both carry *frame 0's* body —
 *   "Unfortunately, this page is not found." A permissions refusal and an out-of-date build
 *   are not a missing page, and shipping the mockup's copy verbatim would put a sentence on
 *   the screen that contradicts the title directly above it.
 * - Frame 1's badge reads "Error Code: 401" beside the title "Server Error". 401 is
 *   Unauthorized, not a server fault, and it never reaches this table — `lib/api.ts` marks
 *   401/403 `isAuthError` and every screen routes those to sign-in. The badge is generated
 *   from the real status instead.
 */
const SPEC: Record<StateKey, Omit<StateDescriptor, 'key' | 'badge' | 'detail'> & { badge?: string }> = {
    not_found: {
        tone: 'alert',
        badgeIcon: 'warning-outline',
        title: 'Not Found',
        body: 'Unfortunately, this page is not found. Please try again sometime later or refresh.',
        retryable: false,
    },
    server_error: {
        tone: 'alert',
        badgeIcon: 'warning-outline',
        title: 'Server Error',
        body: 'Unfortunately, we encountered an issue with our server. Please try again or later.',
        retryable: true,
    },
    offline: {
        tone: 'alert',
        badge: 'Please Reconnect',
        badgeIcon: 'wifi-outline',
        title: 'No Internet',
        body: 'Please ensure that you have an active internet connection!',
        retryable: true,
    },
    maintenance: {
        tone: 'alert',
        badgeIcon: 'time-outline',
        title: 'Maintenance',
        body: "We're currently undergoing maintenance to our app. Please try again later.",
        retryable: true,
    },
    not_allowed: {
        tone: 'alert',
        badgeIcon: 'warning-outline',
        title: 'Not Allowed',
        body: 'This part of LabTrack is not available to your account. If that looks wrong, support can check it for you.',
        retryable: false,
    },
    locked: {
        tone: 'accent',
        badge: 'Subscribe to plus',
        badgeIcon: 'sparkles-outline',
        title: 'Feature Locked',
        body: "Let's subscribe to the plus plan to unlock the features today!",
        retryable: false,
    },
    update: {
        tone: 'accent',
        badgeIcon: 'phone-portrait-outline',
        title: 'Update Required',
        body: 'A newer version of LabTrack is ready. Update to carry on where you left off.',
        retryable: false,
    },
    empty: {
        tone: 'accent',
        badge: 'No data available',
        badgeIcon: 'stats-chart-outline',
        title: 'Nothing To Show Yet',
        body: "Looks like there's no data here to show yet. Please try again later.",
        retryable: true,
    },
};

/** Build a descriptor for a state, with any field overridden by the caller. */
export const describeState = (
    key: StateKey,
    overrides: Partial<Omit<StateDescriptor, 'key'>> = {},
): StateDescriptor => {
    const spec = SPEC[key];
    return {
        key,
        tone: spec.tone,
        badge: spec.badge ?? null,
        badgeIcon: spec.badgeIcon,
        title: spec.title,
        body: spec.body,
        detail: null,
        retryable: spec.retryable,
        ...overrides,
    };
};

/**
 * A server message worth showing.
 *
 * `apiFetch` falls back to `Request failed (500)` when the body carried nothing, and a
 * bare status code repeated under a headline that already says "Server Error" is noise.
 * Anything that is only a status line, or that is not a sentence a person can read, is
 * dropped.
 */
const usefulDetail = (message: string | undefined, status: number): string | null => {
    if (!message) return null;
    const trimmed = message.trim();
    if (!trimmed) return null;
    if (trimmed === `Request failed (${status})`) return null;
    if (/^network error/i.test(trimmed)) return null;
    // A stack trace or a Mongoose validator path is not copy.
    if (trimmed.length > 160 || /\n/.test(trimmed)) return null;
    return trimmed;
};

export type DescribeOptions = {
    /**
     * What the screen was loading, lower case and singular — "your sleep", "this product".
     * Used to make the body specific where the kit's copy is generic. Omit it and the
     * kit's own sentence is used unchanged.
     */
    subject?: string;
};

/**
 * Map a thrown value onto one of the eight states.
 *
 * Auth failures (401/403) are **not** given a state here. Every screen already routes them
 * to sign-in before rendering, because a signed-out person needs a sign-in screen and not a
 * picture of a police officer. If one reaches this function it is described as
 * `not_allowed`, which is what a 403 that survived that routing actually is.
 */
export const describeError = (error: unknown, options: DescribeOptions = {}): StateDescriptor => {
    const { subject } = options;
    const status = error instanceof ApiError ? error.status : null;
    const message = error instanceof Error ? error.message : undefined;
    const detail = status === null ? null : usefulDetail(message, status);

    // `status: 0` is `apiFetch`'s marker for a fetch that never left the device.
    if (status === 0) {
        return describeState('offline', {
            body: subject
                ? `We could not reach LabTrack to load ${subject}. Please check your connection and try again.`
                : SPEC.offline.body,
        });
    }

    if (status === 404) {
        return describeState('not_found', {
            badge: 'Error Code: 404',
            detail,
            body: subject
                ? `We could not find ${subject}. It may have been removed, or the link may be out of date.`
                : SPEC.not_found.body,
        });
    }

    // 503 is the one the backend would answer while it is deliberately down, and the one
    // `/api/interpretation` and `/api/assistant` already answer when their model key is
    // absent. Either way it is "come back shortly", not "something broke".
    if (status === 503) {
        return describeState('maintenance', { badge: 'Temporarily unavailable', detail });
    }

    // 402 is the paywall. `User.proMember` gates the resource library today and nothing
    // charges for it, so this is reachable only once billing exists — the state is here so
    // the screen that first hits it has somewhere to send people.
    if (status === 402) {
        return describeState('locked', { detail });
    }

    if (status === 401 || status === 403) {
        return describeState('not_allowed', { badge: `Status Code: ${status}`, detail });
    }

    // 410 is the retired `/api/deepseek` tombstone, and any other endpoint that follows it.
    if (status === 410) {
        return describeState('update', { badge: 'This feature has moved', detail, retryable: false });
    }

    if (status !== null && status >= 500) {
        return describeState('server_error', { badge: `Error Code: ${status}`, detail });
    }

    if (status !== null && status >= 400) {
        // A 4xx we did not name is a request this client built wrongly — our fault, not
        // theirs, and not something retrying will fix on its own.
        return describeState('server_error', {
            badge: `Error Code: ${status}`,
            detail,
            body: subject
                ? `Something went wrong on our side while loading ${subject}. Please try again.`
                : SPEC.server_error.body,
            retryable: true,
        });
    }

    // Not an ApiError at all — a bug in our own code, a JSON shape we did not expect, a
    // native module that threw. Reported as ours, because it is.
    return describeState('server_error', {
        badge: null,
        detail: usefulDetail(message, -1),
        body: subject
            ? `Something went wrong while loading ${subject}. Please try again.`
            : SPEC.server_error.body,
    });
};
