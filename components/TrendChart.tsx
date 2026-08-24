/**
 * Biomarker trend chart.
 *
 * Built on `react-native-svg`, which is already a dependency, rather than pulling in a
 * charting library. The requirements here are narrow — one series, one shaded band, a few
 * highlighted points — and a general-purpose library would add weight without adding
 * capability.
 *
 * The shaded band is the point of the chart. A ferritin of 26 means nothing on its own; it
 * means something against *this person's* reference range, which may itself be narrowed by
 * their genetics. Drawing the band makes "inside or outside, and by how much" immediate.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { BiomarkerFlag } from '@/types/api';

export interface TrendPoint {
    value: number;
    measuredAt: string;
    flag: BiomarkerFlag;
}

interface Props {
    points: TrendPoint[];
    /** Personal reference band. Either bound may be absent for one-sided analytes. */
    range?: { min?: number; max?: number; geneAdjusted?: boolean } | null;
    unit?: string;
    height?: number;
    width: number;
}

const FLAG_COLOR: Record<BiomarkerFlag, string> = {
    critical_low: '#DC2626',
    low: '#F59E0B',
    normal: '#10B981',
    high: '#F59E0B',
    critical_high: '#DC2626',
    unknown: '#9CA3AF',
};

const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

export default function TrendChart({ points, range, unit, height = 200, width }: Props) {
    const chart = useMemo(() => {
        if (points.length === 0) return null;

        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;

        const values = points.map((p) => p.value);
        const times = points.map((p) => new Date(p.measuredAt).getTime());

        // Include the reference band in the domain, otherwise a band sitting entirely
        // outside the data range would be clipped and the reader would not see how far
        // outside a value actually is.
        const candidates = [...values];
        if (typeof range?.min === 'number') candidates.push(range.min);
        if (typeof range?.max === 'number') candidates.push(range.max);

        let minY = Math.min(...candidates);
        let maxY = Math.max(...candidates);
        const span = maxY - minY || Math.abs(maxY) || 1;
        minY -= span * 0.12;
        maxY += span * 0.12;

        const minT = Math.min(...times);
        const maxT = Math.max(...times);
        const tSpan = maxT - minT || 1;

        const x = (t: number) => PADDING.left + ((t - minT) / tSpan) * plotW;
        const y = (v: number) => PADDING.top + plotH - ((v - minY) / (maxY - minY)) * plotH;

        // A single measurement has no line to draw; centre the point instead
        const coords = points.map((p, i) => ({
            cx: points.length === 1 ? PADDING.left + plotW / 2 : x(times[i]),
            cy: y(p.value),
            flag: p.flag,
            value: p.value,
            measuredAt: p.measuredAt,
        }));

        const path = coords.length > 1
            ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ')
            : '';

        // Band rectangle, clamped to the plot area
        let band = null;
        if (typeof range?.min === 'number' || typeof range?.max === 'number') {
            const top = typeof range.max === 'number' ? y(range.max) : PADDING.top;
            const bottom = typeof range.min === 'number' ? y(range.min) : PADDING.top + plotH;
            band = {
                y: Math.max(PADDING.top, Math.min(top, bottom)),
                height: Math.max(2, Math.abs(bottom - top)),
            };
        }

        return {
            coords, path, band, plotW, plotH,
            yTicks: [minY + (maxY - minY) * 0.05, (minY + maxY) / 2, maxY - (maxY - minY) * 0.05]
                .map((v) => ({ v, y: y(v) })),
            firstDate: points[0].measuredAt,
            lastDate: points[points.length - 1].measuredAt,
        };
    }, [points, range, width, height]);

    if (!chart) {
        return (
            <View style={[styles.empty, { height, width }]}>
                <Text style={styles.emptyText}>No measurements yet</Text>
            </View>
        );
    }

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

    const fmtValue = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

    return (
        <View>
            <Svg width={width} height={height}>
                {/* Reference band */}
                {chart.band && (
                    <Rect
                        x={PADDING.left}
                        y={chart.band.y}
                        width={chart.plotW}
                        height={chart.band.height}
                        fill="#10B981"
                        opacity={0.1}
                    />
                )}

                {/* Y gridlines and labels */}
                {chart.yTicks.map((tick, i) => (
                    <React.Fragment key={i}>
                        <Line
                            x1={PADDING.left} y1={tick.y}
                            x2={PADDING.left + chart.plotW} y2={tick.y}
                            stroke="#F3F4F6" strokeWidth={1}
                        />
                        <SvgText
                            x={PADDING.left - 6} y={tick.y + 3}
                            fontSize={9} fill="#9CA3AF" textAnchor="end"
                        >
                            {fmtValue(tick.v)}
                        </SvgText>
                    </React.Fragment>
                ))}

                {/* Series */}
                {chart.path ? (
                    <Path d={chart.path} stroke="#7C3AED" strokeWidth={2} fill="none" strokeLinejoin="round" />
                ) : null}

                {/* Points, coloured by their own verdict at the time */}
                {chart.coords.map((c, i) => (
                    <Circle
                        key={i}
                        cx={c.cx} cy={c.cy} r={c.flag === 'normal' ? 4 : 5}
                        fill={FLAG_COLOR[c.flag] ?? '#9CA3AF'}
                        stroke="#fff" strokeWidth={2}
                    />
                ))}

                {/* X axis labels: only the ends, to avoid crowding */}
                <SvgText x={PADDING.left} y={height - 8} fontSize={9} fill="#9CA3AF">
                    {fmtDate(chart.firstDate)}
                </SvgText>
                {points.length > 1 && (
                    <SvgText x={PADDING.left + chart.plotW} y={height - 8} fontSize={9} fill="#9CA3AF" textAnchor="end">
                        {fmtDate(chart.lastDate)}
                    </SvgText>
                )}
            </Svg>

            {chart.band && (
                <View style={styles.legend}>
                    <View style={styles.legendSwatch} />
                    <Text style={styles.legendText}>
                        Your normal range
                        {typeof range?.min === 'number' && typeof range?.max === 'number'
                            ? ` ${fmtValue(range.min)}–${fmtValue(range.max)}${unit ? ` ${unit}` : ''}`
                            : typeof range?.max === 'number'
                                ? ` below ${fmtValue(range.max)}${unit ? ` ${unit}` : ''}`
                                : typeof range?.min === 'number'
                                    ? ` above ${fmtValue(range.min)}${unit ? ` ${unit}` : ''}`
                                    : ''}
                    </Text>
                    {range?.geneAdjusted && (
                        <View style={styles.geneBadge}>
                            <Text style={styles.geneBadgeText}>Adjusted for your genetics</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    empty: { alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 13, color: '#9CA3AF' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    legendSwatch: { width: 14, height: 10, borderRadius: 2, backgroundColor: 'rgba(16,185,129,0.25)' },
    legendText: { fontSize: 11, color: '#6B7280' },
    geneBadge: { backgroundColor: '#F3E8FF', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    geneBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '700' },
});
