/**
 * The poster — the run as neon line art on the hero violet, with the distance huge.
 * What the Share button sends (plan §2.4).
 *
 * Captured by `react-native-view-shot`, so two rules from the achievement share card apply
 * and neither is optional:
 *
 * - **The Share button lives outside this component.** Anything inside is in the picture.
 * - **`collapsable={false}` on the root.** Android flattens a View that only wraps another
 *   into its parent, and a view that no longer exists in the native tree captures as a blank
 *   bitmap — on Android only, with nothing wrong in the JS.
 *
 * **Privacy trim.** The route drawn here is `trimForPrivacy`'d: the first and last 250 m are
 * gone, so the picture does not start at somebody's door. A route too short to trim is not
 * drawn at all, and the poster says why instead of publishing where the walk began.
 *
 * No map tiles: a poster with a street map is a picture of a neighbourhood. The line alone
 * is recognisable to the person who ran it and to nobody else.
 */
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BodyFont, Fonts, Palettes, Spacing } from '@/constants/theme';
import BrandMark from '@/components/BrandMark';
import TickerNumber from './TickerNumber';
import { routePath, trimForPrivacy } from '@/lib/run/replay';
import { EMBER_DARK } from '@/lib/run/afterglow';

interface Props {
    coordinates: number[][];
    title: string;
    distance: { value: string; unit: string };
    stats: { label: string; value: string }[];
    date: string;
    width: number;
}

const P = Palettes.light; // the hero is violet in both schemes, and so is a picture of it

const RoutePoster = forwardRef<View, Props>(({ coordinates, title, distance, stats, date, width }, ref) => {
    const height = Math.round(width * 1.25);
    const art = { w: width - Spacing.xxl * 2, h: height * 0.46 };
    const trimmed = useMemo(() => trimForPrivacy(coordinates), [coordinates]);
    const d = useMemo(() => (trimmed ? routePath(trimmed, art.w, art.h, 14) : ''), [trimmed, art.w, art.h]);

    return (
        <View ref={ref} collapsable={false} style={{ width, height }}>
            <LinearGradient colors={P.heroGradient} style={StyleSheet.absoluteFill} />
            <View style={styles.inner}>
                <View style={styles.top}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                <View style={{ width: art.w, height: art.h, alignItems: 'center', justifyContent: 'center' }}>
                    {d ? (
                        <Svg width={art.w} height={art.h}>
                            <Defs>
                                <SvgGradient id="neon" x1="0" y1="0" x2="1" y2="1">
                                    <Stop offset="0" stopColor={EMBER_DARK[2]} />
                                    <Stop offset="1" stopColor={EMBER_DARK[4]} />
                                </SvgGradient>
                            </Defs>
                            <Path d={d} stroke={EMBER_DARK[3]} strokeOpacity={0.18} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d={d} stroke={EMBER_DARK[3]} strokeOpacity={0.35} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d={d} stroke="url(#neon)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    ) : (
                        <Text style={styles.hidden}>
                            Route not shown: it is too short to share without revealing where it started.
                        </Text>
                    )}
                </View>

                <View style={styles.bottom}>
                    <View style={styles.distanceRow}>
                        <TickerNumber value={distance.value} size={72} color={P.white} />
                        <Text style={styles.unit}>{distance.unit}</Text>
                    </View>
                    <View style={styles.stats}>
                        {stats.map((s) => (
                            <View key={s.label} style={styles.stat}>
                                <Text style={styles.statValue}>{s.value}</Text>
                                <Text style={styles.statLabel}>{s.label}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.brand}>
                        <BrandMark size={14} color={P.white} />
                        <Text style={styles.brandText}>PREDYQT</Text>
                    </View>
                </View>
            </View>
        </View>
    );
});
RoutePoster.displayName = 'RoutePoster';
export default RoutePoster;

const styles = StyleSheet.create({
    inner: { flex: 1, padding: Spacing.xxl, justifyContent: 'space-between', alignItems: 'center' },
    top: { alignSelf: 'stretch', gap: 2 },
    title: { fontFamily: Fonts.bold, fontSize: 22, color: P.white, letterSpacing: 0.5 },
    date: { ...BodyFont.regular, fontSize: 13, color: P.white, opacity: 0.75 },
    hidden: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, color: P.white, opacity: 0.8, textAlign: 'center', paddingHorizontal: Spacing.xl },
    bottom: { alignSelf: 'stretch', gap: Spacing.md },
    distanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    unit: { fontFamily: Fonts.semibold, fontSize: 24, color: P.white, opacity: 0.8 },
    stats: { flexDirection: 'row', gap: Spacing.xl },
    stat: { gap: 2 },
    statValue: { fontFamily: Fonts.bold, fontSize: 18, color: P.white },
    statLabel: { ...BodyFont.regular, fontSize: 12, color: P.white, opacity: 0.7 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, opacity: 0.85 },
    brandText: { fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 3, color: P.white },
});
