/**
 * The block both auth screens open with: the mark on its glow, the wordmark, and one line
 * saying what signing in is for.
 *
 * The glow is a lavender disc drawn *behind* the mark rather than a shadow on it, because
 * `BrandMark` is four arms with the background showing through the middle. A shadow would
 * trace each arm and leave the centre white, losing the halo the kit puts there — in the
 * kit's export that centre square reads `#EDE4FD`, which is the glow, not a fill.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BrandMark from '@/components/BrandMark';
import { Fonts, Palette } from '@/constants/theme';

const MARK_SIZE = 40;

interface Props {
    /** The one line under the wordmark. Screens phrase this for what they are asking for. */
    tagline: string;
}

export default function AuthHeader({ tagline }: Props) {
    return (
        <View style={styles.wrap}>
            <View style={styles.markSlot}>
                <View style={styles.glow} />
                <BrandMark size={MARK_SIZE} color={Palette.primary} />
            </View>
            <Text style={styles.wordmark}>LabTrack</Text>
            <Text style={styles.tagline}>{tagline}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
    },
    markSlot: {
        width: MARK_SIZE,
        height: MARK_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        width: MARK_SIZE * 1.9,
        height: MARK_SIZE * 1.9,
        borderRadius: MARK_SIZE,
        backgroundColor: Palette.primarySurface,
        opacity: 0.75,
    },
    wordmark: {
        marginTop: 14,
        fontSize: 32,
        fontFamily: Fonts.bold,
        color: Palette.text,
        letterSpacing: -0.5,
    },
    tagline: {
        marginTop: 14,
        fontSize: 15,
        lineHeight: 22,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
    },
});
