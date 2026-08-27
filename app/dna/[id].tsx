/**
 * A genotyping result, as the person it belongs to reads it.
 *
 * Three rules shape this screen, and they are the reason it is not just a list:
 *
 *  1. **Not tested is never a negative.** Coverage is not a footnote — it is drawn, in the
 *     same chart as everything else, because a person reading silence as reassurance is the
 *     specific harm this product has to avoid.
 *  2. **Ordered by usefulness, not by drama.** Medicines and nutrition first. Risk last,
 *     and only if the person asked for it.
 *  3. **A finding that moves a reference range links to that biomarker.** The genotype
 *     explaining a number they already track is the thing LabTrack does that a genetics
 *     app does not.
 *
 * Layout follows the turing kit's health-record screens: one gradient hero carrying the
 * single number that matters, a segmented filter, and findings as *rows inside one card per
 * section* rather than a card each. Thirty identical bordered cards is a list you scroll
 * past; rows you can scan and open are a report you read. Typical results collapse to a
 * line, anything non-typical opens itself.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, UIManager,
    TouchableOpacity, RefreshControl, Alert, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';
import {
    getGenotypeFile, setRiskConsent, groupByCategory, TONE_META,
    type GenotypeFile, type Finding, type Category, type Tone,
} from '@/lib/genotype';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GUTTER = Spacing.lg;

const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const ease = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/**
 * Sort weight by tone. Drives both the highlights rail and the order of rows inside a
 * section: the thing a person can act on should not be the eleventh row down.
 */
const TONE_WEIGHT: Record<Tone, number> = {
    attention: 0, increased: 1, reduced: 1, carrier: 2, typical: 3,
};

const findingWeight = (f: Finding) => {
    if (f.withheld) return 5;
    if (f.status !== 'called') return 6;
    return TONE_WEIGHT[f.tone ?? 'typical'] ?? 4;
};

const isNotable = (f: Finding) =>
    !f.withheld && f.status === 'called' && (f.tone ?? 'typical') !== 'typical';

const CATEGORY_SHORT: Record<Category, string> = {
    medication: 'Medicines',
    nutrition: 'Nutrition',
    carrier: 'Carrier',
    trait: 'Traits',
    risk: 'Risk',
};

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one figure worth putting at 46pt is "how many of these results ask something of
 * you" — not the panel size, which is a fact about the assay rather than about the person.
 */
function Hero({ file, notable }: { file: GenotypeFile; notable: number }) {
    const assay = file.assayType === 'array' ? 'Genotyping array' : file.assayType;
    const s = file.summary;

    return (
        <LinearGradient
            colors={Palette.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
        >
            <View style={styles.heroBadge}>
                <Ionicons name="git-branch-outline" size={13} color={Palette.white} />
                <Text style={styles.heroBadgeText}>{assay}</Text>
            </View>

            <View style={styles.heroFigureRow}>
                <Text style={styles.heroFigure}>{notable || s.shown}</Text>
                <Text style={styles.heroFigureLabel}>
                    {notable > 0
                        ? `result${notable === 1 ? '' : 's'}\nworth knowing about`
                        : `result${s.shown === 1 ? '' : 's'}\nread for you`}
                </Text>
            </View>

            <Text style={styles.heroHeadline}>
                {notable > 0
                    ? 'Everything else in this panel came back typical for you.'
                    : 'Nothing in this panel came back outside the typical range.'}
            </Text>

            <Text style={styles.heroMeta}>
                {file.labName}
                {file.chip ? ` · ${file.chip}` : ''}
                {file.reportedAt ? ` · ${fmtDate(file.reportedAt)}` : ''}
            </Text>

            <View style={styles.heroRule} />

            <View style={styles.heroStats}>
                <HeroStat value={s.shown} label="shown" />
                <HeroStat value={s.withheld} label="in review" />
                <HeroStat value={s.notCovered} label="not tested" last />
            </View>
        </LinearGradient>
    );
}

const HeroStat = ({ value, label, last }: { value: number; label: string; last?: boolean }) => (
    <View style={[styles.heroStat, !last && styles.heroStatDivider]}>
        <Text style={styles.heroStatValue}>{value}</Text>
        <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One block per called result, stacked into a column per category — a unit chart, not an
 * abstraction over one. A person can count their own results in it, and the grey blocks
 * carry the same weight as the coloured ones, which is the honest shape of a panel where
 * most things are typical.
 */
function ResultChart({
    groups, active, onPick,
}: {
    groups: { category: Category; icon: string; findings: Finding[] }[];
    active: Category | 'all';
    onPick: (c: Category) => void;
}) {
    const MAX_BLOCKS = 9;

    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Where your results sit</Text>
            <Text style={styles.chartBlurb}>
                Every block is one result. Coloured blocks are the ones that differ from the
                common version of that gene.
            </Text>

            <View style={styles.chartPlot}>
                {groups.map((g) => {
                    const called = [...g.findings].filter((f) => !f.withheld && f.status === 'called')
                        .sort((a, b) => findingWeight(a) - findingWeight(b));
                    const shown = called.slice(0, MAX_BLOCKS);
                    const overflow = called.length - shown.length;
                    const on = active === g.category;

                    return (
                        <TouchableOpacity
                            key={g.category}
                            style={styles.chartCol}
                            onPress={() => onPick(g.category)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${CATEGORY_SHORT[g.category]}, ${called.length} results`}
                        >
                            {overflow > 0 && <Text style={styles.chartOverflow}>+{overflow}</Text>}
                            {/* Bottom-aligned so the columns read against a common baseline. */}
                            <View style={styles.chartStack}>
                                {shown.slice().reverse().map((f, i) => {
                                    const notable = isNotable(f);
                                    const tone = TONE_META[f.tone ?? 'typical'];
                                    return (
                                        <View
                                            key={f.rsid + i}
                                            style={[
                                                styles.chartBlock,
                                                {
                                                    backgroundColor: notable ? tone.color : Palette.borderLight,
                                                    height: notable ? 16 : 11,
                                                },
                                            ]}
                                        />
                                    );
                                })}
                                {called.length === 0 && <View style={styles.chartBlockEmpty} />}
                            </View>
                            <View style={[styles.chartFoot, on && styles.chartFootOn]}>
                                <Ionicons
                                    name={g.icon as any}
                                    size={15}
                                    color={on ? Palette.white : Palette.textSecondary}
                                />
                            </View>
                            <Text style={[styles.chartAxis, on && styles.chartAxisOn]} numberOfLines={1}>
                                {CATEGORY_SHORT[g.category]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

/**
 * Coverage as a single bar. The grey segment is the point of it: it is drawn to scale
 * alongside the results, so "we did not look" occupies real estate rather than a sentence
 * at the bottom of the screen.
 */
function CoverageBar({ summary }: { summary: GenotypeFile['summary'] }) {
    // Every segment counts findings. Scaling one of them against a different unit — the
    // curated `notTested` topic list — would make the bar a picture of nothing.
    const segs = [
        { n: summary.shown, color: Palette.primary, label: 'Reported' },
        { n: summary.withheld, color: Palette.info, label: 'In review' },
        { n: summary.notCovered, color: Palette.border, label: 'Not tested' },
    ].filter((s) => s.n > 0);
    const total = segs.reduce((a, s) => a + s.n, 0) || 1;

    return (
        <View style={styles.coverage}>
            <View style={styles.coverageBar}>
                {segs.map((s, i) => (
                    <View
                        key={s.label}
                        style={{
                            flex: s.n / total,
                            backgroundColor: s.color,
                            marginLeft: i === 0 ? 0 : 2,
                            borderRadius: Radius.pill,
                        }}
                    />
                ))}
            </View>
            <View style={styles.coverageLegend}>
                {segs.map((s) => (
                    <View key={s.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                        <Text style={styles.legendText}>{s.n} {s.label.toLowerCase()}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlights
// ─────────────────────────────────────────────────────────────────────────────

/** The findings that ask something of the reader, lifted clear of the scroll. */
function Highlights({ items, onPick }: { items: Finding[]; onPick: (f: Finding) => void }) {
    if (items.length === 0) return null;
    return (
        <View style={styles.railWrap}>
            <Text style={styles.railTitle}>Start here</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
            >
                {items.map((f) => {
                    const tone = TONE_META[f.tone ?? 'typical'];
                    return (
                        <TouchableOpacity
                            key={f.rsid}
                            style={[styles.railCard, { backgroundColor: tone.bg, borderColor: `${tone.color}33` }]}
                            onPress={() => onPick(f)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <View style={[styles.railChip, { backgroundColor: tone.color }]}>
                                <Text style={styles.railChipText}>{f.label}</Text>
                            </View>
                            <Text style={styles.railCardTitle} numberOfLines={3}>{f.name}</Text>
                            <View style={styles.railFoot}>
                                <Text style={[styles.railGene, { color: tone.color }]} numberOfLines={1}>
                                    {f.gene}{f.genotype ? ` · ${f.genotype}` : ''}
                                </Text>
                                <Ionicons name="arrow-forward" size={15} color={tone.color} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One result, as a row. Collapsed it is a name, a tone and a genotype; open it is the
 * paragraph and its links. Withheld and uninterpreted rows render deliberately differently
 * and cannot be opened, because there is nothing behind them to open.
 */
function FindingRow({
    finding, open, first, onToggle, onBiomarker,
}: {
    finding: Finding;
    open: boolean;
    first: boolean;
    onToggle: () => void;
    onBiomarker: (n: string) => void;
}) {
    const inert = finding.withheld || finding.status !== 'called';
    const tone = TONE_META[finding.tone ?? 'typical'];

    const chip = finding.withheld
        ? { text: 'In review', color: Palette.info, bg: Palette.infoSurface }
        : finding.status !== 'called'
            ? {
                text: finding.status === 'not_covered' ? 'Not tested' : 'No result',
                color: Palette.textSecondary, bg: Palette.borderLight,
            }
            : { text: finding.label ?? tone.label, color: tone.color, bg: tone.bg };

    const body = finding.withheld
        ? 'A clinician is reviewing this result. It will appear here once that is done.'
        : finding.detail;

    return (
        <View style={[styles.row, !first && styles.rowDivider]}>
            <TouchableOpacity
                style={styles.rowHead}
                onPress={inert ? undefined : onToggle}
                activeOpacity={inert ? 1 : 0.6}
                accessibilityRole={inert ? undefined : 'button'}
                accessibilityState={inert ? undefined : { expanded: open }}
            >
                {/* A colour rail rather than a border, so a scan down the left edge finds
                    the non-typical results without reading a word. */}
                <View
                    style={[
                        styles.rowRail,
                        { backgroundColor: isNotable(finding) ? tone.color : Palette.border },
                    ]}
                />
                <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, inert && styles.rowTitleMuted]}>{finding.name}</Text>
                    <View style={styles.rowMeta}>
                        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                            <Text style={[styles.chipText, { color: chip.color }]}>{chip.text}</Text>
                        </View>
                        {!!finding.gene && (
                            <Text style={styles.genotype} numberOfLines={1}>
                                {finding.gene}
                                {finding.alleleName ? ` · ${finding.alleleName}` : ''}
                                {finding.genotype ? ` · ${finding.genotype}` : ''}
                            </Text>
                        )}
                    </View>
                </View>
                {!inert && (
                    <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Palette.textMuted}
                        style={styles.rowChevron}
                    />
                )}
            </TouchableOpacity>

            {(open || inert) && (
                <View style={styles.rowBody}>
                    {!!body && <Text style={styles.rowDetail}>{body}</Text>}

                    {!!finding.incomplete && (
                        <View style={styles.note}>
                            <Ionicons name="alert-circle-outline" size={16} color={Palette.warning} />
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
                            <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DnaReportScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [file, setFile] = useState<GenotypeFile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [consenting, setConsenting] = useState(false);
    const [filter, setFilter] = useState<Category | 'all'>('all');
    const [openIds, setOpenIds] = useState<string[]>([]);

    const scroller = useRef<ScrollView>(null);
    const listY = useRef(0);

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

    const groups = useMemo(() => (file ? groupByCategory(file.findings) : []), [file]);

    /** Sorted across every category — a medication finding and a carrier one compete on
     *  how much they ask of the reader, not on which section they happen to live in. */
    const notable = useMemo(
        () => file
            ? file.findings.filter(isNotable).sort((a, b) => findingWeight(a) - findingWeight(b))
            : [],
        [file],
    );

    const toggle = (rsid: string) => {
        ease();
        setOpenIds((ids) => (ids.includes(rsid) ? ids.filter((i) => i !== rsid) : [...ids, rsid]));
    };

    /** Filtering changes the height of everything below, so scroll to the list rather than
     *  to a row: the row's own offset is stale the moment the filter applies. */
    const jumpTo = (f: Finding) => {
        ease();
        setFilter(f.category);
        setOpenIds((ids) => (ids.includes(f.rsid) ? ids : [...ids, f.rsid]));
        requestAnimationFrame(() => {
            scroller.current?.scrollTo({ y: Math.max(0, listY.current - 8), animated: true });
        });
    };

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

    const visible = filter === 'all' ? groups : groups.filter((g) => g.category === filter);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your DNA</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                ref={scroller}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={Palette.primary}
                    />
                }
            >
                <Hero file={file} notable={notable.length} />

                {!file.clinicianReleased && file.summary.withheld > 0 && (
                    <View style={styles.reviewBanner}>
                        <Ionicons name="time-outline" size={16} color={Palette.info} />
                        <Text style={styles.reviewText}>
                            {file.summary.withheld} result{file.summary.withheld === 1 ? '' : 's'} awaiting
                            clinician review
                        </Text>
                    </View>
                )}

                <Highlights items={notable} onPick={jumpTo} />

                {groups.length > 0 && (
                    <ResultChart
                        groups={groups}
                        active={filter}
                        onPick={(c) => { ease(); setFilter((cur) => (cur === c ? 'all' : c)); }}
                    />
                )}

                {/* Findings list ─────────────────────────────────────────────── */}
                <View onLayout={(e) => { listY.current = e.nativeEvent.layout.y; }}>
                    {groups.length > 1 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.tabs}
                        >
                            {(['all', ...groups.map((g) => g.category)] as (Category | 'all')[]).map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.tab, filter === c && styles.tabOn]}
                                    onPress={() => { ease(); setFilter(c); }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: filter === c }}
                                >
                                    <Text style={[styles.tabText, filter === c && styles.tabTextOn]}>
                                        {c === 'all' ? 'All' : CATEGORY_SHORT[c]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {visible.map((group) => {
                        const ordered = [...group.findings]
                            .sort((a, b) => findingWeight(a) - findingWeight(b));
                        return (
                            <View key={group.category} style={styles.section}>
                                <View style={styles.sectionHead}>
                                    <View style={styles.sectionIcon}>
                                        <Ionicons name={group.icon as any} size={17} color={Palette.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionTitle}>{group.title}</Text>
                                        <Text style={styles.sectionBlurb}>{group.blurb}</Text>
                                    </View>
                                </View>
                                <View style={styles.card}>
                                    {ordered.map((f, i) => (
                                        <FindingRow
                                            key={f.rsid}
                                            finding={f}
                                            first={i === 0}
                                            open={openIds.includes(f.rsid)}
                                            onToggle={() => toggle(f.rsid)}
                                            onBiomarker={(name) => router.push(`/biomarker/${name}`)}
                                        />
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Offered without revealing what sits behind it. */}
                {file.riskResultsAvailable && (
                    <View style={styles.section}>
                        <LinearGradient
                            colors={[Palette.primarySurface, Palette.white]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.consentCard}
                        >
                            <View style={styles.consentIcon}>
                                <Ionicons
                                    name={file.consent?.riskResultsOptIn ? 'eye-outline' : 'lock-closed-outline'}
                                    size={18}
                                    color={Palette.primary}
                                />
                            </View>
                            <Text style={styles.consentTitle}>
                                {file.consent?.riskResultsOptIn
                                    ? 'Health risk results are shown'
                                    : 'Health risk results are hidden'}
                            </Text>
                            <Text style={styles.consentBody}>
                                {file.consent?.riskResultsOptIn
                                    ? 'You can hide these again at any time.'
                                    : 'This test found results about conditions that may develop later in life. '
                                      + 'We keep these hidden until you ask for them.'}
                            </Text>
                            <TouchableOpacity
                                style={styles.consentButton}
                                onPress={onToggleRisk}
                                disabled={consenting}
                                accessibilityRole="button"
                            >
                                <Text style={styles.consentButtonText}>
                                    {consenting
                                        ? 'Updating…'
                                        : file.consent?.riskResultsOptIn
                                            ? 'Hide these results'
                                            : 'Show me these results'}
                                </Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                )}

                {/* The section that stops silence being read as reassurance. */}
                <View style={styles.section}>
                    <View style={styles.sectionHead}>
                        <View style={[styles.sectionIcon, { backgroundColor: Palette.borderLight }]}>
                            <Ionicons name="scan-outline" size={17} color={Palette.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>What this test did not cover</Text>
                            <Text style={styles.sectionBlurb}>
                                No genetic test looks at everything. These were not examined, so this
                                report cannot rule them out.
                            </Text>
                        </View>
                    </View>

                    <CoverageBar summary={file.summary} />

                    <View style={[styles.card, styles.cardGap]}>
                        {file.notTested.map((gap, i) => (
                            <View key={gap.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                                <View style={styles.gapBody}>
                                    <Text style={styles.rowTitle}>{gap.title}</Text>
                                    <Text style={styles.rowDetail}>{gap.detail}</Text>
                                    {!!gap.upgrade && (
                                        <TouchableOpacity
                                            style={styles.link}
                                            onPress={() => router.push('/(tabs)/orders')}
                                            accessibilityRole="button"
                                        >
                                            <Text style={styles.linkText}>See tests that cover this</Text>
                                            <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
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
    safe: { flex: 1, backgroundColor: Palette.surface },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: GUTTER, paddingVertical: Spacing.md,
        backgroundColor: Palette.surface,
    },
    headerTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
    scroll: { paddingBottom: Spacing.xxxl * 2 },
    empty: { padding: Spacing.xxxl, alignItems: 'center' },
    emptyText: { fontFamily: Fonts.regular, fontSize: 16, color: Palette.textSecondary },

    // Hero
    hero: {
        marginHorizontal: GUTTER, marginTop: Spacing.sm,
        borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.card,
    },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
    },
    heroBadgeText: {
        fontFamily: Fonts.semibold, fontSize: 12, color: Palette.white,
        letterSpacing: 0.3, textTransform: 'capitalize',
    },
    heroFigureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
    heroFigure: { fontFamily: Fonts.bold, fontSize: 46, lineHeight: 50, color: Palette.white },
    heroFigureLabel: {
        flex: 1, fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20,
        color: 'rgba(255,255,255,0.92)',
    },
    heroHeadline: {
        fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20,
        color: 'rgba(255,255,255,0.82)', marginTop: Spacing.md,
    },
    heroMeta: {
        fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17,
        color: 'rgba(255,255,255,0.62)', marginTop: Spacing.sm,
    },
    heroRule: {
        height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: Spacing.lg,
    },
    heroStats: { flexDirection: 'row' },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatDivider: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' },
    heroStatValue: { fontFamily: Fonts.bold, fontSize: 20, color: Palette.white },
    heroStatLabel: {
        fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1,
    },

    reviewBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.infoSurface, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        marginHorizontal: GUTTER, marginTop: Spacing.md,
    },
    reviewText: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.info, flex: 1, lineHeight: 20 },

    // Highlights rail
    railWrap: { marginTop: Spacing.xxl },
    railTitle: {
        fontFamily: Fonts.bold, fontSize: 19, color: Palette.text,
        marginHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    rail: { paddingHorizontal: GUTTER, gap: Spacing.md, paddingBottom: 2 },
    railCard: {
        width: 208, borderRadius: Radius.lg, borderWidth: 1,
        padding: Spacing.lg, justifyContent: 'space-between', minHeight: 148,
    },
    railChip: {
        alignSelf: 'flex-start', borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md, paddingVertical: 4,
    },
    railChipText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.white },
    railCardTitle: {
        fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 21,
        color: Palette.text, marginTop: Spacing.md,
    },
    railFoot: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: Spacing.sm, marginTop: Spacing.md,
    },
    railGene: { fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0.4, flex: 1 },

    // Chart
    chartCard: {
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        padding: Spacing.lg, ...Shadow.card,
    },
    chartTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    chartBlurb: {
        fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19,
        color: Palette.textSecondary, marginTop: 3,
    },
    chartPlot: {
        flexDirection: 'row', alignItems: 'flex-end',
        marginTop: Spacing.lg, gap: Spacing.xs,
    },
    chartCol: { flex: 1, alignItems: 'center' },
    chartOverflow: {
        fontFamily: Fonts.medium, fontSize: 11, color: Palette.textMuted, marginBottom: 3,
    },
    chartStack: { alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: 40 },
    chartBlock: { width: 12, borderRadius: Radius.pill },
    chartBlockEmpty: {
        width: 12, height: 4, borderRadius: Radius.pill, backgroundColor: Palette.border,
    },
    chartFoot: {
        width: 30, height: 30, borderRadius: Radius.pill, marginTop: Spacing.md,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.borderLight,
    },
    chartFootOn: { backgroundColor: Palette.primary },
    chartAxis: {
        fontFamily: Fonts.medium, fontSize: 11, color: Palette.textMuted, marginTop: 5,
    },
    chartAxisOn: { color: Palette.primary, fontFamily: Fonts.bold },

    // Coverage bar
    coverage: { marginBottom: Spacing.lg },
    coverageBar: { flexDirection: 'row', height: 10, borderRadius: Radius.pill },
    coverageLegend: {
        flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: Radius.pill },
    legendText: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary },

    // Tabs
    tabs: {
        paddingHorizontal: GUTTER, gap: Spacing.sm,
        marginTop: Spacing.xxl, paddingBottom: 2,
    },
    tab: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: Radius.pill, backgroundColor: Palette.borderLight,
    },
    tabOn: { backgroundColor: Palette.text },
    tabText: { fontFamily: Fonts.semibold, fontSize: 13, color: Palette.textSecondary },
    tabTextOn: { color: Palette.white },

    // Sections
    section: { marginTop: Spacing.xxl },
    sectionHead: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
        paddingHorizontal: GUTTER, marginBottom: Spacing.md,
    },
    sectionIcon: {
        width: 32, height: 32, borderRadius: Radius.md, marginTop: 1,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    sectionTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    sectionBlurb: {
        fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary,
        lineHeight: 19, marginTop: 2,
    },

    // Card + rows
    card: {
        marginHorizontal: GUTTER, backgroundColor: Palette.background,
        borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card,
    },
    cardGap: {
        backgroundColor: Palette.background, borderWidth: 1,
        borderColor: Palette.border, borderStyle: 'dashed', shadowOpacity: 0, elevation: 0,
    },
    row: { paddingHorizontal: Spacing.lg },
    rowDivider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    rowHead: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.lg },
    rowRail: {
        width: 3, borderRadius: Radius.pill, alignSelf: 'stretch',
        marginRight: Spacing.md, minHeight: 34,
    },
    rowMain: { flex: 1 },
    rowChevron: { marginLeft: Spacing.sm, marginTop: 2 },
    rowTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.text, lineHeight: 22 },
    rowTitleMuted: { color: Palette.textSecondary },
    rowMeta: {
        flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
        gap: Spacing.sm, marginTop: Spacing.sm,
    },
    rowBody: { paddingBottom: Spacing.lg, paddingLeft: Spacing.md + 3 },
    rowDetail: {
        fontFamily: Fonts.regular, fontSize: 15, color: Palette.text, lineHeight: 23,
    },
    gapBody: { paddingVertical: Spacing.lg, gap: Spacing.sm },
    genotype: { fontFamily: Fonts.medium, fontSize: 12, color: Palette.textMuted, letterSpacing: 0.4 },

    chip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill },
    chipText: { fontFamily: Fonts.semibold, fontSize: 12 },

    note: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
        backgroundColor: Palette.warningSurface, borderRadius: Radius.md,
        padding: Spacing.md, marginTop: Spacing.md,
    },
    noteText: { fontFamily: Fonts.regular, fontSize: 14, color: Palette.warning, flex: 1, lineHeight: 21 },

    link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md },
    linkText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.primary },

    // Consent
    consentCard: {
        marginHorizontal: GUTTER, borderRadius: Radius.lg, padding: Spacing.xl,
        borderWidth: 1, borderColor: Palette.primarySurface,
    },
    consentIcon: {
        width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: Palette.white,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
    },
    consentTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    consentBody: {
        fontFamily: Fonts.regular, fontSize: 15, color: Palette.textSecondary,
        lineHeight: 22, marginTop: 5,
    },
    consentButton: {
        backgroundColor: Palette.primary, borderRadius: Radius.md,
        paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
    },
    consentButtonText: { fontFamily: Fonts.semibold, fontSize: 16, color: Palette.white },

    footer: {
        fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted,
        lineHeight: 19, textAlign: 'center',
        marginTop: Spacing.xxl, marginHorizontal: Spacing.xxl,
    },
});
