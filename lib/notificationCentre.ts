/**
 * The notification centre — client.
 *
 * A thin fetch layer, like `lib/score.ts` and `lib/achievements.ts`, and for the same
 * reason: the server decides what a notification *is*. Category, icon, tint, destination
 * and read state all arrive on the row, so two phones cannot disagree about whether
 * something has been read and a card cannot render a mark the sender did not choose.
 *
 * What this file owns is presentation the server has no business knowing: which Ionicon a
 * tint maps to a colour, how a timestamp reads in words, and how a flat feed becomes the
 * day sections `Design/notification.svg` draws.
 */
import { api } from './api';
import { schemed } from '@/constants/theme';

/* ------------------------------------------------------------------ *
 * Shapes — these mirror `utils/notificationCatalogue.js` on the server
 * ------------------------------------------------------------------ */

export type NotificationCategory =
    | 'plan' | 'medication' | 'sleep' | 'hydration' | 'activity' | 'nutrition'
    | 'vitals' | 'results' | 'insight' | 'appointment' | 'order' | 'achievement' | 'account';

export type NotificationTint =
    | 'violet' | 'indigo' | 'blue' | 'green' | 'rose' | 'amber' | 'slate';

export interface NotificationAction {
    label: string;
    route: string;
    tone: 'primary' | 'secondary';
}

export interface NotificationCard {
    id: string;
    category: NotificationCategory;
    categoryLabel: string;
    /** An Ionicons name, chosen by the server's table. */
    icon: string;
    tint: NotificationTint;
    title: string;
    body: string;
    route: string;
    meter: { value: number; max: number; label: string | null } | null;
    chip: { label: string; icon: string | null } | null;
    imageUrl: string | null;
    actions: NotificationAction[];
    data: Record<string, any>;
    read: boolean;
    readAt: string | null;
    createdAt: string;
    /** `YYYY-MM-DD` in the person's own timezone. See `tzOffset` below. */
    day: string;
    wasPushed: boolean;
}

export interface NotificationCounts {
    unread: number;
    read: number;
    byCategory: Record<string, { total: number; unread: number }>;
}

export interface NotificationFeed {
    notifications: NotificationCard[];
    counts: NotificationCounts;
    nextCursor: { before: string; beforeId: string } | null;
}

export type FeedState = 'unread' | 'read' | 'all';

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

/**
 * Minutes west of UTC, the convention `MealLog.day`, `medicationSchedule` and
 * `pushSender.inQuietHours` all follow. Sent on every read so the server groups the feed by
 * the day the person was living, not the day UTC was having.
 */
const tzOffset = () => new Date().getTimezoneOffset();

export const getFeed = (opts: {
    state?: FeedState;
    category?: NotificationCategory | null;
    cursor?: { before: string; beforeId: string } | null;
} = {}) => {
    const params = new URLSearchParams({
        state: opts.state ?? 'unread',
        tzOffset: String(tzOffset()),
    });
    if (opts.category) params.set('category', opts.category);
    if (opts.cursor) {
        params.set('before', opts.cursor.before);
        params.set('beforeId', opts.cursor.beforeId);
    }
    return api.get<NotificationFeed>(`/notifications?${params.toString()}`);
};

export const getUnreadCount = () =>
    api.get<{ unread: number }>('/notifications/unread-count');

export const setRead = (id: string, read = true) =>
    api.patch<{ notification: NotificationCard; unread: number }>(
        `/notifications/${id}/read`, { read }
    );

export const markAllRead = (category?: NotificationCategory | null) =>
    api.post<{ marked: number; unread: number }>(
        '/notifications/read-all', category ? { category } : {}
    );

export const dismiss = (id: string) =>
    api.delete<{ unread: number }>(`/notifications/${id}`);

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/**
 * A tint, as two colours: the icon and the disc behind it.
 *
 * Deliberately **not** severity. `vitals` is rose because a pulse reads as rose, not
 * because a vitals notification is a warning — the same line `Palette.alert` holds against
 * `Palette.danger`, and the same line `notificationCatalogue.js` holds about priority. A
 * card is never coloured by how worried to be; if a reading is in the crisis band the words
 * say so, because `utils/bloodPressure.js` is what decides that and it keeps `isCrisis` off
 * the colour ladder for exactly this reason.
 */
export const TINT_COLOURS: Record<NotificationTint, { fg: string; bg: string }> = schemed((Palette) => ({
    violet: { fg: Palette.primary, bg: Palette.primarySurface },
    indigo: { fg: Palette.indigo, bg: Palette.indigoSurface },
    blue: { fg: Palette.info, bg: Palette.infoSurface },
    green: { fg: Palette.successDeep, bg: Palette.successSurface },
    rose: { fg: Palette.alert, bg: Palette.alertSurface },
    amber: { fg: Palette.warning, bg: Palette.warningSurface },
    slate: { fg: Palette.textSecondary, bg: Palette.borderLight },
}));

export const tintOf = (tint: NotificationTint) => TINT_COLOURS[tint] ?? TINT_COLOURS.slate;

/**
 * The filter chips, in the order they are drawn.
 *
 * Read off the feed's own `counts.byCategory` rather than hard-coded, so a category added
 * to the server's table appears here without an app release — and one that has never
 * produced a notification does not appear at all. A chip reading "Orders (0)" is a filter
 * whose only outcome is an empty screen.
 */
export const chipsFor = (counts: NotificationCounts, labels: Record<string, string>) =>
    Object.entries(counts.byCategory)
        .filter(([, c]) => c.total > 0)
        .map(([key, c]) => ({
            key: key as NotificationCategory,
            label: labels[key] ?? key,
            total: c.total,
            unread: c.unread,
        }))
        .sort((a, b) => b.unread - a.unread || b.total - a.total);

/**
 * "1h ago", as the kit writes it.
 *
 * Minutes, then hours, then days, then the date. It stops being relative at a week because
 * "23d ago" is a number somebody has to do arithmetic on, and the one thing a timestamp on
 * a notification has to be is glanceable.
 */
export const relativeTime = (iso: string, now: Date = new Date()) => {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';

    const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
    if (seconds < 60) return 'just now';

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;

    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * "Today", "Yesterday", or the date — the section headers the kit draws.
 *
 * Takes the day string the **server** computed from `tzOffset` and compares it against the
 * client's own today. Both sides are then talking about the same calendar, which is the
 * only way these two words can be right: deriving the header from `createdAt` here and the
 * grouping there would eventually disagree at midnight.
 */
export const dayLabel = (day: string, now: Date = new Date()) => {
    const local = (d: Date) => {
        const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
        return shifted.toISOString().slice(0, 10);
    };
    if (day === local(now)) return 'Today';
    if (day === local(new Date(now.getTime() - 86400000))) return 'Yesterday';

    const parsed = new Date(`${day}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return day;
    return parsed.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: parsed.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
};

/**
 * One section per local day, in feed order.
 *
 * The array is named `data` rather than `items` because `SectionList` requires that key —
 * a section with any other name typechecks as a plain object and renders as nothing.
 */
export interface DaySection {
    day: string;
    label: string;
    data: NotificationCard[];
}

export const groupByDay = (cards: NotificationCard[], now: Date = new Date()): DaySection[] => {
    const sections: DaySection[] = [];
    for (const card of cards) {
        const last = sections[sections.length - 1];
        // The feed is already newest-first, so a run of equal days is a section. Grouping
        // into a map and sorting afterwards would lose the server's ordering, which is the
        // only thing that puts two notifications from the same sweep in the right order.
        if (last && last.day === card.day) last.data.push(card);
        else sections.push({ day: card.day, label: dayLabel(card.day, now), data: [card] });
    }
    return sections;
};
