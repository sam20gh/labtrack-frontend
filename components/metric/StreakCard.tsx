/**
 * The streak card — `Design/activity.svg` frame 7, with frame 18's badge.
 *
 * The artwork is **ported, not redrawn**: three paths lifted verbatim out of the export in
 * paint order, keeping the export's own coordinate origin so a re-issued export diffs
 * against this file directly. That is the treatment `SymptomIllustration.tsx` and
 * `WelcomeIllustration.tsx` both needed after hand-built likenesses drifted; a flame
 * approximated with an icon is a different picture every time somebody tidies it.
 *
 * The card is drawn only when there **is** a streak. A "0 day streak" is not an
 * encouragement, it is a scoreboard reading zero, and it is the first thing somebody sees
 * on the screen they opened to feel better about moving.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

/**
 * The export's own frame for the card: x 2865, y 678, 343 × 104.
 *
 * Kept rather than translated to the origin so the two paths below are byte-comparable
 * with a fresh export of `activity.svg`.
 */
const VIEW_BOX = '2865 678 343 104';

/** The warm blob, and the line work over it. The card's own border replaces path 4. */
const BLOB = 'M3105.3 793.908C3102.36 786.476 3099.41 779.043 3096.47 771.611C3104.93 766.538 3115.56 765.218 3125 768.065C3115.64 760.524 3111.76 747.673 3112.51 735.663C3113.25 723.653 3118.02 712.277 3123.37 701.501C3126.31 695.572 3129.5 689.592 3130.42 683.036C3131.33 676.48 3129.47 669.074 3124.05 665.279C3140.12 666.297 3156.35 668.789 3170.96 675.575C3185.56 682.36 3198.49 693.875 3204.3 708.905C3206.11 691.876 3219.7 676.756 3236.43 673.163C3233.31 683.54 3235.63 695.391 3242.42 703.827C3246.6 709.004 3252.2 712.823 3256.78 717.642C3261.36 722.46 3265.02 728.979 3263.8 735.515V793.906H3105.3V793.908Z';
const LEAVES = 'M3160.21 788.896C3160.16 788.896 3160.11 788.886 3160.06 788.864C3154.3 786.274 3149.9 779.948 3148.29 771.946C3147.29 767.027 3147.28 761.928 3147.27 756.999C3147.27 754.988 3147.26 752.91 3147.19 750.876C3146.88 742.031 3145.09 735.768 3141.56 731.167C3141.47 731.051 3141.46 730.892 3141.53 730.763C3141.6 730.634 3141.74 730.555 3141.89 730.572C3153.32 731.587 3164.61 735.606 3174.56 742.196C3183.94 748.413 3191.69 756.635 3197.07 766.058C3195.87 755.661 3196.51 744.867 3198.97 734.715C3199.01 734.521 3199.2 734.4 3199.4 734.438C3209.19 736.368 3218.65 741.579 3226.03 749.113C3233.16 756.39 3238.09 765.562 3239.99 775.044C3243.02 769.794 3247.2 765.169 3252.11 761.623C3252.24 761.534 3252.4 761.531 3252.53 761.615C3252.66 761.701 3252.72 761.858 3252.69 762.008C3251.21 768.355 3250.75 774.864 3251.32 781.356C3251.34 781.56 3251.19 781.74 3250.98 781.757C3250.79 781.779 3250.6 781.624 3250.58 781.42C3250.04 775.182 3250.43 768.928 3251.75 762.812C3246.99 766.415 3242.99 771.056 3240.14 776.289C3240.06 776.428 3239.91 776.503 3239.75 776.478C3239.6 776.453 3239.47 776.332 3239.45 776.177C3235.9 756.109 3219.54 739.323 3199.6 735.235C3197.09 745.826 3196.55 757.107 3198.05 767.883C3198.08 768.061 3197.97 768.232 3197.8 768.286C3197.63 768.341 3197.44 768.265 3197.36 768.107C3186.67 748.031 3165.26 733.69 3142.64 731.386C3146.98 737.512 3147.74 745.381 3147.93 750.847C3148.01 752.893 3148.01 754.978 3148.01 756.994C3148.02 761.888 3148.03 766.947 3149.01 771.796C3150.58 779.566 3154.82 785.692 3160.36 788.185C3160.55 788.269 3160.63 788.488 3160.55 788.675C3160.49 788.815 3160.35 788.896 3160.21 788.896Z';

interface Props {
    /** Consecutive days ending today with an activity on them. Never rendered at zero. */
    days: number;
    /** The longest run this person has managed, when the server knows it. */
    best?: number | null;
}

export function StreakCard({ days, best }: Props) {
    if (!days || days <= 0) return null;

    // Only claimed when it is a fact the server sent. "Your longest streak" over a figure
    // computed from the last seven days would be a claim about a history nothing read.
    const isBest = Number.isFinite(best as number) && days >= (best as number);

    return (
        <View style={styles.card} accessibilityRole="summary">
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMaxYMax slice">
                    <Path d={BLOB} fill="#FDE68A" />
                    <Path d={LEAVES} fill="#92400E" />
                </Svg>
            </View>

            <View style={styles.body}>
                <Text style={styles.title}>{days}d streak!</Text>
                <Text style={styles.copy}>
                    {isBest
                        ? `Your longest streak for activity is ${days} days. Keep it up!`
                        : `You’re on a ${days}-day streak. Keep it up!`}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Palette.warningSurface,
        borderWidth: 1,
        borderColor: '#FCD34D',
        borderRadius: Radius.lg,
        // The artwork bleeds off the right and bottom edges in the export, and is meant to.
        overflow: 'hidden',
        minHeight: 104,
        justifyContent: 'center',
    },
    // Held to the left half so the copy never runs under the blob, whatever the streak says.
    body: { padding: Spacing.lg, paddingRight: '38%', gap: 4 },
    title: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    copy: { fontSize: 12.5, fontFamily: Fonts.regular, color: Palette.textSecondary, lineHeight: 18 },
});
