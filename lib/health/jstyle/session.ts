/**
 * One conversation with one bracelet.
 *
 * Everything between "a connection exists" and "here are the rows": the mutex that keeps
 * the stateful codec honest, the paging rule that keeps a history read from hanging, and
 * the timeouts that keep a silent bracelet from wedging a sync forever.
 *
 * ## Why a mutex
 *
 * The vendor codec is a set of static methods over static flags: issuing
 * `GetTotalActivityDataWithMode` sets a flag that the *next* parse reads to know what it is
 * decoding. Two reads in flight would decode each other's packets — not fail, decode, into
 * plausible rows of the wrong kind. So commands are serialised here and nothing else in the
 * app is allowed to call `buildCommand` directly.
 *
 * ## Why paging is explicit
 *
 * The bracelet answers a `start` with **at most 50 packets** and then goes quiet. It does
 * not mark the fiftieth as final and it does not keep going. The client counts, and asks
 * for the next batch with `next`. A reader that waits for the end flag alone waits out its
 * timeout against a device that is politely waiting to be asked — which is why this is the
 * one piece of arithmetic in the file with a constant of its own.
 */
import {
    buildCommand, parsePacket, resetCodec, supports,
    type JstyleCommand, type JstylePacket, type JstyleVariant,
} from '@/modules/jstyle-ble';
import * as transport from './transport';

/** The vendor's batch size. See the note above — this is not a tuning parameter. */
const PACKETS_PER_BATCH = 50;

/**
 * How long to wait for the first packet of a reply.
 *
 * Generous because a bracelet that has been asleep takes a moment to answer its first
 * command of a session, and a spuriously short timeout here reads to a person as "pairing
 * failed" on a device that was about to respond.
 */
const FIRST_PACKET_MS = 8_000;

/**
 * How long to wait for the *next* packet of a reply already in progress.
 *
 * Much shorter: a bracelet mid-stream sends continuously, so a gap this long means the
 * stream has ended rather than that the next packet is slow. This is also what terminates a
 * read whose final packet never carried the end flag — firmware that forgets to set it is
 * common enough that treating silence as an ending is the difference between a sync that
 * completes and one that always times out.
 */
const NEXT_PACKET_MS = 2_500;

export interface ReadResult {
    /** Every packet's payload, in arrival order. */
    packets: JstylePacket[];
    /** False when the read stopped on silence rather than on the vendor's end flag. */
    complete: boolean;
    /** Set when the read ended early. Written to be logged, not shown. */
    reason?: string;
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialise everything that touches the codec. See the note above. */
const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    // Swallow here only: the caller still gets the rejection from `next`. Without this the
    // chain itself rejects and every later command fails with the first one's error.
    queue = next.catch(() => undefined);
    return next;
};

/**
 * Packets arriving from the radio, routed to whoever is currently reading.
 *
 * A module-level sink rather than a per-read subscription because the bracelet speaks
 * unprompted — a button press, a finished on-device measurement — and those packets arrive
 * on the same characteristic as a reply. They are handed to `onUnsolicited` rather than
 * dropped, so a screen can react to somebody pressing the button on their watch.
 */
type Sink = (packet: JstylePacket) => void;
let activeSink: Sink | null = null;
let unsolicited: Sink | null = null;

export const onUnsolicited = (handler: Sink | null): void => { unsolicited = handler; };

/** Wired into `transport.connect`, and the only place a packet is decoded. */
export const makePacketHandler = (variant: JstyleVariant) => (base64: string): void => {
    let packet: JstylePacket;
    try {
        packet = parsePacket(variant, base64);
    } catch {
        // A packet the codec could not read at all. Dropping one is survivable; letting it
        // throw would take down the notification subscription and with it the whole sync.
        return;
    }
    (activeSink ?? unsolicited)?.(packet);
};

/**
 * Issue one command and collect its reply.
 *
 * Resolves on the vendor's end flag, on silence, or on the caller's packet budget —
 * whichever comes first. It never rejects on a slow bracelet: a partial read is a real
 * result and the rows in it are as good as the rows in a complete one, so the caller
 * decides what a short read means rather than losing what arrived.
 */
const exchange = async (
    variant: JstyleVariant,
    command: JstyleCommand,
    args: Parameters<typeof buildCommand>[2],
    maxPackets: number,
): Promise<ReadResult> => {
    const packets: JstylePacket[] = [];
    let complete = false;
    let reason: string | undefined;

    await new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        let settled = false;

        const finish = (why?: string) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            activeSink = null;
            reason = why;
            resolve();
        };

        const arm = (ms: number) => {
            clearTimeout(timer);
            timer = setTimeout(
                () => finish(packets.length ? undefined : 'The bracelet did not answer.'),
                ms,
            );
        };

        activeSink = (packet) => {
            // A reply to something else entirely — most often a button press mid-read.
            // Passed on rather than counted, so it cannot end this read early.
            if (packet.type === 'unknown' && !packets.length) {
                unsolicited?.(packet);
                return;
            }

            packets.push(packet);

            if (packet.end) {
                complete = true;
                finish();
                return;
            }
            if (packets.length >= maxPackets) {
                finish();
                return;
            }
            arm(NEXT_PACKET_MS);
        };

        arm(FIRST_PACKET_MS);

        transport.write(buildCommand(variant, command, args)).catch((err) => {
            finish(err instanceof Error ? err.message : 'Could not reach the bracelet.');
        });
    });

    return { packets, complete, reason };
};

/**
 * Read a whole history series, paging until the bracelet says it is done.
 *
 * `maxBatches` is a safety rail rather than a tuning knob. A bracelet whose end flag never
 * arrives would otherwise page forever, and forever here means a connected radio and a
 * spinner on somebody's screen. Fifty batches is roughly 2,500 packets — comfortably more
 * than a few weeks of any of these series, and far less than infinity.
 */
export const readSeries = (
    variant: JstyleVariant,
    command: JstyleCommand,
    { maxBatches = 50 }: { maxBatches?: number } = {},
): Promise<ReadResult> => exclusive(async () => {
    if (!supports(variant, command)) {
        // Not an error. The V8 has no axillary-temperature command, and a caller asking for
        // one should get an empty series, not a failed sync.
        return { packets: [], complete: true, reason: `${variant} has no '${command}'.` };
    }

    const all: JstylePacket[] = [];

    for (let batch = 0; batch < maxBatches; batch += 1) {
        const result = await exchange(
            variant,
            command,
            { mode: batch === 0 ? 'start' : 'next' },
            PACKETS_PER_BATCH,
        );
        all.push(...result.packets);

        // The vendor's end flag: the series is finished.
        if (result.complete) return { packets: all, complete: true };

        // Silence, or a short batch. Either way the bracelet has no more to give — only a
        // full batch means "there is more, ask again".
        if (result.packets.length < PACKETS_PER_BATCH) {
            return { packets: all, complete: true, reason: result.reason };
        }
    }

    return {
        packets: all,
        complete: false,
        reason: `Stopped after ${maxBatches} batches without an end flag.`,
    };
});

/** A single request/response — battery, version, the handshake. */
export const ask = (
    variant: JstyleVariant,
    command: JstyleCommand,
    args: Parameters<typeof buildCommand>[2] = {},
): Promise<ReadResult> => exclusive(() => exchange(variant, command, args, PACKETS_PER_BATCH));

/**
 * Tell the bracelet a series is safely stored, so it can free the space.
 *
 * **Destructive, and the bracelet is the only copy.** Its storage is a ring buffer of a few
 * weeks and nothing is sent twice, so this runs only after `/api/wearables/sync` has
 * answered. Called before the POST it would turn every failed upload into permanent data
 * loss — and a failed upload is the ordinary case on a train.
 *
 * Failure is swallowed. The rows are already on the server by the time this runs; the worst
 * case is that the bracelet keeps them and sends them again next time, which the server
 * upserts by `externalId` anyway.
 */
export const acknowledge = (
    variant: JstyleVariant,
    command: JstyleCommand,
): Promise<void> => exclusive(async () => {
    if (!supports(variant, command)) return;
    try {
        await exchange(variant, command, { mode: 'delete' }, 4);
    } catch { /* see above: re-sending beats deleting early */ }
});

/**
 * Forget any half-finished conversation.
 *
 * Called on every disconnect, clean or not. On Android it clears the codec's static decode
 * flags; on iOS there is no such facility and the comment in `JstyleCodec.swift` explains
 * what stands in for it.
 */
export const reset = (variant: JstyleVariant): void => {
    activeSink = null;
    queue = Promise.resolve();
    try { resetCodec(variant); } catch { /* best effort by design */ }
};
