/**
 * The cycle as a dial: day 1 at the top, running clockwise, one arc per thing worth seeing.
 *
 *   - rose, solid    — the period, as logged (or as usually long, before one is logged)
 *   - rose, pale     — the window the next period is likely to start in
 *   - teal           — the estimated fertile window, only when switched on
 *   - violet marker  — today
 *
 * The dial's circumference is the expected cycle plus its spread, so the start window always
 * fits on the ring rather than wrapping past day 1 into the period it predicts. Past that —
 * somebody is late — the marker stops at the end of the ring and the words in the middle say
 * how late; an arc cannot honestly draw "further than predicted".
 *
 * With nothing to predict from there is just the track and the words: an empty ring is the
 * honest picture of a cycle nobody has logged yet.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { usePalette } from '@/hooks/useTheme';
import { diffDays, type CycleReading } from '@/lib/cycle';

interface Props {
    reading: CycleReading;
    size: number;
    children?: React.ReactNode;
}

const STROKE = 14;

const polar = (c: number, r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
};

/** An arc from the start of day `a` to the end of day `b` (1-based) on a ring of `total` days. */
const arc = (c: number, r: number, total: number, a: number, b: number) => {
    const step = 360 / total;
    const from = -90 + (a - 1) * step + 1.2;
    const to = -90 + b * step - 1.2;
    if (to <= from) return null;
    const p1 = polar(c, r, from);
    const p2 = polar(c, r, to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
};

export function CycleRing({ reading, size, children }: Props) {
    const Palette = usePalette();
    const c = size / 2;
    const r = c - STROKE / 2 - 4;

    const p = reading.prediction;
    const start = reading.lastStart;
    const total = p ? p.cycleLength + p.spread : Math.max(28, (reading.cycleDay ?? 0) + 3);
    const clampDay = (d: number) => Math.max(1, Math.min(total, d));

    const arcs: { d: string; color: string; width: number }[] = [];
    if (start) {
        // The period: what was logged, reaching on to where it will probably stop.
        const periodEnd = reading.currentPeriod
            ? diffDays(start, reading.currentPeriod.expectedEnd) + 1
            : reading.periodLength.length;
        const d = arc(c, r, total, 1, clampDay(periodEnd));
        if (d) arcs.push({ d, color: Palette.cycle, width: STROKE });

        if (p) {
            const w = arc(c, r, total, clampDay(p.cycleLength - p.spread + 1), total);
            if (w) arcs.push({ d: w, color: Palette.cyclePale, width: STROKE });
        }
        const fertile = reading.next?.fertile;
        if (fertile) {
            const a = diffDays(start, fertile.from) + 1;
            const b = diffDays(start, fertile.to) + 1;
            if (a >= 1 && b <= total) {
                const f = arc(c, r, total, a, b);
                if (f) arcs.push({ d: f, color: Palette.teal, width: STROKE - 4 });
            }
        }
    }

    const marker = start && reading.cycleDay
        ? polar(c, r, -90 + ((clampDay(reading.cycleDay) - 0.5) / total) * 360)
        : null;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute' }} accessible={false}>
                <Circle cx={c} cy={c} r={r} fill="none" stroke={Palette.borderSlate} strokeWidth={STROKE} />
                {arcs.map((a, i) => (
                    <Path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={a.width} strokeLinecap="round" />
                ))}
                {marker ? (
                    <Circle
                        cx={marker.x} cy={marker.y} r={STROKE / 2 + 3}
                        fill={Palette.primaryFill} stroke={Palette.background} strokeWidth={3}
                    />
                ) : null}
            </Svg>
            <View style={{ width: size - STROKE * 2 - 24, alignItems: 'center' }}>{children}</View>
        </View>
    );
}
