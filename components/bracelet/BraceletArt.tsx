/**
 * The bracelet, drawn.
 *
 * `Design/device.svg` puts a photograph on the plinth — an Apple Watch on one frame, an
 * Omron cuff on the other, both embedded as raster (462×578 and 568×466). Neither is a
 * J-Style band, and neither is ours to ship: they are third-party product photography of
 * hardware this app does not talk to.
 *
 * So the *stagecraft* is ported and the *subject* is redrawn. Vector rather than a photo,
 * for three reasons that outlast the art: it tints to `Palette`, its display can carry
 * state, and it costs about 3 KB instead of a product shot per variant.
 *
 * ## The form is generic on purpose
 *
 * The 2208A and the V8 are visually near-identical — a rounded head on a silicone band —
 * and a drawing precise enough to tell them apart would be wrong for whichever one somebody
 * actually owns. The model is named in text underneath, which is where a fact belongs.
 *
 * Two details are load-bearing. **The band's ends tuck under the head**, so it reads as one
 * continuous object; ending them in the open leaves two round caps that look like a hook.
 * And **the band is thick relative to the head** — an earlier draft used a thin ring and a
 * large head, which reads unmistakably as a padlock.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import Animated, {
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
    Easing, cancelAnimation,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

export type BraceletMood = 'idle' | 'searching' | 'live';

/** The drawing's own coordinate space. Every figure below is in these units. */
const W = 160;
/**
 * Cropped to the band's contact point, not to the artboard.
 *
 * The strap's lowest curve sits at y=190 and its 25-wide stroke rounds off to ~202, so the
 * drawing ends there. Any slack below it becomes a gap between the bracelet and the plinth
 * it is meant to be standing on — `DeviceStage` aligns on this box's bottom edge, so dead
 * space here reads as the device hovering.
 */
const H = 204;

/** The glass, needed here and by the animated overlay that sits on top of it. */
const GLASS = { x: 55, y: 15, w: 50, h: 74, r: 15 };

/** Both ends terminate under the head, which is what makes the band continuous. */
const STRAP = 'M60 84 C 20 118, 26 190, 82 190 C 138 190, 142 118, 110 84';

interface Props {
    mood: BraceletMood;
    width?: number;
}

export default function BraceletArt({ mood, width = W }: Props) {
    const scale = width / W;

    return (
        <View style={{ width, height: H * scale }}>
            <Svg width={width} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
                <Defs>
                    {/* Lit from the upper left, as everything else in the kit is. */}
                    <LinearGradient id="strapG" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#4B5563" />
                        <Stop offset="0.55" stopColor="#374151" />
                        <Stop offset="1" stopColor="#1F2937" />
                    </LinearGradient>
                    <LinearGradient id="bodyG" x1="0.2" y1="0" x2="0.85" y2="1">
                        <Stop offset="0" stopColor="#3F4854" />
                        <Stop offset="1" stopColor="#111827" />
                    </LinearGradient>
                    <LinearGradient id="glassG" x1="0.1" y1="0" x2="0.7" y2="1">
                        <Stop offset="0" stopColor="#232B38" />
                        <Stop offset="1" stopColor="#030712" />
                    </LinearGradient>
                </Defs>

                <Path d={STRAP} stroke="url(#strapG)" strokeWidth={25} strokeLinecap="round" fill="none" />

                {/* Offset copy in shadow — without it the band is a flat silhouette. */}
                <Path
                    d={STRAP} stroke="#0B1220" strokeWidth={25} strokeLinecap="round"
                    fill="none" opacity={0.22} translateY={3}
                />

                {/* Specular run down the near sweep. Silicone is glossy; matte reads as cardboard. */}
                <Path
                    d="M52 108 C 37 138, 42 174, 64 184"
                    stroke="#8A94A6" strokeWidth={3.2} strokeLinecap="round"
                    fill="none" opacity={0.38}
                />

                {/* The head, drawn last so the band's ends disappear behind it. */}
                <Rect x={48} y={8} width={64} height={88} rx={21} fill="url(#bodyG)" />
                <Rect
                    x={48.5} y={8.5} width={63} height={87} rx={20.5}
                    stroke="#7B8697" strokeWidth={1} fill="none" opacity={0.5}
                />
                <Rect x={111} y={42} width={4.5} height={19} rx={2.2} fill="#4B5563" />
                <Rect
                    x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} rx={GLASS.r}
                    fill="url(#glassG)"
                />

                {/*
                  * A dark screen, with only the faintest reflection — so an unpaired
                  * bracelet reads as hardware that is off rather than as art that failed
                  * to load. The other two moods animate and are drawn over the top.
                  */}
                {mood === 'idle' ? (
                    <Path
                        d="M63 26 C 72 21, 88 21, 97 26"
                        stroke="#4B5563" strokeWidth={2} strokeLinecap="round"
                        fill="none" opacity={0.8}
                    />
                ) : null}
            </Svg>

            {mood === 'searching' ? <SearchingScreen scale={scale} /> : null}
            {mood === 'live' ? <LiveScreen scale={scale} /> : null}
        </View>
    );
}

/** A slow vertical sweep — a device awake and looking for a host. */
const SearchingScreen = ({ scale }: { scale: number }) => {
    const t = useSharedValue(0);

    useEffect(() => {
        t.value = withRepeat(
            withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, false,
        );
        return () => cancelAnimation(t);
    }, [t]);

    const style = useAnimatedStyle(() => ({
        // Brightest mid-travel, so the beam appears to pass through rather than blink.
        opacity: t.value < 0.5 ? t.value * 2 : (1 - t.value) * 2,
        transform: [{ translateY: (-GLASS.h / 2 + t.value * GLASS.h) * scale }],
    }));

    return (
        <ScreenOverlay scale={scale}>
            <Animated.View
                style={[styles.sweep, { width: 40 * scale, height: 3 * scale }, style]}
            />
        </ScreenOverlay>
    );
};

/**
 * A heartbeat trace, pulsing.
 *
 * The one flourish on this screen that is purely charm, and it earns its place by being
 * what makes "connected" feel like a live link rather than a label.
 */
const LiveScreen = ({ scale }: { scale: number }) => {
    const pulse = useSharedValue(0);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 950, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(pulse);
    }, [pulse]);

    const style = useAnimatedStyle(() => ({
        opacity: 0.7 + pulse.value * 0.3,
        transform: [{ scale: 0.97 + pulse.value * 0.06 }],
    }));

    return (
        <ScreenOverlay scale={scale}>
            <Animated.View style={style}>
                <Svg width={40 * scale} height={26 * scale} viewBox="0 0 40 26">
                    <Path
                        d="M2 14 H10 L14 4 L20 24 L25 11 L29 16 H38"
                        stroke={Palette.primaryLight}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    <Circle cx={38} cy={16} r={2.2} fill={Palette.primaryLight} />
                </Svg>
            </Animated.View>
        </ScreenOverlay>
    );
};

/**
 * Positions an animated child over the glass, at whatever size the art was drawn.
 *
 * A sibling of the `Svg` rather than a child, because a `View` cannot live inside one — and
 * animating react-native-svg props would cost a bridge crossing per frame where this stays
 * on the UI thread. Every figure is the glass rectangle times the caller's scale; hard-
 * coding the 1× numbers would misplace the animation on every call site passing a `width`.
 */
const ScreenOverlay = ({ scale, children }: { scale: number; children: React.ReactNode }) => (
    <View
        pointerEvents="none"
        style={[
            styles.overlay,
            {
                left: GLASS.x * scale,
                top: GLASS.y * scale,
                width: GLASS.w * scale,
                height: GLASS.h * scale,
                borderRadius: GLASS.r * scale,
            },
        ]}
    >
        {children}
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        // Clips the sweep to the glass; without it the beam runs down the strap.
        overflow: 'hidden',
    },
    sweep: { borderRadius: 2, backgroundColor: Palette.primaryLight },
});
