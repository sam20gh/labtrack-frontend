/**
 * The cycle tracker on the home screen, in two forms.
 *
 * **`CycleCard`** is a tracker card, and earns its place like every other: only when there is
 * something to report — a period on, one due within three days, one late, or a question about
 * when the last one ended. The rest of the month it draws nothing, because "cycle day 14" is
 * not news. `homeCardLive` in `lib/cycle.ts` is the predicate, so the rule has one home.
 *
 * **`CycleOfferCard`** is the one invitation the home screen makes about it, and it is made
 * once. It is drawn for somebody whose profile says Female, or who has not said, and who has
 * never set the tracker up or said "Not now". That departs from the home screen's first rule —
 * no rows for trackers nobody has started — on purpose and narrowly: cycle tracking is the one
 * tracker that is not for everybody, so it is not on the score screen's list of unmeasured
 * pillars or in the quick actions, and without this nobody would find it. "Not now" answers it
 * for good; the profile row is the way in after that.
 *
 * Both carry their own 16pt side margin: `Section` pads its heading and nothing else.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { CycleRing } from '@/components/cycle/CycleRing';
import { headline, formatRange, type CycleOverview } from '@/lib/cycle';

export function CycleCard({
    overview, onOpen, onStarted, busy,
}: { overview: CycleOverview; onOpen: () => void; onStarted: () => void; busy?: boolean }) {
    const Palette = usePalette();
    const styles = useStyles();
    const { reading, plan } = overview;
    const words = headline(reading, plan.status);
    const onPeriod = Boolean(reading.currentPeriod);
    const loggedToday = reading.currentPeriod?.loggedThrough === overview.today;
    const offerStart = !onPeriod && ['due', 'late', 'very_late', 'upcoming'].includes(reading.state);
    const offerToday = onPeriod && !loggedToday;

    return (
        <Pressable style={styles.card} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Cycle. ${words.title}. ${words.detail}`}>
            <View style={styles.row}>
                <CycleRing reading={reading} size={84}>
                    <Text style={styles.ringNumber}>{onPeriod ? reading.currentPeriod?.day : reading.cycleDay ?? '—'}</Text>
                </CycleRing>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.title} numberOfLines={2}>{words.title}</Text>
                    <Text style={styles.detail} numberOfLines={3}>
                        {overview.prompt
                            ? 'When did your last period end? One tap keeps predictions right.'
                            // Three lines cannot hold the late explanation; the dashboard, one tap
                            // away, carries it in full. Cut mid-sentence it would end on "If you
                            // could be…", which is the worst place to stop.
                            : (reading.state === 'late' || reading.state === 'very_late') && reading.prediction
                                ? `Expected ${formatRange(reading.prediction.window)}. Log it when it starts.`
                                : words.detail}
                    </Text>
                </View>
            </View>
            {offerStart || offerToday ? (
                <Pressable style={styles.button} onPress={onStarted} disabled={busy} accessibilityRole="button">
                    <Ionicons name="water" size={16} color={Palette.white} />
                    <Text style={styles.buttonLabel}>{offerStart ? 'Period started today' : 'Still on my period'}</Text>
                </Pressable>
            ) : null}
        </Pressable>
    );
}

export function CycleOfferCard({ onSetUp, onDismiss }: { onSetUp: () => void; onDismiss: () => void }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={[styles.card, styles.offer]}>
            <View style={styles.row}>
                <View style={styles.offerIcon}>
                    <Ionicons name="flower-outline" size={26} color={Palette.cycle} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.title}>Track your cycle</Text>
                    <Text style={styles.detail}>
                        Log your period in a tap and see when the next one is likely. Private to you.
                    </Text>
                </View>
            </View>
            <View style={styles.offerActions}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={onSetUp} accessibilityRole="button">
                    <Text style={styles.buttonLabel}>Set it up</Text>
                </Pressable>
                <Pressable style={styles.notNow} onPress={onDismiss} accessibilityRole="button">
                    <Text style={styles.notNowLabel}>Not now</Text>
                </Pressable>
            </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        marginHorizontal: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: Radius.xl,
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.borderLight,
        gap: Spacing.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    ringNumber: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.text },
    title: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    detail: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 18 },
    button: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Palette.primaryFill, minHeight: 44,
    },
    buttonLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
    offer: { backgroundColor: Palette.cycleSurface, borderColor: 'transparent' },
    offerIcon: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.background,
        alignItems: 'center', justifyContent: 'center',
    },
    offerActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    notNow: { paddingVertical: 12, paddingHorizontal: Spacing.lg, minHeight: 44, justifyContent: 'center' },
    notNowLabel: { fontSize: 14, ...BodyFont.medium, color: Palette.textSecondary },
}));
