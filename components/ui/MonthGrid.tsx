/**
 * A month of days in seven columns — the frame, not the marks.
 *
 * Four screens drew their own month grid before this existed (`ActivityCalendar`,
 * `HydrationCalendar`, `DirectionCalendar` and the medication schedule), each with its own
 * copy of `shiftMonth` and `monthTitle` and each slightly different in how it laid the first
 * of the month under its weekday. This is the shared frame: the header with its two chevrons,
 * the weekday row, the leading and trailing blanks. What a day *means* is the caller's, drawn
 * through `renderDay`, because a ring of exercise minutes, a hydration tick and a period day
 * are three different marks and no prop list could anticipate a fourth.
 *
 * Its callers: the cycle calendar, `ActivityCalendar`, `HydrationCalendar` and the medication
 * schedule's month view — each moved over and checked on a device, because a calendar that
 * shifts a date by one column is a bug nothing but a screenshot catches. `DirectionCalendar`
 * is deliberately not one: it draws weeks of a forecast with a date label per row, not a month.
 *
 * Weeks start on Sunday, matching every existing grid in the app. `maxMonth` caps walking
 * forward — the activity grid has nothing to show in a future month, the cycle grid has
 * predictions to show in the next few.
 */
import React from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM` shifted by whole months, without tripping over month lengths. */
export const shiftMonth = (month: string, delta: number): string => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export const monthTitle = (month: string): string => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });
};

/** The month's days with leading and trailing blanks, a multiple of seven long. */
export const monthCells = (month: string): (string | null)[] => {
    const [year, mon] = month.split('-').map(Number);
    const offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
    const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const cells: (string | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length }, (_, i) => `${month}-${pad(i + 1)}`),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
};

interface Props {
    month: string;
    onChangeMonth: (month: string) => void;
    renderDay: (day: string) => React.ReactNode;
    /** The latest month the forward chevron may reach. Omit for no limit. */
    maxMonth?: string;
    /** The earliest month the back chevron may reach. Omit for no limit. */
    minMonth?: string;
    /** Height of one row, or `'auto'` for cells that size themselves. Width is always a seventh. */
    cellHeight?: number | 'auto';
    /** Space between rows. */
    rowGap?: number;
    /**
     * `card` draws its own border and padding; `bare` draws none, for a grid that already sits
     * inside a card of its own (the hydration screen).
     */
    variant?: 'card' | 'bare';
    loading?: boolean;
    /** Drawn under the grid — a legend, usually. */
    footer?: React.ReactNode;
    style?: ViewStyle;
}

export function MonthGrid({
    month, onChangeMonth, renderDay, maxMonth, minMonth, cellHeight = 48, rowGap = 0, variant = 'card',
    loading, footer, style,
}: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const cells = monthCells(month);
    const canBack = !minMonth || month > minMonth;
    const canForward = !maxMonth || month < maxMonth;

    return (
        <View style={[variant === 'card' ? styles.card : styles.bare, style]}>
            <View style={[styles.head, variant === 'bare' && styles.headBare]}>
                <Pressable
                    onPress={() => canBack && onChangeMonth(shiftMonth(month, -1))}
                    disabled={!canBack}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    accessibilityState={{ disabled: !canBack }}
                >
                    <Ionicons name="chevron-back" size={18} color={canBack ? Palette.textSecondary : Palette.border} />
                </Pressable>
                <Text style={styles.title} accessibilityRole="header">{monthTitle(month)}</Text>
                <Pressable
                    onPress={() => canForward && onChangeMonth(shiftMonth(month, 1))}
                    disabled={!canForward}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    accessibilityState={{ disabled: !canForward }}
                >
                    <Ionicons name="chevron-forward" size={18} color={canForward ? Palette.textSecondary : Palette.border} />
                </Pressable>
            </View>

            <View style={styles.week}>
                {WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
            </View>

            <View style={[styles.grid, { rowGap }, loading && styles.gridLoading]}>
                {cells.map((day, i) => (
                    <View key={day ?? `blank${i}`} style={[styles.cell, cellHeight !== 'auto' && { height: cellHeight }]}>
                        {day ? renderDay(day) : null}
                    </View>
                ))}
            </View>

            {footer}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: Radius.lg,
        backgroundColor: Palette.background,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    bare: { gap: 0 },
    headBare: { paddingHorizontal: 0 },
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    title: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    week: { flexDirection: 'row', marginBottom: Spacing.sm },
    weekday: { flex: 1, textAlign: 'center', fontSize: 11, ...BodyFont.medium, color: Palette.textMuted },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    gridLoading: { opacity: 0.45 },
    cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center' },
}));
