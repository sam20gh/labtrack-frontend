/**
 * Vendor payloads into LabTrack rows.
 *
 * The only file that knows what the SDK's dictionary keys mean. Everything above it works
 * in `lib/health/types.ts` vocabulary, so a firmware change or a vendor rename is a change
 * here and nowhere else.
 *
 * Two rules run through all of it:
 *
 * **Null, never zero.** A figure the bracelet did not report is absent, not `0`. A band
 * that was off the wrist all afternoon and a person who genuinely did not move produce the
 * same zero, and they are not the same fact — the distinction `alignment: 'unassessed'`
 * makes everywhere else in this codebase.
 *
 * **Nothing is derived that the device already reports.** Where the bracelet gives a heart
 * rate, a stress score or a blood pressure, it is carried across as-is. Recomputing any of
 * them from the waveform would put a second, disagreeing answer in the record.
 */
import type { JstylePacket, JstyleVariant } from '@/modules/jstyle-ble';
import type {
    ActivityRow, BloodPressureRow, DayRow, EcgRow, HeartRow, SleepRow, SleepStage,
    SourceDevice, Spo2Row, TemperatureRow,
} from '../types';

/** The vendor's keys, named once. */
const K = {
    date: 'date', time: 'Time',
    step: 'step', calories: 'calories', distance: 'distance',
    exerciseMinutes: 'exerciseMinutes', activeMinutes: 'ExerciseTime',
    sleepUnit: 'sleepUnitLength', sleepArray: 'arraySleepQuality',
    staticHr: 'onceHeartValue', dynamicHr: 'arrayDynamicHR', heartValue: 'heartValue',
    hrv: 'hrv', stress: 'stress', fatigue: 'fatigueDegree', vascularAging: 'vascularAging',
    highPressure: 'highPressure', lowPressure: 'lowPressure',
    highBp: 'highBP', lowBp: 'lowBP',
    spo2: 'Blood_oxygen',
    temperature: 'temperature', axillary: 'axillaryTemperature',
    ecgValue: 'ECGValue', ppgValue: 'PPGValue', ecgString: 'KEcgDataString',
    ecgHr: 'ECGHrValue', ecgHrv: 'ECGHrvValue', ecgStress: 'ECGStreesValue',
    ecgBreath: 'ECGBreathValue', ecgHighBp: 'ECGhighBpValue', ecgLowBp: 'ECGLowBpValue',
    ecgQuality: 'ECGQualityValue',
    ppgSbp: 'PPGSBP', ppgDbp: 'PPGDBP', ppgHr: 'PPGHR',
    battery: 'batteryLevel', mac: 'macAddress',
    version: 'deviceVersion', name: 'deviceName',
} as const;

// ── primitives ──────────────────────────────────────────────────────────────

/** A number, or null. Never `0` for "absent" — see the header. */
const num = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
};

/** A number that must be positive to mean anything, e.g. a heart rate. */
const positive = (value: unknown): number | null => {
    const n = num(value);
    return n !== null && n > 0 ? n : null;
};

/**
 * The vendor's timestamps, which arrive in at least three spellings.
 *
 * `2022-04-07 02:28:01` is the documented one, but `yyyy.MM.dd HH:mm:ss` and a bare date
 * both turn up, and a space instead of a `T` is not a valid ISO instant on every JS engine.
 * Parsing by hand rather than trusting `new Date(string)` also keeps it **local**: the
 * bracelet has no timezone and its clock was set from this phone, so `02:28` means 02:28
 * where the person was — reading it as UTC files a night's sleep under the wrong day, which
 * is the one thing the sleep tracker cannot survive.
 */
const parseInstant = (value: unknown): Date | null => {
    if (!value) return null;
    const text = String(value).trim().replace(/\./g, '-');
    const m = text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (!m) return null;

    const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
    const date = new Date(
        Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s),
    );
    return Number.isNaN(date.getTime()) ? null : date;
};

/** `YYYY-MM-DD` in the phone's own calendar. */
const localDay = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * The vendor's arrays, which are space-separated strings as often as they are arrays.
 *
 * `arraySleepQuality=58 2 2 2 2 …` is a single string in the documented sample and a real
 * list once it has been through the Android bridge. Handling only one shape loses a whole
 * night's hypnogram, silently, on one platform.
 */
const numberList = (value: unknown): number[] => {
    if (Array.isArray(value)) {
        return value.map((v) => num(v)).filter((n): n is number => n !== null);
    }
    if (typeof value === 'string') {
        return value.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    }
    return [];
};

/**
 * A stable identity for a reading, so a re-sync updates rather than duplicates.
 *
 * The bracelet gives no identifiers of its own, so one is built from what cannot change:
 * the device, the kind of reading, and the instant it was taken. Re-reading the same
 * history — which happens on every sync until the rows are acknowledged and deleted —
 * therefore upserts onto the same row. Including the device id keeps two bracelets on one
 * account from colliding on a shared timestamp.
 */
const idFor = (deviceId: string, kind: string, at: Date, extra = ''): string =>
    `jstyle:${deviceId}:${kind}:${at.getTime()}${extra ? `:${extra}` : ''}`;

export interface MapContext {
    deviceId: string;
    variant: JstyleVariant;
    device: SourceDevice;
}

/**
 * Every packet of a series carries its payload the same way, under `dicData`.
 *
 * The bridge already lifts that, but the vendor sends a *list* of records per packet for
 * history series and a bare object for single replies. Flattening here means each mapper
 * below reads one record at a time and never has to know which shape it got.
 */
const records = (packets: JstylePacket[]): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    packets.forEach((packet) => {
        const data = packet.data as Record<string, unknown>;
        // The list arrives either as `dicData` or as the payload itself once unwrapped.
        const list = Array.isArray(data) ? data : data?.ActivityData ?? data?.dicData ?? data;
        if (Array.isArray(list)) {
            list.forEach((item) => {
                if (item && typeof item === 'object') out.push(item as Record<string, unknown>);
            });
        } else if (list && typeof list === 'object') {
            out.push(list as Record<string, unknown>);
        }
    });
    return out;
};

// ── activity ────────────────────────────────────────────────────────────────

/**
 * Whole-day totals.
 *
 * These are `DayRow`s, not `ActivityRow`s, and the difference is the one
 * `lib/health/types.ts` already draws: steps are a day's figure the device reports
 * directly, never the sum of workouts. Filing them as sessions would double every step
 * taken during a recorded walk.
 */
export const toDays = (packets: JstylePacket[]): DayRow[] => {
    const byDay = new Map<string, DayRow>();

    records(packets).forEach((r) => {
        const at = parseInstant(r[K.date]);
        if (!at) return;

        const day = localDay(at);
        const row: DayRow = byDay.get(day) ?? { day };

        const steps = num(r[K.step]);
        const kcal = num(r[K.calories]);
        const distance = num(r[K.distance]);
        const exercise = num(r[K.exerciseMinutes]) ?? num(r[K.activeMinutes]);

        // A bracelet reports a day's totals more than once as the day goes on, and the
        // later report is the fuller one. Taking the max rather than the last also survives
        // packets arriving out of order, which they do after a paged read.
        if (steps !== null) row.steps = Math.max(row.steps ?? 0, steps);
        if (kcal !== null) row.activeKcal = Math.max(row.activeKcal ?? 0, kcal);
        if (distance !== null) row.distanceM = Math.max(row.distanceM ?? 0, distance);
        if (exercise !== null) row.exerciseMin = Math.max(row.exerciseMin ?? 0, exercise);

        byDay.set(day, row);
    });

    return [...byDay.values()];
};

/**
 * Exercise the person started on the bracelet.
 *
 * Only `activityModeData` produces these — a deliberate session with a start, an end and a
 * mode. Everything else the band records is ambient movement and belongs in the day's
 * totals.
 */
export const toActivities = (packets: JstylePacket[], ctx: MapContext): ActivityRow[] =>
    records(packets).flatMap((r) => {
        const at = parseInstant(r[K.date]);
        if (!at) return [];

        const durationSec = (num(r.sportModelTime) ?? num(r[K.activeMinutes]) ?? 0) * 60;
        if (durationSec <= 0) return [];

        return [{
            externalId: idFor(ctx.deviceId, 'activity', at),
            // The server's `normaliseType` maps vendor names onto its own vocabulary, so
            // the vendor's own mode number is passed through rather than guessed at here.
            type: `jstyle_${num(r.sportModel) ?? 'session'}`,
            startedAt: at.toISOString(),
            endedAt: new Date(at.getTime() + durationSec * 1000).toISOString(),
            durationSec,
            distanceM: positive(r[K.distance]) ?? undefined,
            activeKcal: positive(r[K.calories]) ?? undefined,
            avgBpm: positive(r[K.heartValue]) ?? undefined,
            sourceDevice: ctx.device,
        }];
    });

// ── sleep ───────────────────────────────────────────────────────────────────

/**
 * The vendor's sleep codes, per unit length.
 *
 * Two scales, documented in the SDK's own `sleep.txt`, and using the wrong one turns a
 * night into noise rather than failing. At one minute per value the code *is* the stage; at
 * five minutes per value the number is a count that has to be divided by five and banded.
 * `sleepUnitLength` is what says which, and it varies by firmware rather than by model —
 * so it is read per record and never assumed.
 */
const STAGE_BY_CODE: Record<number, SleepStage> = { 1: 'deep', 2: 'light', 3: 'rem' };

const stageFor = (value: number, unitMinutes: number): SleepStage => {
    if (unitMinutes === 1) return STAGE_BY_CODE[value] ?? 'awake';
    const perMinute = value / 5;
    if (perMinute <= 2) return 'deep';
    if (perMinute <= 8) return 'light';
    if (perMinute <= 20) return 'rem';
    return 'awake';
};

/**
 * One night, as a hypnogram.
 *
 * The bracelet gives a start instant, a unit length and a run of codes; the segments are
 * built by walking that run and merging neighbours of the same stage. Merging matters:
 * unmerged, a night is several hundred one-minute segments, which is a slow chart and a
 * large document to no purpose.
 *
 * The **wake day** filing that `SleepSession` requires is the server's job — `healthSync`
 * already files a night under the day it ended, and duplicating that rule here would give
 * two places to get it wrong.
 */
export const toSleep = (packets: JstylePacket[], ctx: MapContext): SleepRow[] =>
    records(packets).flatMap((r) => {
        const start = parseInstant(r[K.date]);
        const codes = numberList(r[K.sleepArray]);
        if (!start || codes.length === 0) return [];

        const unit = num(r[K.sleepUnit]) ?? 1;
        const segments: NonNullable<SleepRow['segments']> = [];

        codes.forEach((code, index) => {
            const stage = stageFor(code, unit);
            const from = new Date(start.getTime() + index * unit * 60_000);
            const to = new Date(from.getTime() + unit * 60_000);
            const last = segments[segments.length - 1];

            if (last && last.stage === stage) last.endedAt = to.toISOString();
            else segments.push({ stage, startedAt: from.toISOString(), endedAt: to.toISOString() });
        });

        const end = new Date(start.getTime() + codes.length * unit * 60_000);
        const asleepMin = codes.filter((c) => stageFor(c, unit) !== 'awake').length * unit;

        return [{
            externalId: idFor(ctx.deviceId, 'sleep', start),
            startedAt: start.toISOString(),
            endedAt: end.toISOString(),
            segments,
            asleepMin,
            inBedMin: codes.length * unit,
            sourceDevice: ctx.device,
        }];
    });

// ── heart ───────────────────────────────────────────────────────────────────

/**
 * Spot heart-rate measurements.
 *
 * `staticHr` only. The continuous stream goes to `toHeartDays` instead, because
 * `lib/health/types.ts` is explicit that nothing in the app plots a reading every few
 * seconds and the dashboards want the day's spread — a night of continuous monitoring is
 * tens of thousands of rows nobody reads.
 *
 * `resting` is honest for these: the bracelet takes them on a timer while the person is
 * still, which is what the context means.
 */
export const toHeart = (packets: JstylePacket[], ctx: MapContext): HeartRow[] =>
    records(packets).flatMap((r) => {
        const at = parseInstant(r[K.date]) ?? parseInstant(r[K.time]);
        const bpm = positive(r[K.staticHr]) ?? positive(r[K.heartValue]);
        if (!at || bpm === null) return [];

        return [{
            externalId: idFor(ctx.deviceId, 'hr', at),
            measuredAt: at.toISOString(),
            bpm,
            context: 'resting',
            sourceDevice: ctx.device,
        }];
    });

/**
 * The continuous stream, reduced to each day's spread.
 *
 * Zeroes are dropped before anything is computed, and that is the whole correctness of this
 * function: the bracelet emits `0` for every interval the band was off the wrist or could
 * not get a reading, and those are far and away the most common values in a day's array.
 * Averaging them in drags a resting rate of 62 down into the forties, and `minBpm` becomes
 * `0` — a number that would then be plotted, scored, and eventually predicted from.
 */
export const toHeartDays = (packets: JstylePacket[]): DayRow[] => {
    const byDay = new Map<string, number[]>();

    records(packets).forEach((r) => {
        const at = parseInstant(r[K.date]);
        if (!at) return;
        const values = numberList(r[K.dynamicHr]).filter((v) => v > 0);
        if (!values.length) return;
        byDay.set(localDay(at), [...(byDay.get(localDay(at)) ?? []), ...values]);
    });

    return [...byDay.entries()].map(([day, values]) => ({
        day,
        minBpm: Math.min(...values),
        maxBpm: Math.max(...values),
        avgBpm: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));
};

/**
 * HRV, and the blood-pressure estimate that rides along with it.
 *
 * The vendor computes both from the same pulse-wave analysis and returns them in one
 * packet, which is exactly why `BloodPressureRow.method` exists: by the time these two
 * numbers are in separate collections, nothing else records that the blood pressure came
 * out of an HRV measurement rather than off a cuff.
 */
export const toHrvDays = (packets: JstylePacket[]): DayRow[] => {
    const byDay = new Map<string, number[]>();

    records(packets).forEach((r) => {
        const at = parseInstant(r[K.date]);
        const hrv = positive(r[K.hrv]);
        if (!at || hrv === null) return;
        byDay.set(localDay(at), [...(byDay.get(localDay(at)) ?? []), hrv]);
    });

    return [...byDay.entries()].map(([day, values]) => ({
        day,
        hrvMs: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));
};

export const toBloodPressure = (
    packets: JstylePacket[], ctx: MapContext,
): BloodPressureRow[] =>
    records(packets).flatMap((r) => {
        const at = parseInstant(r[K.date]);
        const systolic = positive(r[K.highPressure]) ?? positive(r[K.highBp]);
        const diastolic = positive(r[K.lowPressure]) ?? positive(r[K.lowBp]);
        if (!at || systolic === null || diastolic === null) return [];

        // A transposed or impossible pair is dropped rather than sent. The server answers
        // 400 for one, and a whole batch rejected over a single bad optical read would cost
        // the sync every other row in it.
        if (systolic <= diastolic || systolic > 300 || diastolic < 20) return [];

        return [{
            externalId: idFor(ctx.deviceId, 'bp', at),
            measuredAt: at.toISOString(),
            systolic,
            diastolic,
            pulse: positive(r[K.heartValue]) ?? undefined,
            method: 'optical_estimate',
            sourceDevice: ctx.device,
        }];
    });

// ── spo2, temperature ───────────────────────────────────────────────────────

export const toSpo2 = (
    packets: JstylePacket[], ctx: MapContext, context: Spo2Row['context'],
): Spo2Row[] =>
    records(packets).flatMap((r) => {
        const at = parseInstant(r[K.date]);
        const spo2 = positive(r[K.spo2]);
        // Below 70% is outside what a wrist sensor can measure rather than a medical
        // emergency it has detected, and above 100 is impossible. Both are dropped so the
        // record does not carry a reading nobody should act on.
        if (!at || spo2 === null || spo2 < 70 || spo2 > 100) return [];

        return [{
            externalId: idFor(ctx.deviceId, `spo2_${context}`, at),
            measuredAt: at.toISOString(),
            spo2,
            context,
            sourceDevice: ctx.device,
        }];
    });

export const toTemperature = (
    packets: JstylePacket[], ctx: MapContext, site: TemperatureRow['site'],
): TemperatureRow[] =>
    records(packets).flatMap((r) => {
        const at = parseInstant(r[K.date]);
        const celsius = site === 'axillary'
            ? num(r[K.axillary]) ?? num(r[K.temperature])
            : num(r[K.temperature]);
        // A wrist sensor reads well below core and the vendor reports 0 for a failed
        // sample; anything outside a band a living person can be in is a sensor fault, not
        // a finding.
        if (!at || celsius === null || celsius < 20 || celsius > 45) return [];

        return [{
            externalId: idFor(ctx.deviceId, `temp_${site}`, at),
            measuredAt: at.toISOString(),
            celsius: Math.round(celsius * 10) / 10,
            site,
            sourceDevice: ctx.device,
        }];
    });

// ── ECG / PPG ───────────────────────────────────────────────────────────────

/**
 * One measurement, waveform and all.
 *
 * Every derived figure is the bracelet's own. Nothing here computes a heart rate from the
 * trace or an interval from the peaks: LabTrack has no ECG engine, and inventing one in a
 * mapping file would be a clinical claim made in the quietest possible place.
 */
export const toEcg = (packets: JstylePacket[], ctx: MapContext): EcgRow[] => {
    const samples: number[] = [];
    let at: Date | null = null;
    let result: EcgRow['result'] = {};
    let kind: EcgRow['kind'] = 'ecg';

    records(packets).forEach((r) => {
        at = at ?? parseInstant(r[K.date]);

        const ecg = numberList(r[K.ecgValue] ?? r[K.ecgString]);
        const ppg = numberList(r[K.ppgValue]);
        if (ecg.length) samples.push(...ecg);
        if (ppg.length) { samples.push(...ppg); if (!ecg.length) kind = 'ppg'; }

        const merge = (key: keyof NonNullable<EcgRow['result']>, value: number | null) => {
            if (value !== null) result = { ...result, [key]: value };
        };
        merge('hrBpm', positive(r[K.ecgHr]) ?? positive(r[K.ppgHr]));
        merge('hrvMs', positive(r[K.ecgHrv]));
        merge('stress', num(r[K.ecgStress]));
        merge('breathRate', positive(r[K.ecgBreath]));
        merge('systolic', positive(r[K.ecgHighBp]) ?? positive(r[K.ppgSbp]));
        merge('diastolic', positive(r[K.ecgLowBp]) ?? positive(r[K.ppgDbp]));
        merge('quality', num(r[K.ecgQuality]));
    });

    // A measurement with neither a trace nor a single derived figure is a failed one. The
    // bracelet reports those, and storing them would fill somebody's history with empty
    // records of attempts rather than results.
    if (!at || (!samples.length && !Object.keys(result).length)) return [];

    return [{
        externalId: idFor(ctx.deviceId, kind, at),
        measuredAt: (at as Date).toISOString(),
        kind,
        samples,
        // The vendor's fixed rate for both sensors, and it is not reported per measurement.
        sampleRateHz: 125,
        durationSec: samples.length ? Math.round(samples.length / 125) : undefined,
        result: Object.keys(result).length ? result : undefined,
        sourceDevice: ctx.device,
    }];
};

// ── replies that are not history ────────────────────────────────────────────

export const readBattery = (packets: JstylePacket[]): number | null =>
    positive(records(packets)[0]?.[K.battery]);

export const readIdentity = (packets: JstylePacket[]): Partial<SourceDevice> => {
    const r = records(packets)[0] ?? {};
    return {
        name: (r[K.name] as string) || undefined,
        model: (r[K.version] as string) || undefined,
    };
};

export const readMac = (packets: JstylePacket[]): string | null =>
    (records(packets)[0]?.[K.mac] as string) || null;
