/**
 * What the runner set out to do, and how far along they are.
 *
 * A goal is chosen on the launch pad and kept in the journal's meta, so a restarted recorder
 * still knows it. It changes nothing the server stores — it is a lens on the live screen.
 *
 * The pace goal is a **ghost**: a runner at exactly the target pace who started when you
 * did and pauses when you pause (moving time, not clock time), so standing at a crossing
 * does not put you behind. "12 s ahead" is how long the ghost would take to cover the gap.
 */
export type RunGoal =
    | { kind: 'free' }
    | { kind: 'distance'; metres: number }
    | { kind: 'time'; seconds: number }
    | { kind: 'pace'; secPerKm: number };

export const FREE: RunGoal = { kind: 'free' };

export interface GoalProgress {
    /** 0–1, capped. Null for a free run and for a pace goal (which has no end). */
    fraction: number | null;
    done: boolean;
    /** Seconds ahead of the ghost (negative is behind). Pace goals only. */
    ghostGapSec: number | null;
}

export const goalProgress = (
    goal: RunGoal | undefined,
    { distanceM, movingSec, activeSec }: { distanceM: number; movingSec: number; activeSec: number },
): GoalProgress => {
    if (!goal || goal.kind === 'free') return { fraction: null, done: false, ghostGapSec: null };
    if (goal.kind === 'distance') {
        const f = goal.metres > 0 ? distanceM / goal.metres : 0;
        return { fraction: Math.min(1, f), done: f >= 1, ghostGapSec: null };
    }
    if (goal.kind === 'time') {
        const f = goal.seconds > 0 ? activeSec / goal.seconds : 0;
        return { fraction: Math.min(1, f), done: f >= 1, ghostGapSec: null };
    }
    const ghostSpeed = 1000 / goal.secPerKm; // m/s
    const ghostDistance = movingSec * ghostSpeed;
    // Under 50 m of running the gap is GPS noise, not a lead.
    const gap = distanceM < 50 ? null : Math.round((distanceM - ghostDistance) / ghostSpeed);
    return { fraction: null, done: false, ghostGapSec: gap };
};
