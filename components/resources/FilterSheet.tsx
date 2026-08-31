/**
 * The Filter Resources sheet.
 *
 * Three facets — Resource Type, Category, Duration — and a button that names the number of
 * results before the sheet closes. That count is the reason the sheet holds a draft of the
 * filters rather than applying each tap: it re-queries the list endpoint for `total` only,
 * and only commits on "Show results", so a person can try a combination and back out of it
 * without the screen behind them lurching about.
 *
 * `options` comes from `GET /resources/filters` rather than being written here, so a category
 * added on the website appears in the sheet without an app release.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import { listResources, type FilterOptions, type ResourceQuery } from '@/lib/resources';

export type Filters = {
    type: string;
    category: string | null;
    duration: string;
    sort: string;
};

export const EMPTY_FILTERS: Filters = { type: 'all', category: null, duration: 'any', sort: 'newest' };

/** Turn the sheet's state into the query string the list endpoint speaks. */
export const toQuery = (filters: Filters, options: FilterOptions | null, extra: ResourceQuery = {}): ResourceQuery => {
    const duration = options?.durations.find((d) => d.key === filters.duration);
    return {
        ...extra,
        type: filters.type === 'all' ? undefined : (filters.type as any),
        category: filters.category || undefined,
        minMinutes: duration?.minMinutes,
        maxMinutes: duration?.maxMinutes,
        sort: filters.sort as any,
    };
};

export const countActive = (filters: Filters) =>
    (filters.type !== 'all' ? 1 : 0) + (filters.category ? 1 : 0) + (filters.duration !== 'any' ? 1 : 0);

const Pill = ({ label, selected, icon, onPress }: {
    label: string; selected: boolean; icon?: string; onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.pill, selected && styles.pillSelected]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        {!!icon && (
            <Ionicons
                name={icon as any}
                size={14}
                color={selected ? Palette.primary : Palette.textSecondary}
            />
        )}
        <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
);

export default function FilterSheet({ visible, options, value, baseQuery, onApply, onClose }: {
    visible: boolean;
    options: FilterOptions | null;
    value: Filters;
    /** Filters the host screen pins and the sheet must not offer to change (e.g. a fixed type). */
    baseQuery?: ResourceQuery;
    onApply: (filters: Filters) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<Filters>(value);
    const [count, setCount] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);

    // Re-seed from the host every time it opens: a sheet that remembers a combination the
    // person backed out of shows them filters the list is not actually using.
    useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

    const query = useMemo(() => toQuery(draft, options, { ...baseQuery, limit: 1 }), [draft, options, baseQuery]);

    const recount = useCallback(async () => {
        setCounting(true);
        try {
            const page = await listResources(query);
            setCount(page.total);
        } catch {
            // A count that could not be fetched is shown as no count. The button still
            // applies the filters — refusing to let someone filter because a preview
            // request failed would be the worse failure.
            setCount(null);
        } finally {
            setCounting(false);
        }
    }, [query]);

    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(recount, 220);
        return () => clearTimeout(timer);
    }, [visible, recount]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.grabber} />

                <View style={styles.header}>
                    <Text style={styles.title}>Filter Resources</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={22} color={Palette.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                    {!options ? (
                        <ActivityIndicator color={Palette.primary} style={styles.loader} />
                    ) : (
                        <>
                            <Text style={styles.label}>Resource Type</Text>
                            <View style={styles.pillWrap}>
                                {options.types.map((t) => (
                                    <Pill
                                        key={t.key}
                                        label={t.label}
                                        selected={draft.type === t.key}
                                        onPress={() => setDraft((d) => ({ ...d, type: t.key }))}
                                    />
                                ))}
                            </View>

                            <Text style={styles.label}>Category</Text>
                            <View style={styles.pillWrap}>
                                <Pill
                                    label="Any"
                                    selected={!draft.category}
                                    onPress={() => setDraft((d) => ({ ...d, category: null }))}
                                />
                                {options.categories.map((c) => (
                                    <Pill
                                        key={c.slug}
                                        label={c.name}
                                        icon={c.icon}
                                        selected={draft.category === c.slug}
                                        onPress={() => setDraft((d) => ({
                                            ...d,
                                            category: d.category === c.slug ? null : c.slug,
                                        }))}
                                    />
                                ))}
                            </View>

                            <Text style={styles.label}>Duration</Text>
                            <View style={styles.pillWrap}>
                                {options.durations.map((d) => (
                                    <Pill
                                        key={d.key}
                                        label={d.label}
                                        icon="time-outline"
                                        selected={draft.duration === d.key}
                                        onPress={() => setDraft((prev) => ({ ...prev, duration: d.key }))}
                                    />
                                ))}
                            </View>

                            <Text style={styles.label}>Sort by</Text>
                            <View style={styles.pillWrap}>
                                {options.sorts.map((s) => (
                                    <Pill
                                        key={s.key}
                                        label={s.label}
                                        selected={draft.sort === s.key}
                                        onPress={() => setDraft((d) => ({ ...d, sort: s.key }))}
                                    />
                                ))}
                            </View>
                        </>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.reset} onPress={() => setDraft(EMPTY_FILTERS)}>
                        <Text style={styles.resetText}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.apply} onPress={() => onApply(draft)} activeOpacity={0.85}>
                        <Text style={styles.applyText}>
                            {counting || count === null ? 'Show results' : `Show results (${count})`}
                        </Text>
                        <Ionicons name="options-outline" size={16} color={Palette.white} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)' },
    sheet: {
        backgroundColor: Palette.background,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Spacing.xxxl, maxHeight: '82%',
    },
    grabber: {
        width: 44, height: 4, borderRadius: 2, backgroundColor: Palette.border,
        alignSelf: 'center', marginTop: Spacing.md,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    },
    title: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
    loader: { marginVertical: Spacing.xxxl },
    label: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.lg, marginBottom: Spacing.md },
    pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
    },
    pillSelected: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    pillText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    pillTextSelected: { color: Palette.primary, fontFamily: Fonts.semibold },
    footer: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight,
    },
    reset: {
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border,
    },
    resetText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    apply: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    applyText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
});
