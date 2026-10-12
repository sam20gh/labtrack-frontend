/**
 * What the bracelet screen and the home chip say — `status.ts`.
 *
 * On 2026-10-12 an iPhone showed a 2208A as "Connected · 15%" while every sync failed with
 * "Operation timed out". What has to hold:
 *
 *   - "Connected" is said only while a link is open, never because a bracelet is paired.
 *   - A connection nobody answered reads as "Can't reach" until the bracelet answers again.
 *   - Silence after a low reading says "probably needs charging", and names the reading.
 *   - A battery figure carries its age once it is more than a few hours old.
 *   - The home chip leads with what needs somebody, never a percentage over a silent band.
 */
import { ago, braceletStatus, shortAgo } from '../status';
import type { PairedBracelet } from '../store';

const NOW = new Date(2026, 9, 12, 9, 30).getTime();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const band = (patch: Partial<PairedBracelet> = {}): PairedBracelet => ({
    id: 'band-1', variant: 'j2208a', label: 'J-Style 2208A', pairedAt: at(24 * 30), ...patch,
});

/** The case that was reported: last answered a day ago at 15%, both syncs since unanswered. */
const reported = band({
    lastSyncAt: at(25), lastSeenAt: at(25), lastBattery: 15, batteryAt: at(25),
    lastAttempt: { at: at(0.1), outcome: 'unreachable', reason: "Couldn't reach your bracelet." },
});

describe('braceletStatus', () => {
    it('never says connected because a bracelet is merely paired', () => {
        const s = braceletStatus(band({ lastSeenAt: at(0.75), lastAttempt: { at: at(0.75), outcome: 'ok' } }), {}, NOW);
        expect(s.reach).toBe('seen');
        expect(s.reachLabel).not.toMatch(/connected/i);
        expect(s.reachLabel).toBe('Seen 45 min ago');
        expect(braceletStatus(band(), { connected: true }, NOW).reachLabel).toBe('Connected');
    });

    it('reads the reported case as a bracelet that probably needs charging', () => {
        const s = braceletStatus(reported, {}, NOW);
        expect(s.reach).toBe('unreachable');
        expect(s.likelyFlat).toBe(true);
        expect(s.advice?.title).toBe('It probably needs charging');
        expect(s.advice?.body).toMatch(/15%/);
        expect(s.advice?.body).toMatch(/yesterday at 08:30/);
        expect(s.chip).toEqual({ tone: 'alert', label: 'Charge', icon: 'battery-dead' });
        expect(s.battery).toMatchObject({ pct: 15, stale: true });
    });

    it('says only "can\'t reach" when the last reading was not low', () => {
        const s = braceletStatus({ ...reported, lastBattery: 70 }, {}, NOW);
        expect(s.likelyFlat).toBe(false);
        expect(s.advice?.title).toBe("Can't reach your bracelet");
        expect(s.advice?.body).toMatch(/maker's app/);
        expect(s.chip.label).toBe("Can't reach");
    });

    it('clears the failure the moment the bracelet answers again', () => {
        const back = { ...reported, lastSeenAt: at(0) };
        expect(braceletStatus(back, {}, NOW).reach).not.toBe('unreachable');
        expect(braceletStatus(reported, { nearby: true }, NOW).reach).toBe('nearby');
    });

    it('keeps the notice while it looks, and says it is looking', () => {
        const s = braceletStatus(reported, { checking: true }, NOW);
        expect(s.reachLabel).toBe('Looking for it…');
        expect(s.advice?.title).toBe('It probably needs charging');
    });

    it('treats a low band that was listened for and not heard as probably flat', () => {
        const s = braceletStatus(band({ lastSeenAt: at(3), lastBattery: 12, batteryAt: at(3) }), { nearby: false }, NOW);
        expect(s.reach).toBe('not_seen');
        expect(s.likelyFlat).toBe(true);
    });

    it('warns about a critically low battery while it still answers', () => {
        const s = braceletStatus(band({ lastSeenAt: at(0.2), lastBattery: 9, batteryAt: at(0.2) }), {}, NOW);
        expect(s.advice?.title).toBe('Battery low');
        expect(s.chip).toEqual({ tone: 'critical', label: '9%', icon: 'battery-dead' });
    });

    it('shows a healthy battery as a plain percentage, and syncing above everything', () => {
        const healthy = band({ lastSeenAt: at(0.2), lastBattery: 82, batteryAt: at(0.2) });
        expect(braceletStatus(healthy, {}, NOW).chip).toEqual({ tone: 'ok', label: '82%', icon: 'battery-full' });
        expect(braceletStatus(healthy, {}, NOW).advice).toBeNull();
        expect(braceletStatus(reported, { syncing: true }, NOW).chip.label).toBe('Syncing');
        expect(braceletStatus(band({ lastBattery: 25, batteryAt: at(0.2) }), {}, NOW).chip.tone).toBe('low');
    });

    it('dates a battery read before batteryAt existed by the last sync', () => {
        const old = band({ lastSyncAt: at(10), lastBattery: 60 });
        expect(braceletStatus(old, {}, NOW).battery).toEqual({ pct: 60, at: at(10), stale: true });
    });

    it('puts Bluetooth being off before anything about the bracelet', () => {
        const s = braceletStatus(reported, { bluetoothBlocked: 'Bluetooth is off. Turn it on to find your bracelet.' }, NOW);
        expect(s.reach).toBe('bluetooth');
        expect(s.advice?.title).toBe('Bluetooth is off');
    });

    it('says everything the chip shows to a screen reader', () => {
        expect(braceletStatus(reported, {}, NOW).a11y)
            .toBe('Health bracelet, not answering, probably needs charging, battery 15%, as of yesterday at 08:30');
    });
});

describe('ago / shortAgo', () => {
    it('speaks in local calendar days', () => {
        expect(ago(at(0.01), NOW)).toBe('just now');
        expect(ago(at(0.5), NOW)).toBe('30 min ago');
        expect(ago(at(2), NOW)).toBe('today at 07:30');
        expect(ago(at(11), NOW)).toBe('yesterday at 22:30');
        expect(ago(at(72), NOW)).toBe('3 days ago');
        expect(ago(undefined, NOW)).toBe('never');
        expect(shortAgo(at(25), NOW)).toBe('1d ago');
        expect(shortAgo(at(5), NOW)).toBe('5h ago');
    });
});
