/**
 * What to say about the bracelet right now — the bracelet screen's chips and notice, and the
 * home header's device chip. Pure: it reads the pairing and what the screen knows this
 * instant, and touches neither the radio nor the store, so every rule below has a test
 * (`__tests__/status-test.ts`).
 *
 * ## Why this exists
 *
 * On 2026-10-12 an iPhone showed a 2208A as "Connected · 15%" while every sync failed with
 * "Operation timed out". All three were wrong in a different way:
 *
 * - **"Connected" was a constant.** The screen passed `connected` whenever a bracelet was
 *   *paired*. These bracelets are never held connected — a sync connects, reads and lets go —
 *   so the chip said nothing true at any moment.
 * - **15% was a day old**, drawn exactly like a reading taken a second ago. It was the last
 *   thing the bracelet said before going quiet, which made it the most useful number on the
 *   screen and the one presented least honestly.
 * - **"Operation timed out" is `react-native-ble-plx` talking**: the connection request went
 *   unanswered for 15 seconds and was cancelled. A bracelet that last reported 15% and then
 *   stopped answering has almost certainly run flat, and nothing said so.
 *
 * So status is now made of evidence, each piece with its time: the last time the bracelet
 * answered (`lastSeenAt`), the last time we tried and whether it did (`lastAttempt`), when the
 * battery was read (`batteryAt`), and — on the bracelet screen only — whether it is
 * advertising nearby this second. "Connected" is said only while a link is actually open.
 *
 * **"Probably needs charging" is an inference and is worded as one.** Nothing over Bluetooth
 * can tell a flat bracelet from one in a drawer in another room; both are silent. A low last
 * reading followed by silence is the likelier story, so the copy leads with it and still says
 * what else to check.
 */
import type { PairedBracelet } from './store';

/** Amber below this. Matches `StatusChips` and the ring on `DeviceStage`. */
export const LOW_BATTERY = 30;
/** Rose below this. */
export const CRITICAL_BATTERY = 15;
/**
 * A bracelet last heard at or below this that has since gone silent is probably flat. Above
 * the rose line on purpose: with timed heart rate, SpO2 and temperature switched on, a band at
 * 20% can be empty by the next morning.
 */
export const FLAT_SUSPECT = 20;
/** A battery figure older than this is labelled with its age rather than shown as current. */
export const BATTERY_FRESH_MS = 6 * 60 * 60 * 1000;

/** How the bracelet can be reached, most certain first. */
export type Reach =
    /** Bluetooth itself is off or not allowed — nothing below can be known. */
    | 'bluetooth'
    | 'syncing'
    /** A link is open right now (live view, or the moments of a sync). */
    | 'connected'
    /** The screen is listening for it. */
    | 'checking'
    /** Heard advertising seconds ago. */
    | 'nearby'
    /** The last attempt to reach it went unanswered, and it has not been heard since. */
    | 'unreachable'
    /** Listened for just now and not heard, though the last sync worked. */
    | 'not_seen'
    /** Answered the last time anything asked. */
    | 'seen'
    /** Paired, never heard from since. */
    | 'unknown';

/** What the screen knows this instant, beyond the stored pairing. */
export interface LiveFacts {
    syncing?: boolean;
    checking?: boolean;
    connected?: boolean;
    /** True: heard just now. False: listened and did not hear it. Absent: not listened. */
    nearby?: boolean;
    /** Why Bluetooth cannot be used, from `transport.scanBlockedReason`. */
    bluetoothBlocked?: string | null;
}

export type Tone = 'ok' | 'low' | 'critical' | 'alert' | 'busy' | 'muted';

export interface BatteryFact {
    pct: number;
    /** When it was read, if known. */
    at: string | null;
    /** Older than `BATTERY_FRESH_MS` — draw it with its age. */
    stale: boolean;
}

export interface BraceletStatus {
    reach: Reach;
    /** Short label for the connection chip on the bracelet screen. */
    reachLabel: string;
    battery: BatteryFact | null;
    /** Silent, and last heard with a low battery. See the header. */
    likelyFlat: boolean;
    /** Something the person should do, or null. */
    advice: { title: string; body: string } | null;
    /** The home chip: one tone, one short label. */
    chip: { tone: Tone; label: string | null; icon: ChipIcon };
    /** Everything the chip says, for a screen reader. */
    a11y: string;
}

export type ChipIcon = 'battery-full' | 'battery-half' | 'battery-dead' | 'sync' | 'alert-circle' | 'bluetooth' | null;

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * When something happened, as a person says it. Local calendar days, not 24-hour blocks:
 * "yesterday at 21:40" is the evening before however few hours ago that was.
 */
export const ago = (iso: string | null | undefined, now: number = Date.now()): string => {
    if (!iso) return 'never';
    const at = new Date(iso);
    const ms = now - at.getTime();
    if (!Number.isFinite(ms)) return 'never';
    if (ms < 2 * 60_000) return 'just now';
    if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)} min ago`;
    const days = Math.round((startOfDay(new Date(now)) - startOfDay(at)) / 86_400_000);
    if (days <= 0) return `today at ${clock(at)}`;
    if (days === 1) return `yesterday at ${clock(at)}`;
    return `${days} days ago`;
};

/** The same, in a chip's width: "40m ago", "18h ago", "2d ago". */
export const shortAgo = (iso: string | null | undefined, now: number = Date.now()): string => {
    if (!iso) return '';
    const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
    if (mins < 2) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
};

/**
 * When the battery was read. A pairing made before `batteryAt` existed read its battery on
 * every successful sync, so `lastSyncAt` is the honest stand-in, then the pairing itself.
 */
const batteryOf = (paired: PairedBracelet, now: number): BatteryFact | null => {
    if (typeof paired.lastBattery !== 'number') return null;
    const at = paired.batteryAt ?? paired.lastSyncAt ?? paired.pairedAt ?? null;
    const stale = !at || now - Date.parse(at) > BATTERY_FRESH_MS;
    return { pct: Math.round(paired.lastBattery), at, stale };
};

/** The last time it answered — what the store says, or the pairing's older fields. */
const lastSeen = (paired: PairedBracelet): string | null =>
    paired.lastSeenAt ?? paired.lastSyncAt ?? null;

const failedSinceSeen = (paired: PairedBracelet): boolean => {
    const attempt = paired.lastAttempt;
    if (!attempt || attempt.outcome === 'ok') return false;
    const seen = lastSeen(paired);
    return !seen || Date.parse(seen) <= Date.parse(attempt.at);
};

const reachOf = (paired: PairedBracelet, live: LiveFacts): Reach => {
    if (live.bluetoothBlocked) return 'bluetooth';
    if (live.syncing) return 'syncing';
    if (live.connected) return 'connected';
    if (live.nearby === true) return 'nearby';
    if (failedSinceSeen(paired)) return 'unreachable';
    if (live.checking) return 'checking';
    if (live.nearby === false) return 'not_seen';
    return lastSeen(paired) ? 'seen' : 'unknown';
};

const REACH_LABEL: Record<Reach, string> = {
    bluetooth: 'Bluetooth off',
    syncing: 'Syncing…',
    connected: 'Connected',
    checking: 'Looking for it…',
    nearby: 'Nearby',
    unreachable: 'Can\'t reach',
    not_seen: 'Not nearby',
    seen: 'Paired',
    unknown: 'Paired',
};

export const braceletStatus = (
    paired: PairedBracelet,
    live: LiveFacts = {},
    now: number = Date.now(),
): BraceletStatus => {
    const reach = reachOf(paired, live);
    const battery = batteryOf(paired, now);
    const seen = lastSeen(paired);
    const silent = reach === 'unreachable' || reach === 'not_seen';
    const likelyFlat = silent && !!battery && battery.pct <= FLAT_SUSPECT;

    // "Paired" says nothing a person can use, so a reach of `seen` names when instead.
    // While the screen listens, say so even over a stale failure — the notice below stays put,
    // so nothing jumps, and the chip shows the check is happening.
    const reachLabel = live.checking && silent ? REACH_LABEL.checking
        : reach === 'seen' && seen ? `Seen ${ago(seen, now)}`
            : REACH_LABEL[reach];

    let advice: BraceletStatus['advice'] = null;
    if (reach === 'bluetooth') {
        advice = { title: 'Bluetooth is off', body: live.bluetoothBlocked! };
    } else if (likelyFlat) {
        advice = {
            title: 'It probably needs charging',
            body: `Your bracelet isn't answering, and it was at ${battery!.pct}% when it last did, `
                + `${ago(battery!.at ?? seen, now)}. Charge it for 15 minutes, then tap Sync now.`,
        };
    } else if (reach === 'unreachable') {
        advice = {
            title: 'Can\'t reach your bracelet',
            body: `It last answered ${ago(seen, now)}. Check it's charged and within arm's reach, and `
                + 'close the maker\'s app — a bracelet talks to one phone at a time.',
        };
    } else if (battery && !battery.stale && battery.pct < CRITICAL_BATTERY && reach !== 'syncing') {
        // Said while it still answers: this is the one moment charging it saves a night.
        advice = {
            title: 'Battery low',
            body: `At ${battery.pct}% it can switch off before morning, and a night's sleep would go `
                + 'unrecorded. Charge it when you can.',
        };
    }

    const chip = chipFor(reach, battery, likelyFlat);
    const a11y = [
        'Health bracelet',
        reach === 'syncing' ? 'syncing'
            : likelyFlat ? 'not answering, probably needs charging'
                : reach === 'unreachable' ? 'not answering'
                    : reach === 'bluetooth' ? 'Bluetooth is off'
                        : null,
        battery ? `battery ${battery.pct}%${battery.stale ? `, as of ${ago(battery.at, now)}` : ''}` : null,
    ].filter(Boolean).join(', ');

    return { reach, reachLabel, battery, likelyFlat, advice, chip, a11y };
};

const chipFor = (reach: Reach, battery: BatteryFact | null, likelyFlat: boolean): BraceletStatus['chip'] => {
    if (reach === 'syncing') return { tone: 'busy', label: 'Syncing', icon: 'sync' };
    if (reach === 'bluetooth') return { tone: 'muted', label: 'Off', icon: 'bluetooth' };
    if (likelyFlat) return { tone: 'alert', label: 'Charge', icon: 'battery-dead' };
    if (reach === 'unreachable') return { tone: 'alert', label: 'Can\'t reach', icon: 'alert-circle' };
    if (!battery) return { tone: 'ok', label: null, icon: null };
    const tone: Tone = battery.pct < CRITICAL_BATTERY ? 'critical' : battery.pct < LOW_BATTERY ? 'low' : 'ok';
    const icon: ChipIcon = battery.pct < CRITICAL_BATTERY ? 'battery-dead' : battery.pct < 60 ? 'battery-half' : 'battery-full';
    return { tone, label: `${battery.pct}%`, icon };
};
