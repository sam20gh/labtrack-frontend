/**
 * The spoken coach — a split read out as it lands.
 *
 * Factual and never judgemental, the tone rule the hydration nudge holds: "Three kilometres.
 * Last kilometre, five thirty-one." Never "great job", never "you're slowing down" — a
 * slower kilometre up a hill is the hill, and the app does not know which one it was.
 *
 * Runs from the recorder's change events, so it speaks whether or not the live screen is
 * mounted. **Known limit in this build:** iOS only lets an app keep playing audio in the
 * background with the `audio` background mode, which this build does not declare; with the
 * screen locked, iOS cues may be silent. Adding the mode is an `app.json` change, which moves
 * the fingerprint, so it waits for the next native build. Android speaks under the
 * foreground service.
 */
import * as Speech from 'expo-speech';
import * as recorder from './recorder';
import { getRunSettings, type AudioCues } from './settings';
import { getUnits, type DistanceUnit } from '@/lib/units';
import type { TrackableType } from './trackMath';

const M_PER_MILE = 1609.344;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

/** Words to fifty-nine, which covers every minute and second of a pace; digits beyond. */
const spoken = (n: number) => {
    if (n <= 20) return NUMBER_WORDS[n];
    if (n < 60) return n % 10 ? `${TENS[Math.floor(n / 10)]}-${NUMBER_WORDS[n % 10]}` : TENS[n / 10];
    return String(n);
};

/** The distance between cues for these preferences, in metres. Null when cues are off. */
export const cueInterval = (cues: AudioCues, unit: DistanceUnit): number | null => {
    if (cues === 'off') return null;
    const base = unit === 'mi' ? M_PER_MILE : 1000;
    return cues === 'half' ? base / 2 : base;
};

/** Say "five thirty-one" for 331 s, the way runners say a pace. */
const paceWords = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (s === 0) return `${spoken(m)} minutes`;
    return `${spoken(m)} ${s < 10 ? `oh ${spoken(s)}` : spoken(s)}`;
};

/**
 * The sentence for crossing cue `index` (1-based), or null. Pure, so the wording is tested.
 * `lapSec` is the moving time since the previous cue.
 */
export const cueText = (
    index: number,
    { intervalM, unit, lapSec, type }: { intervalM: number; unit: DistanceUnit; lapSec: number; type: TrackableType },
): string | null => {
    if (index < 1 || lapSec <= 0) return null;
    const unitM = unit === 'mi' ? M_PER_MILE : 1000;
    const unitName = unit === 'mi' ? 'mile' : 'kilometre';
    const covered = (index * intervalM) / unitM;
    const whole = Number.isInteger(Math.round(covered * 100) / 100) ? Math.round(covered) : null;
    const distanceSaid = whole != null
        ? `${spoken(whole)} ${unitName}${whole === 1 ? '' : 's'}`
        : `${covered.toFixed(1)} ${unitName}s`;

    if (type === 'biking') {
        const perHour = (intervalM / lapSec) * 3600 / unitM;
        return `${distanceSaid}. ${Math.round(perHour)} ${unit === 'mi' ? 'miles' : 'kilometres'} an hour.`;
    }
    const pacePerUnit = lapSec * (unitM / intervalM);
    return `${distanceSaid}. Pace, ${paceWords(pacePerUnit)} per ${unitName}.`;
};

let attached = false;
let lastRun: string | null = null;
let lastIndex = 0;
let lastMovingSec = 0;

/** Subscribe once, from `app/_layout.tsx`. Speaks only while a run is recording. */
export const attachCoach = () => {
    if (attached) return;
    attached = true;
    recorder.subscribe(() => {
        const state = recorder.getState();
        if (state.phase !== 'recording' || !state.clientId || !state.live || !state.type) return;
        if (state.clientId !== lastRun) {
            // A new run, or the same run rebuilt from the journal: start counting from where
            // it already is, so a restart does not replay every split.
            lastRun = state.clientId;
            const interval0 = cueInterval(getRunSettings().audioCues, getUnits().distance);
            lastIndex = interval0 ? Math.floor(state.live.distanceM / interval0) : 0;
            lastMovingSec = state.live.movingSec;
            return;
        }
        const intervalM = cueInterval(getRunSettings().audioCues, getUnits().distance);
        if (!intervalM) return;
        const index = Math.floor(state.live.distanceM / intervalM);
        if (index <= lastIndex) return;
        const text = cueText(index, {
            intervalM,
            unit: getUnits().distance,
            lapSec: (state.live.movingSec - lastMovingSec) / (index - lastIndex),
            type: state.type,
        });
        lastIndex = index;
        lastMovingSec = state.live.movingSec;
        if (text) Speech.speak(text, { rate: 0.95 });
    });
};
