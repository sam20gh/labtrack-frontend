/**
 * Every attempt to reach the bracelet, recorded on the pairing.
 *
 * The evidence `status.ts` turns into words: when the bracelet last answered, and whether the
 * last attempt to reach it did. Sync, live view and pairing all connect through `reach` so none
 * of them can forget to record it — the failure that left a silent bracelet reading "Connected"
 * for a day was a screen inventing its status because nothing had been written down.
 */
import * as transport from './transport';
import { getPaired, updatePaired } from './store';

/** What a connection nobody answered is called, everywhere it is shown. */
export const UNREACHABLE = 'Couldn\'t reach your bracelet.';

/**
 * Connect, and record how it went. A connection nobody answered is rethrown in words; any
 * other failure keeps its own message.
 */
export const reach = async (
    deviceId: string,
    onPacket: (base64: string) => void,
    onDisconnect?: () => void,
): Promise<transport.Connection> => {
    try {
        const opened = await transport.connect(deviceId, onPacket, onDisconnect);
        const at = new Date().toISOString();
        await updatePaired({ lastSeenAt: at, lastAttempt: { at, outcome: 'ok' } });
        return opened;
    } catch (err) {
        const unreachable = transport.isUnreachable(err);
        const reason = unreachable ? UNREACHABLE : err instanceof Error ? err.message : String(err);
        await updatePaired({
            lastAttempt: { at: new Date().toISOString(), outcome: unreachable ? 'unreachable' : 'failed', reason },
        }).catch(() => undefined);
        throw unreachable ? new Error(reason) : err;
    }
};

/** Record a battery reading with the time it was taken. */
export const recordBattery = (pct: number): Promise<void> =>
    updatePaired({ lastBattery: pct, batteryAt: new Date().toISOString() });

/**
 * Listen for the paired bracelet's advertisement. A bracelet heard is one that answered, so
 * it moves `lastSeenAt`; one not heard writes nothing — silence is not an attempt that failed,
 * and the stored outcome is what a sync found.
 */
export const lookFor = async (): Promise<boolean> => {
    const paired = await getPaired();
    if (!paired) return false;
    const { seen } = await transport.seek(paired.id);
    if (seen) await updatePaired({ lastSeenAt: new Date().toISOString() });
    return seen;
};
