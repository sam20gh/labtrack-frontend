/**
 * One medication — what it is, and how you have been taking it.
 *
 * The design's two tabs: Overview (what the drug is, side effects, storage, interactions)
 * and Insight (adherence, active schedule). Kept as tabs because they answer different
 * questions — "what is this" is read once, "how am I doing" is read repeatedly.
 *
 * The Overview copy comes from the server's catalogue, never from a model and never from the
 * app bundle. It is clinical copy: a misleading line has to be fixable the same day rather
 * than on the next app-store release. Where the catalogue has no entry, the screen degrades
 * to the person's own details rather than inventing a description — a drug we cannot
 * describe is common and is not an error.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    listMedications, getCatalogueEntry, getInsight, deleteMedication, updateMedication,
    scheduleSummary, FORM_LABEL, WITH_FOOD_LABEL,
} from '@/lib/medications';
import { PillGlyph } from '@/components/medications/PillGlyph';
import { ensureRemindersReady } from '@/lib/notifications';
import { warnRemindersUnavailable } from '@/lib/medicationReminders';
import { FindingCard } from '@/components/medications/FindingCard';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { TrackedMedication, MedicationCatalogueEntry, InteractionFinding, MedicationInsight } from '@/types/api';

type Tab = 'overview' | 'insight';

export default function MedicationDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [tab, setTab] = useState<Tab>('overview');
    const [medication, setMedication] = useState<TrackedMedication | null>(null);
    const [entry, setEntry] = useState<(MedicationCatalogueEntry & {
        foodInteractions: InteractionFinding[]; safetyNote: string;
    }) | null>(null);
    const [insight, setInsight] = useState<MedicationInsight | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const { medications } = await listMedications(true);
            const found = medications.find((m) => m._id === id) || null;
            setMedication(found);

            if (found) {
                // The catalogue may not hold it. That is normal, not an error.
                getCatalogueEntry(found.name).then(setEntry).catch(() => setEntry(null));
                getInsight(30).then(setInsight).catch(() => setInsight(null));
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const remove = () => {
        if (!medication) return;
        Alert.alert(
            'Remove this medication?',
            `"${medication.name}" will leave your list and stop reminding you. What you have already taken is kept.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMedication(medication._id);
                            router.replace('/medications');
                        } catch (error) {
                            Alert.alert('Could not remove', error instanceof Error ? error.message : 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const toggleReminders = async () => {
        if (!medication) return;
        const turningOn = !medication.remindersEnabled;
        try {
            await updateMedication(medication._id, { remindersEnabled: turningOn });
            await load();

            // Switching this on is a promise that a notification will arrive. It only can
            // if the account has a device registered — see `ensureRemindersReady`.
            if (turningOn) {
                const state = await ensureRemindersReady();
                if (!state.ready) warnRemindersUnavailable(state, () => Linking.openSettings());
            }
        } catch (error) {
            Alert.alert('Could not update', error instanceof Error ? error.message : 'Please try again.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator style={{ marginTop: 80 }} color={Palette.primary} />
            </SafeAreaView>
        );
    }

    if (!medication) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={32} color={Palette.textMuted} />
                    <Text style={styles.emptyTitle}>Medication not found</Text>
                    <TouchableOpacity onPress={() => router.replace('/medications')}>
                        <Text style={styles.link}>Back to your medications</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const mine = insight?.perMedication.find((p) => p.medicationId === medication._id);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{medication.name}</Text>
                <TouchableOpacity onPress={remove} hitSlop={8}>
                    <Ionicons name="trash-outline" size={19} color={Palette.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.hero}>
                <PillGlyph shape={medication.shape} colour={medication.colour} size={64} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.heroName}>{medication.name}</Text>
                    {entry?.plainName ? <Text style={styles.heroPlain}>{entry.plainName}</Text> : null}
                    <View style={styles.heroChips}>
                        {medication.strength ? <Pill text={medication.strength} /> : null}
                        <Pill text={FORM_LABEL[medication.form]} />
                        {entry?.prescriptionOnly ? <Pill text="Rx required" /> : null}
                    </View>
                </View>
            </View>

            <View style={styles.tabs}>
                <TabButton label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
                <TabButton label="Insight" active={tab === 'insight'} onPress={() => setTab('insight')} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {tab === 'overview' ? (
                    <>
                        {entry?.whatItIs ? (
                            <Card title="What it is">
                                <Text style={styles.body}>{entry.whatItIs}</Text>
                                {entry.whyItMatters ? (
                                    <Text style={[styles.body, { marginTop: Spacing.sm }]}>{entry.whyItMatters}</Text>
                                ) : null}
                            </Card>
                        ) : (
                            /*
                              No catalogue entry. Said plainly rather than left blank: the
                              same gap appears in the interaction check, and someone who sees
                              it here understands why it is there too.
                            */
                            <Card title="What it is">
                                <Text style={styles.muted}>
                                    We do not hold plain-language notes for {medication.name}. Your
                                    pharmacist or the leaflet in the box is the right source, and
                                    your interaction check will say it could not be verified.
                                </Text>
                            </Card>
                        )}

                        <Card title="How you take it">
                            <Row icon="repeat-outline" label={scheduleSummary(medication)} />
                            {medication.dose ? <Row icon="medical-outline" label={`${medication.dose} each time`} /> : null}
                            {medication.withFood && medication.withFood !== 'any' ? (
                                <Row icon="restaurant-outline" label={WITH_FOOD_LABEL[medication.withFood]} />
                            ) : null}
                            <Row icon="calendar-outline" label={`Started ${medication.startDay}`} />
                            {medication.endDay ? <Row icon="flag-outline" label={`Until ${medication.endDay}`} /> : null}
                            {typeof medication.remainingDoses === 'number' ? (
                                <Row
                                    icon="cube-outline"
                                    label={`${medication.remainingDoses} left in the packet`}
                                    warn={medication.needsRefill}
                                />
                            ) : null}
                        </Card>

                        {entry?.sideEffects ? (
                            <Card title="Side effects">
                                <Text style={styles.subLabel}>Common, and usually settle</Text>
                                <View style={styles.tagRow}>
                                    {entry.sideEffects.minor.map((s) => (
                                        <View key={s} style={styles.tag}>
                                            <Text style={styles.tagText}>{s}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Text style={[styles.subLabel, { marginTop: Spacing.lg }]}>
                                    Get medical advice if you notice these
                                </Text>
                                <View style={styles.tagRow}>
                                    {entry.sideEffects.serious.map((s) => (
                                        <View key={s} style={[styles.tag, styles.tagSerious]}>
                                            <Ionicons name="alert-circle" size={12} color={Palette.danger} />
                                            <Text style={[styles.tagText, { color: Palette.danger }]}>{s}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Card>
                        ) : null}

                        {/* Food and drink, from the rule table — the design's interactions section */}
                        {entry?.foodInteractions?.length ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Food and drink</Text>
                                <View style={{ gap: Spacing.sm }}>
                                    {entry.foodInteractions.map((f, i) => <FindingCard key={i} finding={f} />)}
                                </View>
                            </View>
                        ) : null}

                        {entry?.storage ? (
                            <Card title="Storing it">
                                <Text style={styles.body}>{entry.storage}</Text>
                            </Card>
                        ) : null}

                        <TouchableOpacity
                            style={styles.checkButton}
                            onPress={() => router.push('/medications/interactions')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="shield-outline" size={17} color={Palette.primary} />
                            <Text style={styles.checkButtonText}>Check against everything you take</Text>
                            <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
                        </TouchableOpacity>

                        {entry?.safetyNote ? <Text style={styles.footer}>{entry.safetyNote}</Text> : null}
                    </>
                ) : (
                    <>
                        <Card title="Reminders">
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.body}>
                                        {medication.remindersEnabled ? 'On' : 'Off'}
                                    </Text>
                                    <Text style={styles.muted}>
                                        {medication.frequency === 'as_needed'
                                            ? 'When-needed medicines are never reminded.'
                                            : scheduleSummary(medication)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.smallButton, medication.remindersEnabled && styles.smallButtonActive]}
                                    onPress={toggleReminders}
                                    disabled={medication.frequency === 'as_needed'}
                                >
                                    <Text style={[
                                        styles.smallButtonText,
                                        medication.remindersEnabled && styles.smallButtonTextActive,
                                    ]}>
                                        {medication.remindersEnabled ? 'Turn off' : 'Turn on'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Card>

                        {mine ? (
                            <Card title="Last 30 days">
                                <View style={styles.statGrid}>
                                    <Stat value={mine.adherence.score} suffix="%" label="Taken" colour={Palette.success} />
                                    <Stat value={mine.adherence.onTime} label="On time" colour={Palette.primary} />
                                    <Stat value={mine.adherence.late} label="Late" colour={Palette.warning} />
                                    <Stat value={mine.adherence.missed} label="Missed" colour={Palette.danger} />
                                </View>
                                {mine.adherence.score === null ? (
                                    <Text style={styles.muted}>
                                        Nothing has come due yet, so there is nothing to score.
                                    </Text>
                                ) : null}
                            </Card>
                        ) : (
                            <Card title="Last 30 days">
                                <Text style={styles.muted}>
                                    No doses have come due for this medication yet.
                                </Text>
                            </Card>
                        )}

                        {medication.identification ? (
                            <Card title="How this was identified">
                                <Text style={styles.body}>{medication.identification.basis}</Text>
                                {medication.identification.confidence != null ? (
                                    <Text style={styles.muted}>
                                        {Math.round(medication.identification.confidence * 100)}% confident at the time of scanning.
                                        {medication.identification.confidence < 0.6
                                            ? ' You confirmed it against your own packaging.'
                                            : ''}
                                    </Text>
                                ) : null}
                            </Card>
                        ) : null}

                        {medication.notes ? (
                            <Card title="Your notes">
                                <Text style={styles.body}>{medication.notes}</Text>
                            </Card>
                        ) : null}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const TabButton = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        {children}
    </View>
);

const Row = ({ icon, label, warn }: { icon: string; label: string; warn?: boolean }) => (
    <View style={styles.detailRow}>
        <Ionicons name={icon as any} size={15} color={warn ? Palette.warning : Palette.textSecondary} />
        <Text style={[styles.body, warn && { color: Palette.warning, fontFamily: Fonts.semibold }]}>{label}</Text>
    </View>
);

const Pill = ({ text }: { text: string }) => (
    <View style={styles.heroChip}><Text style={styles.heroChipText}>{text}</Text></View>
);

const Stat = ({ value, suffix, label, colour }: {
    value: number | null; suffix?: string; label: string; colour: string;
}) => (
    <View style={styles.stat}>
        <Text style={[styles.statValue, { color: colour }]}>
            {value === null ? '—' : value}{value !== null && suffix ? suffix : ''}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.md,
    },
    headerTitle: { flex: 1, fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold, textAlign: 'center', textTransform: 'capitalize' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.semibold },
    link: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.medium },

    hero: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    heroName: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold, textTransform: 'capitalize' },
    heroPlain: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.medium, marginTop: 1 },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: Spacing.sm },
    heroChip: { backgroundColor: Palette.borderLight, paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.sm },
    heroChipText: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },

    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Palette.border },
    tab: { paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: Palette.primary },
    tabText: { fontSize: 14, color: Palette.textSecondary, fontFamily: Fonts.medium },
    tabTextActive: { color: Palette.primary, fontFamily: Fonts.semibold },

    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    card: {
        backgroundColor: Palette.white, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg, gap: Spacing.sm,
    },
    cardTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
    body: { fontSize: 13, color: Palette.text, fontFamily: Fonts.regular, lineHeight: 20 },
    muted: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },
    subLabel: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },

    detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Palette.surface, borderRadius: Radius.sm,
        paddingHorizontal: 9, paddingVertical: 5,
    },
    tagSerious: { backgroundColor: Palette.dangerSurface },
    tagText: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.medium },

    section: { gap: Spacing.sm },
    sectionTitle: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },

    checkButton: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primarySurface, borderRadius: Radius.md, padding: Spacing.lg,
    },
    checkButtonText: { flex: 1, fontSize: 14, color: Palette.primary, fontFamily: Fonts.semibold },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    smallButton: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm,
        borderWidth: 1, borderColor: Palette.border,
    },
    smallButtonActive: { borderColor: Palette.primary },
    smallButtonText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.medium },
    smallButtonTextActive: { color: Palette.primary },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    stat: { flex: 1, minWidth: '40%', gap: 2 },
    statValue: { fontSize: 22, fontFamily: Fonts.bold },
    statLabel: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.regular },

    footer: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.regular, lineHeight: 17 },
});
