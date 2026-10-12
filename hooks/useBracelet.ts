/**
 * The paired bracelet and what is happening to it, kept current without a round trip.
 *
 * Reads the pairing from the device-local store and redraws when anything writes it — a sync
 * started by `autoSync.ts`, the background task's record, a forget — so the home header's chip
 * and the bracelet screen cannot disagree. `syncing` is delayed a moment, because a sync the
 * interval guard skips starts and ends inside a frame and would flash "Syncing" for nothing.
 */
import { useEffect, useState } from 'react';

import { getPaired, getPairedSync, onPairedChange, type PairedBracelet } from '@/lib/health/jstyle/store';
import { isSyncing, onSyncingChange } from '@/lib/health/sync';

const SYNCING_DELAY_MS = 400;

export function useBracelet(): { paired: PairedBracelet | null | undefined; syncing: boolean } {
    const [paired, setPaired] = useState<PairedBracelet | null | undefined>(getPairedSync());
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        let live = true;
        getPaired().then((p) => { if (live) setPaired(p); }).catch(() => undefined);
        const off = onPairedChange((p) => { if (live) setPaired(p); });
        return () => { live = false; off(); };
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const apply = (on: boolean) => {
            if (timer) clearTimeout(timer);
            timer = null;
            if (!on) { setSyncing(false); return; }
            timer = setTimeout(() => setSyncing(isSyncing()), SYNCING_DELAY_MS);
        };
        apply(isSyncing());
        const off = onSyncingChange(apply);
        return () => { off(); if (timer) clearTimeout(timer); };
    }, []);

    return { paired, syncing };
}
