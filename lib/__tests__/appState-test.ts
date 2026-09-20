/**
 * The state table is what stops thirty screens disagreeing about what a 500 means, so the
 * thing worth pinning is the mapping itself — every branch, and the four rules the module
 * header states.
 */
// `lib/api` reaches `lib/auth` for a fresh access token, and `lib/auth` constructs the
// Supabase client at module scope — which needs AsyncStorage and a WebSocket, neither of
// which exists under Jest. `describeError` reads `ApiError.status` and nothing else, so the
// token path is stubbed rather than stood up.
jest.mock('../auth', () => ({ getAccessToken: jest.fn(async () => null) }));

import { ApiError } from '../api';
import { describeError, describeState } from '../appState';

describe('describeError', () => {
    it('maps a fetch that never left the device to the offline state', () => {
        const state = describeError(new ApiError('Network error. Please check your connection.', 0));
        expect(state.key).toBe('offline');
        expect(state.retryable).toBe(true);
        // Rule 1: the API's own wording is never promoted, and "Network error." is ours anyway.
        expect(state.detail).toBeNull();
    });

    it('maps 404 to not found, and does not offer a retry that cannot work', () => {
        const state = describeError(new ApiError('Not found', 404));
        expect(state.key).toBe('not_found');
        expect(state.retryable).toBe(false);
        expect(state.badge).toBe('Error Code: 404');
    });

    it('maps 5xx to a server error carrying the real status, not the kit\'s 401', () => {
        expect(describeError(new ApiError('boom', 500)).badge).toBe('Error Code: 500');
        expect(describeError(new ApiError('boom', 502)).key).toBe('server_error');
        expect(describeError(new ApiError('boom', 504)).retryable).toBe(true);
    });

    it('maps 503 to maintenance rather than to a fault', () => {
        // The interpretation and assistant routes answer 503 with no model key, and that is
        // "come back shortly", not "something broke".
        const state = describeError(new ApiError('AI is not configured', 503));
        expect(state.key).toBe('maintenance');
        expect(state.retryable).toBe(true);
    });

    it('maps 402 to the paywall and 410 to a feature that has moved', () => {
        expect(describeError(new ApiError('Pro only', 402)).key).toBe('locked');
        expect(describeError(new ApiError('Gone', 410)).key).toBe('update');
    });

    it('describes an auth failure that survived a screen\'s sign-in routing as not allowed', () => {
        const state = describeError(new ApiError('Forbidden', 403));
        expect(state.key).toBe('not_allowed');
        expect(state.badge).toBe('Status Code: 403');
        expect(state.retryable).toBe(false);
    });

    it('treats an unrecognised throw as our fault, never as the person being offline', () => {
        // Rule 4. A TypeError from our own parsing must not tell somebody to check their wifi.
        const state = describeError(new TypeError('x.map is not a function'));
        expect(state.key).toBe('server_error');
        expect(state.badge).toBeNull();
    });

    it('carries a useful server message as detail but drops a bare status line', () => {
        expect(describeError(new ApiError('Your report is still being parsed.', 409)).detail).toBe(
            'Your report is still being parsed.',
        );
        expect(describeError(new ApiError('Request failed (500)', 500)).detail).toBeNull();
        expect(describeError(new ApiError('a'.repeat(200), 500)).detail).toBeNull();
        expect(describeError(new ApiError('line one\nline two', 500)).detail).toBeNull();
    });

    it('names the subject in the body when the screen said what it was loading', () => {
        const state = describeError(new ApiError('Network error', 0), { subject: 'your sleep' });
        expect(state.body).toContain('your sleep');
    });
});

describe('describeState', () => {
    it('lets a caller override copy without inventing a ninth state', () => {
        const state = describeState('empty', { title: 'No nights recorded yet' });
        expect(state.key).toBe('empty');
        expect(state.title).toBe('No nights recorded yet');
        expect(state.tone).toBe('accent');
    });

    it('draws the two badge tones the kit draws and no others', () => {
        const keys = ['not_found', 'server_error', 'offline', 'maintenance', 'not_allowed', 'locked', 'update', 'empty'] as const;
        for (const key of keys) expect(['alert', 'accent']).toContain(describeState(key).tone);
        // A fault is rose, a fact is violet.
        expect(describeState('offline').tone).toBe('alert');
        expect(describeState('locked').tone).toBe('accent');
    });
});
