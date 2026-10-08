/**
 * One day of stress readings on a 24-hour axis, each point coloured against the person's usual.
 *
 * The colours are the server's (`utils/stressLevel.js`): green calmer than usual, red more
 * stressed than usual, neutral near it. They are never the only signal — the legend under the
 * chart names each with a glyph, and the screen-reader label counts them — because green and
 * red are the pair a colour-blind reader cannot separate.
 *
 * Fixed 0–100 vertical scale, the vendor's, so two days drawn on this chart are comparable.
 * Before there is a usual (five earlier days) nothing is coloured and no dashed line is drawn.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { BodyFont, Spacing, tone } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { LEVEL_ICON, type StressLevel, type StressLevelKey, type StressReading } from '@/lib/stress';

const PAD = { left: 26, right: 8, top: 10, bottom: 18 };
const MINUTES = 24 * 60;

const minuteOfDay = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
};

export const StressDayChart = ({ readings, baseline, levels, width, height = 150 }: {
    readings: StressReading[];
    baseline: number | null;
    levels: StressLevel[];
    width: number;
    height?: number;
}) => {
    const Palette = usePalette();
    const styles = useStyles();

    const colourFor = (key: StressLevelKey | null) => {
        const hex = levels.find((l) => l.key === key)?.colour;
        return hex ? tone(hex) : Palette.textSecondary;
    };

    const top = Math.max(100, ...readings.map((r) => r.value));
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const x = (minute: number) => PAD.left + (minute / MINUTES) * plotW;
    const y = (value: number) => PAD.top + plotH - (value / top) * plotH;

    const points = useMemo(
        () => readings.map((r) => ({ ...r, px: x(minuteOfDay(r.at)), py: y(r.value) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [readings, width, height, top],
    );
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');

    const counts = readings.reduce<Record<string, number>>((acc, r) => {
        acc[r.level ?? 'none'] = (acc[r.level ?? 'none'] ?? 0) + 1;
        return acc;
    }, {});
    const spoken = `${readings.length} reading${readings.length === 1 ? '' : 's'}`
        + (baseline != null
            ? `: ${counts.below ?? 0} calmer than usual, ${counts.usual ?? 0} about usual, ${counts.above ?? 0} more stressed than usual.`
            : '. Still learning your usual.');

    return (
        <View>
            <View accessible accessibilityLabel={spoken}>
                <Svg width={width} height={height}>
                    {[0, 50, 100].map((v) => (
                        <React.Fragment key={v}>
                            <Line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={Palette.borderLight} strokeWidth={1} />
                            <SvgText x={PAD.left - 6} y={y(v) + 3} fontSize={9} fill={Palette.textMuted} textAnchor="end">{v}</SvgText>
                        </React.Fragment>
                    ))}
                    {[0, 6, 12, 18, 24].map((h) => (
                        <SvgText key={h} x={x(h * 60)} y={height - 4} fontSize={9} fill={Palette.textMuted} textAnchor="middle">
                            {String(h % 24).padStart(2, '0')}
                        </SvgText>
                    ))}

                    {baseline != null && (
                        <>
                            <Line
                                x1={PAD.left} x2={width - PAD.right} y1={y(baseline)} y2={y(baseline)}
                                stroke={Palette.textSecondary} strokeWidth={1} strokeDasharray="4 4"
                            />
                            <SvgText x={width - PAD.right} y={y(baseline) - 4} fontSize={9} fill={Palette.textSecondary} textAnchor="end">
                                {`usual ${baseline}`}
                            </SvgText>
                        </>
                    )}

                    {points.length > 1 && <Path d={line} stroke={Palette.borderStrong} strokeWidth={1.5} fill="none" />}
                    {points.map((p) => (
                        <Circle key={p.at} cx={p.px} cy={p.py} r={4} fill={colourFor(p.level)} stroke={Palette.background} strokeWidth={1} />
                    ))}
                </Svg>
            </View>

            {baseline != null && (
                <View style={styles.legend}>
                    {levels.map((l) => (
                        <View key={l.key} style={styles.legendItem}>
                            <Ionicons name={LEVEL_ICON[l.key] as never} size={13} color={colourFor(l.key)} />
                            <Text style={styles.legendText}>{l.label}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendText: { ...BodyFont.regular, fontSize: 11, color: Palette.textSecondary },
}));
