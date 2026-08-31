/**
 * The photographs, as a rail on the tracker dashboard.
 *
 * Frames 13 and 32 of `Design/nutrition.svg` both draw a gallery the same way: a strip of
 * thumbnails inside a card, with the count and a chevron underneath. The kit puts one on a
 * single meal; this one reads across the whole history, because "what have I been eating"
 * is a question about the run of days rather than about lunch on Tuesday — and because a
 * per-meal gallery would need several photographs of one plate, which the capture flow
 * does not produce.
 *
 * Renders nothing at all when there are no photographs. An empty strip of grey squares is a
 * promise the feature has not kept yet, and the dashboard already carries a prompt to log a
 * meal; a second empty state under it says the same thing twice.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { NutritionGalleryItem } from '@/types/api';

interface Props {
    items: NutritionGalleryItem[];
    /** Every photograph on record, which is usually more than `items` holds. */
    total: number;
    onPressItem: (item: NutritionGalleryItem) => void;
    onSeeAll: () => void;
}

export function MealGallery({ items, total, onPressItem, onSeeAll }: Props) {
    if (!items.length) return null;

    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
                    <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.strip}
                >
                    {items.map((item) => (
                        <TouchableOpacity
                            key={item._id}
                            style={styles.tile}
                            activeOpacity={0.85}
                            onPress={() => onPressItem(item)}
                        >
                            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                            {/*
                              The calorie figure sits on the picture rather than under it.
                              A caption line under every tile turns a strip of food into a
                              spreadsheet, and the number is the one thing worth reading at
                              this size.
                            */}
                            <View style={styles.kcalChip}>
                                <Text style={styles.kcalText}>{Math.round(item.calories)}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity style={styles.footer} onPress={onSeeAll} activeOpacity={0.7}>
                    <Text style={styles.count}>
                        {total} {total === 1 ? 'photo' : 'photos'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    seeAll: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingTop: Spacing.md,
        overflow: 'hidden',
    },
    // Padding lives on the content, not the ScrollView, so a tile can scroll to the edge
    // of the card rather than stopping short of it.
    strip: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
    tile: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
    thumb: { width: '100%', height: '100%', backgroundColor: Palette.borderLight },
    kcalChip: {
        position: 'absolute',
        left: 4,
        bottom: 4,
        borderRadius: Radius.pill,
        paddingHorizontal: 6,
        paddingVertical: 1,
        backgroundColor: 'rgba(17,24,39,0.66)',
    },
    kcalText: { fontFamily: Fonts.semibold, fontSize: 10, color: Palette.white },

    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        marginTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
    },
    count: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.text },
});
