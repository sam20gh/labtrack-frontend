/**
 * The last seven days as stacked columns of energy: carbohydrate at the base, protein in
 * the middle, fat on top.
 *
 * Each column is as tall as the calories the day recorded, and the segments split that
 * height by where the energy came from (4 kcal/g carbohydrate and protein, 9 kcal/g fat) —
 * so a day that looks fat-heavy is a day where fat supplied the calories, not merely the
 * grams. Grams alone would draw a 30g fat day as smaller than a 60g protein one when it
 * carries more energy.
 *
 * Four rules the chart keeps:
 *
 * 1. **A day with nothing logged is a ghost, never a zero.** It draws a dashed outline, the
 *    same rule the insight screen's weekday bars follow. A zero-height column says somebody
 *    ate nothing; an empty day only says nobody wrote it down.
 * 2. **The goal line is a reference, not a verdict.** It is drawn when a target exists and
 *    the headline states the distance to it in neutral violet — no green for under, no red
 *    for over. Eating 200 kcal over a derived target is not a finding.
 * 3. **Tapping a column selects it; it does not navigate.** The whole point is comparing
 *    days, and a tap that leaves the screen ends the comparison. The breakdown below
 *    follows the selection.
 * 4. **The grow-in animation respects Reduce Motion.** It is decoration, and is skipped
 *    rather than slowed for anyone who has asked the phone for less of it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, Spacing, Radius, Shadow, BodyFont, schemed } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import type { NutritionInsight } from '@/types/api';

type MacroKey = 'carbs' | 'protein' | 'fat';

/** Energy per gram. Fibre is folded into carbohydrate, as the label on the packet does. */
const KCAL_PER_GRAM: Record<MacroKey, number> = { carbs: 4, protein: 4, fat: 9 };

/** Bottom to top. Carbohydrate is the base because it is usually most of the column. */
const STACK: { key: MacroKey; label: string; colors: [string, string] }[] = schemed((Palette) => ([
    { key: 'carbs', label: 'Carbs', colors: [Palette.flameLight, Palette.flame] },
    { key: 'protein', label: 'Protein', colors: [Palette.primaryLight, Palette.primary] },
    { key: 'fat', label: 'Fat', colors: [Palette.macroFat, Palette.macroFatDeep] },
]));

const CHART_HEIGHT = 168;
const COLUMN_WIDTH = 22;
/** Headroom so the tallest column never touches the top of the plot. */
const HEADROOM = 1.12;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DayColumn {
    key: string;
    date: Date;
    isToday: boolean;
    logged: boolean;
    calories: number;
    mealCount: number;
    grams: Record<MacroKey, number>;
    kcal: Record<MacroKey, number>;
}

/** `YYYY-MM-DD` built from local fields, matching how the server files `MealLog.day`. */
const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildWeek(insight: NutritionInsight): DayColumn[] {
    const [y, m, d] = insight.to.split('-').map(Number);
    const byDay = new Map(insight.days.map((row) => [row.day, row]));

    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(y, m - 1, d - (6 - i));
        const key = dayKey(date);
        const row = byDay.get(key);
        const grams = {
            carbs: row?.totals.carbs ?? 0,
            protein: row?.totals.protein ?? 0,
            fat: row?.totals.fat ?? 0,
        };
        return {
            key,
            date,
            isToday: i === 6,
            logged: Boolean(row && row.mealCount > 0),
            calories: Math.round(row?.totals.calories ?? 0),
            mealCount: row?.mealCount ?? 0,
            grams,
            kcal: {
                carbs: grams.carbs * KCAL_PER_GRAM.carbs,
                protein: grams.protein * KCAL_PER_GRAM.protein,
                fat: grams.fat * KCAL_PER_GRAM.fat,
            },
        };
    });
}

const macroEnergy = (day: DayColumn) => day.kcal.carbs + day.kcal.protein + day.kcal.fat;

interface Props {
    insight: NutritionInsight;
}

export function MacroWeekChart({ insight }: Props) {
    const styles = useStyles();
    const week = useMemo(() => buildWeek(insight), [insight]);
    const target = insight.calorieTarget && insight.calorieTarget > 0 ? insight.calorieTarget : null;

    // Today if it has anything on it — that is what somebody opening the tracker is asking
    // about — otherwise the most recent day that does.
    const defaultIndex = useMemo(() => {
        for (let i = week.length - 1; i >= 0; i--) if (week[i].logged) return i;
        return week.length - 1;
    }, [week]);
    const [selected, setSelected] = useState(defaultIndex);
    useEffect(() => setSelected(defaultIndex), [defaultIndex]);

    const peak = Math.max(target ?? 0, ...week.map((w) => w.calories), 1) * HEADROOM;

    // One value per column, staggered, so the week rises left to right.
    const grow = useRef(week.map(() => new Animated.Value(0))).current;
    useEffect(() => {
        let cancelled = false;
        AccessibilityInfo.isReduceMotionEnabled()
            .catch(() => false)
            .then((reduce) => {
                if (cancelled) return;
                if (reduce) {
                    grow.forEach((v) => v.setValue(1));
                    return;
                }
                grow.forEach((v) => v.setValue(0));
                Animated.stagger(55, grow.map((v) => Animated.spring(v, {
                    toValue: 1,
                    friction: 7,
                    tension: 60,
                    useNativeDriver: true,
                }))).start();
            });
        return () => { cancelled = true; };
    }, [insight, grow]);

    const day = week[selected];
    const energy = macroEnergy(day);
    const gap = target && day.logged ? Math.round(day.calories - target) : null;

    return (
        <View style={styles.card}>
            {/* The headline follows the selected column */}
            <View style={styles.head}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>
                        {day.isToday ? 'Today' : `${WEEKDAY_LONG[day.date.getDay()]} ${day.date.getDate()} ${MONTH[day.date.getMonth()]}`}
                    </Text>
                    {day.logged ? (
                        <Text style={styles.headline}>
                            {day.calories.toLocaleString()}
                            <Text style={styles.headlineUnit}> kcal</Text>
                        </Text>
                    ) : (
                        <Text style={styles.headlineEmpty}>Nothing logged</Text>
                    )}
                    {day.logged && (
                        <Text style={styles.subline}>
                            {day.mealCount} {day.mealCount === 1 ? 'meal' : 'meals'}
                        </Text>
                    )}
                </View>
                {gap != null && (
                    <View style={styles.gapPill}>
                        <Text style={styles.gapText}>
                            {gap === 0
                                ? 'On goal'
                                : `${Math.abs(gap).toLocaleString()} ${gap > 0 ? 'over' : 'under'} goal`}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.legend}>
                {STACK.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                        <LinearGradient
                            colors={s.colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.legendDot}
                        />
                        <Text style={styles.legendText}>{s.label}</Text>
                    </View>
                ))}
                {target != null && (
                    <View style={styles.legendItem}>
                        <View style={styles.legendGoal}>
                            <View style={styles.dash} />
                            <View style={styles.dash} />
                        </View>
                        <Text style={styles.legendText}>Goal {Math.round(target).toLocaleString()} kcal</Text>
                    </View>
                )}
            </View>

            {/* The chart */}
            <View style={styles.plot}>
                <View style={styles.columns}>
                    {week.map((w, i) => {
                        const isSelected = i === selected;
                        const height = Math.max(10, (w.calories / peak) * CHART_HEIGHT);
                        const total = macroEnergy(w);
                        return (
                            <Pressable
                                key={w.key}
                                style={styles.column}
                                onPress={() => setSelected(i)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                accessibilityLabel={
                                    w.logged
                                        ? `${WEEKDAY_LONG[w.date.getDay()]}, ${w.calories} kilocalories: ${Math.round(w.grams.carbs)} grams carbs, ${Math.round(w.grams.protein)} grams protein, ${Math.round(w.grams.fat)} grams fat`
                                        : `${WEEKDAY_LONG[w.date.getDay()]}, nothing logged`
                                }
                            >
                                {/* The spotlight behind the selected day */}
                                <View style={[styles.spotlight, isSelected && styles.spotlightOn]} />

                                <View style={styles.track}>
                                    {w.logged ? (
                                        <Animated.View
                                            style={[
                                                styles.capsule,
                                                {
                                                    height,
                                                    opacity: isSelected ? 1 : 0.42,
                                                    transform: [{ scaleY: grow[i] }],
                                                },
                                            ]}
                                        >
                                            {total > 0 ? (
                                                // Rendered top-down: fat, protein, carbs
                                                [...STACK].reverse().map((s) => {
                                                    const share = w.kcal[s.key] / total;
                                                    if (share <= 0) return null;
                                                    return (
                                                        <LinearGradient
                                                            key={s.key}
                                                            colors={s.colors}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 0, y: 1 }}
                                                            style={[styles.segment, { flex: share }]}
                                                        />
                                                    );
                                                })
                                            ) : (
                                                // Calories with no macro breakdown: an
                                                // estimate that never carried one
                                                <View style={[styles.segment, styles.unsplit]} />
                                            )}
                                        </Animated.View>
                                    ) : (
                                        <View style={styles.ghost} />
                                    )}
                                </View>

                                <Text style={[styles.dayLetter, isSelected && styles.dayLetterOn]}>
                                    {WEEKDAY[w.date.getDay()]}
                                </Text>
                                <View style={[styles.dateBubble, w.isToday && styles.dateBubbleToday]}>
                                    <Text style={[styles.dateText, w.isToday && styles.dateTextToday]}>
                                        {w.date.getDate()}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>

                {/*
                  Drawn over the columns, faintly, so it visibly cuts through the one that
                  crosses it. Its label lives in the legend rather than at the line's end,
                  where it would sit on top of today's column.
                */}
                {target != null && (
                    <View
                        pointerEvents="none"
                        style={[styles.goal, { top: Spacing.sm + CHART_HEIGHT * (1 - target / peak) }]}
                    >
                        {Array.from({ length: 36 }, (_, i) => <View key={i} style={styles.dash} />)}
                    </View>
                )}
            </View>

            {/* Where the selected day's energy came from */}
            <View style={styles.ribbon}>
                {day.logged && energy > 0 ? (
                    STACK.map((s) => {
                        const share = day.kcal[s.key] / energy;
                        if (share <= 0) return null;
                        return (
                            <LinearGradient
                                key={s.key}
                                colors={s.colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ flex: share }}
                            />
                        );
                    })
                ) : (
                    <View style={styles.ribbonEmpty} />
                )}
            </View>

            <View style={styles.tiles}>
                {STACK.map((s) => {
                    const share = day.logged && energy > 0 ? Math.round((day.kcal[s.key] / energy) * 100) : null;
                    return (
                        <View key={s.key} style={styles.tile}>
                            <View style={styles.tileHead}>
                                <LinearGradient
                                    colors={s.colors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.swatch}
                                />
                                <Text style={styles.tileLabel}>{s.label}</Text>
                            </View>
                            <Text style={styles.tileValue}>
                                {day.logged ? Math.round(day.grams[s.key]) : '—'}
                                <Text style={styles.tileUnit}>{day.logged ? ' g' : ''}</Text>
                            </Text>
                            <Text style={styles.tileMeta}>
                                {share != null
                                    ? `${share}% · ${Math.round(day.kcal[s.key]).toLocaleString()} kcal`
                                    : 'Not logged'}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        gap: Spacing.lg,
        ...Shadow.card,
    },

    head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    eyebrow: {
        fontFamily: Fonts.semibold,
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: Palette.textSecondary,
    },
    headline: { fontFamily: Fonts.bold, fontSize: 28, color: Palette.text, marginTop: 2 },
    headlineUnit: { ...BodyFont.regular, fontSize: 14, color: Palette.textMuted },
    headlineEmpty: { fontFamily: Fonts.semibold, fontSize: 20, color: Palette.textMuted, marginTop: 4 },
    subline: { ...BodyFont.regular, fontSize: 12, color: Palette.textSecondary },
    gapPill: {
        backgroundColor: Palette.primaryTint,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    gapText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.primaryDark },

    plot: { position: 'relative' },
    goal: {
        position: 'absolute',
        left: Spacing.xs,
        right: Spacing.xs,
        height: 1.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    dash: { width: 5, height: 1.5, borderRadius: 1, backgroundColor: Palette.primaryDeep, opacity: 0.4 },

    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: Spacing.md,
        rowGap: Spacing.xs,
        marginTop: -Spacing.sm,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendGoal: { flexDirection: 'row', gap: 2 },
    legendText: { ...BodyFont.regular, fontSize: 11, color: Palette.textSecondary },

    columns: { flexDirection: 'row' },
    column: { flex: 1, alignItems: 'center', paddingTop: Spacing.sm },
    spotlight: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 3,
        right: 3,
        borderRadius: Radius.lg,
    },
    spotlightOn: { backgroundColor: Palette.primaryTint },
    track: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
    capsule: {
        width: COLUMN_WIDTH,
        borderRadius: COLUMN_WIDTH / 2,
        overflow: 'hidden',
        // Segments separated by a hairline of card white
        gap: 2,
        transformOrigin: 'bottom',
    },
    segment: { width: '100%' },
    unsplit: { flex: 1, backgroundColor: Palette.primaryPale },
    ghost: {
        width: COLUMN_WIDTH,
        height: 28,
        borderRadius: COLUMN_WIDTH / 2,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: Palette.borderStrong,
    },

    dayLetter: { ...BodyFont.medium, fontSize: 11, color: Palette.textMuted, marginTop: Spacing.sm },
    dayLetterOn: { fontFamily: Fonts.bold, color: Palette.primary },
    dateBubble: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
        marginBottom: Spacing.sm,
    },
    dateBubbleToday: { backgroundColor: Palette.primaryFill },
    dateText: { fontFamily: Fonts.semibold, fontSize: 11, color: Palette.text },
    dateTextToday: { color: Palette.white },

    ribbon: {
        flexDirection: 'row',
        height: 10,
        borderRadius: Radius.pill,
        overflow: 'hidden',
        gap: 2,
    },
    ribbonEmpty: { flex: 1, backgroundColor: Palette.borderLight },

    tiles: { flexDirection: 'row', gap: Spacing.sm },
    tile: {
        flex: 1,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.md,
        padding: Spacing.md,
        gap: 2,
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    tileLabel: { ...BodyFont.medium, fontSize: 12, color: Palette.textSecondary },
    tileValue: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text, marginTop: 2 },
    tileUnit: { ...BodyFont.regular, fontSize: 12, color: Palette.textMuted },
    tileMeta: { ...BodyFont.regular, fontSize: 10, color: Palette.textSecondary },
}));
