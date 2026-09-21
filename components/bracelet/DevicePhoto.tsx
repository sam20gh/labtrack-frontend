/**
 * The bracelet itself, photographed.
 *
 * `assets/images/devices/jstyle-v8.png` is cut from `Design/v8.webp`, the maker's product
 * shot, which ships on an opaque white background. On the stage that would be a white
 * rectangle sitting over the perspective grid, so the background was removed — including
 * the white showing through the band's loop, which an edge flood-fill cannot reach because
 * it is enclosed. The white "JCVital" lettering and the buckle's highlight are enclosed
 * white regions too and were deliberately kept; only the one large enclosed region, the
 * loop's hole, was cleared.
 *
 * **Only the V8 has a photograph.** There is no product shot of the 2208A, so a paired 2208A
 * falls back to the drawn `BraceletArt` rather than showing somebody a picture of a device
 * they do not own. Add a 2208A photo to `PHOTOS` and it is used everywhere this is.
 */
import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';

import type { JstyleVariant } from '@/modules/jstyle-ble';

const PHOTOS: Partial<Record<JstyleVariant, ImageSourcePropType>> = {
    v8: require('@/assets/images/devices/jstyle-v8.png'),
};

/** Width over height of the cut-out, so the image is sized without a layout pass. */
const ASPECT = 540 / 615;

export const hasPhoto = (variant: JstyleVariant): boolean => Boolean(PHOTOS[variant]);

interface Props {
    variant: JstyleVariant;
    width?: number;
}

export default function DevicePhoto({ variant, width = 190 }: Props) {
    const source = PHOTOS[variant];
    if (!source) return null;

    return (
        <Image
            source={source}
            style={{ width, height: width / ASPECT }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="J-Style V8 health bracelet"
        />
    );
}
