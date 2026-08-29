/**
 * Activity tracker client.
 *
 * Two things worth knowing before using it.
 *
 * **Days are local.** Every call that resolves a calendar day carries `tzOffset`. The
 * server cannot infer it, and defaulting to UTC files an evening run in the Americas under
 * the following day — on the dashboard the whole feature is built around. Same rule
 * `lib/nutrition.ts` follows.
 *
 * **Measured values are not editable.** A session that came from a watch accepts edits to
 * `effort` and `notes` only; the API answers 409 for anything else. An app that lets
 * someone rewrite what their device recorded cannot then claim the number came from the
 * device. Manual sessions are fully editable, because nothing measured them.
 */
import { api } from './api';
import type { SyncBatch } from './health';

/** Minutes west of UTC, as `Date.getTimezoneOffset()` reports it. */
const tzOffset = () => new Date().getTimezoneOffset();

/** Local `YYYY-MM-DD`, matching how the server stores `ActivitySession.day`. */
export const today = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export type ActivityRange = '1d' | '1w' | '1m' | '1y' | 'all';

export interface ActivitySession {
    _id: string;
    type: string;
    startedAt: string;
    endedAt?: string;
    day: string;
    durationSec: number;
    distanceM?: number;
    activeKcal?: number;
    elevationM?: number;
    avgBpm?: number;
    maxBpm?: number;
    cadence?: number;
    effort?: number;
    splits?: { label?: string; order?: number; distanceM?: number; durationSec?: number; avgBpm?: number; pacePerKm?: number }[];
    route?: { type: 'LineString'; coordinates: number[][] };
    startAddress?: string;
    endAddress?: string;
    source: 'healthkit' | 'health_connect' | 'manual' | 'live' | 'aggregator';
    sourceDevice?: { name?: string; model?: string; manufacturer?: string };
    scoreDelta: number;
    notes?: string;
    analysis?: {
        alignment: 'aligned' | 'partial' | 'off_plan' | 'unassessed';
        rationale?: string;
        guidanceKeys?: string[];
    };
}

export interface ActivitySeriesPoint {
    day: string;
    sessions: number;
    exerciseMin: number | null;
    activeKcal: number | null;
    steps: number | null;
    distanceM: number | null;
    score: number | null;
}

export interface GoalProgress {
    done: number;
    target: number;
}

export interface ActivityTargets {
    sessions: number;
    minutes: number;
    distanceKm: number | null;
    calories: number | null;
}

/** One directive from the person's health plan, worded as the interpretation wrote it. */
export interface ActivityGuidance {
    key: string;
    kind: 'volume' | 'intensity' | 'modality' | 'caution' | 'other';
    label: string | null;
    directive: string;
    rationale?: string;
    favour?: string[];
    avoid?: string[];
}

export interface ActivitySummary {
    range: ActivityRange;
    days: string[];
    series: ActivitySeriesPoint[];
    totals: { sessions: number; exerciseMin: number; activeKcal: number; distanceM: number };
    streak: number;
    highlight: { avgKcal: number | null; daysReported: number };
    /**
     * Null when there is no plan to measure against — never zero. Rendering 0% tells
     * someone they failed at something nobody asked of them, which is the same call the
     * nutrition tracker's `unassessed` alignment makes.
     */
    score: number | null;
    band: { key: string; label: string } | null;
    goal: null | {
        sessions: GoalProgress;
        minutes: GoalProgress;
        distanceKm: GoalProgress | null;
        calories: GoalProgress | null;
    };
    targets: ActivityTargets | null;
    guidance: ActivityGuidance[];
}

export interface ActivityPlan {
    _id: string;
    targets: ActivityTargets;
    basis: {
        method: 'guideline' | 'user';
        baseMinutes: number;
        baseSessions: number;
        activity: string;
        appliedKeys: string[];
    };
    guidance: ActivityGuidance[];
    overrides: {
        sessions: number | null;
        minutes: number | null;
        distanceKm: number | null;
        calories: number | null;
    };
    preferences: {
        types: string[];
        timeOfDay: 'morning' | 'afternoon' | 'evening' | null;
        typicalMinutes: number | null;
        selfRatedLevel: number | null;
    };
    onboarded: boolean;
}

export const getPlan = () =>
    api.get<{ plan: ActivityPlan; explanation: string }>('/activity/plan');

/**
 * Save the person's own targets and preferences.
 *
 * Cannot write `guidance` or `targets` — those are derived from the health plan, and a goal
 * screen that could overwrite them would let someone edit away their own clinical advice.
 * An override of `null` clears it and returns that one target to the plan-derived figure.
 */
export const savePlan = (body: {
    overrides?: Partial<Record<'sessions' | 'minutes' | 'distanceKm' | 'calories', number | null>>;
    preferences?: Partial<ActivityPlan['preferences']>;
    onboarded?: boolean;
}) => api.put<{ plan: ActivityPlan; explanation: string }>('/activity/plan', body);

export const getSummary = (range: ActivityRange = '1w') =>
    api.get<ActivitySummary>(`/activity/summary?range=${range}&tzOffset=${tzOffset()}`);

export const getDay = (date?: string) =>
    api.get<{ day: string; sessions: ActivitySession[]; metrics: any | null }>(
        `/activity/day?tzOffset=${tzOffset()}${date ? `&date=${date}` : ''}`
    );

export interface SessionQuery {
    from?: string;
    to?: string;
    type?: string[];
    q?: string;
    sort?: 'recent' | 'oldest' | 'longest' | 'distance';
    minKcal?: number;
    maxKcal?: number;
    limit?: number;
    skip?: number;
}

export const listSessions = (query: SessionQuery = {}) => {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.type?.length) params.set('type', query.type.join(','));
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);
    if (query.minKcal !== undefined) params.set('minKcal', String(query.minKcal));
    if (query.maxKcal !== undefined) params.set('maxKcal', String(query.maxKcal));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.skip) params.set('skip', String(query.skip));

    return api.get<{ sessions: ActivitySession[]; total: number; limit: number; skip: number }>(
        `/activity/sessions?${params.toString()}`
    );
};

export const getSession = (id: string) =>
    api.get<{ session: ActivitySession }>(`/activity/sessions/${id}`);

export const logActivity = (body: {
    type: string;
    startedAt: string;
    endedAt?: string;
    durationSec?: number;
    distanceM?: number;
    activeKcal?: number;
    effort?: number;
    notes?: string;
}) => api.post<{ session: ActivitySession }>('/activity/sessions', { ...body, tzOffset: tzOffset() });

/** Only `effort` and `notes` on a synced session. See the note at the top of this file. */
export const updateSession = (id: string, body: Partial<{
    effort: number; notes: string; type: string; distanceM: number; activeKcal: number; durationSec: number;
}>) => api.patch<{ session: ActivitySession }>(`/activity/sessions/${id}`, body);

export const deleteSession = (id: string) =>
    api.delete<{ message: string; willResync: boolean }>(`/activity/sessions/${id}`);

// ---------------------------------------------------------------------------
// Device sync
// ---------------------------------------------------------------------------

export interface WearableStatus {
    sources: {
        id: string;
        platform: 'apple_health' | 'health_connect' | 'aggregator';
        providerLabel?: string;
        permissions: string[];
        devices: { name?: string; model?: string; manufacturer?: string; lastSeenAt?: string }[];
        lastSyncAt: string | null;
        cursor: string | null;
        status: 'connected' | 'revoked' | 'error';
        lastError: string | null;
    }[];
    capabilities: { sync: boolean; aiInsight: boolean };
    acceptedHeartContexts: string[];
    maxRowsPerBatch: number;
}

export const getWearableStatus = () => api.get<WearableStatus>('/wearables/status');

/**
 * Push one batch from the device health store.
 *
 * Idempotent server-side, keyed on each row's `externalId`, so a retry after a dropped
 * connection is free and re-syncing a workout an Apple Watch and its phone both wrote does
 * not double-count the day.
 */
export const syncBatch = (batch: SyncBatch) =>
    api.post<{
        received: { activities: number; sleep: number; heart: number; days: number };
        daysUpdated: string[];
        rejectedHeartSamples: number;
    }>('/wearables/sync', batch);

export const disconnectSource = (id: string, purge = false) =>
    api.delete<{ message: string; purged: any }>(`/wearables/sources/${id}?purge=${purge}`);

// ---------------------------------------------------------------------------
// Formatting — kept here so every screen renders a duration the same way
// ---------------------------------------------------------------------------

export const formatDuration = (seconds: number): string => {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
};

export const formatDistance = (metres?: number | null): string | null => {
    if (!Number.isFinite(metres as number)) return null;
    const km = (metres as number) / 1000;
    return km >= 1 ? `${km.toFixed(km >= 10 ? 0 : 1)} km` : `${Math.round(metres as number)} m`;
};

/** Title-case a type the server may have passed through unmapped, e.g. 'kitesurfing'. */
export const formatType = (type: string): string =>
    type.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
