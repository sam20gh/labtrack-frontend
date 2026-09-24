/**
 * The plinth a device stands on.
 *
 * Ported from `Design/device.svg` — the kit puts every device on a one-point-perspective
 * grid floor with a dashed platform ellipse and a soft contact shadow, and that stagecraft
 * is the whole identity of those screens.
 *
 * **Generated rather than traced.** The export's grid and ellipse are Figma-outlined paths
 * (the dashed ring alone is ~20 KB of segments), and the usual rule in this codebase — port
 * artwork verbatim, because a redrawn likeness drifts, which is what `WelcomeIllustration`
 * taught — does not apply to these. A perspective grid and a dashed ellipse are *geometry*,
 * not illustration: regenerating them is exact rather than approximate, and a parametric
 * version can do three things a traced one cannot. It resizes to any screen without
 * resampling, its dash ring can change colour to carry a reading, and it can animate.
 *
 * The verbatim-port rule still holds for the bracelet itself — see `BraceletArt`.
 *
 * ## The stage carries state
 *
 * Idle, listening and connected are three different rooms, not one illustration with a
 * caption. The grid brightens as the screen becomes live, the ring tints, and sonar pulses
 * only ever run while the radio is genuinely scanning — an idle animation that looks like
 * searching is a progress bar that lies.
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Line, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay,
    Easing, cancelAnimation,
} from 'react-native-reanimated';

import { activePalette } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

export type StageState = 'idle' | 'scanning' | 'connected';

export const STAGE_WIDTH = 375;
/**
 * Taller than the kit's band, because this stage is the screen's whole top third rather
 * than a thumbnail. At 250 the composition crowded into the upper half of a 812pt phone
 * and left a third of the screen empty under the buttons.
 */
export const STAGE_HEIGHT = 300;

/** Where the floor's lines converge. Above the canvas, so the fan stays gentle. */
const VANISHING = { x: STAGE_WIDTH / 2, y: 26 };
/** The platform the device stands on. */
const PLATFORM = { cx: STAGE_WIDTH / 2, cy: 232, rx: 104, ry: 29 };

const H_LINES = 9;
const V_LINES = 15;

/**
 * Floor lines, front to back.
 *
 * `t²` rather than `t` is what makes it read as a floor instead of a ladder: in real
 * perspective the rows crowd together as they recede, and evenly spaced lines look like a
 * flat grid seen head-on no matter how the verticals fan.
 */
const floorRows = (): number[] => {
    const rows: number[] = [];
    for (let i = 1; i <= H_LINES; i += 1) {
        const t = i / H_LINES;
        rows.push(VANISHING.y + (STAGE_HEIGHT - VANISHING.y) * t ** 2);
    }
    return rows;
};

/** Verticals, fanning from the vanishing point out past the bottom edge. */
const floorColumns = (): number[] => {
    const cols: number[] = [];
    const half = (V_LINES - 1) / 2;
    for (let i = -half; i <= half; i += 1) {
        cols.push(VANISHING.x + (i / half) * (STAGE_WIDTH * 1.35));
    }
    return cols;
};

/**
 * The ring's colour is a reading, never decoration.
 *
 * It is the only ring already on screen, so it carries battery rather than adding a gauge
 * beside the device: amber under 30%, rose under 15%. Everything else leaves it slate. A
 * screen that tinted it for mood would be spending the one signal this composition has.
 */
const ringColour = (state: StageState, battery?: number): string => {
    if (state !== 'connected') return activePalette().textMuted;
    if (typeof battery !== 'number') return activePalette().primary;
    if (battery < 15) return activePalette().danger;
    if (battery < 30) return activePalette().amber;
    return activePalette().primary;
};

interface Props {
    state: StageState;
    /** 0–100, when the device has actually reported it. Tints the platform ring. */
    battery?: number;
    /** The device itself, drawn standing on the platform. */
    children?: React.ReactNode;
    style?: ViewStyle;
}

export default function DeviceStage({ state, battery, children, style }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const rows = useMemo(floorRows, []);
    const cols = useMemo(floorColumns, []);
    const ring = ringColour(state, battery);

    // ── the device's float, and its shadow ──────────────────────────────────
    //
    // One driver for both: the shadow has to tighten as the device rises or the two read as
    // separate animations and the device looks like it is sliding rather than hovering.
    const bob = useSharedValue(0);

    useEffect(() => {
        if (state !== 'connected') {
            cancelAnimation(bob);
            bob.value = withTiming(0, { duration: 400 });
            return;
        }
        bob.value = withRepeat(
            withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
    }, [state, bob]);

    const deviceStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -bob.value * 9 }],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
        opacity: 0.20 - bob.value * 0.09,
        transform: [{ scaleX: 1 - bob.value * 0.13 }, { scaleY: 1 - bob.value * 0.13 }],
    }));

    return (
        <View style={[styles.stage, style]} pointerEvents="none">
            <Svg width={STAGE_WIDTH} height={STAGE_HEIGHT} style={StyleSheet.absoluteFill}>
                <Defs>
                    {/*
                      * The floor fades out at the top rather than stopping at a hard edge.
                      * Without it the grid ends on a visible horizontal seam, which reads
                      * as a cropped image rather than as distance.
                      */}
                    <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={Palette.canvas} stopOpacity="1" />
                        <Stop offset="0.45" stopColor={Palette.canvas} stopOpacity="0" />
                    </LinearGradient>
                </Defs>

                <G opacity={state === 'idle' ? 0.5 : 1}>
                    {rows.map((y, i) => (
                        <Line
                            key={`r${i}`}
                            x1={0} y1={y} x2={STAGE_WIDTH} y2={y}
                            stroke={Palette.borderLight}
                            strokeWidth={1}
                        />
                    ))}
                    {cols.map((x, i) => (
                        <Line
                            key={`c${i}`}
                            x1={VANISHING.x} y1={VANISHING.y}
                            x2={x} y2={STAGE_HEIGHT}
                            stroke={Palette.borderLight}
                            strokeWidth={1}
                        />
                    ))}
                </G>

                <Rect x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT * 0.55} fill="url(#fade)" />

                {/*
                  * The platform. Dashed because it is a *marker* rather than a surface —
                  * the device is hovering over a spot, not resting on a disc.
                  */}
                <Ellipse
                    cx={PLATFORM.cx} cy={PLATFORM.cy} rx={PLATFORM.rx} ry={PLATFORM.ry}
                    stroke={ring}
                    strokeWidth={1.5}
                    strokeDasharray="5 7"
                    opacity={state === 'idle' ? 0.45 : 0.9}
                    fill="none"
                />
            </Svg>

            {/* Sonar. Only ever while the radio is actually listening. */}
            {state === 'scanning' ? <Sonar /> : null}

            {/*
              * Contact shadow — only when something is standing there.
              *
              * Rendered unconditionally it draws a shadow on an empty plinth, cast by
              * nothing. On the idle screen that is the one element that makes the whole
              * stage read as a stock illustration rather than a live surface.
              */}
            {children ? <Animated.View style={[styles.contactShadow, shadowStyle]} /> : null}

            <Animated.View style={[styles.device, deviceStyle]}>{children}</Animated.View>
        </View>
    );
}

/**
 * Three rings expanding from the platform, staggered.
 *
 * Elliptical because the floor is in perspective: a circular pulse on a receding plane is
 * the detail that would make the whole stage read as flat. Achieved by scaling a circle on
 * one axis rather than animating SVG geometry — animated `rx`/`ry` props cross the bridge
 * per frame, and this stays on the UI thread.
 */
const Sonar = () => (
    <>
        {[0, 1, 2].map((i) => <SonarRing key={i} index={i} />)}
    </>
);

const SONAR_MS = 2400;

const SonarRing = ({ index }: { index: number }) => {
    const styles = useStyles();
    const t = useSharedValue(0);

    useEffect(() => {
        t.value = withDelay(
            index * (SONAR_MS / 3),
            withRepeat(withTiming(1, { duration: SONAR_MS, easing: Easing.out(Easing.quad) }), -1, false),
        );
        return () => cancelAnimation(t);
    }, [index, t]);

    const style = useAnimatedStyle(() => ({
        opacity: (1 - t.value) * 0.5,
        transform: [
            { scaleY: 0.275 },              // the floor's foreshortening
            { scale: 0.35 + t.value * 1.5 },
        ],
    }));

    return <Animated.View style={[styles.sonar, style]} />;
};

const useStyles = makeStyles((Palette) => ({
    stage: {
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        alignSelf: 'center',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    device: {
        position: 'absolute',
        // Sits the device's feet on the platform rather than at the canvas bottom.
        bottom: STAGE_HEIGHT - PLATFORM.cy - 6,
        alignItems: 'center',
    },
    contactShadow: {
        position: 'absolute',
        bottom: STAGE_HEIGHT - PLATFORM.cy - 12,
        width: PLATFORM.rx * 1.15,
        height: PLATFORM.ry * 1.5,
        borderRadius: PLATFORM.rx,
        backgroundColor: Palette.text,
        opacity: 0.2,
    },
    sonar: {
        position: 'absolute',
        bottom: STAGE_HEIGHT - PLATFORM.cy - PLATFORM.rx * 0.275,
        width: PLATFORM.rx * 2,
        height: PLATFORM.rx * 2,
        borderRadius: PLATFORM.rx,
        borderWidth: 2,
        borderColor: Palette.primary,
    },
}));
