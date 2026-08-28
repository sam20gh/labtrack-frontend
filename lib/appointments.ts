/**
 * Appointment client and scheduling helpers.
 *
 * The turing kit's Doctor Appointment flow draws a diary: each doctor card carries a strip
 * of days labelled "Available" / "Unavailable", and the booking screen picks a slot out of
 * it. **LabTrack has no availability model** — `models/Appointment.js` stores a booking and
 * nothing describes a professional's working hours. Rendering the kit's labels literally
 * would mean inventing a signal, and "Available" is the one word on that screen a person
 * acts on.
 *
 * So the strip shows what the API can actually back: which days are open to a *request*.
 * `POST /appointments` creates the booking with `status: 'requested'`, the professional
 * confirms it, and every surface here says so. The only day state that is real is the one
 * derived from the user's own diary — a day they already hold an appointment on.
 */
import { api, apiFetch } from './api';
import type { Appointment, Professional, Id } from '@/types/api';

// ---------------------------------------------------------------------------
// Wire calls
// ---------------------------------------------------------------------------

export const getAppointments = () =>
    api.get<{ appointments: Appointment[] }>('/appointments').then((r) => r.appointments ?? []);

export interface BookingRequest {
    professionalId: Id;
    scheduledFor: Date;
    mode: AppointmentMode;
    reasonForVisit?: string;
    durationMinutes?: number;
    planItemId?: Id;
}

export const createAppointment = (req: BookingRequest) =>
    apiFetch<{ appointment: Appointment }>('/appointments', {
        method: 'POST',
        body: {
            professionalId: req.professionalId,
            planItemId: req.planItemId,
            scheduledFor: req.scheduledFor.toISOString(),
            durationMinutes: req.durationMinutes ?? DEFAULT_DURATION,
            mode: req.mode,
            reasonForVisit: req.reasonForVisit?.trim() || undefined,
        },
    }).then((r) => r.appointment);

export const cancelAppointment = (id: Id, reason?: string) =>
    apiFetch<{ appointment: Appointment }>(`/appointments/${id}/cancel`, {
        method: 'POST',
        body: { reason },
    }).then((r) => r.appointment);

export const rescheduleAppointment = (id: Id, scheduledFor: Date, mode?: AppointmentMode) =>
    apiFetch<{ appointment: Appointment }>(`/appointments/${id}/reschedule`, {
        method: 'POST',
        body: { scheduledFor: scheduledFor.toISOString(), mode },
    }).then((r) => r.appointment);

// ---------------------------------------------------------------------------
// Modes and statuses
// ---------------------------------------------------------------------------

export type AppointmentMode = 'video' | 'phone' | 'in_person';

export const MODES: { value: AppointmentMode; label: string; icon: string; hint: string }[] = [
    { value: 'video', label: 'Video', icon: 'videocam-outline', hint: 'Call from the app' },
    { value: 'phone', label: 'Phone', icon: 'call-outline', hint: 'They call you' },
    { value: 'in_person', label: 'In person', icon: 'walk-outline', hint: 'At the clinic' },
];

export const MODE_LABEL: Record<AppointmentMode, string> = {
    video: 'Video call',
    phone: 'Phone call',
    in_person: 'In person',
};

export const MODE_ICON: Record<AppointmentMode, string> = {
    video: 'videocam-outline',
    phone: 'call-outline',
    in_person: 'walk-outline',
};

/**
 * Status presentation.
 *
 * `requested` is the status every booking starts in, so it gets the honest label rather
 * than being dressed up as confirmed — the difference is whether the person should turn up.
 */
export const STATUS_META: Record<
    Appointment['status'],
    { label: string; color: string; bg: string }
> = {
    requested: { label: 'Awaiting confirmation', color: '#B45309', bg: '#FFFBEB' },
    confirmed: { label: 'Confirmed', color: '#059669', bg: '#ECFDF5' },
    completed: { label: 'Completed', color: '#6B7280', bg: '#F9FAFB' },
    cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEF2F2' },
    no_show: { label: 'Missed', color: '#DC2626', bg: '#FEF2F2' },
};

/** Statuses that still occupy a slot in the diary and can be acted on. */
export const LIVE_STATUSES: Appointment['status'][] = ['requested', 'confirmed'];

export const isLive = (a: Appointment) => LIVE_STATUSES.includes(a.status);

// ---------------------------------------------------------------------------
// Professionals on an appointment
// ---------------------------------------------------------------------------

/** `GET /appointments` populates the professional; everywhere else it is a bare id. */
export const professionalOf = (a: Appointment): Partial<Professional> | null =>
    a.professionalId && typeof a.professionalId === 'object'
        ? (a.professionalId as Professional)
        : null;

export const professionalIdOf = (a: Appointment): Id =>
    typeof a.professionalId === 'object' ? (a.professionalId as Professional)._id : a.professionalId;

export const nameOf = (p?: Partial<Professional> | null) =>
    p ? `Dr ${p.firstname ?? ''} ${p.lastname ?? ''}`.replace(/\s+/g, ' ').trim() : 'Your specialist';

export const initialsOf = (p?: Partial<Professional> | null) =>
    `${p?.firstname?.[0] ?? ''}${p?.lastname?.[0] ?? ''}`.toUpperCase() || '?';

// ---------------------------------------------------------------------------
// Days and slots
// ---------------------------------------------------------------------------

export const DEFAULT_DURATION = 30;

/** How far ahead a request can be made. Two weeks keeps the strip scannable. */
export const BOOKING_HORIZON_DAYS = 14;

/** Consulting hours the slot grid is drawn from, 24h, end exclusive. */
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 17;
const SLOT_MINUTES = 30;

/** Local `YYYY-MM-DD`. Grouping by UTC files an evening appointment under the next day. */
export const dayKey = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
};

export const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
};

export const isSameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

export const isToday = (d: Date) => isSameDay(d, new Date());

export interface BookableDay {
    date: Date;
    key: string;
    /** 'M', 'T', … as the kit's day cell draws it. */
    weekday: string;
    dayOfMonth: number;
    /** Weekends carry no consulting hours, so there is nothing to request. */
    open: boolean;
    /** The user already holds a live appointment with this professional that day. */
    booked: boolean;
    today: boolean;
}

/**
 * The strip of days a request can be made for.
 *
 * `existing` is the user's own diary, which is the only per-day signal the API can supply.
 */
export const bookableDays = (
    existing: Appointment[] = [],
    professionalId?: Id,
    horizon = BOOKING_HORIZON_DAYS,
): BookableDay[] => {
    const mine = new Set(
        existing
            .filter(isLive)
            .filter((a) => !professionalId || professionalIdOf(a) === professionalId)
            .map((a) => dayKey(new Date(a.scheduledFor))),
    );

    const today = startOfDay(new Date());
    return Array.from({ length: horizon }, (_, i) => {
        const date = addDays(today, i);
        const dow = date.getDay();
        const key = dayKey(date);
        return {
            date,
            key,
            weekday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow],
            dayOfMonth: date.getDate(),
            open: dow !== 0 && dow !== 6,
            booked: mine.has(key),
            today: i === 0,
        };
    });
};

export interface Slot {
    /** Local start time. */
    at: Date;
    label: string;
    /** In the past, or already held by one of the user's live appointments. */
    disabled: boolean;
    reason?: 'past' | 'taken';
}

/**
 * Requestable times on one day.
 *
 * A slot is offered unless it has passed or the user is already booked into it — those two
 * are knowable. Whether the doctor is free is not, which is why the button says "Request".
 */
export const slotsForDay = (day: Date, existing: Appointment[] = []): Slot[] => {
    const now = new Date();
    const taken = new Set(
        existing
            .filter(isLive)
            .map((a) => new Date(a.scheduledFor))
            .filter((d) => isSameDay(d, day))
            .map((d) => `${d.getHours()}:${d.getMinutes()}`),
    );

    const out: Slot[] = [];
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
        for (let m = 0; m < 60; m += SLOT_MINUTES) {
            const at = new Date(day);
            at.setHours(h, m, 0, 0);
            const past = at.getTime() <= now.getTime();
            const isTaken = taken.has(`${h}:${m}`);
            out.push({
                at,
                label: formatTime(at),
                disabled: past || isTaken,
                reason: past ? 'past' : isTaken ? 'taken' : undefined,
            });
        }
    }
    return out;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const formatTime = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDayLong = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDayShort = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Today", "Tomorrow", else a short date — the agenda header reads better this way. */
export const formatRelativeDay = (d: Date) => {
    const today = startOfDay(new Date());
    const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return formatDayShort(d);
};

/** Group a diary into `YYYY-MM-DD` buckets, each sorted by time. */
export const groupByDay = (appointments: Appointment[]) => {
    const out: Record<string, Appointment[]> = {};
    for (const a of appointments) {
        const key = dayKey(new Date(a.scheduledFor));
        (out[key] ??= []).push(a);
    }
    for (const key of Object.keys(out)) {
        out[key].sort(
            (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
        );
    }
    return out;
};

/** Upcoming first for the agenda; past appointments keep their own reverse order. */
export const splitByTime = (appointments: Appointment[]) => {
    const now = Date.now();
    const upcoming: Appointment[] = [];
    const past: Appointment[] = [];
    for (const a of appointments) {
        (new Date(a.scheduledFor).getTime() >= now && isLive(a) ? upcoming : past).push(a);
    }
    upcoming.sort((a, b) => +new Date(a.scheduledFor) - +new Date(b.scheduledFor));
    past.sort((a, b) => +new Date(b.scheduledFor) - +new Date(a.scheduledFor));
    return { upcoming, past };
};

/** True while an appointment is close enough to be the thing on screen right now. */
export const isImminent = (a: Appointment, withinMinutes = 30) => {
    if (!isLive(a)) return false;
    const delta = new Date(a.scheduledFor).getTime() - Date.now();
    return delta <= withinMinutes * 60_000 && delta > -(a.durationMinutes ?? DEFAULT_DURATION) * 60_000;
};
