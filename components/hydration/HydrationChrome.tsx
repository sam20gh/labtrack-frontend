/**
 * The chrome the five hydration screens share.
 *
 * A header and a section heading are not worth a component each; five copies of them are how
 * a feature's screens start drifting a pixel at a time, which is the argument `RangeTabs`
 * already makes for the segmented control.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

/**
 * Back, an optional status pill, and an optional action.
 *
 * The pill carries the day's level and is **omitted rather than defaulted** when there is
 * none: a "Hydrated" chip on a day nobody logged is the app answering a question it was not
 * asked. Same rule the level meter follows.
 */
export function WaterHeader({ title, pill, onAdd, right }: {
    title?: string;
    pill?: string | null;
    onAdd?: () => void;
    right?: React.ReactNode;
}) {
    const router = useRouter();
    return (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>

            {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : <View style={styles.flex} />}

            <View style={styles.headerRight}>
                {pill ? (
                    <View style={styles.pill}>
                        <View style={styles.pillDot} />
                        <Text style={styles.pillText} numberOfLines={1}>{pill}</Text>
                    </View>
                ) : null}
                {right}
                {onAdd && (
                    <Pressable
                        onPress={onAdd}
                        style={styles.add}
                        accessibilityRole="button"
                        accessibilityLabel="Log a drink"
                    >
                        <Ionicons name="add" size={22} color={Palette.white} />
                    </Pressable>
                )}
            </View>
        </View>
    );
}

/** A section title with the design's "See All" affordance, drawn only when it leads somewhere. */
export function SectionHeader({ title, icon, onSeeAll, style }: {
    title: string;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    onSeeAll?: () => void;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <View style={[styles.section, style]}>
            <View style={styles.sectionLeft}>
                {icon && <Ionicons name={icon} size={17} color={Palette.primary} />}
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {onSeeAll && (
                <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
                    <Text style={styles.seeAll}>See All</Text>
                </Pressable>
            )}
        </View>
    );
}

/** A statement of absence, never of failure. Used wherever a window has nothing in it. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
    return <Text style={styles.empty}>{children}</Text>;
}

export const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.borderLight,
        padding: Spacing.lg,
    },
    raised: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        ...Shadow.card,
    },
});

const styles = StyleSheet.create({
    flex: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 11, paddingVertical: 6,
        borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.primaryLight,
        backgroundColor: Palette.primarySurface,
        maxWidth: 150,
    },
    pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.primary },
    pillText: { fontFamily: Fonts.medium, fontSize: 12.5, color: Palette.primaryDark },

    add: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
        ...Shadow.card,
    },

    section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16.5, color: Palette.text },
    seeAll: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    empty: {
        fontFamily: Fonts.regular, fontSize: 12.5, color: Palette.textMuted,
        textAlign: 'center', paddingVertical: Spacing.lg, lineHeight: 18,
    },
});
