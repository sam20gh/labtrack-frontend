/**
 * A genotyping result, as the person it belongs to reads it.
 *
 * Three rules shape this screen, and they are the reason it is not just a list:
 *
 *  1. **Not tested is never a negative.** The coverage section is not a footnote — it is a
 *     section, above the fold of the scroll's end, because a person reading silence as
 *     reassurance is the specific harm this product has to avoid.
 *  2. **Ordered by usefulness, not by drama.** Medicines and nutrition first. Risk last,
 *     and only if the person asked for it.
 *  3. **A finding that moves a reference range links to that biomarker.** The genotype
 *     explaining a number they already track is the thing LabTrack does that a genetics
 *     app does not.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';
import {
    getGenotypeFile, setRiskConsent, groupByCategory, TONE_META,
    type GenotypeFile, type Finding,
} from '@/lib/genotype';

const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** One result. Withheld and uninterpreted findings render deliberately differently. */
function FindingCard({ finding, onBiomarker }: { finding: Finding; onBiomarker: (n: string) => void }) {
    if (finding.withheld) {
        return (
            <View style={[styles.card, styles.cardMuted]}>
                <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{finding.name}</Text>
                    <View style={[styles.chip, { backgroundColor: Palette.borderLight }]}>
                        <Ionicons name="time-outline" size={11} color={Palette.textSecondary} />
                        <Text style={[styles.chipText, { color: Palette.textSecondary }]}>In review</Text>
                    </View>
                </View>
                <Text style={styles.cardDetail}>
                    A clinician is reviewing this result. It will appear here once that is done.
                </Text>
            </View>
        );
    }

    if (finding.status !== 'called') {
        return (
            <View style={[styles.card, styles.cardMuted]}>
                <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{finding.name}</Text>
                    <View style={[styles.chip, { backgroundColor: Palette.borderLight }]}>
                        <Text style={[styles.chipText, { color: Palette.textSecondary }]}>
                            {finding.status === 'not_covered' ? 'Not tested' : 'No result'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.cardDetail}>{finding.detail}</Text>
            </View>
        );
    }

    const tone = TONE_META[finding.tone ?? 'typical'];

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{finding.name}</Text>
                <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.chipText, { color: tone.color }]}>{finding.label}</Text>
                </View>
            </View>

            <Text style={styles.genotype}>
                {finding.gene}
                {finding.alleleName ? ` · ${finding.alleleName}` : ''}
                {finding.genotype ? ` · ${finding.genotype}` : ''}
            </Text>

            <Text style={styles.cardDetail}>{finding.detail}</Text>

            {!!finding.incomplete && (
                <View style={styles.note}>
                    <Ionicons name="alert-circle-outline" size={13} color={Palette.warning} />
                    <Text style={styles.noteText}>{finding.incomplete}</Text>
                </View>
            )}

            {!!finding.affectsBiomarker && (
                <TouchableOpacity
                    style={styles.link}
                    onPress={() => onBiomarker(finding.affectsBiomarker!)}
                    accessibilityRole="button"
                >
                    <Text style={styles.linkText}>See how this affects your results</Text>
                    <Ionicons name="arrow-forward" size={13} color={Palette.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

export default function DnaReportScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [file, setFile] = useState<GenotypeFile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [consenting, setConsenting] = useState(false);

    const load = useCallback(async () => {
        try {
            setFile(await getGenotypeFile(String(id)));
        } catch {
            setFile(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /**
     * Opting in is a real consent moment, not a toggle. The warning is shown before the
     * result is fetched, and the destructive-styled button is the one that reveals.
     */
    const onToggleRisk = () => {
        if (!file) return;

        if (file.consent?.riskResultsOptIn) {
            setConsenting(true);
            setRiskConsent(file._id, false).then(load).finally(() => setConsenting(false));
            return;
        }

        Alert.alert(
            'Show health risk results?',
            'These results describe conditions that may develop later in life. They cannot be '
            + 'changed, some have no treatment, and people often find them distressing.\n\n'
            + 'You can hide them again at any time, but you cannot unsee them. Consider '
            + 'talking to a genetic counsellor first.',
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'Show results',
                    style: 'destructive',
                    onPress: () => {
                        setConsenting(true);
                        setRiskConsent(file._id, true).then(load).finally(() => setConsenting(false));
                    },
                },
            ],
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (!file) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>We couldn&apos;t load these results.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const groups = groupByCategory(file.findings);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your DNA results</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <View style={styles.meta}>
                    <Text style={styles.metaLab}>{file.labName}</Text>
                    <Text style={styles.metaLine}>
                        {file.assayType === 'array' ? 'Genotyping array' : file.assayType}
                        {file.chip ? ` · ${file.chip}` : ''}
                        {file.reportedAt ? ` · ${fmtDate(file.reportedAt)}` : ''}
                    </Text>
                    {!file.clinicianReleased && file.summary.withheld > 0 && (
                        <View style={styles.reviewBanner}>
                            <Ionicons name="time-outline" size={14} color={Palette.info} />
                            <Text style={styles.reviewText}>
                                {file.summary.withheld} result{file.summary.withheld === 1 ? '' : 's'} awaiting
                                clinician review
                            </Text>
                        </View>
                    )}
                </View>

                {groups.map((group) => (
                    <View key={group.category} style={styles.section}>
                        <View style={styles.sectionHead}>
                            <Ionicons name={group.icon as any} size={16} color={Palette.primary} />
                            <Text style={styles.sectionTitle}>{group.title}</Text>
                        </View>
                        <Text style={styles.sectionBlurb}>{group.blurb}</Text>
                        {group.findings.map((f) => (
                            <FindingCard
                                key={f.rsid}
                                finding={f}
                                onBiomarker={(name) => router.push(`/biomarker/${name}`)}
                            />
                        ))}
                    </View>
                ))}

                {/* Offered without revealing what sits behind it. */}
                {file.riskResultsAvailable && (
                    <View style={styles.section}>
                        <View style={styles.consentCard}>
                            <Ionicons
                                name={file.consent?.riskResultsOptIn ? 'eye-outline' : 'lock-closed-outline'}
                                size={18}
                                color={Palette.primary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.consentTitle}>
                                    {file.consent?.riskResultsOptIn ? 'Health risk results are shown' : 'Health risk results are hidden'}
                                </Text>
                                <Text style={styles.consentBody}>
                                    {file.consent?.riskResultsOptIn
                                        ? 'You can hide these again at any time.'
                                        : 'This test found results about conditions that may develop later in life. We keep these hidden until you ask for them.'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.consentButton}
                            onPress={onToggleRisk}
                            disabled={consenting}
                            accessibilityRole="button"
                        >
                            <Text style={styles.consentButtonText}>
                                {consenting
                                    ? 'Updating…'
                                    : file.consent?.riskResultsOptIn ? 'Hide these results' : 'Show me these results'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* The section that stops silence being read as reassurance. */}
                <View style={styles.section}>
                    <View style={styles.sectionHead}>
                        <Ionicons name="information-circle-outline" size={16} color={Palette.textSecondary} />
                        <Text style={styles.sectionTitle}>What this test did not cover</Text>
                    </View>
                    <Text style={styles.sectionBlurb}>
                        No genetic test looks at everything. These were not examined, so this report
                        cannot rule them out.
                    </Text>
                    {file.notTested.map((gap) => (
                        <View key={gap.key} style={[styles.card, styles.cardGap]}>
                            <Text style={styles.cardTitle}>{gap.title}</Text>
                            <Text style={styles.cardDetail}>{gap.detail}</Text>
                            {!!gap.upgrade && (
                                <TouchableOpacity
                                    style={styles.link}
                                    onPress={() => router.push('/(tabs)/orders')}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.linkText}>See tests that cover this</Text>
                                    <Ionicons name="arrow-forward" size={13} color={Palette.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>

                <Text style={styles.footer}>
                    {file.qc?.totalCalls?.toLocaleString()} positions read ·{' '}
                    {file.qc ? `${(file.qc.callRate * 100).toFixed(1)}% success rate` : ''} · panel {file.panelVersion}
                    {'\n'}These results are not a diagnosis. Discuss anything that concerns you with a doctor.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    empty: { padding: Spacing.xxxl, alignItems: 'center' },
    emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.textSecondary },

    meta: { marginBottom: Spacing.xl },
    metaLab: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    metaLine: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, marginTop: 2 },
    reviewBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.infoSurface, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.md,
    },
    reviewText: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.info, flex: 1 },

    section: { marginBottom: Spacing.xxl },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    sectionBlurb: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary,
        marginTop: 2, marginBottom: Spacing.md,
    },

    card: {
        backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.border,
        borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card,
    },
    cardMuted: { backgroundColor: Palette.surface, ...Shadow.card, shadowOpacity: 0 },
    cardGap: { backgroundColor: Palette.surface, borderStyle: 'dashed', shadowOpacity: 0 },
    cardHead: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: Spacing.sm,
    },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text, flex: 1 },
    genotype: {
        fontFamily: Fonts.medium, fontSize: 11, color: Palette.textMuted,
        letterSpacing: 0.5, marginTop: 4,
    },
    cardDetail: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        lineHeight: 19, marginTop: Spacing.sm,
    },

    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill,
    },
    chipText: { fontFamily: Fonts.semibold, fontSize: 11 },

    note: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
        backgroundColor: Palette.warningSurface, borderRadius: Radius.md,
        padding: Spacing.md, marginTop: Spacing.md,
    },
    noteText: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.warning, flex: 1, lineHeight: 17 },

    link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md },
    linkText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.primary },

    consentCard: {
        flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
        backgroundColor: Palette.primarySurface, borderRadius: Radius.lg, padding: Spacing.lg,
    },
    consentTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    consentBody: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary,
        lineHeight: 18, marginTop: 4,
    },
    consentButton: {
        borderWidth: 1, borderColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
    },
    consentButtonText: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.primary },

    footer: {
        fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted,
        lineHeight: 17, textAlign: 'center', marginTop: Spacing.lg,
    },
});
