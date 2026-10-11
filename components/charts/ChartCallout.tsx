/**
 * The readout a scrubbed chart shows: which day, what it measured, and one line of context.
 *
 * Inverted ink — `text` as the fill, `background` as the type — so it reads as a layer above
 * the chart in both schemes rather than as one more card on it. The figure is the system face
 * with tabular figures: it changes on every slot a finger crosses, and proportional digits
 * would make it jitter sideways as 1s and 8s trade places. Chakra Petch has no tabular
 * figures (see **Typography** in `CLAUDE.md`).
 *
 * Positioned by `placeCallout` in `lib/chartScrub.ts`, which keeps it off the point it
 * describes. It is measured before it is shown, so it never appears in the wrong place for a
 * frame and then jumps.
 */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Line, Circle, G } from 'react-native-svg';
import { BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { placeCallout } from '@/lib/chartScrub';

interface CalloutProps {
    /** Crosshair x, in the chart's coordinates. */
    x: number;
    /** The selected point's y, or null for a slot with no value. */
    pointY: number | null;
    chartWidth: number;
    /** Where the callout's top sits when centred. */
    top?: number;
    title: string;
    value: string;
    detail?: string | null;
    /** The series' colour, as a swatch beside the figure. */
    color?: string;
}

export function ChartCallout({ x, pointY, chartWidth, top = 0, title, value, detail, color }: CalloutProps) {
    const styles = useStyles();
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const place = size
        ? placeCallout({ x, pointY, chartWidth, calloutWidth: size.w, calloutHeight: size.h, top })
        : { left: 0, top };

    return (
        <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            onLayout={(e) => {
                const { width: w, height: h } = e.nativeEvent.layout;
                if (!size || Math.abs(size.w - w) > 0.5 || Math.abs(size.h - h) > 0.5) setSize({ w, h });
            }}
            style={[styles.callout, { left: place.left, top: place.top, opacity: size ? 1 : 0 }]}
        >
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.valueRow}>
                {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
                <Text style={styles.value} numberOfLines={1}>{value}</Text>
            </View>
            {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
        </View>
    );
}

/**
 * The crosshair and the ringed point, as SVG to drop inside a chart's own `<Svg>`.
 *
 * The halo is what makes the point findable under a thumb; the ring in `background` is what
 * separates it from a line of the same colour running through it.
 */
export function ScrubMarker({
    x, top, bottom, points,
}: {
    x: number;
    top: number;
    bottom: number;
    points: { y: number; color: string; size?: 'primary' | 'secondary' }[];
}) {
    const Palette = usePalette();
    return (
        <G pointerEvents="none">
            <Line x1={x} x2={x} y1={top} y2={bottom} stroke={Palette.textMuted} strokeWidth={1} />
            {points.map((p, i) => (
                <G key={i}>
                    <Circle cx={x} cy={p.y} r={p.size === 'secondary' ? 7 : 10} fill={p.color} opacity={0.18} />
                    <Circle
                        cx={x} cy={p.y} r={p.size === 'secondary' ? 3.5 : 4.5}
                        fill={p.color} stroke={Palette.background} strokeWidth={2}
                    />
                </G>
            ))}
        </G>
    );
}

/** "Touch and drag to read a day", shown until the first scrub anywhere in the app. */
export function ScrubHint({ children = 'Touch and drag the chart to read each day' }: { children?: string }) {
    const styles = useStyles();
    return <Text style={styles.hint}>{children}</Text>;
}

const useStyles = makeStyles((Palette) => ({
    callout: {
        position: 'absolute',
        backgroundColor: Palette.text,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 84,
        maxWidth: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 10,
    },
    title: {
        fontSize: 11,
        ...BodyFont.medium,
        color: Palette.background,
        opacity: 0.72,
    },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
    swatch: { width: 8, height: 8, borderRadius: 4 },
    value: {
        fontSize: 15,
        ...BodyFont.semibold,
        color: Palette.background,
        fontVariant: ['tabular-nums'],
    },
    detail: {
        fontSize: 11,
        ...BodyFont.regular,
        color: Palette.background,
        opacity: 0.72,
        marginTop: 1,
        fontVariant: ['tabular-nums'],
    },
    hint: {
        marginTop: 6,
        fontSize: 11,
        ...BodyFont.medium,
        color: Palette.textMuted,
        textAlign: 'center',
    },
}));
