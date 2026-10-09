/**
 * The first weeks, on home — until there is nothing left to wait for.
 *
 * The one card on this screen that is drawn *before* there is anything to report, and that
 * is the point of it. Every other card earns its place by having data; a new account has
 * none, so the page it used to land on was nearly blank and said nothing about what to do.
 * For somebody in their first two weeks, where they are in the journey *is* the thing to
 * report. It sits under the score card and retires itself (`stage: 'complete'`) or on "Hide".
 *
 * Three faces, one per stage, so it says the one thing true of that moment:
 *
 *   - **Setting up** — the four steps, the next one as the button.
 *   - **Waiting** — the parcels, and what the app has already learned meanwhile. Two weeks
 *     of "nothing yet" is how somebody stops opening an app; "6 nights of sleep, 2 results"
 *     is a reason to keep wearing the bracelet.
 *   - **Ready** — every kit is back. One button: see what changed.
 *
 * Nothing here is computed on the phone. Stage, steps, parcels and counts all come from
 * `GET /onboarding` (`utils/onboardingState.js`).
 */
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { StepRow } from '@/components/onboarding/StepRow';
import { KitTracker } from '@/components/onboarding/KitTracker';
import { VisitRow } from '@/components/onboarding/VisitRow';
import { learnedLine, type Journey } from '@/lib/onboarding';

interface Props {
    journey: Journey;
    onOpen: (route: string) => void;
    onDismiss: () => void;
}

export function JourneyCard({ journey, onOpen, onDismiss }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    if (!journey.showJourney) return null;

    const confirmHide = () => Alert.alert(
        'Hide this card?',
        'Everything on it is still in the app: tests under Order, results under Results, and devices under Profile › Linked devices.',
        [{ text: 'Keep it', style: 'cancel' }, { text: 'Hide', onPress: onDismiss }],
    );

    const learned = learnedLine(journey.learned);
    const open = journey.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped');

    if (journey.stage === 'ready') {
        return (
            <View style={[styles.card, styles.cardReady]}>
                <View style={styles.readyIcon}>
                    <Ionicons name="sparkles" size={20} color={Palette.primary} />
                </View>
                <Text style={styles.title}>Your full analysis is ready</Text>
                <Text style={styles.body}>
                    All your results are in, your DNA included. See what changed in your plan.
                </Text>
                <TouchableOpacity style={styles.primary} onPress={() => onOpen('/journey/update')} accessibilityRole="button">
                    <Text style={styles.primaryText}>See what changed</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDismiss} style={styles.secondary} accessibilityRole="button">
                    <Text style={styles.secondaryText}>Done</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (journey.stage === 'waiting') {
        const waitingForDna = journey.analysis.waitingFor.includes('dna');
        return (
            <View style={styles.card}>
                <View style={styles.head}>
                    <Text style={styles.title}>Your results are on the way</Text>
                    <TouchableOpacity onPress={confirmHide} hitSlop={10} accessibilityLabel="Hide this card">
                        <Ionicons name="close" size={18} color={Palette.textMuted} />
                    </TouchableOpacity>
                </View>
                {journey.analysis.exists && waitingForDna ? (
                    <Text style={styles.body}>
                        Your first analysis is ready. It will be updated when your DNA results arrive.
                    </Text>
                ) : (
                    <Text style={styles.body}>Nothing for you to do. We will tell you the moment anything arrives.</Text>
                )}

                {learned ? (
                    <View style={styles.learned}>
                        <Ionicons name="pulse-outline" size={16} color={Palette.textSecondary} />
                        <Text style={styles.learnedText}>
                            <Text style={styles.learnedLead}>Learned so far: </Text>{learned}
                        </Text>
                    </View>
                ) : null}

                {journey.visit ? <VisitRow visit={journey.visit} onOpen={onOpen} /> : null}
                <View style={styles.divider} />
                <KitTracker kits={journey.kits} />

                {open.map((step, i) => (
                    <StepRow key={step.key} step={step} index={i} compact onOpen={onOpen} />
                ))}
            </View>
        );
    }

    const { done, total } = journey.progress;
    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <Text style={styles.title}>Getting started</Text>
                <TouchableOpacity onPress={confirmHide} hitSlop={10} accessibilityLabel="Hide this card">
                    <Ionicons name="close" size={18} color={Palette.textMuted} />
                </TouchableOpacity>
            </View>
            <Text style={styles.count}>{done} of {total} done</Text>
            <View style={styles.progress} accessibilityElementsHidden>
                {journey.steps.map((s) => (
                    <View key={s.key} style={[styles.progressSeg, s.status === 'done' && styles.progressOn]} />
                ))}
            </View>

            {journey.steps.map((step, i) => (
                <StepRow key={step.key} step={step} index={i} compact onOpen={onOpen} />
            ))}

            {journey.visit ? <VisitRow visit={journey.visit} onOpen={onOpen} /> : null}
            {journey.kits.length ? (
                <>
                    <View style={styles.divider} />
                    <KitTracker kits={journey.kits} />
                </>
            ) : null}

            {journey.next ? (
                <TouchableOpacity
                    style={styles.primary}
                    onPress={() => onOpen(journey.next!.route)}
                    accessibilityRole="button"
                >
                    <Text style={styles.primaryText}>{journey.next.label}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.border,
        padding: Spacing.lg,
        ...Shadow.card,
    },
    cardReady: { borderColor: Palette.primary, borderWidth: 1.5 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    title: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text, flexShrink: 1 },
    body: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 20, marginTop: 4 },
    count: { fontSize: 13, ...BodyFont.medium, color: Palette.textSecondary, marginTop: 2 },
    progress: { flexDirection: 'row', gap: 4, marginTop: Spacing.sm, marginBottom: Spacing.sm },
    progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Palette.borderLight },
    progressOn: { backgroundColor: Palette.successFill },
    learned: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md,
    },
    learnedText: { flex: 1, fontSize: 13, ...BodyFont.regular, color: Palette.text, lineHeight: 19 },
    learnedLead: { ...BodyFont.semibold },
    divider: { height: 1, backgroundColor: Palette.borderLight, marginVertical: Spacing.md },
    readyIcon: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
    },
    primary: {
        marginTop: Spacing.md, backgroundColor: Palette.primaryFill, borderRadius: Radius.lg,
        paddingVertical: 13, alignItems: 'center',
    },
    primaryText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    secondary: { alignItems: 'center', paddingTop: Spacing.md },
    secondaryText: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },
}));

export default JourneyCard;
