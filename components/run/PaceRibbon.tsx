/**
 * The last five minutes of pace as a ribbon under the live numbers.
 *
 * **Faster is higher.** A pace number shrinks as somebody speeds up, so a plotted pace would
 * dip for effort and read backwards; this plots speed and labels nothing, because it is a
 * shape to glance at, not a chart to read. With a pace goal, the ghost's pace is a band
 * across it — above the band is ahead.
 *
 * Monotone cubic, clamped (Fritsch–Carlson) like the dashboard's chart, so a smoothed curve
 * never swings past a value that was actually run.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
    /** Seconds per km, oldest first. */
    paces: number[];
    targetSecPerKm?: number | null;
    width: number;
    height?: number;
    stroke: string;
    band: string;
}

const monotonePath = (xs: number[], ys: number[]) => {
    const n = xs.length;
    if (n < 2) return '';
    const dx = xs.slice(1).map((x, i) => x - xs[i]);
    const m = ys.slice(1).map((y, i) => (y - ys[i]) / (dx[i] || 1));
    const t = new Array<number>(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i += 1) {
        if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
        const a = t[i] / m[i];
        const b = t[i + 1] / m[i];
        const s = a * a + b * b;
        if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${xs[0]},${ys[0]}`;
    for (let i = 0; i < n - 1; i += 1) {
        const h = dx[i] / 3;
        d += ` C${xs[i] + h},${ys[i] + t[i] * h} ${xs[i + 1] - h},${ys[i + 1] - t[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
    }
    return d;
};

export default function PaceRibbon({ paces, targetSecPerKm, width, height = 40, stroke, band }: Props) {
    if (paces.length < 3 || width <= 0) return <View style={{ height }} />;
    // Thin to at most ~60 points: the ribbon is 300 pt wide, not a table.
    const step = Math.max(1, Math.floor(paces.length / 60));
    const sampled = paces.filter((_, i) => i % step === 0);
    const speeds = sampled.map((p) => 1000 / p);
    const target = targetSecPerKm ? 1000 / targetSecPerKm : null;
    const all = target ? [...speeds, target] : speeds;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const span = Math.max(0.3, hi - lo);
    const pad = 4;
    const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
    const xs = sampled.map((_, i) => (i / (sampled.length - 1)) * width);
    const ys = speeds.map(y);
    const line = monotonePath(xs, ys);

    return (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
                        <Stop offset="1" stopColor={stroke} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                {target != null && <Rect x={0} y={y(target) - 1.5} width={width} height={3} rx={1.5} fill={band} />}
                <Path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#ribbon)" />
                <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
        </View>
    );
}
