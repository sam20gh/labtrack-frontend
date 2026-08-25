/**
 * The LabTrack mark — the flared medical cross the turing kit draws on the splash screen.
 *
 * Four separate arms with a square of background showing through the middle, each arm a
 * hair wider at its outer end than at the hub. That gap is the whole identity of the shape:
 * fill the centre in and it collapses into a generic plus sign.
 *
 * Drawn as a path rather than four `View`s so it scales cleanly and can be tinted in one
 * place — it sits on purple during the splash and on white everywhere else.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
    size?: number;
    color?: string;
}

/**
 * Geometry, in a 100×100 box, measured off the kit's export: total span 100, arm thickness
 * ~27, centre gap ~27, so each arm runs 36.5 units out from the hub. The outer ends flare
 * by 1.5 units per side.
 */
const MARK_PATH = [
    'M35 0 L65 0 L63.5 36.5 L36.5 36.5 Z', // top
    'M36.5 63.5 L63.5 63.5 L65 100 L35 100 Z', // bottom
    'M0 35 L36.5 36.5 L36.5 63.5 L0 65 Z', // left
    'M63.5 36.5 L100 35 L100 65 L63.5 63.5 Z', // right
].join(' ');

export default function BrandMark({ size = 64, color = '#FFFFFF' }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d={MARK_PATH} fill={color} />
        </Svg>
    );
}
