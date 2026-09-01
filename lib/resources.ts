/**
 * Health resources — the client for `/api/resources`.
 *
 * Every screen under `app/resources/*` goes through here rather than calling `api.get`
 * directly, so the query-string shape of the list endpoint lives in one place. Four list
 * screens, a search screen and a filter sheet all build the same query; six copies of it is
 * six chances for one of them to spell `minMinutes` differently and silently drop a filter.
 *
 * The formatters at the bottom are here for the same reason: "2.5k" appears on every card in
 * the app, and a card that rounds differently from the one beside it looks like a bug in the
 * number rather than in the formatter.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import { api } from './api';

export type ResourceType = 'article' | 'short' | 'course' | 'workshop' | 'audio';
export type RatingValue = 'bad' | 'neutral' | 'great';

export type Block =
    | { type: 'paragraph' | 'heading' | 'quote' | 'callout'; text: string }
    | { type: 'list' | 'checklist'; items: string[] }
    | { type: 'image'; url: string; caption?: string | null };

export type ResourceCategory = {
    id: string;
    slug: string;
    name: string;
    group: string;
    icon: string;
    resourceCount?: number;
};

export type ResourceAuthorSummary = {
    id: string;
    slug: string;
    name: string;
    speciality: string | null;
    headline: string | null;
    avatar: string | null;
};

export type ResourceStats = {
    views: number;
    likes: number;
    comments: number;
    rating: number | null;
    ratingCount: number;
    /** Absent when the response was built without a reader. Never assume false. */
    liked?: boolean;
    saved?: boolean;
    myRating?: RatingValue | null;
    progressSeconds?: number;
};

export type ResourceCard = {
    id: string;
    slug: string;
    type: ResourceType;
    title: string;
    subtitle: string | null;
    excerpt: string;
    thumbnail: string | null;
    heroImage: string | null;
    tags: string[];
    category: ResourceCategory | null;
    author: ResourceAuthorSummary | null;
    readMinutes: number | null;
    durationSeconds: number | null;
    lengthMinutes: number;
    sessionCount: number;
    isPro: boolean;
    featured: boolean;
    publishedAt: string | null;
    stats: ResourceStats;
    workshop?: {
        startsAt: string | null;
        mode: string | null;
        priceCents: number | null;
        compareAtCents: number | null;
        currency: string;
        attendeeCount: number;
    };
};

export type CourseSession = {
    id: string;
    title: string;
    durationSeconds: number;
    thumbnail: string | null;
    preview: boolean;
    videoUrl: string | null;
    audioUrl: string | null;
};

export type TranscriptCue = { startSeconds: number; endSeconds: number | null; text: string };

/**
 * One resource in full.
 *
 * `workshop` is deliberately re-typed rather than inherited: `detailView` on the server
 * spreads the card view and then overwrites `workshop` with the complete object, so on a
 * detail response it carries the schedule, location, topics and capacity that the card's
 * summary does not. `Omit` is what makes the compiler agree with the wire format instead of
 * quietly narrowing it back to the card's shape.
 */
export type ResourceDetail = Omit<ResourceCard, 'workshop'> & {
    workshop: WorkshopDetail | null;
    body: Block[];
    /** True when this is Pro content the reader has not paid for. */
    locked: boolean;
    hiddenBlocks: number;
    media: {
        videoUrl: string | null;
        audioUrl: string | null;
        captionsUrl: string | null;
        transcript: TranscriptCue[];
    };
    course: { sessionCount: number; sessions: CourseSession[] } | null;
    source: { name: string; url: string } | null;
};

export type WorkshopDetail = {
    startsAt: string | null;
    endsAt: string | null;
    mode: 'online' | 'in_person' | 'hybrid' | null;
    locationName: string | null;
    address: string | null;
    timezone: string | null;
    whoShouldAttend: string[];
    topics: { title: string; detail: string }[];
    priceCents: number | null;
    compareAtCents: number | null;
    currency: string;
    capacity: number | null;
    attendeeCount: number;
};

export type ResourceHub = {
    categories: ResourceCategory[];
    featured: ResourceCard[];
    articles: ResourceCard[];
    shorts: ResourceCard[];
    courses: ResourceCard[];
    workshops: ResourceCard[];
};

export type ResourceAuthorDetail = ResourceAuthorSummary & {
    coverImage: string | null;
    bio: string;
    achievements: { icon: string; title: string; detail: string }[];
    contact: { tel: string | null; email: string | null; fax: string | null };
    socials: Record<string, string>;
    professionalId: string | null;
    followerCount: number;
    following?: boolean;
    rating: { average: number | null; count: number; histogram: Record<string, number> };
    courseCount: number;
    courses: ResourceCard[];
    videos: ResourceCard[];
};

export type ResourceQuery = {
    q?: string;
    type?: ResourceType | 'all';
    category?: string;
    tag?: string;
    author?: string;
    minMinutes?: number;
    maxMinutes?: number;
    pro?: boolean;
    sort?: 'newest' | 'oldest' | 'popular';
    page?: number;
    limit?: number;
};

export type ResourcePage = {
    items: ResourceCard[];
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
};

export type FilterOptions = {
    types: { key: string; label: string }[];
    categories: ResourceCategory[];
    tags: string[];
    durations: { key: string; label: string; minMinutes?: number; maxMinutes?: number }[];
    sorts: { key: string; label: string }[];
};

// ── API ─────────────────────────────────────────────────────────────────────

const toQuery = (query: ResourceQuery) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        // `false` is a real filter value for `pro`, so only null/undefined/'' drop out.
        if (value === undefined || value === null || value === '') continue;
        params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
};

export const getHub = () => api.get<ResourceHub>('/resources/home');

export const getCategories = () =>
    api.get<{ groups: { name: string; categories: ResourceCategory[] }[] }>('/resources/categories');

export const getFilterOptions = () => api.get<FilterOptions>('/resources/filters');

export const listResources = (query: ResourceQuery = {}) =>
    api.get<ResourcePage>(`/resources${toQuery(query)}`);

export const getResource = (idOrSlug: string) =>
    api.get<{ resource: ResourceDetail; related: ResourceCard[] }>(`/resources/${idOrSlug}`);

export const getAuthor = (slug: string) =>
    api.get<{ author: ResourceAuthorDetail; resources: ResourceCard[] }>(`/resources/authors/${slug}`);

export const getSaved = () => api.get<{ items: ResourceCard[] }>('/resources/library/saved');
export const getContinue = () => api.get<{ items: ResourceCard[] }>('/resources/library/continue');

export const recordView = (idOrSlug: string) =>
    api.post<{ views: number }>(`/resources/${idOrSlug}/view`);

export const toggleLike = (idOrSlug: string, value?: boolean) =>
    api.post<{ liked: boolean; likes: number }>(`/resources/${idOrSlug}/like`, { value });

export const toggleSave = (idOrSlug: string, value?: boolean) =>
    api.post<{ saved: boolean }>(`/resources/${idOrSlug}/save`, { value });

export const rateResource = (idOrSlug: string, rating: RatingValue) =>
    api.post<{ rating: RatingValue; average: number | null; ratingCount: number }>(
        `/resources/${idOrSlug}/rate`, { rating },
    );

/**
 * Post playback position.
 *
 * The server takes the maximum, so a call that arrives out of order cannot rewind the stored
 * position. Callers should still throttle — see `PROGRESS_INTERVAL_MS`.
 */
export const saveProgress = (idOrSlug: string, progressSeconds: number, completed = false) =>
    api.post<{ progressSeconds: number; completed: boolean }>(
        `/resources/${idOrSlug}/progress`, { progressSeconds, completed },
    );

export const joinWorkshop = (idOrSlug: string) =>
    api.post<{ joined: boolean; attendeeCount: number }>(`/resources/${idOrSlug}/join`);

export const followAuthor = (slug: string, value?: boolean) =>
    api.post<{ following: boolean; followerCount: number }>(`/resources/authors/${slug}/follow`, { value });

/**
 * AsyncStorage key for "has this person seen the library's value-prop screen".
 *
 * Here rather than on the intro screen itself, so the home screen can read it without
 * importing a route module and pulling that whole screen into its bundle.
 */
export const RESOURCES_INTRO_KEY = 'resourcesIntroSeen';

/**
 * Open the library, showing the value-prop screen only on a first visit.
 *
 * Here rather than in each caller because there are three of them now — the home rail, the
 * home quick-action grid, and the tab bar's shortcut sheet — and a gate implemented three
 * times is a gate that eventually disagrees with itself.
 *
 * A storage read that fails opens the library rather than the intro: a splash you have to
 * dismiss on every visit is a tax on the feature it is advertising, and the worse of the two
 * failures is showing the pitch to someone who has already read it.
 */
export const openResourcesHub = async (router: Router): Promise<void> => {
    let seen = 'true';
    try {
        seen = (await AsyncStorage.getItem(RESOURCES_INTRO_KEY)) ?? '';
    } catch {
        seen = 'true';
    }
    router.push((seen ? '/resources' : '/resources/intro') as never);
};

/** How often a player reports position. Every second would be 300 writes per audio piece. */
export const PROGRESS_INTERVAL_MS = 10000;

// ── presentation ────────────────────────────────────────────────────────────

/**
 * "2.5k", "1.2M".
 *
 * Truncates rather than rounds above a thousand, so a count never appears to go up when it
 * has not: 1,999 reading as "2k" and then 2,001 also reading as "2k" is fine, but 1,999
 * reading as "2k" and dropping to "1.9k" after a correction is not.
 */
export const formatCount = (n: number): string => {
    if (!Number.isFinite(n) || n < 0) return '0';
    if (n < 1000) return String(Math.floor(n));
    if (n < 1_000_000) {
        const k = Math.floor(n / 100) / 10;
        return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    const m = Math.floor(n / 100_000) / 10;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
};

/** "12:00", "1:02:30". */
export const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

/**
 * The length label a card shows: "3m read" for text, "2:15" for anything with a runtime.
 *
 * One function so an article and a short never end up labelled in each other's units.
 */
export const lengthLabel = (card: Pick<ResourceCard, 'type' | 'readMinutes' | 'durationSeconds'>): string => {
    if (card.readMinutes != null) return `${card.readMinutes}m read`;
    if (card.durationSeconds != null) return formatDuration(card.durationSeconds);
    return '';
};

export const TYPE_LABEL: Record<ResourceType, string> = {
    article: 'Article',
    short: 'Short',
    course: 'Course',
    workshop: 'Workshop',
    audio: 'Audio',
};

/** Plural headings for the list screens: "Our Articles", "Our Workshops". */
export const TYPE_PLURAL: Record<ResourceType, string> = {
    article: 'Articles',
    short: 'Shorts',
    course: 'Courses',
    workshop: 'Workshops',
    audio: 'Audio',
};

export const TYPE_ICON: Record<ResourceType, string> = {
    article: 'document-text-outline',
    short: 'videocam-outline',
    course: 'school-outline',
    workshop: 'settings-outline',
    audio: 'headset-outline',
};

/**
 * Where opening a card takes you.
 *
 * Held here rather than at each call site because a card appears on eight screens and a
 * short that opens as an article on one of them is the kind of fault nobody reports.
 */
export const routeFor = (card: Pick<ResourceCard, 'type' | 'slug'>): {
    pathname: string; params: Record<string, string>;
} => {
    switch (card.type) {
        case 'short':
            return { pathname: '/resources/shorts', params: { slug: card.slug } };
        case 'audio':
            return { pathname: '/resources/player/audio', params: { slug: card.slug } };
        case 'course':
            return { pathname: '/resources/player/video', params: { slug: card.slug } };
        default:
            return { pathname: '/resources/[slug]', params: { slug: card.slug } };
    }
};

export const formatPrice = (cents: number | null | undefined, currency = 'GBP'): string => {
    if (cents == null) return '';
    if (cents === 0) return 'Free';
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
    return `${symbol}${(cents / 100).toFixed(2)}`;
};

export const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "Mon, 08:00 – 09:00" for a workshop's time row. */
export const formatSchedule = (startsAt: string | null, endsAt: string | null): string => {
    if (!startsAt) return 'Date to be confirmed';
    const start = new Date(startsAt);
    const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const weekday = start.toLocaleDateString(undefined, { weekday: 'short' });
    return endsAt ? `${weekday}, ${time(start)} – ${time(new Date(endsAt))}` : `${weekday}, ${time(start)}`;
};

export const MODE_LABEL: Record<string, string> = {
    online: 'Online',
    in_person: 'In person',
    hybrid: 'In person / Online',
};
