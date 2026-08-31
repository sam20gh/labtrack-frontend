/**
 * Frequently asked questions — `Design/profile.svg`, frame 20.
 *
 * The kit draws a flat accordion of five questions with a "Still need help?" link. Two
 * additions, both because the real catalogue is four times that size:
 *
 * - **A search field.** Fifteen collapsed rows is a list you scroll past rather than read.
 *   Filtering runs over the question *and* the answer, so "pounds" finds the units entry
 *   whose question never uses the word.
 * - **An answer can carry a destination.** Half of these questions are answered by a
 *   screen — "where do I change units", "why is my score empty". Telling someone the
 *   answer and then making them find the screen themselves is the part of a help centre
 *   people give up on.
 *
 * Content lives in `lib/help.ts`, not on the server, and the header there explains where
 * that line sits relative to `utils/biomarkerGlossary.js`.
 */
import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, TextInput,
    LayoutAnimation, Platform, UIManager, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { SUPPORT_EMAIL, searchFaq, type FaqEntry } from '@/lib/help';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

// The accordion's height change is animated by the platform rather than by Reanimated:
// one LayoutAnimation call is cheaper than a shared value per row, and Android needs the
// experimental flag set before the first call or nothing animates at all.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FaqScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<string | null>(null);

    const sections = useMemo(() => searchFaq(query), [query]);
    const empty = sections.length === 0;

    const toggle = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((current) => (current === id ? null : id));
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <ScreenHeader
                    title="Frequently asked questions"
                    subtitle="See the frequently asked questions here."
                />

                <View style={styles.body}>
                    <View style={styles.search}>
                        <Ionicons name="search" size={18} color={Palette.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search help…"
                            placeholderTextColor={Palette.textMuted}
                            autoCorrect={false}
                            returnKeyType="search"
                        />
                        {!!query && (
                            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                                <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                            </Pressable>
                        )}
                    </View>

                    {empty ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={28} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>Nothing matched “{query.trim()}”</Text>
                            <Text style={styles.emptyBlurb}>
                                Email us and we will answer — and add it here if others are asking too.
                            </Text>
                        </View>
                    ) : (
                        sections.map((section) => (
                            <View key={section.id} style={styles.section}>
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                                <View style={styles.group}>
                                    {section.entries.map((entry, index) => (
                                        <Row
                                            key={entry.id}
                                            entry={entry}
                                            open={open === entry.id}
                                            last={index === section.entries.length - 1}
                                            onToggle={() => toggle(entry.id)}
                                            onNavigate={() => entry.route && router.push(entry.route as never)}
                                        />
                                    ))}
                                </View>
                            </View>
                        ))
                    )}

                    <Pressable
                        style={({ pressed }) => [styles.stillNeedHelp, pressed && styles.stillNeedHelpPressed]}
                        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => { })}
                        accessibilityRole="button"
                    >
                        <Text style={styles.stillNeedHelpText}>Still need help?</Text>
                        <Ionicons name="mail-outline" size={16} color={Palette.primary} />
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const Row = ({
    entry, open, last, onToggle, onNavigate,
}: {
    entry: FaqEntry;
    open: boolean;
    last: boolean;
    onToggle: () => void;
    onNavigate: () => void;
}) => (
    <View style={[styles.row, last && styles.rowLast]}>
        <Pressable
            style={styles.rowHead}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
        >
            <Ionicons
                name="help-circle-outline"
                size={18}
                color={open ? Palette.primary : Palette.textSecondary}
            />
            <Text style={[styles.question, open && styles.questionOpen]}>{entry.question}</Text>
            <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Palette.textMuted}
            />
        </Pressable>

        {open && (
            <View style={styles.answerWrap}>
                <Text style={styles.answer}>{entry.answer}</Text>
                {!!entry.route && (
                    <Pressable style={styles.answerLink} onPress={onNavigate} accessibilityRole="link">
                        <Text style={styles.answerLinkText}>{entry.routeLabel ?? 'Open'}</Text>
                        <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
                    </Pressable>
                )}
            </View>
        )}
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.lg },

    search: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.surface, borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.border,
        paddingHorizontal: Spacing.lg, height: 46,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.text },

    section: { gap: Spacing.sm },
    sectionTitle: {
        fontSize: 12, fontFamily: Fonts.semibold, color: Palette.textMuted,
        letterSpacing: 0.6, textTransform: 'uppercase',
    },
    group: {
        backgroundColor: Palette.surface, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border, overflow: 'hidden',
    },

    row: { borderBottomWidth: 1, borderBottomColor: Palette.border },
    rowLast: { borderBottomWidth: 0 },
    rowHead: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    },
    question: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text, lineHeight: 20 },
    questionOpen: { color: Palette.primaryDark },

    answerWrap: {
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
        // Aligns the answer with the question rather than the icon: 18pt glyph + 12pt gap.
        paddingLeft: Spacing.lg + 18 + Spacing.md,
        gap: Spacing.md,
    },
    answer: { fontSize: 13, lineHeight: 20, fontFamily: Fonts.regular, color: Palette.textSecondary },
    answerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    answerLinkText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },

    emptyState: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl },
    emptyTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    emptyBlurb: {
        fontSize: 13, lineHeight: 19, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingHorizontal: Spacing.xl,
    },

    stillNeedHelp: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, marginTop: Spacing.sm,
    },
    stillNeedHelpPressed: { opacity: 0.6 },
    stillNeedHelpText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
});
