/**
 * The 24-hour dial — `Design/sleep.svg` frames 16 (New Sleep Schedule) and 19 (Set Sleep Goal).
 *
 * Two draggable handles on one circle: bedtime and wake. The arc between them is how long
 * somebody would sleep, which is the number the screen is actually about — a dial is used
 * here rather than two time pickers because the thing being set is a *span*, and two pickers
 * make you do the subtraction in your head.
 *
 * Four decisions worth knowing:
 *
 * 1. **A full turn is 24 hours, not 12.** The kit's dial is marked 12AM at the top, 6AM at
 *    the right, 12PM at the bottom — so midnight and midday are opposite points and a
 *    bedtime cannot be confused with a lunchtime. A 12-hour dial would need an AM/PM toggle
 *    beside a control whose whole point is that you can see the night.
 * 2. **It snaps to five minutes.** A dial has about 250 usable pixels of circumference on a
 *    phone, so a free drag lands on 22:37 and reads as a mis-tap. Five is what the wake and
 *    bed times people actually keep are written in.
 * 3. **`PanResponder`, not a gesture library.** This is one touch tracked against a centre
 *    point; it needs no gesture composition and nothing on the UI thread. Reaching for
 *    Reanimated here would add a worklet to a control that updates a number.
 * 4. **The band ring is advice, not a limit.** The arc turns from the "optimal" tone to the
 *    "sub-optimal" one as the span leaves the healthy range, and the dial still lets you
 *    drag there — the caption says what the app thinks and the person decides. The *goal*
 *    is clamped, but that happens on the server where it is enforceable, not by making a
 *    handle refuse to move.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, PanResponder, StyleSheet, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing } from '@/constants/theme';
import { formatClock, formatMinutes } from '@/lib/sleep';

/** Minutes the handles snap to. See note 2. */
const SNAP = 5;

/** The span the app calls healthy, in minutes. Mirrors `CAPS` in `utils/sleepTargets.js`. */
const OPTIMAL = { min: 7 * 60, max: 9 * 60 };

interface Props {
    bedtimeMin: number;
    wakeMin: number;
    onChange: (next: { bedtimeMin: number; wakeMin: number }) => void;
    size?: number;
    /** Renders without handles — the dial as an illustration of a schedule already set. */
    readOnly?: boolean;
}

const TAU = Math.PI * 2;

/** Minutes → angle in radians, with midnight at the top and the clock running clockwise. */
const angleOf = (minutes: number) => (minutes / 1440) * TAU - Math.PI / 2;

/** The inverse, normalised into [0, 1440). */
const minutesOf = (angle: number) => {
    const normalised = (((angle + Math.PI / 2) % TAU) + TAU) % TAU;
    return Math.round((normalised / TAU) * 1440 / SNAP) * SNAP % 1440;
};

export function TimeDial({ bedtimeMin, wakeMin, onChange, size = 260, readOnly = false }: Props) {
    const stroke = 24;
    const radius = (size - stroke) / 2 - 8;
    const centre = size / 2;

    /**
     * Which handle the current drag belongs to.
     *
     * Held in a ref rather than in state: it is decided once on touch-down and read on every
     * move, and putting it in state would re-render the dial on the first frame of a drag.
     */
    const dragging = useRef<'bedtime' | 'wake' | null>(null);
    const latest = useRef({ bedtimeMin, wakeMin });
    latest.current = { bedtimeMin, wakeMin };
    const layout = useRef({ x: 0, y: 0 });
    const box = useRef<View | null>(null);

    /**
     * Where the dial sits on screen.
     *
     * Measured with `measureInWindow` on layout rather than read from the `onLayout` event,
     * whose `x`/`y` are relative to the parent — the dial lives inside a scroll view, so
     * parent-relative coordinates put its centre several hundred points from where the
     * touch is reported and every drag lands on the wrong hour. Re-measured on layout so a
     * scroll that changes nothing about the layout costs nothing, and a rotation does.
     */
    const measure = useCallback(() => {
        box.current?.measureInWindow?.((x, y) => { layout.current = { x, y }; });
    }, []);

    /** The angle of a touch about the dial's centre, in the page's own coordinates. */
    const angleAt = useCallback((event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        return Math.atan2(pageY - (layout.current.y + centre), pageX - (layout.current.x + centre));
    }, [centre]);

    const responder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => !readOnly,
        onMoveShouldSetPanResponder: () => !readOnly,

        onPanResponderGrant: (event) => {
            // The page may have scrolled since layout, and a stale centre sends the first
            // frame of the drag to the wrong hour.
            measure();
            const minutes = minutesOf(angleAt(event));
            // Whichever handle the touch landed nearer to, measured around the dial rather
            // than along a line — the two are 20 minutes apart at 23:50 and 00:10.
            const gap = (a: number, b: number) => {
                const d = Math.abs(a - b) % 1440;
                return Math.min(d, 1440 - d);
            };
            dragging.current = gap(minutes, latest.current.bedtimeMin) <= gap(minutes, latest.current.wakeMin)
                ? 'bedtime'
                : 'wake';
        },

        onPanResponderMove: (event) => {
            if (!dragging.current) return;
            const minutes = minutesOf(angleAt(event));
            const next = { ...latest.current, [`${dragging.current}Min`]: minutes };
            // A zero-length night is not a schedule. Held rather than corrected, so the
            // handle simply stops instead of jumping to the other side of the dial.
            if (next.bedtimeMin === next.wakeMin) return;
            onChange(next as { bedtimeMin: number; wakeMin: number });
        },

        onPanResponderRelease: () => { dragging.current = null; },
        onPanResponderTerminate: () => { dragging.current = null; },
    }), [angleAt, measure, onChange, readOnly]);

    const span = ((wakeMin - bedtimeMin) % 1440 + 1440) % 1440;
    const optimal = span >= OPTIMAL.min && span <= OPTIMAL.max;

    // The sleep arc. Drawn as a path rather than a dashed circle because it can wrap past
    // midnight, which a dash offset cannot express without a second arc.
    const start = angleOf(bedtimeMin);
    const end = angleOf(wakeMin);
    const point = (angle: number, r: number) => ({
        x: centre + Math.cos(angle) * r,
        y: centre + Math.sin(angle) * r,
    });
    const from = point(start, radius);
    const to = point(end, radius);
    const large = span > 720 ? 1 : 0;

    const bedHandle = point(start, radius);
    const wakeHandle = point(end, radius);

    return (
        <View
            ref={box}
            style={[styles.wrap, { width: size, height: size }]}
            onLayout={measure}
            {...(readOnly ? {} : responder.panHandlers)}
        >
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Circle
                    cx={centre} cy={centre} r={radius}
                    stroke={Palette.borderLight} strokeWidth={stroke} fill="none"
                />
                <Path
                    d={`M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y}`}
                    stroke={optimal ? Palette.primary : Palette.primaryPale}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                />

                {/* Hour ticks. Four long ones at the quarters, the rest short. */}
                <G>
                    {Array.from({ length: 24 }, (_, hour) => {
                        const angle = angleOf(hour * 60);
                        const outer = point(angle, radius - stroke / 2 - 4);
                        const inner = point(angle, radius - stroke / 2 - (hour % 6 === 0 ? 12 : 8));
                        return (
                            <Line
                                key={hour}
                                x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                                stroke={hour % 6 === 0 ? Palette.textSecondary : Palette.borderStrong}
                                strokeWidth={hour % 6 === 0 ? 1.5 : 1}
                            />
                        );
                    })}
                </G>

                {!readOnly ? (
                    <>
                        <Circle cx={bedHandle.x} cy={bedHandle.y} r={11} fill={Palette.text} />
                        <Circle cx={wakeHandle.x} cy={wakeHandle.y} r={11} fill={Palette.primary} />
                        <Circle cx={wakeHandle.x} cy={wakeHandle.y} r={4} fill={Palette.white} />
                    </>
                ) : null}
            </Svg>

            <View style={styles.centre} pointerEvents="none">
                <Ionicons
                    name={optimal ? 'moon' : 'moon-outline'}
                    size={18}
                    color={optimal ? Palette.primary : Palette.textMuted}
                />
                <Text style={styles.span}>{formatMinutes(span)}</Text>
                <Text style={styles.caption}>
                    {optimal ? 'In the healthy range' : 'Outside 7–9 hours'}
                </Text>
                <Text style={styles.times}>
                    {formatClock(bedtimeMin)} → {formatClock(wakeMin)}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    centre: { alignItems: 'center', gap: 2, paddingHorizontal: Spacing.xxl },
    span: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text },
    caption: { fontSize: 11, fontFamily: Fonts.medium, color: Palette.textSecondary },
    times: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted, marginTop: 4 },
});

export default TimeDial;
