/**
 * Line-art hero for the first onboarding slide.
 *
 * A rebuild of the kit's opening spot: the assistant living inside a phone on the left,
 * talking to someone working on the right, with medication and a settings gear filling out
 * the frame. Drawn as vector rather than exported as a bitmap so it stays crisp at every
 * density and picks up `Palette` rather than baking hex into a PNG.
 *
 * The kit's version has more incidental detail than is worth hand-writing in SVG; this
 * keeps its composition, weight and two-accent palette (purple line work, one red cross,
 * one teal gear) and drops the filigree.
 */
import React from 'react';
import Svg, { Rect, Circle, Path, G, Line } from 'react-native-svg';
import { Palette } from '@/constants/theme';

const INK = '#1F2937';
const STROKE = 1.6;

export default function WelcomeIllustration({ width = 320 }: { width?: number }) {
    return (
        <Svg width={width} height={width * (200 / 320)} viewBox="0 0 320 200">
            {/* ---- phone housing the assistant ---- */}
            <G stroke={INK} strokeWidth={STROKE} fill="none">
                <Rect x="8" y="12" width="112" height="180" rx="14" fill={Palette.white} />
                <Line x1="44" y1="28" x2="84" y2="28" strokeLinecap="round" />

                {/* robot head */}
                <Circle cx="24" cy="66" r="7" />
                <Circle cx="104" cy="66" r="7" />
                <Rect x="30" y="40" width="68" height="52" rx="22" fill={Palette.white} />
            </G>
            <Rect x="40" y="54" width="48" height="24" rx="12" fill={INK} />
            <Circle cx="55" cy="66" r="5" fill={Palette.white} />
            <Circle cx="73" cy="66" r="5" fill={Palette.white} />

            {/* cross badge, with the assistant's "signal" arcs either side */}
            <G stroke={INK} strokeWidth={STROKE} fill="none">
                <Rect x="38" y="102" width="52" height="46" rx="12" fill={Palette.white} />
            </G>
            <Circle cx="64" cy="125" r="15" fill="#EF4444" />
            <Path d="M64 117 v16 M56 125 h16" stroke={Palette.white} strokeWidth="3.4" strokeLinecap="round" />
            <G stroke={Palette.primaryLight} strokeWidth={STROKE} fill="none" strokeLinecap="round">
                <Path d="M28 114 q-6 11 0 22 M34 117 q-4 8 0 16" />
                <Path d="M100 114 q6 11 0 22 M94 117 q4 8 0 16" />
            </G>

            {/* medication */}
            <G stroke={INK} strokeWidth={STROKE} fill="none">
                <Rect x="22" y="160" width="26" height="28" rx="4" fill={Palette.white} />
                <Rect x="27" y="153" width="16" height="8" rx="2" fill={Palette.white} />
                <Line x1="26" y1="174" x2="44" y2="174" stroke={Palette.primaryLight} />
                <Rect x="56" y="158" width="46" height="32" rx="7" fill={Palette.white} />
            </G>
            <G fill="none" stroke={INK} strokeWidth="1.1">
                {[65, 79, 93].map((cx) =>
                    [167, 181].map((cy) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />)
                )}
            </G>

            {/* ---- conversation ---- */}
            <Path d="M132 36 h72 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-56 l-14 12 v-12 h-2 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z" fill={Palette.primary} />
            <Path d="M142 48 h50 M142 58 h32" stroke={Palette.white} strokeWidth="4" strokeLinecap="round" />

            <Path d="M224 12 h72 a8 8 0 0 1 8 8 v26 a8 8 0 0 1 -8 8 h-72 a8 8 0 0 1 -8 -8 v-26 a8 8 0 0 1 8 -8 z" fill={Palette.primarySurface} />
            <Path d="M228 24 h56 M228 34 h40 M228 44 h48" stroke={Palette.primaryLight} strokeWidth="4" strokeLinecap="round" />

            {/* gear cluster */}
            <G stroke={INK} strokeWidth={STROKE} fill="none">
                <Circle cx="286" cy="70" r="13" />
                <Circle cx="286" cy="70" r="5" />
            </G>
            <Circle cx="303" cy="82" r="8" fill={Palette.success} />

            {/* ---- person at a laptop ---- */}
            <G stroke={INK} strokeWidth={STROKE} fill="none" strokeLinecap="round">
                {/* frustration marks */}
                <Path d="M196 74 h22 M192 80 h30 M198 86 h20" />
                {/* head and hair */}
                <Circle cx="222" cy="104" r="15" fill={Palette.white} />
                <Path d="M212 92 q14 -12 26 -2 q10 8 8 22 q-2 12 -12 12" fill={INK} stroke="none" />
                {/* arm up to the temple */}
                <Path d="M210 100 q-10 -6 -14 4 q-4 10 6 14" />
                {/* seated body */}
                <Path d="M236 118 q24 6 26 30 q2 26 -26 34 h-88" fill={Palette.white} />
                <Path d="M148 182 q-4 -22 16 -30 q10 -4 22 -2" fill={Palette.white} />
                {/* knees drawn up */}
                <Path d="M170 154 q22 -8 40 6 M182 176 q10 -14 26 -12" />
            </G>
            <Path d="M226 118 q22 4 26 26 q-16 8 -32 2 q-6 -16 6 -28 z" fill={Palette.primary} />

            {/* laptop */}
            <Path d="M170 122 l38 -8 v34 l-38 6 z" fill={INK} />
            <Path d="M164 148 l46 -6 l10 8 h-58 z" fill={INK} />
            <Circle cx="188" cy="130" r="2" fill={Palette.primaryLight} />

            {/* mug */}
            <G stroke={INK} strokeWidth={STROKE} fill="none" strokeLinecap="round">
                <Rect x="232" y="146" width="18" height="22" rx="3" fill={Palette.white} />
                <Path d="M250 152 q7 5 0 10" />
                <Path d="M237 138 q-4 -6 2 -10 M245 138 q-4 -6 2 -10" />
            </G>
        </Svg>
    );
}
