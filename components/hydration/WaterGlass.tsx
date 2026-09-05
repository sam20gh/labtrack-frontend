/**
 * The hydration hero — the tapered glass from `Design/hydration.svg` frames 1 and 2.
 *
 * **Ported, not redrawn.** The cup outline, the rim highlight and the three stacked wave
 * layers are the export's own paths and its own gradients, at the export's own coordinates,
 * so this is diffable against a re-issued design file rather than a likeness that drifts.
 * That is the rule `WelcomeIllustration.tsx` records after being rebuilt by eye once.
 *
 * The one thing that could not be ported is the part that matters: **the design draws the
 * water at a fixed height and this has to draw it at the person's**. The two frames give the
 * mapping, which is why it is a measurement here and not a guess — frame 1 sits at 750/2,000
 * and frame 2 at 2,000/2,000, and the identical wave paths differ by exactly 269.18 units.
 * A 62.5-point swing over 269.18 units puts the full 0–100% travel at 430.7, and the extra
 * over the 401-unit cup interior is the wave's own amplitude: the crest has to clear the rim
 * at full and the trough has to clear the base at empty, or the level reads wrong at both
 * ends.
 *
 * Two rules the component keeps:
 *
 * 1. **Nothing logged draws an empty glass.** At `fill = 0` the waves are not rendered at
 *    all rather than parked just below the rim, because a sliver of water is a claim that
 *    somebody drank something. Same distinction `levelFor` makes by returning null.
 * 2. **Over target pins at full.** A glass cannot draw 140%, and the honest place for that
 *    number is the line under it.
 *
 * What is deliberately *not* ported is the export's four stacked Figma filters — two inner
 * shadows on the cup and a pair of drop shadows per wave. They cost a shade of contrast and
 * nothing else, `react-native-svg` supports them only partly, and four filter passes under an
 * animating fill level is a frame-rate bill for an illustration. Verified against the export's
 * own authored paths at full: identical to the pixel with the filters removed from both.
 */
import React, { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';

/** The export's own frame: the cup spans x 42.3–332.7, y 288–690.7. */
const VIEW = { x: 38, y: 282, w: 300, h: 416 };

const CUP = 'M43.2975 291.261C43.1399 290.063 44.0722 289 45.2804 289H329.692C330.9 289 331.833 '
    + '290.063 331.675 291.261L282.902 661.902C280.807 677.824 267.235 689.727 251.176 '
    + '689.727H123.797C107.738 689.727 94.1659 677.824 92.0707 661.902L43.2975 291.261Z';

const RIM = 'M329.692 288C331.505 288 332.903 289.595 332.667 291.392L283.894 662.032C281.733 '
    + '678.452 267.737 690.726 251.176 690.727H123.797C107.236 690.726 93.2398 678.452 91.0791 '
    + '662.032L42.3057 291.392C42.0692 289.595 43.4681 288 45.2803 288H329.692Z';

/**
 * The three surfaces, back to front.
 *
 * They run from x −222 to +707 against a 290-wide cup on purpose: the overhang is what lets
 * the group slide vertically without ever exposing an edge inside the clip.
 */
const WAVE_BACK = 'M-222.766 489.226L-187.646 487.491C-152.421 485.755 -82.1815 482.285 -11.8367 '
    + '504.194C55.7661 525.236 116.408 566.886 185.909 582.071C262.055 598.666 337.567 571.116 '
    + '410.021 549.966C479.628 529.575 550.289 513.414 620.95 497.361V693.897C339.676 693.897 '
    + '58.5081 693.897 -222.766 693.897V489.226Z';

const WAVE_MID = 'M-136.285 551.566L-101.165 561.111C-65.9403 570.764 4.299 589.854 74.6438 '
    + '591.698C144.989 593.542 215.228 577.923 285.573 581.068C355.39 584.105 422.888 604.822 '
    + '491.439 616.319C551.238 626.406 611.774 629.226 672.311 630.202L707.431 630.745V715.346C426.157 '
    + '715.346 144.989 715.346 -136.285 715.346V551.566Z';

/**
 * The front wave, whose **base is pinned to the cup and whose crest is not**.
 *
 * Translating this one whole is the mistake, and the export says so: at full, frame 2 keeps
 * its crest 269.18 above frame 1's while running its base *down* to 700 rather than up to
 * 420, and pins the bottom of its gradient at the cup's own base. Move the whole thing and a
 * full glass empties from the bottom — the water rides up and leaves the lower two thirds of
 * the cup unpainted, because these are area paths that close a fixed distance below their
 * crest, not an infinite fill.
 *
 * So the base is computed rather than authored, and the back two waves are left alone: at
 * every level where their own bases would show, this one is already covering that ground.
 */
const waveFront = (base: number) => 'M-136.285 635.642L-101.165 639.017C-65.9403 642.286 4.299 '
    + '649.036 74.6438 642.708C180.425 633.216 282.198 599.257 388.506 591.453C484.479 584.492 '
    + `578.448 597.359 672.311 615.92L707.431 622.986V${base}C426.157 ${base} 144.989 ${base} `
    + `-136.285 ${base}V635.642Z`;

/** Where the paths sit as exported, and how far a full sweep moves them. Both measured above. */
const EXPORTED_AT = 0.375;
const FULL_TRAVEL = 430.7;

/** The cup's interior, which is what the front wave's base and gradient are pinned to. */
const CUP_BASE = 690;

interface Props {
    /** 0–1. Values outside are clamped; see rule 2. */
    fill: number;
    /** Rendered at the intrinsic aspect ratio of the export, 300 : 416. */
    width: number;
    /** Draws the design's confirmation ring over the glass. */
    complete?: boolean;
}

export function WaterGlass({ fill, width, complete }: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const level = Math.max(0, Math.min(1, fill));
    const height = (width * VIEW.h) / VIEW.w;
    const shift = (EXPORTED_AT - level) * FULL_TRAVEL;

    const id = (name: string) => `${name}${uid}`;

    return (
        <View style={{ width, height }} accessibilityLabel={`Glass filled to ${Math.round(level * 100)} per cent`}>
            <Svg width={width} height={height} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}>
                <Defs>
                    <LinearGradient id={id('cup')} x1="187.486" y1="689.727" x2="187.486" y2="309" gradientUnits="userSpaceOnUse">
                        <Stop stopColor="#FFFFFF" />
                        <Stop offset="1" stopColor="#DBEAFE" />
                    </LinearGradient>
                    <LinearGradient id={id('rim')} x1="187.486" y1="689.727" x2="187.486" y2="289" gradientUnits="userSpaceOnUse">
                        <Stop stopColor="#FFFFFF" stopOpacity="0" />
                        <Stop offset="1" stopColor="#FFFFFF" />
                    </LinearGradient>
                    <LinearGradient id={id('w1')} x1="199.092" y1="546.226" x2="199.092" y2="693.897" gradientUnits="userSpaceOnUse">
                        <Stop stopColor="#BFDBFE" />
                        <Stop offset="1" stopColor="#DBEAFE" />
                    </LinearGradient>
                    <LinearGradient id={id('w2')} x1="187" y1="584.225" x2="187" y2="688.225" gradientUnits="userSpaceOnUse">
                        <Stop stopColor="#60A5FA" />
                        <Stop offset="1" stopColor="#BFDBFE" />
                    </LinearGradient>
                    {/*
                      Inside the translated group, so a coordinate `c` paints at `c + shift`.
                      The top follows the crest (left as exported); the bottom is
                      counter-shifted so it lands on the cup's base whatever the level — which
                      is exactly what the export does at full.
                    */}
                    <LinearGradient
                        id={id('w3')}
                        x1="285.573" y1="589.535"
                        x2="285.573" y2={CUP_BASE - shift}
                        gradientUnits="userSpaceOnUse"
                    >
                        <Stop stopColor="#2563EB" />
                        <Stop offset="1" stopColor="#60A5FA" />
                    </LinearGradient>
                    <ClipPath id={id('cut')}>
                        <Path d={CUP} />
                    </ClipPath>
                </Defs>

                <Path d={CUP} fill={`url(#${id('cup')})`} />

                {level > 0 && (
                    <G clipPath={`url(#${id('cut')})`}>
                        <G translateY={shift}>
                            <Path d={WAVE_BACK} fill={`url(#${id('w1')})`} />
                            <Path d={WAVE_MID} fill={`url(#${id('w2')})`} />
                            <Path d={waveFront(CUP_BASE - shift + 24)} fill={`url(#${id('w3')})`} />
                        </G>
                    </G>
                )}

                {/* Drawn last so the highlight sits over the water, as it does in the export. */}
                <Path d={RIM} stroke={`url(#${id('rim')})`} strokeWidth={2} fill="none" />
            </Svg>

            {/*
              The confirmation ring from frame 2. A View rather than more SVG because it is
              chrome over the illustration rather than part of it — and because the tick is
              the same icon every other "done" state in the app uses.
            */}
            {complete && (
                <View style={[styles.badgeWrap, { width, height }]} pointerEvents="none">
                    <View style={styles.badgeRing}>
                        <View style={styles.badgeFill}>
                            <Ionicons name="checkmark" size={40} color={Palette.white} />
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badgeWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    badgeRing: {
        width: 108, height: 108, borderRadius: 54,
        backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#0F172A', shadowOpacity: 0.14, shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    badgeFill: {
        width: 82, height: 82, borderRadius: 41,
        backgroundColor: '#22C55E',
        alignItems: 'center', justifyContent: 'center',
    },
});
