/**
 * Touch-and-drag to read a chart, shared by every chart that scrubs.
 *
 * Built on `PanResponder`, like `ForecastChart` and the notification swipe, rather than on
 * gesture-handler: this app mounts no `GestureHandlerRootView`, and a chart library would be
 * a `package.json` change — which moves the fingerprint and strands every installed build
 * (the fourth trap in `CLAUDE.md`).
 *
 * Four things about the gesture are load-bearing:
 *
 * 1. **A drag is claimed only once it is horizontal.** Every chart in this app sits inside a
 *    vertical ScrollView. Claiming on touch-down would make a page impossible to scroll
 *    whenever the thumb happened to start on a chart — which on the metric screens is most
 *    of the first screenful. `ForecastChart` claims on touch-down; that is why it is opt-in.
 * 2. **Once claimed, it is not given back.** A scrub that drifts a few points vertically is
 *    still a scrub; letting the ScrollView take it mid-drag drops the readout under the
 *    finger.
 * 3. **A tap selects too, without being a responder.** Taps are read from the raw
 *    `onTouchStart`/`onTouchEnd` events, which fire whoever holds the responder, so a tap
 *    can be answered without claiming touch-down (rule 1). Tapping the selected slot again
 *    clears it.
 * 4. **The selection stays after the finger lifts.** A reading that vanishes the moment you
 *    let go cannot be read — the call `ForecastChart` makes for the same reason.
 *
 * A screen reader cannot drag, so the container is `adjustable`: swipe up and down steps
 * through the slots and each one is announced through `describe`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    PanResponder,
    type AccessibilityActionEvent,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    type View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { columnCentres, nearestIndex, stepIndex } from '@/lib/chartScrub';

/** Movement under this is a tap; over it, a drag (or a scroll). */
const TAP_SLOP = 10;
const TAP_MS = 400;
/** Horizontal travel before a drag is claimed from the ScrollView. */
const CLAIM_DX = 6;

interface Options {
    /** Chart-local x of every slot, left to right. */
    xs?: readonly number[];
    /**
     * Or, for a chart drawn as a flex row of equal columns: how many, and the gap between
     * them. The centres are read off the width the container is laid out at.
     */
    columns?: { count: number; gap?: number };
    /** Which slots may be selected. Omitted: all of them. */
    selectable?: (i: number) => boolean;
    /** Controlled selection. Omit to let the hook hold it. */
    index?: number | null;
    onChange?: (index: number | null) => void;
    /** A new value clears an uncontrolled selection — new data, a new range. */
    resetKey?: unknown;
    /** False where the slots already handle their own taps (a row of Pressables). */
    tapToSelect?: boolean;
    /** Tapping the selected slot clears it. Off where something must always be selected. */
    tapToClear?: boolean;
    enabled?: boolean;
    /** What a screen reader says for a slot. */
    describe?: (i: number) => string;
    /** What a screen reader says for the chart as a whole. */
    label?: string;
    /**
     * Make the container one adjustable element for a screen reader. Off where every slot is
     * already its own button — wrapping them would hide those buttons behind one control.
     */
    adjustable?: boolean;
}

/* ---------------------------------------------------------------- the first-use hint */

const HINT_KEY = 'chartScrubHintSeen';
let hintSeen: boolean | null = null;
const hintListeners = new Set<(seen: boolean) => void>();

/**
 * Whether to show "Touch and drag to read a day" under a chart. Shown until the person has
 * scrubbed any chart once, then never again: a hint is for discovering a gesture, and one
 * that stays on every chart for ever is a caption nobody reads.
 */
export function useScrubHint(): boolean {
    const [seen, setSeen] = useState(hintSeen ?? true);
    useEffect(() => {
        hintListeners.add(setSeen);
        if (hintSeen === null) {
            AsyncStorage.getItem(HINT_KEY)
                .then((v) => { hintSeen = v === '1'; })
                .catch(() => { hintSeen = true; })
                .finally(() => hintListeners.forEach((l) => l(hintSeen as boolean)));
        } else {
            setSeen(hintSeen);
        }
        return () => { hintListeners.delete(setSeen); };
    }, []);
    return !seen;
}

const markHintSeen = () => {
    if (hintSeen) return;
    hintSeen = true;
    hintListeners.forEach((l) => l(true));
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
};

/* ---------------------------------------------------------------- the hook */

export function useChartScrub({
    xs: xsOption, columns, selectable, index: controlled, onChange, resetKey,
    tapToSelect = true, tapToClear = true, enabled = true, describe, label, adjustable = true,
}: Options) {
    const isControlled = controlled !== undefined;
    const [own, setOwn] = useState<number | null>(null);
    const index = isControlled ? controlled : own;

    // Charts drawn as a row of Views have no `x` scale of their own; they read their slot
    // centres off the width the container was laid out at.
    const [layoutWidth, setLayoutWidth] = useState(0);
    // Keyed on the column count and gap rather than the object: callers pass `columns`
    // inline, and a new object every render would rebuild the centres every render.
    const columnCount = columns?.count;
    const columnGap = columns?.gap;
    const xs = useMemo(
        () => xsOption ?? (columnCount ? columnCentres(columnCount, layoutWidth, columnGap) : []),
        [xsOption, columnCount, columnGap, layoutWidth],
    );

    const indexRef = useRef(index);
    indexRef.current = index;
    const xsRef = useRef(xs);
    xsRef.current = xs;
    const selectableRef = useRef(selectable);
    selectableRef.current = selectable;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // New data is a new chart: a selection made on last month's slots means nothing on this
    // month's, and an index past the end would read off the array.
    useEffect(() => {
        if (!isControlled) setOwn(null);
    }, [resetKey, isControlled]);

    const select = useCallback((next: number | null) => {
        if (next === indexRef.current) return;
        // A tick per slot crossed: the finger feels each day go by.
        if (next !== null) Haptics.selectionAsync().catch(() => {});
        indexRef.current = next;
        if (!isControlled) setOwn(next);
        onChangeRef.current?.(next);
    }, [isControlled]);

    /**
     * The container's left edge in window coordinates. Re-measured on every touch-down,
     * because scrolling moves the chart without firing a layout event, and a stale origin
     * puts the crosshair a finger's width from the finger.
     */
    const container = useRef<View>(null);
    const originX = useRef(0);
    const measure = useCallback((then?: () => void) => {
        const node = container.current;
        if (!node) { then?.(); return; }
        node.measureInWindow((px) => {
            originX.current = px;
            then?.();
        });
    }, []);

    const pick = useCallback((pageX: number) =>
        nearestIndex(xsRef.current, pageX - originX.current, selectableRef.current), []);

    const panned = useRef(false);
    const touch = useRef<{ x: number; y: number; t: number } | null>(null);

    const pan = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
            enabled && xsRef.current.length > 0
            && Math.abs(g.dx) > CLAIM_DX && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: (e) => {
            panned.current = true;
            markHintSeen();
            select(pick(e.nativeEvent.pageX));
        },
        onPanResponderMove: (e) => select(pick(e.nativeEvent.pageX)),
        onPanResponderTerminationRequest: () => false,
    }), [enabled, pick, select]);

    const onTouchStart = useCallback((e: GestureResponderEvent) => {
        panned.current = false;
        touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() };
        measure();
    }, [measure]);

    const onTouchEnd = useCallback((e: GestureResponderEvent) => {
        const start = touch.current;
        touch.current = null;
        if (!enabled || !tapToSelect || panned.current || !start || !xsRef.current.length) return;
        const { pageX, pageY } = e.nativeEvent;
        if (Math.abs(pageX - start.x) > TAP_SLOP || Math.abs(pageY - start.y) > TAP_SLOP) return;
        if (Date.now() - start.t > TAP_MS) return;
        // Measured again rather than trusting touch-down's, whose answer may not be back yet
        // on a quick tap.
        measure(() => {
            const next = pick(pageX);
            markHintSeen();
            select(tapToClear && next === indexRef.current ? null : next);
        });
    }, [enabled, tapToSelect, tapToClear, measure, pick, select]);

    const onAccessibilityAction = useCallback((e: AccessibilityActionEvent) => {
        const direction = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        select(stepIndex(xsRef.current.length, indexRef.current, direction, selectableRef.current));
    }, [select]);

    const clear = useCallback(() => select(null), [select]);

    const containerProps = {
        ref: container,
        onLayout: (e: LayoutChangeEvent) => {
            setLayoutWidth(e.nativeEvent.layout.width);
            measure();
        },
        onTouchStart,
        onTouchEnd,
        ...(enabled ? pan.panHandlers : {}),
        ...(adjustable ? {
            accessible: enabled,
            accessibilityRole: 'adjustable' as const,
            accessibilityLabel: label,
            accessibilityHint: 'Swipe up or down to read each point.',
            accessibilityValue: index !== null && describe ? { text: describe(index) } : undefined,
            accessibilityActions: [{ name: 'increment' as const }, { name: 'decrement' as const }],
            onAccessibilityAction,
        } : {}),
    };

    return { index, select, clear, containerProps, xs, width: layoutWidth };
}
