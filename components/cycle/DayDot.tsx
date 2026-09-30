/**
 * One day of a cycle, as a circle with its date in it. The calendar and the week strip both
 * draw this, so a Tuesday cannot look like a period day in one and a predicted day in the other.
 *
 * Four rules, in the order they are applied:
 *
 * 1. **What happened is filled; what might happen is outlined.** A logged period day is a solid
 *    rose disc. A predicted one is a dashed rose ring, and a day inside the start window but
 *    outside the likely period is a fainter dotted ring. The difference between a measurement
 *    and a forecast is the difference between a fill and an outline — the rule `ForecastChart`
 *    holds with its dashed projection.
 * 2. **The fertile window is a different hue, not a lighter rose.** Teal, so nobody is asked
 *    to tell two pinks apart to learn which days are which — least of all somebody colour-blind.
 * 3. **Today is a mark under the circle, not a fill.** Today can also be a period day, and a
 *    fill for "today" would hide the fact that mattered.
 * 4. **A past day with nothing on it is plain.** Not grey, not crossed: an unlogged Tuesday is
 *    not a missed one.
 *
 * Drawn with SVG rather than a dashed `borderStyle`, which Android renders as solid on a
 * rounded view — the predicted ring would silently become a logged-looking one.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { formatDayLong, flowLabel, type DayMark } from '@/lib/cycle';

interface Props {
    mark: DayMark;
    size?: number;
    /** Edit mode: what this day will become once saved. Overrides the logged state. */
    pending?: 'add' | 'remove' | null;
    selected?: boolean;
    onPress?: () => void;
    disabled?: boolean;
}

/** What a screen reader says for a day, from the same facts the circle is drawn from. */
export const describeMark = (m: DayMark): string => {
    const parts = [formatDayLong(m.day)];
    if (m.today) parts.push('today');
    if (m.period) parts.push(`period, ${flowLabel(m.flow).toLowerCase()}`);
    else if (m.flow === 'spotting') parts.push('spotting');
    if (m.between) parts.push('bleeding between periods');
    if (m.predicted === 'period') parts.push('predicted period');
    if (m.predicted === 'window') parts.push('period could start');
    if (m.ovulation) parts.push('estimated ovulation');
    else if (m.fertile) parts.push('estimated fertile window');
    if (m.ovulationConfirmed) parts.push('ovulation confirmed by temperature');
    if (m.symptoms) parts.push(`${m.symptoms} symptom${m.symptoms === 1 ? '' : 's'}`);
    return parts.join(', ');
};

export function DayDot({ mark, size = 34, pending = null, selected = false, onPress, disabled }: Props) {
    const Palette = usePalette();
    const styles = useStyles();

    const logged = pending === 'add' || (mark.period && pending !== 'remove');
    const r = size / 2 - 1.5;
    const c = size / 2;

    let fill = 'transparent';
    let text = mark.future ? Palette.textMuted : Palette.text;
    let ring: { color: string; dash?: string; width: number } | null = null;

    if (logged) {
        fill = Palette.cycleFill;
        text = Palette.white;
    } else if (mark.between) {
        fill = Palette.cyclePale;
        text = Palette.text;
    } else if (mark.predicted === 'period') {
        ring = { color: Palette.cycle, dash: '3 3', width: 1.5 };
        text = Palette.cycle;
    } else if (mark.predicted === 'window') {
        ring = { color: Palette.cycle, dash: '1 3', width: 1.2 };
    } else if (mark.ovulation) {
        fill = Palette.tealSurface;
        ring = { color: Palette.teal, width: 1.5 };
        text = Palette.teal;
    } else if (mark.fertile) {
        fill = Palette.tealSurface;
        text = Palette.teal;
    }
    if (selected) ring = { color: Palette.primary, width: 2 };

    const extra = !logged && (mark.flow === 'spotting' || mark.symptoms > 0 || mark.note || mark.mood !== null);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || !onPress}
            style={styles.wrap}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={describeMark(mark)}
            accessibilityState={{ selected, disabled: disabled || !onPress }}
        >
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={size} height={size} style={{ position: 'absolute' }}>
                    <Circle cx={c} cy={c} r={r} fill={fill} />
                    {ring ? (
                        <Circle
                            cx={c} cy={c} r={r}
                            fill="none"
                            stroke={ring.color}
                            strokeWidth={ring.width}
                            strokeDasharray={ring.dash}
                            strokeLinecap="round"
                        />
                    ) : null}
                </Svg>
                <Text style={[styles.date, { color: text }, (mark.today || logged) && styles.dateStrong]}>
                    {Number(mark.day.slice(-2))}
                </Text>
                {mark.ovulationConfirmed ? <View style={[styles.confirmed, { borderColor: Palette.background }]} /> : null}
            </View>
            <View style={styles.under}>
                {mark.today ? <View style={styles.todayBar} /> : null}
                {!mark.today && extra ? (
                    <View style={[styles.dot, mark.flow === 'spotting' && styles.dotSpotting]} />
                ) : null}
            </View>
        </Pressable>
    );
}

const useStyles = makeStyles((Palette) => ({
    wrap: { alignItems: 'center', justifyContent: 'center', gap: 3 },
    date: { fontSize: 13, ...BodyFont.medium },
    dateStrong: { fontFamily: Fonts.semibold },
    under: { height: 4, alignItems: 'center', justifyContent: 'center' },
    todayBar: { width: 14, height: 3, borderRadius: 2, backgroundColor: Palette.primaryFill },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Palette.textMuted },
    dotSpotting: { backgroundColor: Palette.cycle },
    confirmed: {
        position: 'absolute', right: 0, top: 0, width: 9, height: 9, borderRadius: 5,
        backgroundColor: Palette.teal, borderWidth: 1.5,
    },
}));
