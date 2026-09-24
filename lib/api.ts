/**
 * The single entry point for Predyqt API calls.
 *
 * Every protected endpoint needs a bearer token, and Supabase access tokens expire and
 * refresh. Reading the token at each call site (the old `AsyncStorage.getItem('authToken')`
 * pattern) meant a forgotten header shipped as a silent 401 — that is exactly how the home
 * screen ended up calling `/test-results` unauthenticated.
 *
 * `apiFetch` attaches a fresh token every time, so screens describe *what* they want, not
 * how to authenticate it.
 */
import { API_URL } from '@/constants/config';
import { getAccessToken } from './auth';

export class ApiError extends Error {
    status: number;
    body: any;

    constructor(message: string, status: number, body?: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }

    /** The session is gone or was never valid — the caller should route to sign-in. */
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
}

/**
 * Whether the last request reached the server.
 *
 * This is the app's **only** connectivity signal, and it is deliberately a weaker claim
 * than "the phone is online". `@react-native-community/netinfo` would report the radio,
 * and it would cost a native module — which is a `package.json` change, which moves the
 * Expo fingerprint, which silently strands every build already installed on somebody's
 * phone (CLAUDE.md, the fourth trap). It would also answer the wrong question: a phone
 * with four bars behind a captive portal is online and cannot reach us.
 *
 * `apiFetch` is the one place every call passes through, so it already knows. A `fetch`
 * that rejects means the request never left; any response at all, including a 500, means
 * it arrived. Nothing here polls and nothing here retries — a screen showing a banner is
 * cleared by the next successful call the app makes for any reason.
 */
let reachable = true;
type ReachabilityListener = (reachable: boolean) => void;
const listeners = new Set<ReachabilityListener>();

const setReachable = (next: boolean) => {
    if (next === reachable) return;
    reachable = next;
    listeners.forEach((listener) => listener(next));
};

/** Read synchronously — callers are render functions. */
export const isReachable = () => reachable;

/** Subscribe to changes. Returns the unsubscribe. */
export const onReachabilityChange = (listener: ReachabilityListener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

type ApiOptions = Omit<RequestInit, 'body'> & {
    body?: unknown;
    /** Skip the Authorization header (public endpoints only). */
    anonymous?: boolean;
};

/**
 * Call the Predyqt API.
 *
 * @param path endpoint path beginning with '/', e.g. `/users/${id}`
 * @throws {ApiError} on any non-2xx response
 */
export const apiFetch = async <T = any>(path: string, options: ApiOptions = {}): Promise<T> => {
    const { body, anonymous, headers, ...rest } = options;

    const finalHeaders: Record<string, string> = {
        Accept: 'application/json',
        ...(headers as Record<string, string> | undefined),
    };

    if (!anonymous) {
        const token = await getAccessToken();
        if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }

    let payload: BodyInit | undefined;
    if (body !== undefined) {
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
            payload = body; // let fetch set the multipart boundary
        } else {
            finalHeaders['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
    }

    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders, body: payload });
    } catch {
        setReachable(false);
        throw new ApiError('Network error. Please check your connection.', 0);
    }

    // Any answer at all — including a 500 — means the request reached Predyqt, which is
    // the only thing `reachable` claims.
    setReachable(true);

    const text = await response.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const message =
            (data && (data.message || data.error)) ||
            `Request failed (${response.status})`;
        throw new ApiError(message, response.status, data);
    }

    return data as T;
};

/** Convenience wrappers. */
export const api = {
    get: <T = any>(path: string, options?: ApiOptions) =>
        apiFetch<T>(path, { ...options, method: 'GET' }),
    post: <T = any>(path: string, body?: unknown, options?: ApiOptions) =>
        apiFetch<T>(path, { ...options, method: 'POST', body }),
    put: <T = any>(path: string, body?: unknown, options?: ApiOptions) =>
        apiFetch<T>(path, { ...options, method: 'PUT', body }),
    patch: <T = any>(path: string, body?: unknown, options?: ApiOptions) =>
        apiFetch<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T = any>(path: string, options?: ApiOptions) =>
        apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
