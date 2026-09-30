/**
 * What the marks on the cycle calendar mean. Drawn from the same colours `DayDot` uses and
 * listing only what the calendar can currently show: no fertile swatch for somebody who has
 * not switched the window on, because a key for a colour that never appears is a question.
 */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Spacing, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

function Swatch({ fill = 'transparent', stroke, dash, centre }: { fill?: string; stroke?: string; dash?: string; centre?: string }) {
    return (
        <Svg width={14} height={14}>
            <Circle cx={7} cy={7} r={5.5} fill={fill} stroke={stroke} strokeWidth={stroke ? 1.5 : 0} strokeDasharray={dash} />
            {/* The calendar draws a fertile day as a pale disc with a teal numeral; with no
                numeral to show, the swatch carries the teal as a centre dot. */}
            {centre ? <Circle cx={7} cy={7} r={2.2} fill={centre} /> : null}
        </Svg>
    );
}

export function CycleLegend({ fertile }: { fertile: boolean }) {
    const Palette = usePalette();
    const styles = useStyles();
    const items: { key: string; swatch: React.ReactNode; label: string }[] = [
        { key: 'period', swatch: <Swatch fill={Palette.cycleFill} />, label: 'Period' },
        { key: 'predicted', swatch: <Swatch stroke={Palette.cycle} dash="3 2" />, label: 'Predicted' },
        { key: 'window', swatch: <Swatch stroke={Palette.cycle} dash="1 2" />, label: 'Could start' },
    ];
    if (fertile) {
        items.push({ key: 'fertile', swatch: <Swatch fill={Palette.tealSurface} centre={Palette.teal} />, label: 'Fertile (estimate)' });
        items.push({ key: 'ovulation', swatch: <Swatch fill={Palette.tealSurface} stroke={Palette.teal} />, label: 'Ovulation (estimate)' });
    }
    return (
        <View style={styles.row} accessibilityRole="summary">
            {items.map((i) => (
                <View key={i.key} style={styles.item}>
                    {i.swatch}
                    <Text style={styles.label}>{i.label}</Text>
                </View>
            ))}
            <View style={styles.item}>
                <View style={styles.today} />
                <Text style={styles.label}>Today</Text>
            </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.sm, paddingTop: Spacing.md, paddingHorizontal: Spacing.sm },
    item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { fontSize: 11, ...BodyFont.regular, color: Palette.textSecondary },
    today: { width: 12, height: 3, borderRadius: 2, backgroundColor: Palette.primaryFill },
}));
