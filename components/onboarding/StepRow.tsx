/**
 * One step of the first-run journey: what it is, where it stands, and the way in.
 *
 * Drawn by the welcome hub and the home journey card, so a step reads the same in both. The
 * status mark carries the state; colour only repeats it — a green tick for done, a clock for
 * waiting on a parcel, a muted dash for "not now". Purple is kept for the action, which is the
 * rule the rest of the app follows: purple means you can act here.
 *
 * "Not now" is offered on a step that is still the person's to do, and only there. Skipping
 * blocks nothing — the card keeps the step, and "Add it" brings it back.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { STEP_ICON, type JourneyStep } from '@/lib/onboarding';

interface Props {
    step: JourneyStep;
    index: number;
    onOpen: (route: string) => void;
    onSkip?: () => void;
    onResume?: () => void;
    /** Hub rows are roomy; card rows are compact and drop the per-row skip. */
    compact?: boolean;
    busy?: boolean;
}

export function StepRow({ step, index, onOpen, onSkip, onResume, compact, busy }: Props) {
    const Palette = usePalette();
    const styles = useStyles();

    const done = step.status === 'done';
    const skipped = step.status === 'skipped';
    const waiting = step.status === 'waiting';
    const actionable = !!step.action && !done;

    const mark = done
        ? <Ionicons name="checkmark" size={16} color={Palette.white} />
        : waiting
            ? <Ionicons name="time-outline" size={16} color={Palette.textSecondary} />
            : skipped
                ? <Ionicons name="remove" size={16} color={Palette.textMuted} />
                : <Text style={styles.markNumber}>{index + 1}</Text>;

    const body = (
        <>
            <View style={[styles.mark, done && styles.markDone, (waiting || skipped) && styles.markQuiet]}>
                {mark}
            </View>
            <View style={styles.text}>
                <View style={styles.titleRow}>
                    <Ionicons name={STEP_ICON[step.key] as any} size={14} color={Palette.textSecondary} />
                    <Text style={[styles.title, skipped && styles.titleMuted]} numberOfLines={1}>{step.title}</Text>
                </View>
                <Text style={styles.detail} numberOfLines={compact ? 1 : 2}>{step.detail}</Text>
                {!compact && skipped && onResume ? (
                    <TouchableOpacity onPress={onResume} hitSlop={8} disabled={busy} accessibilityRole="button">
                        <Text style={styles.link}>Add it back</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            {actionable ? (
                <View style={[styles.cta, (skipped || waiting) && styles.ctaQuiet]}>
                    <Text style={[styles.ctaText, (skipped || waiting) && styles.ctaTextQuiet]} numberOfLines={1}>
                        {step.action!.label}
                    </Text>
                </View>
            ) : null}
        </>
    );

    return (
        <View style={[styles.row, compact && styles.rowCompact]}>
            {actionable ? (
                <TouchableOpacity
                    style={styles.press}
                    onPress={() => onOpen(step.action!.route)}
                    accessibilityRole="button"
                    accessibilityLabel={`${step.title}. ${step.detail}. ${step.action!.label}`}
                >
                    {body}
                </TouchableOpacity>
            ) : (
                <View style={styles.press} accessible accessibilityLabel={`${step.title}. ${step.detail}`}>
                    {body}
                </View>
            )}
            {!compact && onSkip && (step.status === 'todo' || step.status === 'in_progress') ? (
                <TouchableOpacity onPress={onSkip} hitSlop={8} disabled={busy} style={styles.skip} accessibilityRole="button">
                    <Text style={styles.skipText}>Not now</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    row: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.border,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
    },
    rowCompact: {
        borderWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: Spacing.sm,
        marginBottom: 0,
        backgroundColor: 'transparent',
    },
    press: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    mark: {
        width: 28, height: 28, borderRadius: 14,
        borderWidth: 1.5, borderColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    markDone: { backgroundColor: Palette.successFill, borderColor: Palette.successFill },
    markQuiet: { borderColor: Palette.borderStrong },
    markNumber: { fontSize: 13, fontFamily: Fonts.bold, color: Palette.primary },
    text: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, flexShrink: 1 },
    titleMuted: { color: Palette.textSecondary },
    detail: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 18 },
    link: { fontSize: 13, ...BodyFont.medium, color: Palette.primary, marginTop: 6 },
    cta: {
        backgroundColor: Palette.primaryFill,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
        maxWidth: 130,
    },
    ctaQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Palette.primary },
    ctaText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.white },
    ctaTextQuiet: { color: Palette.primary },
    skip: { alignSelf: 'flex-start', marginLeft: 28 + Spacing.md, marginTop: 6 },
    skipText: { fontSize: 13, ...BodyFont.regular, color: Palette.textMuted },
}));

export default StepRow;
