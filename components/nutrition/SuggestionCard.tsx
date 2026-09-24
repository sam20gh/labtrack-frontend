/**
 * One AI meal suggestion.
 *
 * **The photograph is an example, and the card says so.** Nothing has been cooked, so no
 * picture on this card can be of the meal: it is somebody else's dish with a similar name,
 * from Unsplash, chosen on the server by `utils/mealImages.js`. The first version of this
 * card refused stock imagery for exactly that reason — a picture dresses a suggestion up as
 * evidence. It is back because a rail of six tinted panels gave nobody an idea of what they
 * were being offered, and it is back on three conditions:
 *
 *   1. **"Example photo" is printed on the picture itself**, not in a footnote, together with
 *      the photographer's credit that Unsplash requires anyway.
 *   2. **The server skips any photo whose description names something this person cannot
 *      eat**, using the same screen the dish passed. A safe salad under a stock shot covered
 *      in walnuts would be the one thing on this card a nut-allergic person should not see.
 *   3. **A missing photo is the old card, not a broken one.** Older cached sets, no key on
 *      the server, a rate limit, a search that found nothing safe: the tile falls back to the
 *      tinted panel, picked from the meal slot so a rail of six does not shimmer.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, Spacing, Radius, BodyFont, activePalette, tone, schemed } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { MEAL_TYPE_LABEL } from '@/lib/nutrition';
import type { MealSuggestion, MealType } from '@/types/api';

/** Slot → tile wash. Warm through the day, matching how the kit's photographs read. */
const SLOT_WASH: Record<MealType, [string, string]> = schemed((_, scheme) => ({
    breakfast: [tone('#FDE68A', scheme), tone('#FCA5A5', scheme)],
    lunch: [tone('#A7F3D0', scheme), tone('#93C5FD', scheme)],
    dinner: [activePalette().primaryPale, tone('#818CF8', scheme)],
    snack: [tone('#FBCFE8', scheme), activePalette().primaryPale],
}));

const SLOT_ICON: Record<MealType, string> = {
    breakfast: 'sunny-outline',
    lunch: 'partly-sunny-outline',
    dinner: 'moon-outline',
    snack: 'cafe-outline',
};

/** Top and bottom shade, so white chips and the credit read over any photograph. */
const SCRIM: [string, string, string] = ['rgba(15,23,42,0.28)', 'rgba(15,23,42,0)', 'rgba(15,23,42,0.62)'];

const open = (url?: string) => { if (url) Linking.openURL(url).catch(() => {}); };

interface HeroProps {
    suggestion: MealSuggestion;
    height: number;
    /** `full` spells the credit out and links both names; `compact` fits a 250pt card. */
    credit?: 'compact' | 'full';
    children?: React.ReactNode;
}

/**
 * The top of a suggestion: its example photograph with the credit, or the tinted panel.
 * Shared by the card and the detail sheet so the two cannot disagree about the label.
 */
export function SuggestionHero({ suggestion, height, credit = 'compact', children }: HeroProps) {
    const Palette = usePalette();
    const styles = useStyles();
    const slot = suggestion.mealType || 'lunch';
    const image = suggestion.image;

    if (!image?.url) {
        return (
            <LinearGradient
                colors={SLOT_WASH[slot]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, { height }]}
            >
                <View style={styles.chipRow}>{children}</View>
            </LinearGradient>
        );
    }

    return (
        <View style={[styles.hero, { height, backgroundColor: image.color || Palette.canvas }]}>
            <Image
                source={{ uri: image.url }}
                placeholder={image.blurHash ? { blurhash: image.blurHash } : undefined}
                contentFit="cover"
                transition={200}
                style={StyleSheet.absoluteFill}
                accessibilityIgnoresInvertColors
                // Decoration: the dish is named in text directly below
                accessible={false}
            />
            <LinearGradient colors={SCRIM} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

            <View style={styles.chipRow}>{children}</View>

            <View style={styles.credit}>
                <Ionicons name="image-outline" size={11} color={Palette.white} />
                {credit === 'full' ? (
                    <Text style={styles.creditText} numberOfLines={1}>
                        Example photo by{' '}
                        <Text style={styles.creditLink} onPress={() => open(image.authorUrl)}>
                            {image.author || 'a photographer'}
                        </Text>
                        {' '}on{' '}
                        <Text style={styles.creditLink} onPress={() => open(image.photoUrl)}>Unsplash</Text>
                    </Text>
                ) : (
                    <Pressable onPress={() => open(image.authorUrl || image.photoUrl)} hitSlop={6} style={styles.creditPress}>
                        <Text style={styles.creditText} numberOfLines={1}>
                            Example photo · {image.author ? `${image.author} / ` : ''}Unsplash
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

interface Props {
    suggestion: MealSuggestion;
    onPress?: () => void;
    /** `rail` is the fixed-width horizontal card; `list` fills its parent. */
    variant?: 'rail' | 'list';
}

export function SuggestionCard({ suggestion, onPress, variant = 'rail' }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const slot = suggestion.mealType || 'lunch';
    // The panel only needs room for chips; a photograph needs room to be a picture
    const height = suggestion.image?.url ? (variant === 'rail' ? 132 : 168) : 96;

    return (
        <TouchableOpacity
            style={[styles.card, variant === 'rail' ? styles.rail : styles.list]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.85}
        >
            <SuggestionHero suggestion={suggestion} height={height}>
                <View style={styles.slotChip}>
                    <Ionicons name={SLOT_ICON[slot] as any} size={12} color={Palette.text} />
                    <Text style={styles.slotText}>{MEAL_TYPE_LABEL[slot]}</Text>
                </View>

                {suggestion.prepMinutes != null && (
                    <View style={styles.slotChip}>
                        <Ionicons name="time-outline" size={12} color={Palette.text} />
                        <Text style={styles.slotText}>{suggestion.prepMinutes}m</Text>
                    </View>
                )}
            </SuggestionHero>

            <View style={styles.body}>
                <Text style={styles.name} numberOfLines={2}>{suggestion.name}</Text>

                {suggestion.why ? (
                    <Text style={styles.why} numberOfLines={variant === 'rail' ? 2 : 3}>
                        {suggestion.why}
                    </Text>
                ) : null}

                <View style={styles.stats}>
                    <Stat icon="flame-outline" value={`${suggestion.calories}kcal`} />
                    <Stat icon="barbell-outline" value={`${suggestion.protein}g`} />
                    <Stat icon="leaf-outline" value={`${suggestion.carbs}g`} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const Stat = ({ icon, value }: { icon: string; value: string }) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.stat}>
            <Ionicons name={icon as any} size={13} color={Palette.textSecondary} />
            <Text style={styles.statText}>{value}</Text>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        overflow: 'hidden',
    },
    rail: { width: 250 },
    list: { width: '100%' },
    hero: { overflow: 'hidden', justifyContent: 'space-between' },
    chipRow: {
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    slotChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    slotText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.text },

    credit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    creditPress: { flexShrink: 1 },
    creditText: { flexShrink: 1, ...BodyFont.medium, fontSize: 10, color: Palette.white },
    creditLink: { fontFamily: Fonts.semibold, textDecorationLine: 'underline' },

    body: { padding: Spacing.md, gap: Spacing.xs },
    name: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.text },
    why: { ...BodyFont.regular, fontSize: 12, color: Palette.textSecondary, lineHeight: 17 },
    stats: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.text },
}));
