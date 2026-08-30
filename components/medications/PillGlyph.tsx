/**
 * The shape-and-colour marker the design puts beside every medication.
 *
 * Purely an aid to recognition — six white tablets in a list are indistinguishable, and a
 * person scanning their evening doses picks the right row by its silhouette. It is never an
 * identifier: `imprint` and `strength` are what identify a medicine, and nothing in the app
 * should ever act on the glyph.
 *
 * Drawn in SVG rather than as an icon font because the design's shape picker offers twelve
 * silhouettes, and `Ionicons` has about three of them.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse, Polygon, G } from 'react-native-svg';
import { Palette, Radius } from '@/constants/theme';
import type { MedicationShape } from '@/types/api';

interface Props {
    shape?: MedicationShape | null;
    colour?: string | null;
    size?: number;
}

/** A pale wash of the pill colour, so the tile reads as tinted rather than saturated. */
const tint = (colour: string | null | undefined) => {
    if (!colour) return Palette.borderLight;
    // Six-digit hex only; anything else falls back rather than producing an invalid colour
    return /^#[0-9a-f]{6}$/i.test(colour) ? `${colour}1A` : Palette.borderLight;
};

export function PillGlyph({ shape, colour, size = 44 }: Props) {
    const stroke = colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : Palette.textMuted;
    const s = size * 0.52;
    const c = s / 2;

    const common = { fill: 'none', stroke, strokeWidth: 1.6 };

    const glyph = () => {
        switch (shape) {
            case 'round':
            case 'circle':
                return <Circle cx={c} cy={c} r={c - 1} {...common} />;
            case 'oval':
                return <Ellipse cx={c} cy={c} rx={c - 1} ry={c * 0.66} {...common} />;
            case 'oblong':
            case 'long':
            case 'capsule':
                return <Rect x={1} y={c * 0.55} width={s - 2} height={s * 0.45} rx={s * 0.22} {...common} />;
            case 'rectangle':
                return <Rect x={1} y={c * 0.5} width={s - 2} height={s * 0.5} rx={2} {...common} />;
            case 'square':
                return <Rect x={2} y={2} width={s - 4} height={s - 4} rx={3} {...common} />;
            case 'triangle':
                return <Polygon points={`${c},2 ${s - 2},${s - 2} 2,${s - 2}`} {...common} />;
            case 'diamond':
                return <Polygon points={`${c},1 ${s - 1},${c} ${c},${s - 1} 1,${c}`} {...common} />;
            case 'pentagon':
                return <Polygon points={`${c},1 ${s - 1},${s * 0.38} ${s * 0.81},${s - 1} ${s * 0.19},${s - 1} 1,${s * 0.38}`} {...common} />;
            case 'hexagon':
                return <Polygon points={`${c},1 ${s - 1},${s * 0.27} ${s - 1},${s * 0.73} ${c},${s - 1} 1,${s * 0.73} 1,${s * 0.27}`} {...common} />;
            case 'teardrop':
                return <Path d={`M ${c} 1 C ${s - 1} ${s * 0.35}, ${s - 1} ${s - 1}, ${c} ${s - 1} C 1 ${s - 1}, 1 ${s * 0.35}, ${c} 1 Z`} {...common} />;
            case 'shield':
                return <Path d={`M ${c} 1 L ${s - 2} ${s * 0.25} L ${s - 2} ${s * 0.6} Q ${s - 2} ${s - 1} ${c} ${s - 1} Q 2 ${s - 1} 2 ${s * 0.6} L 2 ${s * 0.25} Z`} {...common} />;
            case 'trapezoid':
                return <Polygon points={`${s * 0.26},${s * 0.3} ${s * 0.74},${s * 0.3} ${s - 1},${s * 0.7} 1,${s * 0.7}`} {...common} />;
            default:
                // Unknown or unset: the design's default capsule silhouette
                return <Rect x={1} y={c * 0.55} width={s - 2} height={s * 0.45} rx={s * 0.22} {...common} />;
        }
    };

    return (
        <View style={[styles.tile, { width: size, height: size, backgroundColor: tint(colour) }]}>
            <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
                <G>{glyph()}</G>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Palette.border,
    },
});
