/**
 * What the scan found — the confirmation checkpoint.
 *
 * Nothing has been saved at this point and nothing will be until the person taps Add. That
 * is the same checkpoint report ingestion puts between a misread digit and the record, and
 * nutrition puts between an estimate and a meal log, and it matters more here than in either:
 * a wrong drug name on a medication list is a wrong drug name in the interaction check.
 *
 * Two things this screen does that the design's Scan Result frame does not:
 *
 *   - **A low-confidence result leads with the alternatives, not with one answer.** The
 *     design shows "80% Match / Atorvastatin" as a single verdict. Thousands of generic
 *     tablets are round and white, and presenting one confident answer for an ambiguous
 *     photograph is precisely how the wrong drug gets onto a list.
 *   - **It runs an interaction preview before the medication is added.** "Would this clash
 *     with what I already take" is the question that actually matters at this moment, and
 *     answering it after the thing is on the list is answering it too late. The preview is
 *     rules-only, so it is instant and free.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { previewInteractions, SEVERITY_META } from '@/lib/medications';
import { FindingCard } from '@/components/medications/FindingCard';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { MedicationIdentifyResult, InteractionPreview } from '@/types/api';

export default function ScanResultScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ payload?: string; imageUri?: string }>();

    const [result, setResult] = useState<MedicationIdentifyResult | null>(null);
    const [preview, setPreview] = useState<InteractionPreview | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (!params.payload) return;
        try {
            const parsed: MedicationIdentifyResult = JSON.parse(params.payload);
            setResult(parsed);

            const name = parsed.draft?.name;
            if (!name) { setChecking(false); return; }

            // Rules only — instant, free, and writes nothing.
            previewInteractions(name)
                .then(setPreview)
                .catch(() => setPreview(null))
                .finally(() => setChecking(false));
        } catch {
            setChecking(false);
        }
    }, [params.payload]);

    if (!result?.draft) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={34} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Nothing to show</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/medications/scan')}>
                        <Text style={styles.primaryButtonText}>Scan again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { draft, confidence, needsConfirmation, alternatives = [], warnings = [], basis } = result;
    const pct = confidence != null ? Math.round(confidence * 100) : null;

    /**
     * Carry the draft into the add form rather than saving here. The form is where a
     * schedule gets set, and a medication with no schedule produces no doses and no
     * reminders — which would make a "saved" medication look broken.
     */
    const accept = (name: string) => {
        router.replace({
            pathname: '/medications/add',
            params: {
                prefill: JSON.stringify({ ...draft, name }),
                imageUri: params.imageUri || '',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan result</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {params.imageUri ? (
                    <Image source={{ uri: params.imageUri }} style={styles.photo} />
                ) : null}

                {/* The identification. Confidence is stated, never buried. */}
                <View style={styles.card}>
                    <View style={styles.matchRow}>
                        <View style={[
                            styles.matchChip,
                            needsConfirmation ? styles.matchChipLow : styles.matchChipHigh,
                        ]}>
                            <Ionicons
                                name={needsConfirmation ? 'help-circle' : 'checkmark-circle'}
                                size={14}
                                color={needsConfirmation ? Palette.warning : Palette.success}
                            />
                            <Text style={[
                                styles.matchText,
                                { color: needsConfirmation ? Palette.warning : Palette.success },
                            ]}>
                                {pct != null ? `${pct}% confident` : 'Identified'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.name}>{draft.name}</Text>
                    {draft.brandName ? <Text style={styles.brand}>Also sold as {draft.brandName}</Text> : null}
                    {result.catalogue?.plainName ? (
                        <Text style={styles.plain}>{result.catalogue.plainName}</Text>
                    ) : null}

                    <View style={styles.factRow}>
                        {draft.strength ? <Fact label="Strength" value={draft.strength} /> : null}
                        <Fact label="Form" value={draft.form} />
                        {draft.imprint ? <Fact label="Imprint" value={draft.imprint} /> : null}
                    </View>

                    {basis ? <Text style={styles.basis}>Based on {basis.toLowerCase()}</Text> : null}
                </View>

                {/*
                  Low confidence. The alternatives are offered as equals — the point is that
                  we do not know which of these it is, and the person holding the box does.
                */}
                {needsConfirmation ? (
                    <View style={styles.uncertainCard}>
                        <View style={styles.uncertainHead}>
                            <Ionicons name="alert-circle" size={17} color={Palette.warning} />
                            <Text style={styles.uncertainTitle}>Check this before you add it</Text>
                        </View>
                        <Text style={styles.uncertainBody}>
                            This rests on how the medicine looks rather than on a name we could
                            read. Many different tablets look alike. Compare it against your own
                            box before adding it.
                        </Text>
                        {alternatives.length ? (
                            <View style={styles.altList}>
                                <Text style={styles.altHead}>It could also be:</Text>
                                {alternatives.map((alt) => (
                                    <TouchableOpacity
                                        key={alt.name}
                                        style={styles.altRow}
                                        onPress={() => accept(alt.name)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.altName}>{alt.name}</Text>
                                            <Text style={styles.altWhy}>{alt.why}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={15} color={Palette.textMuted} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {warnings.length ? (
                    <View style={styles.warnCard}>
                        {warnings.map((w, i) => (
                            <View key={i} style={styles.warnRow}>
                                <Ionicons name="information-circle-outline" size={14} color={Palette.textSecondary} />
                                <Text style={styles.warnText}>{w}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* What adding this would introduce, before it is added. */}
                <View style={styles.previewSection}>
                    <Text style={styles.sectionTitle}>Against what you already take</Text>

                    {checking ? (
                        <View style={styles.checkingRow}>
                            <ActivityIndicator size="small" color={Palette.primary} />
                            <Text style={styles.checkingText}>Checking…</Text>
                        </View>
                    ) : preview?.introduced.length ? (
                        <View style={styles.findingList}>
                            <Text style={styles.introducedNote}>
                                Adding this would introduce {preview.introduced.length}{' '}
                                {preview.introduced.length === 1 ? 'finding' : 'findings'}:
                            </Text>
                            {preview.introduced.map((f, i) => <FindingCard key={i} finding={f} />)}
                        </View>
                    ) : preview?.uncheckable ? (
                        // Nothing found because nothing was checked. Never shown as reassurance.
                        <View style={styles.neutralCard}>
                            <Ionicons name="help-circle-outline" size={17} color={Palette.textSecondary} />
                            <Text style={styles.neutralText}>
                                We do not hold {preview.name} in our catalogue, so it was not
                                checked against anything you take. Ask your pharmacist about it
                                specifically.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.neutralCard}>
                            <Ionicons name="shield-outline" size={17} color={Palette.textSecondary} />
                            <Text style={styles.neutralText}>
                                Nothing came up against the medicines we could check. That is not
                                an all-clear — your pharmacist sees things we cannot.
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => accept(draft.name)}
                    activeOpacity={0.85}
                >
                    <Text style={styles.primaryButtonText}>
                        {needsConfirmation ? `Yes, it's ${draft.name}` : 'Add this medication'}
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color={Palette.white} />
                </TouchableOpacity>

                <View style={styles.escapeRow}>
                    <TouchableOpacity onPress={() => router.replace('/medications/scan')} hitSlop={8}>
                        <Text style={styles.escape}>Scan again</Text>
                    </TouchableOpacity>
                    <Text style={styles.escapeDivider}>·</Text>
                    <TouchableOpacity onPress={() => router.replace('/medications/add')} hitSlop={8}>
                        <Text style={styles.escape}>Enter by hand</Text>
                    </TouchableOpacity>
                </View>

                {preview?.safetyNote ? <Text style={styles.footer}>{preview.safetyNote}</Text> : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.fact}>
        <Text style={styles.factValue}>{value}</Text>
        <Text style={styles.factLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxxl },
    emptyTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },

    photo: { width: '100%', height: 180, borderRadius: Radius.lg, backgroundColor: Palette.borderLight },

    card: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.xl, gap: Spacing.xs,
    },
    matchRow: { flexDirection: 'row' },
    matchChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill,
    },
    matchChipHigh: { backgroundColor: Palette.successSurface },
    matchChipLow: { backgroundColor: Palette.warningSurface },
    matchText: { fontSize: 11, fontFamily: Fonts.semibold },

    name: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold, textTransform: 'capitalize', marginTop: Spacing.sm },
    brand: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    plain: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.medium, marginTop: 2 },

    factRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.md },
    fact: { gap: 2 },
    factValue: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    factLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },
    basis: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, marginTop: Spacing.md, lineHeight: 16 },

    uncertainCard: {
        backgroundColor: Palette.warningSurface, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: '#FDE68A', padding: Spacing.lg, gap: Spacing.sm,
    },
    uncertainHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    uncertainTitle: { fontSize: 14, color: Palette.warning, fontFamily: Fonts.bold },
    uncertainBody: { fontSize: 13, color: Palette.text, fontFamily: Fonts.regular, lineHeight: 19 },
    altList: { gap: 6, marginTop: Spacing.sm },
    altHead: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.semibold },
    altRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.white, borderRadius: Radius.md, padding: Spacing.md,
    },
    altName: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
    altWhy: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: 1 },

    warnCard: {
        backgroundColor: Palette.surface, borderRadius: Radius.md,
        padding: Spacing.md, gap: Spacing.sm,
    },
    warnRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    warnText: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },

    previewSection: { gap: Spacing.sm },
    sectionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },
    checkingRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', padding: Spacing.md },
    checkingText: { fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular },
    findingList: { gap: Spacing.sm },
    introducedNote: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },
    neutralCard: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg,
    },
    neutralText: { flex: 1, fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 19 },

    primaryButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary, borderRadius: Radius.md, paddingVertical: 15,
    },
    primaryButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    escapeRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
    escape: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.medium },
    escapeDivider: { fontSize: 13, color: Palette.textMuted },
    footer: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 17 },
});
