/**
 * Achievements client.
 *
 * Everything here is a fetch. The grading, the thresholds and the unlock rows all live on the
 * server, for the three reasons `lib/score.ts` gives about the health score and one more that
 * is specific to badges:
 *
 *   1. It reads rows this app does not hold — every tracker's whole history.
 *   2. Two phones must agree. A badge that exists on a tablet and not on a phone is worse
 *      than no badge.
 *   3. An unlock is a record, and records belong on the server.
 *   4. **A threshold on the client is a threshold anyone can move.** The leaderboard is
 *      shared, so grading in the app would make the points a number the app reports about
 *      itself rather than one the server establishes.
 *
 * The one thing this file owns is presentation: `toneColour`, the share text, and the
 * first-run gate.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { Router } from 'expo-router';
import { api } from './api';
import { Palette } from '@/constants/theme';
import type { BadgeGlyph, BadgeShape } from '@/components/achievements/badgeArt';
import { BADGE_TONES, type BadgeTone } from '@/components/achievements/BadgeMedal';

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export type AchievementCategory =
    | 'activity' | 'sleep' | 'nutrition' | 'hydration'
    | 'medication' | 'vitals' | 'insight' | 'care' | 'milestone';

/** One catalogue entry, graded against this person. */
export interface Achievement {
    key: string;
    name: string;
    plainName: string;
    category: AchievementCategory;
    categoryLabel: string;
    /** The tracker this badge is earned in. Never null — a badge with no route is a dead end. */
    route: string;
    shape: BadgeShape;
    glyph: BadgeGlyph;
    tone: BadgeTone;
    unit: string;
    levels: number[];
    blurb: string;

    level: number;
    maxLevel: number;
    unlocked: boolean;
    /** What they have. Counts an action taken, never a health result. */
    value: number;
    /** The threshold the current level was won at, or null while locked. */
    threshold: number | null;
    /** The next threshold, or null at the top of the ladder. */
    next: number | null;
    /** 0–1 through the *current* level, measured from the previous rung rather than from zero. */
    progress: number;
    points: number;
    how: string;
    unlockedAt: string | null;
    shareToken: string | null;
}

export interface AchievementSummary {
    unlocked: number;
    total: number;
    points: number;
    maxPoints: number;
}

/** An unlock, in the shape the celebration modal and the "recent" rail draw. */
export interface Unlock {
    key: string;
    name: string;
    plainName: string;
    shape: BadgeShape;
    glyph: BadgeGlyph;
    tone: BadgeTone;
    categoryLabel: string;
    route: string;
    level: number;
    threshold: number;
    unlockedAt: string;
    points: number;
    how: string;
}

export interface AchievementHub {
    summary: AchievementSummary;
    achievements: Achievement[];
    categories: Record<AchievementCategory, { label: string; tone: BadgeTone; route: string }>;
    /** Earned and never shown. The screen fires the modal for these, then posts `/seen`. */
    celebrate: Unlock[];
    recent: Unlock[];
}

export interface AchievementDetail extends Achievement {
    shareUrl: string | null;
    /**
     * Exactly what a share card would publish about the person — built by the same function
     * on the server that builds the public card, so the preview cannot promise something
     * different from what the link resolves to.
     *
     * Both null until they opt into a public profile. A card with no name reads "A LabTrack
     * member", which is complete: the badge is the subject.
     */
    person: { name: string | null; avatar: string | null };
    /** The address printed in the card's corner. Null when no share URL is configured. */
    shareHost: string | null;
    ladder: {
        level: number;
        threshold: number;
        how: string;
        reached: boolean;
        reachedAt: string | null;
    }[];
}

export interface LeaderboardRow {
    rank: number;
    name: string;
    avatar: string | null;
    points: number;
    unlocked: number;
    isYou: boolean;
}

export interface Leaderboard {
    board: LeaderboardRow[];
    you: {
        optedIn: boolean;
        displayName: string;
        points: number;
        unlocked: number;
        /** Null while they have not joined the board. */
        rank: number | null;
    };
    participants: number;
    disclaimer: string;
}

export interface StatsRow {
    label: string;
    value: number | string;
    format: 'count' | 'km' | 'days' | 'text';
}

export interface Stats {
    header: {
        memberSince: string | null;
        daysWithLabTrack: number;
        achievementsUnlocked: number;
        points: number;
    };
    sections: { title: string; rows: StatsRow[] }[];
    note: string;
}

export interface ShareLink {
    token: string;
    /** Null when the deployment has no `ACHIEVEMENT_SHARE_URL`. See `shareAchievement`. */
    url: string | null;
    message: string;
    level: number;
    shareHost: string | null;
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

export const getAchievements = () => api.get<AchievementHub>('/achievements');
export const getAchievement = (key: string) => api.get<AchievementDetail>(`/achievements/${key}`);
export const getLeaderboard = () => api.get<Leaderboard>('/achievements/leaderboard');
export const getAchievementStats = () => api.get<Stats>('/achievements/stats');

export const markCelebrationsSeen = (keys?: string[]) =>
    api.post<{ marked: number }>('/achievements/seen', keys ? { keys } : {});

export const createShareLink = (key: string) =>
    api.post<ShareLink>(`/achievements/${key}/share`, {});

export const revokeShareLink = (key: string) =>
    api.delete<{ revoked: number }>(`/achievements/${key}/share`);

export const updateLeaderboardProfile = (body: { optedIn?: boolean; displayName?: string }) =>
    api.put<{ optedIn: boolean; displayName: string; points: number }>('/achievements/leaderboard', body);

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/**
 * The three badges to put on a shelf: the newest first, then the closest to unlocking.
 *
 * Shared by the hub's featured row and the profile's trophy case, because they are the same
 * editorial decision and two copies of it would eventually disagree about which three matter.
 *
 * A row of three *locked* badges is what somebody sees on day one and it is the right thing to
 * show them — those are the ones within reach. The moment anything is earned it takes the
 * front of the shelf, because a collection screen that keeps leading with what you have not
 * got is a screen that never feels like yours.
 */
export const pickShelf = (all: Achievement[], count = 3): Achievement[] => {
    const earned = all
        .filter((a) => a.unlocked && a.unlockedAt)
        .sort((a, b) => Date.parse(b.unlockedAt!) - Date.parse(a.unlockedAt!));
    const closest = all
        .filter((a) => !a.unlocked)
        .sort((a, b) => b.progress - a.progress);
    return [...earned, ...closest, ...all].slice(0, count);
};

/**
 * The one still to come that is nearest — what the profile's "Next up" line names.
 *
 * Null when every ladder is topped out, which the caller has to render as a state rather than
 * as an empty row. Ties broken by the smaller remaining gap so two badges both at 90% are
 * ordered by which is actually closer in the person's own units.
 */
export const nextUp = (all: Achievement[]): Achievement | null =>
    all
        .filter((a) => a.next !== null)
        .sort((a, b) => b.progress - a.progress || (a.next! - a.value) - (b.next! - b.value))[0] ?? null;

/** The badge's colour. Never a clinical colour — see the note in `BadgeMedal.tsx`. */
export const toneColour = (tone: BadgeTone, locked = false) =>
    (locked ? BADGE_TONES.locked : BADGE_TONES[tone]);

/**
 * "1,240 of 25,000 steps".
 *
 * The unit travels from the catalogue so a step count and a run of days are phrased
 * differently without this file knowing which is which.
 */
export const progressLabel = (a: Pick<Achievement, 'value' | 'next' | 'unit'>) =>
    a.next === null
        ? `${a.value.toLocaleString()} ${a.unit}`
        : `${a.value.toLocaleString()} of ${a.next.toLocaleString()} ${a.unit}`;

/** "Nov 2025", as the detail screen's Earned chip prints it. An absent date renders nothing. */
export const earnedLabel = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;

/* ------------------------------------------------------------------ *
 * Sharing
 * ------------------------------------------------------------------ */

/**
 * What a share attempt actually did.
 *
 * `image` is the intended path; the rest are the ways it degrades, and the caller tells the
 * person which one happened rather than letting them assume a picture went out.
 */
export type ShareOutcome = 'image' | 'link' | 'text' | 'dismissed';

/**
 * Share a badge as a picture.
 *
 * **The image is the artefact.** It used to be a link: the app sent a URL and whatever app
 * received it fetched an Open Graph card to draw a preview. That works, but it is a *preview
 * of a page*, not a thing somebody owns — it needs a live server to render, it can be revoked
 * out from under the person who shared it, and it publishes a public page on the internet as
 * the price of sending a picture to one friend.
 *
 * Capturing the card instead removes all three. The file is handed to the share sheet and
 * from there it is a photo like any other: it works offline, it survives the product, and
 * **nothing is published** — no token is minted, so there is no public URL to leak or revoke.
 * That is a real privacy improvement and it is why this path does not call `/share` at all.
 *
 * What it costs is the link. An image has no href, so the card prints the host in its own
 * corner — see `ShareCard`. That is the only route back, and it is why the watermark is not
 * decoration.
 *
 * Falls back rather than fails, in two steps:
 *   - No `expo-sharing` on this platform (web) → the old link path, which still works.
 *   - Capture failed → the link path too, rather than a silent nothing.
 */
export const shareAchievementImage = async (
    view: React.RefObject<unknown>,
    key: string,
): Promise<ShareOutcome> => {
    const available = await Sharing.isAvailableAsync().catch(() => false);

    if (available && view.current) {
        try {
            const uri = await captureRef(view as never, {
                format: 'png',
                quality: 1,
                // A file rather than base64: the share sheet wants a path, and a megabyte of
                // base64 through the bridge is the slow way to arrive at the same file.
                result: 'tmpfile',
            });

            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                // iOS needs the uniform type or some targets refuse the attachment.
                UTI: 'public.png',
                dialogTitle: 'Share your achievement',
            });
            return 'image';
        } catch {
            // Fall through to the link. A capture that failed is not a reason to send nothing.
        }
    }

    return shareAchievementLink(key);
};

/**
 * The fallback: share a link to a public card.
 *
 * Kept because it is the only thing that works where `expo-sharing` does not, and because a
 * link already sent stays live. Unlike the image path this **does** publish: it mints a token,
 * and the page at that URL is readable by anyone who has it until the person revokes it from
 * the badge's own screen.
 *
 * With no `url` — a deployment that has not set `ACHIEVEMENT_SHARE_URL` — the message goes out
 * alone and the outcome says so. Sending a link that resolves to nothing would be worse.
 */
export const shareAchievementLink = async (key: string): Promise<ShareOutcome> => {
    const link = await createShareLink(key);

    const result = await Share.share(
        link.url
            ? { message: `${link.message}\n${link.url}`, url: link.url, title: 'LabTrack achievement' }
            : { message: link.message, title: 'LabTrack achievement' },
    );

    if (result.action === Share.dismissedAction) return 'dismissed';
    return link.url ? 'link' : 'text';
};

/* ------------------------------------------------------------------ *
 * The first-run gate
 * ------------------------------------------------------------------ */

export const ACHIEVEMENTS_INTRO_KEY = 'achievementsIntroSeen';

/**
 * Open the achievements hub, showing the value-prop screen only on a first visit.
 *
 * Here rather than in each caller, for the reason `openPredictions` gives: there are already
 * three entry points — the profile, the quick-action sheet and the celebration modal — and a
 * gate implemented three times is one that eventually disagrees with itself.
 *
 * A storage read that fails opens the hub. The worse of the two failures is showing the pitch
 * again to somebody who has already read it.
 */
export const openAchievements = async (router: Router): Promise<void> => {
    let seen = 'true';
    try {
        seen = (await AsyncStorage.getItem(ACHIEVEMENTS_INTRO_KEY)) ?? '';
    } catch {
        seen = 'true';
    }
    router.push((seen ? '/achievements' : '/achievements/intro') as never);
};

/** Category tints for the filter strip. Kept beside `toneColour` so the two cannot drift. */
export const CATEGORY_ORDER: AchievementCategory[] = [
    'milestone', 'activity', 'sleep', 'nutrition', 'hydration',
    'medication', 'vitals', 'insight', 'care',
];

export const surfaceFor = (tone: BadgeTone) => ({
    amber: Palette.warningSurface,
    violet: Palette.primarySurface,
    green: Palette.successSurface,
    rose: Palette.dangerSurface,
}[tone]);
