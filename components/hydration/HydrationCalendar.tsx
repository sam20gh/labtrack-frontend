/**
 * The month grid from `Design/hydration.svg` frame 3 — a date, and under it a mark saying
 * how that day went.
 *
 * Three marks, not two, and the third is the whole point. The design draws a green tick for
 * a day that met its goal, a red cross for one that fell short, and a **plain empty ring**
 * for a day with nothing on it. Collapsing the last two into one cross is the obvious
 * simplification and it is wrong: a day nobody logged is a day this app measured nothing on,
 * and marking it as failure turns "I forgot to open the app on holiday" into a fortnight of
 * dehydration on somebody's health record. That is the distinction `levelFor` makes on the
 * server by returning null rather than `minimal`, and `dayStatus` carries it here.
 *
 * A future date is dimmed and inert for the same reason `ActivityCalendar` dims one: drawing
 * the rest of the month like a missed Tuesday invents three weeks of failure every time
 * somebody opens this on the 5th.
 *
 * Each day is judged against **its own** target, which is why the series carries one per row.
 * The target moves with body mass and recorded activity, so grading a month against today's
 * figure would restage every day in it whenever somebody weighed themselves.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, BodyFont, tone } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { MonthGrid } from '@/components/ui/MonthGrid';
import { dayStatus, type DayStatus } from '@/lib/hydration';
import type { SeriesPoint } from '@/lib/metrics';

function Mark({ status }: { status: DayStatus }) {
    const Palette = usePalette();
    const styles = useStyles();
    if (status === 'met') {
        return (
            <View style={[styles.mark, styles.markMet]}>
                <Ionicons name="checkmark" size={13} color={Palette.white} />
            </View>
        );
    }
    if (status === 'short') {
        return (
            <View style={[styles.mark, styles.markShort]}>
                <Ionicons name="close" size={13} color={Palette.white} />
            </View>
        );
    }
    // Nothing logged, or a day still to come. Same empty ring, because neither is a verdict.
    return <View style={[styles.mark, styles.markEmpty, status === 'future' && styles.markFuture]} />;
}

interface Props {
    month: string;
    series: SeriesPoint[];
    /** Local today, so tomorrow is never drawn as a miss. */
    today: string;
    onChangeMonth: (month: string) => void;
    onSelect?: (day: string) => void;
}

/**
 * The month frame is `MonthGrid`'s, `bare` because the water screen already draws the card
 * around it. What is drawn here is each day: its date and its mark, and today boxed.
 */
export function HydrationCalendar({ month, series, today, onChangeMonth, onSelect }: Props) {
    const styles = useStyles();
    const byDay = useMemo(() => new Map(series.map((p) => [p.day, p])), [series]);

    return (
        <MonthGrid
            month={month}
            onChangeMonth={onChangeMonth}
            maxMonth={today.slice(0, 7)}
            variant="bare"
            cellHeight="auto"
            rowGap={Spacing.xs}
            renderDay={(day) => {
                const point = byDay.get(day);
                // A day outside the fetched window is "nothing known", which draws the
                // same as "nothing logged" — an empty ring claims nothing either way.
                const status = point ? dayStatus(point, today) : (day > today ? 'future' : 'none');
                const isToday = day === today;

                return (
                    <Pressable
                        disabled={status === 'future' || !onSelect}
                        onPress={() => onSelect?.(day)}
                        accessibilityRole={onSelect ? 'button' : undefined}
                        accessibilityLabel={`${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}: ${LABELS[status]}`}
                    >
                        <View style={[styles.inner, isToday && styles.innerToday]}>
                            <Text style={[styles.date, status === 'future' && styles.dateFuture]}>
                                {Number(day.slice(-2))}
                            </Text>
                            <Mark status={status} />
                        </View>
                    </Pressable>
                );
            }}
        />
    );
}

const LABELS: Record<DayStatus, string> = {
    met: 'target met',
    short: 'under target',
    none: 'nothing logged',
    future: 'still to come',
};

const MARK = 22;

const useStyles = makeStyles((Palette) => ({
    inner: {
        alignItems: 'center', gap: 5,
        paddingVertical: 5, paddingHorizontal: 4,
        borderRadius: Radius.md,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    // The design boxes today rather than filling it, so the day's own mark still reads.
    innerToday: { borderColor: Palette.primary },

    date: { ...BodyFont.medium, fontSize: 13, color: Palette.text },
    dateFuture: { color: Palette.textMuted },

    mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
    markMet: { backgroundColor: tone('#22C55E') },
    markShort: { backgroundColor: tone('#EF4444') },
    markEmpty: { borderWidth: 1.5, borderColor: Palette.textSecondary },
    markFuture: { borderColor: Palette.border },
}));
