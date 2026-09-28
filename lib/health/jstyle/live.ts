/**
 * The bracelet, right now.
 *
 * Two things a sync cannot give: a heart rate that updates while somebody watches it, and a
 * reading taken because they asked for one. Both hold the bracelet's one connection for as
 * long as a screen is open, which is why this is its own module with its own lifecycle
 * rather than a mode of the reader — and why the reader refuses to sync while `isLive()`.
 *
 * ## What is stored, and what is only shown
 *
 * The stream is **shown and never stored.** It is a reading a second, and the bracelet
 * already records its own continuous heart rate, which the next sync brings over as the
 * day's spread. Storing the stream as well would put the same heartbeat in the record
 * twice, from two paths that disagree by a beat.
 *
 * A **measurement** is stored, once, when it finishes. It is a deliberate reading taken
 * sitting still, which is what `context: 'manual'` means, and the V8's Android SDK has no
 * manual-SpO2 history for a sync to find it in later.
 */
import { supports, type JstyleMeasure, type JstylePacket } from '@/modules/jstyle-ble';
import { getWearableStatus, syncBatch } from '@/lib/activity';
import * as transport from './transport';
import * as session from './session';
import { getPaired, updatePaired, type PairedBracelet } from './store';

export interface LiveReading {
    heartRate: number | null;
    steps: number | null;
    temperature: number | null;
    spo2: number | null;
    at: number;
}

export interface MeasureResult {
    kind: JstyleMeasure;
    heartRate: number | null;
    spo2: number | null;
    hrv: number | null;
    stress: number | null;
    systolic: number | null;
    diastolic: number | null;
}

/**
 * How long a measurement runs. The iOS SDK's floor is 30 seconds; 45 gives an optical
 * sensor time to settle on a wrist that has just been moved to look at the screen.
 */
export const MEASURE_SECONDS = 45;

let live = false;
let variantInUse: PairedBracelet['variant'] | null = null;

export const isLive = (): boolean => live;

// ── packet reading ──────────────────────────────────────────────────────────

/**
 * The first key present, as a positive number.
 *
 * Android and iOS spell these keys differently — `heartRate` against `HeartRate`, and the
 * temperature arrives as `TempData` from one SDK and `temperature` from the other — and a
 * sensor that has no reading yet reports 0, which is "not yet", not a heart that stopped.
 */
const pick = (data: Record<string, unknown>, keys: string[]): number | null => {
    for (const key of keys) {
        const n = Number(data[key]);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
};

const HR_KEYS = ['heartRate', 'HeartRate', 'heartValue'];
const SPO2_KEYS = ['Blood_oxygen', 'bloodOxygen', 'spo2'];

const readLive = (packet: JstylePacket): LiveReading => ({
    heartRate: pick(packet.data, HR_KEYS),
    steps: pick(packet.data, ['step', 'steps']),
    temperature: pick(packet.data, ['TempData', 'temperature']),
    spo2: pick(packet.data, SPO2_KEYS),
    at: Date.now(),
});

const MEASUREMENT_TYPES = new Set<JstylePacket['type']>([
    'deviceMeasurementHr', 'deviceMeasurementHrv', 'deviceMeasurementSpo2',
]);

// ── the live session ────────────────────────────────────────────────────────

export interface LiveHandlers {
    onReading: (reading: LiveReading) => void;
    onMeasurement: (partial: MeasureResult) => void;
    /** The bracelet went out of range or was switched off. */
    onLost: () => void;
}

let measuring: JstyleMeasure | null = null;
let lastMeasurement: MeasureResult | null = null;

/**
 * Connect and start the stream.
 *
 * The clock is set first for the same reason the reader does it: a measurement taken now is
 * stamped by the bracelet's clock, and a flat battery resets that to 1970.
 */
export const start = async (handlers: LiveHandlers): Promise<void> => {
    const paired = await getPaired();
    if (!paired) throw new Error('No bracelet is paired.');
    if (!supports(paired.variant, 'liveData')) {
        throw new Error('Live readings need the latest version of the app.');
    }
    if (live) return;

    const { variant } = paired;
    live = true;
    variantInUse = variant;

    session.onUnsolicited((packet) => {
        if (packet.type === 'realTimeStep') {
            handlers.onReading(readLive(packet));
        } else if (measuring && MEASUREMENT_TYPES.has(packet.type)) {
            const result: MeasureResult = {
                kind: measuring,
                heartRate: pick(packet.data, HR_KEYS),
                spo2: pick(packet.data, SPO2_KEYS),
                hrv: pick(packet.data, ['hrv', 'HRV']),
                stress: pick(packet.data, ['stress', 'Stress']),
                systolic: pick(packet.data, ['highPressure', 'highBP']),
                diastolic: pick(packet.data, ['lowPressure', 'lowBP']),
            };
            // A later packet with a blank field must not erase an earlier real value.
            lastMeasurement = lastMeasurement
                ? Object.fromEntries(Object.entries(result).map(([k, v]) => [
                    k, v ?? lastMeasurement![k as keyof MeasureResult],
                ])) as unknown as MeasureResult
                : result;
            handlers.onMeasurement(lastMeasurement);
        }
    });

    try {
        await transport.connect(paired.id, session.makePacketHandler(variant), () => {
            const wasLive = live;
            cleanUp(variant);
            if (wasLive) handlers.onLost();
        });
        await session.ask(variant, 'setDeviceTime');
        const first = await session.ask(
            variant, 'liveData', { live: true }, (p) => p.type === 'realTimeStep',
        );
        first.packets.forEach((p) => handlers.onReading(readLive(p)));
    } catch (err) {
        await stop();
        throw err;
    }
};

const cleanUp = (variant: PairedBracelet['variant']) => {
    live = false;
    measuring = null;
    lastMeasurement = null;
    variantInUse = null;
    session.onUnsolicited(null);
    session.reset(variant);
};

/**
 * Stop the stream and let go of the bracelet.
 *
 * Every step is best-effort and the disconnect always happens: a stream left running keeps
 * the bracelet's radio awake and drains it in a day, and a held connection stops the next
 * sync connecting at all.
 */
export const stop = async (): Promise<void> => {
    // Nothing of ours is open. Disconnecting anyway would cut off a sync mid-read.
    if (!live && !variantInUse) return;
    const variant = variantInUse;
    if (variant && transport.isConnected()) {
        if (measuring) {
            await session.send(variant, 'measure', { measure: measuring, open: false }).catch(() => undefined);
        }
        await session.send(variant, 'liveData', { live: false }).catch(() => undefined);
    }
    await transport.disconnect();
    if (variant) cleanUp(variant);
    live = false;
};

// ── measurements ────────────────────────────────────────────────────────────

/**
 * Take one reading on the bracelet.
 *
 * Resolves with whatever the bracelet reported by the end of the window — possibly nothing,
 * when the band was loose or the arm moved, which the screen says in those words rather than
 * as a zero. The stream keeps running throughout; the measurement's packets are told apart
 * by type.
 */
export const measure = async (kind: JstyleMeasure): Promise<MeasureResult | null> => {
    const variant = variantInUse;
    if (!live || !variant) throw new Error('Start live view first.');
    if (measuring) throw new Error('A measurement is already running.');

    measuring = kind;
    lastMeasurement = null;

    try {
        await session.send(variant, 'measure', { measure: kind, open: true, seconds: MEASURE_SECONDS });
        // A few seconds past the window: the result packet lands after the sensor stops.
        await new Promise((resolve) => setTimeout(resolve, (MEASURE_SECONDS + 5) * 1000));
        if (live) {
            await session.send(variant, 'measure', { measure: kind, open: false }).catch(() => undefined);
        }
    } finally {
        measuring = null;
    }

    const result = lastMeasurement as MeasureResult | null;
    lastMeasurement = null;
    if (!result || !usable(result)) return null;

    await save(result).catch(() => undefined);
    return result;
};

const usable = (r: MeasureResult): boolean =>
    r.kind === 'spo2' ? r.spo2 !== null
        : r.kind === 'hrv' ? r.hrv !== null
            : r.heartRate !== null;

/**
 * Put a finished measurement in the record.
 *
 * Through the same `/wearables/sync` path a history read takes, so the server's plausibility
 * bands apply to it exactly as they do to anything else the bracelet sends, and the id is
 * built the way `mapping.ts` builds one so a later replay of the same reading upserts.
 * HRV is shown and not stored: it arrives as one figure for one minute, and the record keeps
 * HRV as a day's average that this would overwrite.
 */
const save = async (r: MeasureResult): Promise<void> => {
    const paired = await getPaired();
    if (!paired) return;

    const at = new Date().toISOString();
    const id = (kind: string) => `jstyle:${paired.id}:${kind}_manual:${Date.parse(at)}`;
    const device = { name: paired.label, manufacturer: 'J-Style' };

    const heart = r.kind === 'hr' && r.heartRate !== null
        ? [{ externalId: id('hr'), measuredAt: at, bpm: r.heartRate, context: 'manual' as const, sourceDevice: device }]
        : [];
    const spo2 = r.kind === 'spo2' && r.spo2 !== null
        ? [{ externalId: id('spo2'), measuredAt: at, spo2: r.spo2, context: 'manual' as const, sourceDevice: device }]
        : [];
    if (!heart.length && !spo2.length) return;

    // The stored cursor is passed straight back: the server overwrites it with whatever a
    // batch carries, and a null here would make the next sync replay the bracelet's history.
    const status = await getWearableStatus().catch(() => null);
    const cursor = status?.sources.find((s) => s.platform === 'jstyle_bracelet')?.cursor ?? null;

    await syncBatch({
        platform: 'jstyle_bracelet',
        tzOffset: new Date().getTimezoneOffset(),
        cursor,
        activities: [], sleep: [], days: [],
        heart, spo2,
    });

    await updatePaired({
        latest: {
            ...paired.latest,
            ...(heart.length ? { heartRate: { value: heart[0].bpm, at } } : {}),
            ...(spo2.length ? { spo2: { value: spo2[0].spo2, at } } : {}),
        },
    });
};
