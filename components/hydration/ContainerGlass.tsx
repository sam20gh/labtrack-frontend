/**
 * The four vessels from `Design/water.svg`, ported verbatim.
 *
 * Cup, glass, bottle, large bottle — the icons the design puts beside every history row and
 * every "most consumed" row. Each is three of the export's paths (a pale body, a gradient
 * wave clipped to it, and a `#BFDBFE` rim drawn as an even-odd ring) at the export's own
 * coordinates and its own gradient stops, so a re-issued `water.svg` can be diffed against
 * this file rather than re-eyeballed.
 *
 * They are **icons, not gauges**: the wave sits where the design put it and does not move
 * with the volume. The number beside the row is what says how much; a second, imprecise
 * encoding of the same figure in a 20pt drawing would only ever contradict it.
 *
 * Which one is drawn comes from `containerFor()` in `lib/hydration.ts`, which buckets a
 * recorded millilitre figure. That is deliberately *not* the API's three-preset `containers`
 * list — see the note there.
 */
import React, { useId } from 'react';
import Svg, { Path, G, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';
import type { ContainerSize } from '@/lib/hydration';

interface Vessel {
    /** The export's own frame for this vessel. */
    view: [number, number, number, number];
    /** The pale `#DBEAFE` body, which also clips the wave. */
    body: string;
    /** The `#60A5FA → #2563EB` water, overhanging the body on every side. */
    wave: string;
    /** The `#BFDBFE` rim, an even-odd ring rather than a stroke. */
    rim: string;
    /** `userSpaceOnUse` gradient ends, straight from the export. */
    grad: [number, number, number, number];
}

const VESSELS: Record<ContainerSize, Vessel> = {
    cup: {
        view: [26, 24, 28, 33],
        body: 'M49.8043 25H30.1952C29.2018 25 28.429 25.8634 28.5387 26.8507L31.3369 52.0348C31.5245 '
            + '53.7229 32.9514 55 34.6499 55H45.3496C47.0481 55 48.475 53.7229 48.6625 52.0348L51.4608 '
            + '26.8507C51.5705 25.8634 50.7977 25 49.8043 25Z',
        wave: 'M26.1104 32.4475L27.2666 32.586C28.4263 32.7202 30.7388 32.9971 33.0548 32.7375C36.5374 '
            + '32.348 39.8881 30.9545 43.3881 30.6342C46.5479 30.3486 49.6416 30.8766 52.7319 '
            + '31.6382L53.8881 31.9282V56.1111C44.6277 56.1111 35.3708 56.1111 26.1104 56.1111V32.4475Z',
        rim: 'M49.9238 24.4477C51.1882 24.5164 52.1509 25.6367 52.0093 26.9119L49.2109 52.0964C48.9919 '
            + '54.0657 47.3273 55.5556 45.3459 55.5556H34.646C32.6647 55.5554 30.9999 54.0656 30.781 '
            + '52.0964L27.9826 26.9119C27.8365 25.5958 28.8671 24.4447 30.1912 24.4445H49.8006L49.9238 '
            + '24.4477ZM30.0692 25.5621C29.4673 25.6278 29.0187 26.1724 29.0872 26.7893L31.8856 '
            + '51.9732C32.0419 53.3798 33.2308 54.4443 34.646 54.4445H45.3459C46.7613 54.4445 47.9505 '
            + '53.38 48.1068 51.9732L50.9047 26.7893C50.9732 26.1722 50.5248 25.6276 49.9227 '
            + '25.5621L49.8006 25.5556H30.1912L30.0692 25.5621Z',
        grad: [39.9992, 30.5555, 39.9992, 56.1111],
    },
    glass: {
        view: [93, 25, 30, 38],
        body: 'M119.766 26H96.2346C95.0426 26 94.1152 27.0361 94.2468 28.2209L97.6047 58.4417C97.8298 '
            + '60.4675 99.5421 62 101.58 62H114.42C116.458 62 118.17 60.4675 118.395 58.4417L121.753 '
            + '28.2209C121.885 27.0361 120.958 26 119.766 26Z',
        wave: 'M91.333 34.9371L92.7205 35.1032C94.1122 35.2642 96.8872 35.5966 99.6663 35.285C103.846 '
            + '34.8176 107.866 33.1454 112.066 32.7611C115.858 32.4183 119.571 33.0519 123.279 '
            + '33.9659L124.666 34.3139V63.3334C113.554 63.3334 102.446 63.3334 91.333 63.3334V34.9371Z',
        rim: 'M119.909 25.3372C121.426 25.4197 122.581 26.764 122.411 28.2943L119.053 58.5156C118.79 '
            + '60.8788 116.793 62.6666 114.415 62.6666H101.575C99.1976 62.6664 97.1999 60.8787 96.9372 '
            + '58.5156L93.5791 28.2943C93.4038 26.7149 94.6405 25.3336 96.2295 25.3333H119.761L119.909 '
            + '25.3372ZM96.083 26.6745C95.3607 26.7533 94.8224 27.4068 94.9046 28.1471L98.2627 '
            + '58.3678C98.4502 60.0558 99.8769 61.3331 101.575 61.3333H114.415C116.114 61.3333 117.541 '
            + '60.0559 117.728 58.3678L121.086 28.1471C121.168 27.4066 120.63 26.7531 119.907 '
            + '26.6745L119.761 26.6666H96.2295L96.083 26.6745Z',
        grad: [108, 32.6667, 108, 63.3334],
    },
    bottle: {
        view: [166, 26, 36, 45],
        body: 'M197.727 27H170.274C168.883 27 167.801 28.2088 167.955 29.591L171.872 64.8487C172.135 '
            + '67.212 174.133 69 176.511 69H191.49C193.868 69 195.866 67.212 196.128 64.8487L200.046 '
            + '29.591C200.199 28.2088 199.117 27 197.727 27Z',
        wave: 'M164.556 37.4265L166.174 37.6204C167.798 37.8082 171.036 38.196 174.278 37.8325C179.154 '
            + '37.2872 183.845 35.3363 188.745 34.8879C193.168 34.488 197.499 35.2272 201.826 '
            + '36.2936L203.445 36.6995V70.5556C190.48 70.5556 177.52 70.5556 164.556 70.5556V37.4265Z',
        rim: 'M197.893 26.2268C199.663 26.323 201.011 27.8914 200.813 29.6767L196.895 64.9349C196.589 '
            + '67.692 194.258 69.7778 191.484 69.7778H176.504C173.731 69.7775 171.4 67.6918 171.093 '
            + '64.9349L167.176 29.6767C166.971 27.8341 168.414 26.2226 170.268 26.2222H197.721L197.893 '
            + '26.2268ZM170.097 27.7869C169.254 27.8789 168.626 28.6413 168.722 29.505L172.64 '
            + '64.7625C172.859 66.7318 174.523 68.2219 176.504 68.2222H191.484C193.466 68.2222 195.131 '
            + '66.7319 195.35 64.7625L199.267 29.505C199.362 28.6411 198.735 27.8787 197.892 '
            + '27.7869L197.721 27.7778H170.268L170.097 27.7869Z',
        grad: [184, 34.7778, 184, 70.5556],
    },
    flask: {
        view: [248, 27, 40, 51],
        body: 'M283.687 28H252.312C250.723 28 249.487 29.3815 249.662 30.9612L254.139 71.2556C254.439 '
            + '73.9566 256.722 76 259.44 76H276.56C279.277 76 281.56 73.9566 281.86 71.2556L286.337 '
            + '30.9612C286.513 29.3815 285.276 28 283.687 28Z',
        wave: 'M245.777 39.9161L247.627 40.1377C249.483 40.3523 253.183 40.7955 256.888 40.38C262.461 '
            + '39.7568 267.822 37.5272 273.422 37.0148C278.477 36.5578 283.427 37.4026 288.372 '
            + '38.6212L290.222 39.0852V77.7778C275.405 77.7778 260.594 77.7778 245.777 77.7778V39.9161Z',
        rim: 'M283.878 27.1163C285.901 27.2263 287.441 29.0187 287.215 31.059L282.737 71.3541C282.387 '
            + '74.5051 279.724 76.8889 276.553 76.8889H259.434C256.263 76.8885 253.6 74.5049 253.25 '
            + '71.3541L248.772 31.059C248.538 28.9532 250.187 27.1115 252.306 27.1111H283.681L283.878 '
            + '27.1163ZM252.111 28.8993C251.148 29.0045 250.43 29.8757 250.539 30.8628L255.017 '
            + '71.1571C255.267 73.4077 257.169 75.1108 259.434 75.1111H276.553C278.818 75.1111 280.721 '
            + '73.4079 280.971 71.1571L285.447 30.8628C285.557 29.8755 284.84 29.0041 283.876 '
            + '28.8993L283.681 28.8889H252.306L252.111 28.8993Z',
        grad: [268, 36.8889, 268, 77.7778],
    },
};

/**
 * The tallest vessel's own height, which is what `height` sizes.
 *
 * The four are drawn at 33, 38, 45 and 51 in the export, and **that difference is the
 * information**: a row of history where a 250ml cup and a litre bottle are the same size has
 * thrown away the one thing an icon of a vessel is for. So `height` is the height of the
 * largest, and each vessel keeps its own fraction of it — scaling every one to a fixed box
 * would have flattened them all to the same silhouette.
 */
const TALLEST = VESSELS.flask.view[3];

interface Props {
    size: ContainerSize;
    /**
     * The height a **large bottle** draws at; smaller vessels draw proportionally smaller.
     * Height rather than width, because these sit in a column and matching on width would
     * make the squat cup as tall as the bottle.
     */
    height?: number;
}

export function ContainerGlass({ size, height = 44 }: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const v = VESSELS[size];
    const [x, y, w, h] = v.view;
    const drawn = (height * h) / TALLEST;
    const width = (drawn * w) / h;
    const [x1, y1, x2, y2] = v.grad;

    return (
        <Svg width={width} height={drawn} viewBox={`${x} ${y} ${w} ${h}`}>
            <Defs>
                <LinearGradient id={`wg${uid}`} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                    <Stop stopColor="#60A5FA" />
                    <Stop offset="1" stopColor="#2563EB" />
                </LinearGradient>
                <ClipPath id={`wc${uid}`}>
                    <Path d={v.body} />
                </ClipPath>
            </Defs>

            <Path d={v.body} fill="#DBEAFE" />
            <G clipPath={`url(#wc${uid})`}>
                <Path d={v.wave} fill={`url(#wg${uid})`} />
            </G>
            <Path d={v.rim} fill="#BFDBFE" fillRule="evenodd" clipRule="evenodd" />
        </Svg>
    );
}
