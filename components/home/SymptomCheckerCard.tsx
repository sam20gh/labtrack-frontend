/**
 * Symptom Checker — the home card, from `Design/sympt.svg`.
 *
 * The kit draws it as one panel: the illustration, a search field with a filter button
 * beside it, a "Most Common" rail, a rule, and a "Recent Checks" list. Every measurement
 * below is the export's own — card `343×384` at radius 8, field `263×40` at radius 6 with
 * a 40pt circle 8pt to its right, chips 24 tall at radius 4, the rule full-bleed at y=297,
 * rows on a 48pt pitch behind a 24pt badge.
 *
 * Two things depart from the kit, and both are the same departure the rest of this feature
 * already makes (see **Symptom checker** in CLAUDE.md):
 *
 * 1. **The right-hand slot is a severity, not a risk.** The kit writes "High Risk" and
 *    "Low Risk" against each row. Nothing here can write those words honestly — there is
 *    no diagnosis engine and no risk model behind the chips — so the slot carries the
 *    severity the person picked themselves, and the kit's rose and violet badges separate
 *    what they called hard to ignore from what they did not. See `lib/symptomChecks.ts`.
 * 2. **Neither control types here.** The field and the chips push to `app/symptoms`, which
 *    is where a symptom is actually chosen, refined and sent. A second search index on the
 *    home screen would be a second place for the catalogue to be out of date.
 *
 * The empty state is the kit's list replaced by one link, because a "Recent Checks" heading
 * over nothing is a section that reads as broken rather than as new.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import SymptomIllustration, { SYMPTOM_ILLUSTRATION } from '@/components/symptoms/SymptomIllustration';
import { SYMPTOMS } from '@/lib/symptoms';
import {
    checkTitle, isPressing, severityLabel, type SymptomCheck,
} from '@/lib/symptomChecks';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

/** As many rows as the kit draws. The rest stay in the store as history. */
const MAX_ROWS = 2;

/**
 * The filter glyph inside the purple circle, lifted from the export rather than matched to
 * an icon-set name: the kit's is three centred bars, and every close relative in Ionicons
 * and MaterialIcons is left-aligned. `viewBox` is the export's own 24pt box around it.
 */
const FilterGlyph = () => (
    <Svg width={24} height={24} viewBox="311 213 24 24" fill="none">
        <Path
            d="M320.75 229.547H325.25C325.436 229.547 325.615 229.621 325.747 229.753C325.879 229.885 325.953 230.064 325.953 230.25C325.953 230.436 325.879 230.615 325.747 230.747C325.615 230.879 325.436 230.953 325.25 230.953H320.75C320.564 230.953 320.385 230.879 320.253 230.747C320.121 230.615 320.047 230.436 320.047 230.25C320.047 230.064 320.121 229.885 320.253 229.753C320.385 229.621 320.564 229.547 320.75 229.547ZM317.75 224.297H328.25C328.436 224.297 328.615 224.371 328.747 224.503C328.879 224.635 328.953 224.814 328.953 225C328.953 225.186 328.879 225.365 328.747 225.497C328.615 225.629 328.436 225.703 328.25 225.703H317.75C317.564 225.703 317.385 225.629 317.253 225.497C317.121 225.365 317.047 225.186 317.047 225C317.047 224.814 317.121 224.635 317.253 224.503C317.385 224.371 317.564 224.297 317.75 224.297ZM314.75 219.047H331.25C331.436 219.047 331.615 219.121 331.747 219.253C331.879 219.385 331.953 219.564 331.953 219.75C331.953 219.936 331.879 220.115 331.747 220.247C331.615 220.379 331.436 220.453 331.25 220.453H314.75C314.564 220.453 314.385 220.379 314.253 220.247C314.121 220.115 314.047 219.936 314.047 219.75C314.047 219.564 314.121 219.385 314.253 219.253C314.385 219.121 314.564 219.047 314.75 219.047Z"
            fill={Palette.white}
        />
    </Svg>
);

const SymptomCheckerCard = ({ checks, commonIds, onSearch, onBrowse, onSymptom, onOpenCheck }: {
    checks: SymptomCheck[];
    /** The "Most Common" rail, from the real catalogue — see `COMMON_SYMPTOM_IDS`. */
    commonIds: string[];
    onSearch: () => void;
    onBrowse: () => void;
    onSymptom: (id: string) => void;
    onOpenCheck: (check: SymptomCheck) => void;
}) => {
    const common = commonIds
        .map((id) => SYMPTOMS.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const recent = checks.slice(0, MAX_ROWS);

    return (
        <View style={styles.card}>
            <View style={styles.body}>
                <View style={styles.illustration}>
                    <SymptomIllustration width={SYMPTOM_ILLUSTRATION.width} />
                </View>

                <View style={styles.searchRow}>
                    <TouchableOpacity
                        style={styles.field}
                        onPress={onSearch}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Search for a symptom"
                    >
                        <Ionicons name="search" size={18} color={Palette.textSecondary} />
                        <Text style={styles.fieldPlaceholder}>Search for a symptom…</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={onBrowse}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Browse symptoms by body area"
                    >
                        <FilterGlyph />
                    </TouchableOpacity>
                </View>

                {/*
                  The rail scrolls because the kit's fifth chip runs off the card edge, which
                  is how it says there are more than fit. "Most Common" stays pinned outside
                  the scroller so it cannot slide away from the row it labels.
                */}
                <View style={styles.commonRow}>
                    <Text style={styles.commonLabel}>Most Common</Text>
                    <ScrollView
                        horizontal
                        style={styles.chipScroll}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                    >
                        {common.map((symptom) => (
                            <TouchableOpacity
                                key={symptom.id}
                                style={styles.chip}
                                onPress={() => onSymptom(symptom.id)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.chipText} numberOfLines={1}>{symptom.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.recent}>
                {recent.length === 0 ? (
                    <>
                        <Text style={styles.emptyText}>
                            You have not checked any symptoms yet.
                        </Text>
                        <TouchableOpacity
                            style={styles.browseLink}
                            onPress={onSearch}
                            activeOpacity={0.7}
                            accessibilityRole="link"
                        >
                            <Text style={styles.browseText}>Browse symptoms</Text>
                            <Ionicons name="chevron-forward" size={18} color={Palette.primary} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.recentTitle}>Recent Checks</Text>
                        {recent.map((check) => {
                            const pressing = isPressing(check);
                            return (
                                <TouchableOpacity
                                    key={check.id}
                                    style={styles.row}
                                    onPress={() => onOpenCheck(check)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.badge, pressing ? styles.badgePressing : styles.badgeCalm]}>
                                        <Text style={[styles.badgeText, pressing && styles.badgeTextPressing]}>
                                            {check.symptomIds.length}
                                        </Text>
                                    </View>
                                    <Text style={styles.rowTitle} numberOfLines={1}>{checkTitle(check)}</Text>
                                    <Text style={styles.rowMeta} numberOfLines={1}>{severityLabel(check)}</Text>
                                    <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Card — `rect x=16 y=50 w=343 h=384 rx=8`, over a 1pt #E5E7EB outline.
    card: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Palette.border,
        overflow: 'hidden',
    },
    // Everything above the rule. The rule itself is full-bleed, so the padding lives here
    // rather than on the card.
    body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

    illustration: { alignItems: 'center' },

    // Field bottom 245, illustration bottom 176.25.
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 29 },
    field: {
        flex: 1,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Palette.borderStrong,
        backgroundColor: Palette.white,
    },
    fieldPlaceholder: { flex: 1, fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.regular },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Palette.primary,
    },

    commonRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
    commonLabel: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, marginRight: 13 },
    chipScroll: { flex: 1 },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: Spacing.lg },
    chip: {
        height: 24,
        justifyContent: 'center',
        // A label long enough to fill the rail on its own ellipses rather than pushing the
        // other four out of reach. See the note on `COMMON_SYMPTOM_IDS`.
        maxWidth: 140,
        paddingHorizontal: 7,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Palette.borderStrong,
        backgroundColor: '#F9FAFB',
    },
    chipText: { fontSize: 13, color: Palette.text, fontFamily: Fonts.regular },

    divider: { height: 1, backgroundColor: Palette.border },

    recent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    recentTitle: { fontSize: 16, lineHeight: 20, color: Palette.text, fontFamily: Fonts.bold, marginBottom: 2 },

    // 48pt pitch, badge centre to badge centre, as the export's two filters give.
    row: { height: 48, flexDirection: 'row', alignItems: 'center' },
    badge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 13,
    },
    badgeCalm: { backgroundColor: '#F5F3FF', borderColor: Palette.primaryPale },
    badgePressing: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
    badgeText: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.bold },
    badgeTextPressing: { color: Palette.meterWeak },
    rowTitle: { flex: 1, fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    rowMeta: { fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.regular, marginRight: Spacing.sm },

    emptyText: { fontSize: 14, lineHeight: 20, color: Palette.textSecondary, fontFamily: Fonts.regular },
    browseLink: {
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    browseText: { fontSize: 15, color: Palette.primary, fontFamily: Fonts.semibold },
});

export default SymptomCheckerCard;
