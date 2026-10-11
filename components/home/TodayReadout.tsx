/**
 * Today — Sleep, Recovery, Effort — at the top of the home screen.
 *
 * Three rings in the order they happen (how you slept, how ready you are, what you have done),
 * and one sentence saying what they mean together. It replaced the Health Metrics carousel,
 * the Activity card and the Sleep card, which reported the same body three times in three
 * shapes and never connected them.
 *
 * Every figure here is the server's (`GET /readout`, `utils/dailyReadout.js`). The card only
 * draws, and it keeps three rules:
 *
 * 1. **Recovery is one colour.** Teal at every score, with a word and a glyph saying the state.
 *    A traffic light would put `danger` on a feeling.
 * 2. **A ring with nothing behind it draws a dash and a reason**, never an empty arc that reads
 *    as a score of zero.
 * 3. **Each ring opens the screen that explains it**: Sleep → `/sleep`, Recovery →
 *    `/recovery`, Effort → `/activity`.
 *
 * The card is earned like every home card: the caller draws it only when `readout.live`.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Spacing, Radius, Shadow, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { metricTint } from '@/lib/metrics';
import { formatSleep, recoveryCaption, signalPill, type Readout } from '@/lib/readout';

const RING = 76;
const STROKE = 8;

interface Props {
    readout: Readout;
    onSleep: () => void;
    onRecovery: () => void;
    onEffort: () => void;
}

export default function TodayReadout({ readout, onSleep, onRecovery, onEffort }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const { sleep, recovery, effort } = readout;

    const sleepTint = metricTint('sleep', Palette);
    const effortCaption = effort.minutes == null
        ? (effort.note === 'needs_age' ? 'Add your birth date' : `Aim for ${effort.target} min`)
        : `of ${effort.target} min`;

    // Off-usual signals first, then steps. Three at most: a fourth wraps to a second line.
    const pills = [
        ...(recovery?.signals ?? []).map(signalPill).filter((p): p is string => Boolean(p)),
        ...(effort.steps != null ? [`${effort.steps.toLocaleString()} steps`] : []),
    ].slice(0, 3);

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <Text style={styles.title}>Today</Text>
                <Text style={styles.week}>{effort.weekMinutes} of {effort.weekTarget} effort min this week</Text>
            </View>

            <View style={styles.rings}>
                <Ring
                    name="Sleep"
                    tint={sleepTint}
                    ratio={sleep?.score != null ? sleep.score / 100 : null}
                    centre={sleep?.score != null ? String(sleep.score) : '--'}
                    caption={formatSleep(sleep?.asleepMin ?? null) ?? 'No night yet'}
                    accessibilityLabel={sleep?.score != null
                        ? `Sleep score ${sleep.score}, ${formatSleep(sleep.asleepMin) ?? ''} asleep`
                        : 'No night recorded yet'}
                    onPress={onSleep}
                />
                <Ring
                    name="Recovery"
                    tint={Palette.teal}
                    ratio={recovery?.score != null ? recovery.score / 100 : null}
                    centre={recovery?.score != null ? String(recovery.score) : '--'}
                    caption={recoveryCaption(recovery)}
                    accessibilityLabel={recovery?.score != null
                        ? `Recovery ${recovery.score}, ${recovery.label}`
                        : `Recovery: ${recoveryCaption(recovery)}`}
                    onPress={onRecovery}
                />
                <Ring
                    name="Effort"
                    tint={Palette.orange}
                    ratio={effort.minutes != null ? effort.minutes / Math.max(1, effort.target) : null}
                    centre={effort.minutes != null ? String(effort.minutes) : '--'}
                    caption={effortCaption}
                    accessibilityLabel={effort.minutes != null
                        ? `Effort ${effort.minutes} of ${effort.target} minutes`
                        : `Effort: ${effortCaption}`}
                    onPress={onEffort}
                />
            </View>

            <Text style={styles.sentence}>{readout.sentence}</Text>

            {pills.length > 0 && (
                <View style={styles.pills}>
                    {pills.map((p) => (
                        <View key={p} style={styles.pill}><Text style={styles.pillText}>{p}</Text></View>
                    ))}
                </View>
            )}
        </View>
    );
}

/**
 * One ring. `ratio` null draws the track alone with a dash in the middle. Effort can pass its
 * target, so the arc is capped at a full circle rather than wrapping into a second lap that
 * nobody can read at 76pt.
 */
const Ring = ({ name, tint, ratio, centre, caption, accessibilityLabel, onPress }: {
    name: string;
    tint: string;
    ratio: number | null;
    centre: string;
    caption: string;
    accessibilityLabel: string;
    onPress: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    const r = (RING - STROKE) / 2;
    const c = 2 * Math.PI * r;
    const filled = ratio == null ? 0 : Math.min(1, Math.max(0, ratio));

    return (
        <TouchableOpacity
            style={styles.ring}
            onPress={onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <View style={{ width: RING, height: RING }}>
                <Svg width={RING} height={RING}>
                    <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={Palette.borderLight} strokeWidth={STROKE} fill="none" />
                    {filled > 0 && (
                        <Circle
                            cx={RING / 2} cy={RING / 2} r={r}
                            stroke={tint} strokeWidth={STROKE} fill="none"
                            strokeDasharray={`${c * filled} ${c}`}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                        />
                    )}
                </Svg>
                <View style={styles.ringCentre}>
                    <Text style={styles.ringValue}>{centre}</Text>
                </View>
            </View>
            <Text style={styles.ringName}>{name}</Text>
            <Text style={styles.ringCaption} numberOfLines={1}>{caption}</Text>
        </TouchableOpacity>
    );
};

const useStyles = makeStyles((Palette) => ({
    // Lifted over the hero's foot like the score card it sits above, so it carries the same
    // surface and shadow rather than a hairline border.
    card: {
        marginHorizontal: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: Radius.xl,
        backgroundColor: Palette.background,
        ...Shadow.card,
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        gap: Spacing.md,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
    title: { fontSize: 17, color: Palette.text, fontFamily: Fonts.bold },
    week: { flexShrink: 1, fontSize: 12, color: Palette.textSecondary, ...BodyFont.medium, fontVariant: ['tabular-nums'] },
    rings: { flexDirection: 'row', justifyContent: 'space-between' },
    ring: { flex: 1, alignItems: 'center', gap: 2 },
    ringCentre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: { fontSize: 20, color: Palette.text, fontFamily: Fonts.bold },
    ringName: { marginTop: Spacing.xs, fontSize: 11, letterSpacing: 0.6, color: Palette.textSecondary, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
    ringCaption: { fontSize: 12, color: Palette.text, ...BodyFont.medium },
    sentence: {
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Palette.borderLight,
        fontSize: 14,
        lineHeight: 20,
        color: Palette.text,
        ...BodyFont.regular,
    },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Palette.borderLight },
    pillText: { fontSize: 12, color: Palette.textSecondary, ...BodyFont.medium, fontVariant: ['tabular-nums'] },
}));
