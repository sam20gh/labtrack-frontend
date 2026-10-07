/**
 * What changed — opened when a kit comes back and the analysis has been rewritten with it.
 *
 * Built for the DNA moment. Somebody has waited about two weeks and has had a first analysis
 * the whole time; "your analysis was updated" tells them nothing they can act on. So this says
 * what the new one read, leads with its plain-language headline, and then lists the plan's own
 * nouns — screenings, consultations, advice — that were added or are no longer needed.
 * Everything else stayed as it was, and the screen says how much.
 *
 * Reached from the "Your full analysis is ready" notification (`orderController.reinterpret`)
 * and from the home journey card's ready state. An analysis held for clinical review is
 * reported as held — the server will not diff what the person is not yet allowed to read.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { ApiError } from '@/lib/api';
import { getAnalysisUpdate, type AnalysisUpdate } from '@/lib/onboarding';

const SECTIONS = [
    { key: 'screenings', title: 'Screenings', icon: 'medical-outline' },
    { key: 'consultations', title: 'Consultations', icon: 'people-outline' },
    { key: 'lifestyle', title: 'Advice', icon: 'leaf-outline' },
] as const;

const readsLine = (reads: AnalysisUpdate['reads']) => {
    const parts: string[] = [];
    if (reads.dna) parts.push(reads.dna === 1 ? 'your DNA report' : `${reads.dna} genetic reports`);
    if (reads.results) parts.push(reads.results === 1 ? '1 blood result' : `${reads.results} blood results`);
    return parts.length ? `This analysis read ${parts.join(' and ')}, alongside everything you have recorded.` : null;
};

export default function AnalysisUpdateScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [data, setData] = useState<AnalysisUpdate | null>(null);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(useCallback(() => {
        let mounted = true;
        getAnalysisUpdate()
            .then((d) => { if (mounted) { setData(d); setError(null); } })
            .catch((e) => {
                if (!mounted) return;
                if (e instanceof ApiError && e.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
                setError(e instanceof ApiError && e.status === 404 ? 'There is no analysis yet.' : 'We could not load the update.');
            });
        return () => { mounted = false; };
    }, [router]));

    const header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.headerBtn} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>What changed</Text>
            <View style={styles.headerBtn} />
        </View>
    );

    if (!data) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <View style={styles.centre}>
                    {error ? <Text style={styles.muted}>{error}</Text> : <ActivityIndicator color={Palette.primary} />}
                </View>
            </SafeAreaView>
        );
    }

    const reads = readsLine(data.reads);

    if (data.withheld) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                {header}
                <View style={styles.content}>
                    <View style={styles.held}>
                        <Ionicons name="shield-checkmark-outline" size={22} color={Palette.textSecondary} />
                        <Text style={styles.heldText}>{data.message}</Text>
                    </View>
                    {reads ? <Text style={styles.reads}>{reads}</Text> : null}
                </View>
            </SafeAreaView>
        );
    }

    const nothingChanged = !data.first && !data.added && !data.removed;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {header}
            <ScrollView contentContainerStyle={styles.content}>
                {data.headline ? <Text style={styles.headline}>{data.headline}</Text> : null}
                {reads ? <Text style={styles.reads}>{reads}</Text> : null}
                {data.whatItMeans ? <Text style={styles.prose}>{data.whatItMeans}</Text> : null}

                <View style={styles.summary}>
                    <Text style={styles.summaryText}>
                        {data.first
                            ? 'This is your first analysis, so everything in your plan is new.'
                            : nothingChanged
                                ? 'Your plan stays as it was. The new results confirmed it rather than changing it.'
                                : `${data.added} added to your plan · ${data.removed} no longer needed`}
                    </Text>
                </View>

                {SECTIONS.map((section) => {
                    const change = data.changes?.[section.key];
                    if (!change || (!change.added.length && !change.removed.length)) return null;
                    return (
                        <View key={section.key} style={styles.section}>
                            <View style={styles.sectionHead}>
                                <Ionicons name={section.icon as any} size={16} color={Palette.textSecondary} />
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                                {change.kept ? <Text style={styles.kept}>{change.kept} unchanged</Text> : null}
                            </View>
                            {change.added.map((x) => (
                                <View key={`a:${x.title}`} style={styles.item}>
                                    <View style={[styles.tag, styles.tagNew]}><Text style={[styles.tagText, styles.tagNewText]}>New</Text></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{x.title}</Text>
                                        {x.detail ? <Text style={styles.itemDetail}>{x.detail}</Text> : null}
                                    </View>
                                </View>
                            ))}
                            {change.removed.map((x) => (
                                <View key={`r:${x.title}`} style={styles.item}>
                                    <View style={styles.tag}><Text style={styles.tagText}>Removed</Text></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemTitle, styles.itemRemoved]}>{x.title}</Text>
                                        {x.detail ? <Text style={styles.itemDetail}>{x.detail}</Text> : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    );
                })}

                {data.nextStep ? (
                    <View style={styles.next}>
                        <Text style={styles.nextLabel}>Your next step</Text>
                        <Text style={styles.prose}>{data.nextStep}</Text>
                    </View>
                ) : null}

                <TouchableOpacity style={styles.primary} onPress={() => router.push('/myplans')} accessibilityRole="button">
                    <Text style={styles.primaryText}>Open my plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => router.replace('/(tabs)')} accessibilityRole="button">
                    <Text style={styles.secondaryText}>Back to home</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
    muted: { fontSize: 15, ...BodyFont.regular, color: Palette.textSecondary, textAlign: 'center' },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },

    headline: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 30, marginTop: Spacing.sm },
    reads: { fontSize: 13, ...BodyFont.regular, color: Palette.textMuted, marginTop: Spacing.sm, lineHeight: 19 },
    prose: { fontSize: 15, ...BodyFont.regular, color: Palette.text, lineHeight: 23, marginTop: Spacing.md },

    summary: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.xl },
    summaryText: { fontSize: 14, ...BodyFont.medium, color: Palette.text, lineHeight: 20 },

    section: {
        backgroundColor: Palette.background, borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg, marginTop: Spacing.md,
    },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    sectionTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, flex: 1 },
    kept: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted },
    item: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', paddingVertical: Spacing.sm },
    tag: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: Palette.borderLight, marginTop: 1 },
    tagNew: { backgroundColor: Palette.successSurface },
    tagText: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.textSecondary },
    tagNewText: { color: Palette.successDeep },
    itemTitle: { fontSize: 14, ...BodyFont.medium, color: Palette.text, lineHeight: 20 },
    itemRemoved: { color: Palette.textSecondary },
    itemDetail: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 18, marginTop: 1 },

    held: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: Palette.surface,
        borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.lg,
    },
    heldText: { flex: 1, fontSize: 15, ...BodyFont.regular, color: Palette.text, lineHeight: 22 },

    next: { marginTop: Spacing.xl },
    nextLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary, letterSpacing: 0.5 },

    primary: { marginTop: Spacing.xxl, backgroundColor: Palette.primaryFill, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
    primaryText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    secondary: { alignItems: 'center', paddingVertical: Spacing.lg },
    secondaryText: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },
}));
