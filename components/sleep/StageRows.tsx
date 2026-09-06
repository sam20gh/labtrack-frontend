/**
 * The stage breakdown — `Design/sleep.svg` frames 10, 12 and 28.
 *
 * Two components over the same table, because the design draws the same four stages twice on
 * the same screen: as a donut with a total in the middle, and as rows with minutes on the
 * right. They share `STAGE_META` in `lib/sleep.ts` so the colour a stage is in the ring is
 * the colour it is in the row beneath it.
 *
 * **A stage nobody measured is written as "not reported", never as 0m.** A tracker that
 * gives only a total is not evidence that somebody got no deep sleep, and a row reading
 * "Deep 0m" is the app telling them something about their body that nothing measured. The
 * server sends `null` for exactly this and the rows honour it.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Palette, Fonts, Spacing } from '@/constants/theme';
import { STAGE_META, STAGE_ORDER, formatMinutes, type SleepStageKey } from '@/lib/sleep';

export interface StageRow {
    stage: SleepStageKey;
    minutes: number | null;
    share?: number | null;
}

/**
 * The donut. One arc per stage, sized by its share of the measured time.
 *
 * Arcs are laid end to end by accumulating `strokeDashoffset`, which is why the shares have
 * to add to 100 — the server computes them over the stages that were *reported* rather than
 * over an assumed four, so a source giving two stages still fills the ring.
 */
export function StageDonut({
    rows, totalLabel, caption, size = 168,
}: {
    rows: StageRow[];
    totalLabel: string;
    caption?: string;
    size?: number;
}) {
    const stroke = 18;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const arcs = rows
        .filter((r) => Number.isFinite(r.share as number) && (r.share as number) > 0)
        .map((row) => {
            const length = (circumference * (row.share as number)) / 100;
            const arc = { stage: row.stage, length, offset };
            offset += length;
            return arc;
        });

    return (
        <View style={[styles.donutWrap, { width: size, height: size }]}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
                    <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={Palette.borderLight} strokeWidth={stroke} fill="none"
                    />
                    {arcs.map((arc) => (
                        <Circle
                            key={arc.stage}
                            cx={size / 2} cy={size / 2} r={radius}
                            stroke={STAGE_META[arc.stage].tint}
                            strokeWidth={stroke}
                            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                            strokeDashoffset={-arc.offset}
                            fill="none"
                        />
                    ))}
                </G>
            </Svg>
            <View style={styles.donutCentre}>
                <Text style={styles.donutTotal}>{totalLabel}</Text>
                {caption ? <Text style={styles.donutCaption}>{caption}</Text> : null}
            </View>
        </View>
    );
}

/**
 * The rows under it.
 *
 * `description` is on by default in the night detail, where somebody is asking what REM
 * actually is, and off in a card where four sentences would outweigh the chart above them.
 */
export function StageRows({
    rows, showDescription = false,
}: {
    rows: StageRow[];
    showDescription?: boolean;
}) {
    const ordered = STAGE_ORDER
        .map((stage) => rows.find((r) => r.stage === stage))
        .filter(Boolean) as StageRow[];

    return (
        <View style={styles.rows}>
            {ordered.map((row) => {
                const meta = STAGE_META[row.stage];
                const measured = Number.isFinite(row.minutes as number);
                return (
                    <View key={row.stage} style={styles.row}>
                        <View style={styles.rowHead}>
                            <View style={[styles.dot, { backgroundColor: meta.tint }]} />
                            <Text style={styles.rowLabel}>{meta.label}</Text>
                            <Text style={[styles.rowValue, !measured && styles.rowValueMissing]}>
                                {/* Not "0m": a stage nobody measured is unknown, not absent. */}
                                {measured ? formatMinutes(row.minutes) : 'Not reported'}
                            </Text>
                        </View>
                        {showDescription ? (
                            <Text style={styles.rowDescription}>{meta.description}</Text>
                        ) : null}
                        {measured && Number.isFinite(row.share as number) ? (
                            <View style={styles.track}>
                                <View
                                    style={[
                                        styles.fill,
                                        { width: `${Math.min(100, row.share as number)}%`, backgroundColor: meta.tint },
                                    ]}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    donutWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    donutCentre: { alignItems: 'center' },
    donutTotal: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text },
    donutCaption: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    rows: { gap: Spacing.md },
    row: { gap: 6 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    dot: { width: 9, height: 9, borderRadius: 5 },
    rowLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: Palette.text },
    rowValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    rowValueMissing: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },
    rowDescription: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginLeft: 17 },
    track: {
        height: 6, borderRadius: 3, marginLeft: 17,
        backgroundColor: Palette.borderLight, overflow: 'hidden',
    },
    fill: { height: 6, borderRadius: 3 },
});

export default StageRows;
