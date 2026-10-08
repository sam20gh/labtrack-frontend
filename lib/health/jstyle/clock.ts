/**
 * The bracelet's own clock: read it, then set it.
 *
 * Every record a bracelet hands over is stamped from its own clock, and the phone sets that
 * clock before every sync and every live view. Setting it used to be all that happened, and
 * that destroyed the evidence: on 2026-10-01 a V8 went back about ten and a half hours at one
 * sync and recorded a morning nap stamped as the evening before. The next sync set the clock
 * right, read the nap and filed it exactly where the stamp said, and nothing anywhere
 * noticed. Seven such stretches turned up in four days of data.
 *
 * So the clock is **read first**. What the phone saw goes to the server with the batch
 * (`SyncBatch.clock`), and `utils/clockFault.js` moves or sets aside whatever was stamped
 * while it was wrong — on this sync and on every later one, because the band never deletes
 * sleep and re-sends the same mis-stamped night for weeks.
 *
 * Two more readings go with it, because nobody yet knows what moves the clock: one when a
 * sync has finished reading and one after its deletes. Each sync reports the previous sync's
 * pair, so the first wrong clock after this ships says whether it was already wrong when the
 * sync before let go of the band — something that sync sent — or went wrong afterwards on the
 * band by itself. The server stores them on the fault it records.
 */
import type { JstyleVariant } from '@/modules/jstyle-ble';

import { readDeviceTime } from './mapping';
import * as session from './session';
import { getPaired, updatePaired, type ClockReading } from './store';

/**
 * Past this, the clock is wrong rather than drifting. The server decides with the same figure
 * (`CLOCK_TOLERANCE_SEC` in `utils/clockFault.js`); here it only decides what to log and what
 * is worth keeping for the next sync.
 */
export const CLOCK_TOLERANCE_SEC = 300;

/** Real minus band, in whole seconds. Null when the band did not say. */
export const skewSec = (reading?: ClockReading | null): number | null => {
    if (!reading?.bandAt) return null;
    return Math.round((Date.parse(reading.phoneAt) - Date.parse(reading.bandAt)) / 1000);
};

export const isWrong = (reading?: ClockReading | null): boolean =>
    Math.abs(skewSec(reading) ?? 0) > CLOCK_TOLERANCE_SEC;

/** Ask the band what time it thinks it is. Never throws; a silent band is `bandAt: null`. */
export const readClock = async (variant: JstyleVariant): Promise<ClockReading> => {
    try {
        const answer = await session.ask(variant, 'getDeviceTime');
        const band = readDeviceTime(answer.packets);
        return { bandAt: band ? band.toISOString() : null, phoneAt: new Date().toISOString() };
    } catch {
        return { bandAt: null, phoneAt: new Date().toISOString() };
    }
};

/** How long a clock set waits for the band's acknowledgement. Nothing depends on it. */
const SET_TIME_REPLY_MS = 1_500;

/**
 * Read the clock, then set it. The order is the whole point.
 *
 * `report` is true for a sync, which sends the reading with its own batch. Anything else that
 * sets the clock passes false, and a wrong reading is kept on the pairing for the next sync to
 * send — once set, nothing else can show it was wrong.
 */
export const checkAndSetClock = async (
    variant: JstyleVariant,
    { report }: { report: boolean },
): Promise<ClockReading & { lastSetAt: string | null }> => {
    const paired = await getPaired();
    // A pairing from before this was recorded has only its last sync, which began seconds
    // before that sync set the clock — earlier, so the server's window errs wider.
    const lastSetAt = paired?.clockSetAt ?? paired?.lastSyncAt ?? null;

    const before = await readClock(variant);
    // The band acknowledges a set with a packet type this build has no name for, and an
    // unnamed packet is ignored unless a filter takes it, so this waited out the full eight
    // seconds on every sync (measured 2026-10-08: "clock 8.1s"). Any reply ends it, and a
    // band that sends none costs `SET_TIME_REPLY_MS` rather than the session's default.
    await session.ask(variant, 'setDeviceTime', {}, () => true, SET_TIME_REPLY_MS);
    await updatePaired({ clockSetAt: new Date().toISOString() });

    if (isWrong(before)) {
        console.warn(`⏰ Bracelet clock was ${skewSec(before)}s off; set it.`);
        if (!report) await updatePaired({ unreportedClock: { ...before, lastSetAt } });
    }
    return { ...before, lastSetAt };
};
