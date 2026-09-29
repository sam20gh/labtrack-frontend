/**
 * Plan items shown where they are acted on, rather than only on the timeline.
 *
 * The plan is the record and stays the record: these are the same rows, not copies, and
 * each opens `app/plan/[id].tsx` — the one place an item is read in full and finished or
 * dismissed. Deliberately not an alert. A note to raise with a prescriber is not a verdict
 * on a result, so it wears no `danger` and no `alert` rose; the neutral badge and the
 * chevron say "there is something here to read", which is all it is.
 *
 * Which rows belong on which screen is decided in `lib/plan.ts`
 * (`planItemsForMedications`), never here.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, BodyFont, Spacing, Radius } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { PlanItem } from '@/types/api';

/** One item: the kicker, the first two lines of it, and the way into the rest. */
export const PlanNoteRow = ({ item, divider }: { item: PlanItem; divider?: boolean }) => {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    return (
        <TouchableOpacity
            style={[styles.row, divider && styles.divider]}
            onPress={() => router.push({ pathname: '/plan/[id]', params: { id: item._id } })}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`From your health plan: ${item.title}`}
            accessibilityHint="Opens the full advice"
        >
            <View style={styles.icon}>
                <Ionicons name="clipboard-outline" size={17} color={Palette.textSecondary} />
            </View>
            <View style={styles.body}>
                <Text style={styles.kicker}>From your health plan</Text>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

/**
 * The card a hub draws. Three rows at most — past that it is a second copy of the plan,
 * and the plan is one tap away.
 */
export const PlanNotesCard = ({ items }: { items: PlanItem[] }) => {
    const styles = useStyles();
    const router = useRouter();
    if (items.length === 0) return null;
    const shown = items.slice(0, 3);
    return (
        <View style={styles.card}>
            {shown.map((item, i) => <PlanNoteRow key={item._id} item={item} divider={i > 0} />)}
            {items.length > shown.length ? (
                <TouchableOpacity style={styles.more} onPress={() => router.push('/myplans')}>
                    <Text style={styles.moreText}>{`${items.length - shown.length} more on your plan`}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    card: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl,
        backgroundColor: Palette.background, paddingHorizontal: Spacing.lg,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    divider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    icon: {
        width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1, gap: 2 },
    kicker: { fontSize: 11, color: Palette.textMuted, ...BodyFont.medium },
    title: { fontSize: 14, lineHeight: 19, color: Palette.text, ...BodyFont.medium },
    more: { borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingVertical: Spacing.md },
    moreText: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.semibold },
}));
