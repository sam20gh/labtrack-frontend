/**
 * A person's avatar, with initials behind it.
 *
 * Shared by the profile hub, the profile edit form and the home header, because the three
 * of them have to agree about one thing that is easy to get wrong independently: **an image
 * that fails to load must fall back to the initials, not to a hole.**
 *
 * That is not a hypothetical. `utils/imageStore.js` spent its whole life assembling
 * Cloudflare delivery URLs out of `CLOUDFLARE_ACCOUNT_ID` instead of reading them from the
 * upload response, and an account id is not the account hash those URLs carry. Every stored
 * URL 404'd. On the server it looked like a success; on the phone it looked like the photo
 * had not saved, which is a very long way from the actual fault. A transparent `<Image>` is
 * the worst possible rendering of a bad URL — it is indistinguishable from having no photo
 * at all, so nobody reports it as broken.
 *
 * `onError` here means the fallback is what someone sees, and a URL that was stored before
 * that fix stops looking like a bug in saving.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, Image, StyleSheet,
    type ViewStyle, type ImageStyle, type StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts } from '@/constants/theme';

export const Avatar = ({
    uri, initials, size, style, textStyle,
}: {
    uri?: string | null;
    /** Empty is fine — the person glyph stands in until a name exists. */
    initials?: string;
    size: number;
    /** Border and ring styling shared by both states — `ViewStyle` keys only, so the
     *  same value is valid on the `<Image>` and on the initials `<View>`. */
    style?: StyleProp<ViewStyle & ImageStyle>;
    textStyle?: { fontSize?: number; color?: string };
}) => {
    const [failed, setFailed] = useState(false);

    // A new URL deserves a fresh attempt: without this, one bad image would poison the
    // slot for the rest of the session, including the photo that replaced it.
    useEffect(() => { setFailed(false); }, [uri]);

    const box = { width: size, height: size, borderRadius: size / 2 };
    const showImage = Boolean(uri) && !failed;

    if (showImage) {
        return (
            <Image
                source={{ uri: uri as string }}
                style={[box, style]}
                onError={() => setFailed(true)}
                accessibilityIgnoresInvertColors
            />
        );
    }

    return (
        <View style={[box, styles.fallback, style]}>
            {initials?.trim() ? (
                <Text
                    style={[
                        styles.initials,
                        { fontSize: textStyle?.fontSize ?? Math.round(size * 0.36) },
                        textStyle?.color ? { color: textStyle.color } : null,
                    ]}
                >
                    {initials}
                </Text>
            ) : (
                <Ionicons name="person" size={Math.round(size * 0.45)} color={Palette.primary} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    fallback: {
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: { fontFamily: Fonts.bold, color: Palette.primary, includeFontPadding: false },
});

export default Avatar;
