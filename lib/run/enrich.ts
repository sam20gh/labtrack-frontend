/**
 * Android: fill a live run's steps from Health Connect once it has them.
 *
 * Runs after a health sync. For each recent live session with no cadence yet, asks Health
 * Connect for the steps inside the session's window and sends them to the fill-only endpoint.
 * Each session is asked about once per app run: a window with no steps in it stays that way,
 * and asking every sync would be a query a minute for an answer that will not change.
 */
import { Platform } from 'react-native';
import { enrichLiveSession, listSessions } from '../activity';

const asked = new Set<string>();

export const fillLiveSteps = async (): Promise<number> => {
    if (Platform.OS !== 'android') return 0;
    // Required lazily: the Health Connect module is Android-only native code.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stepsBetween } = require('../health/healthConnect') as typeof import('../health/healthConnect');
    const from = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const { sessions } = await listSessions({ from, limit: 50 });
    let filled = 0;
    for (const s of sessions) {
        if (s.source !== 'live' || s.cadence != null || !s.endedAt || asked.has(s._id)) continue;
        asked.add(s._id);
        const steps = await stepsBetween(s.startedAt, s.endedAt);
        if (!steps) continue;
        await enrichLiveSession(s._id, { steps }).then(() => { filled += 1; }).catch(() => undefined);
    }
    return filled;
};
