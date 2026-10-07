/**
 * Where each parcel is: the DNA kit, the blood kit, the bracelet — one row each, because a
 * package is three things on three timelines and the one somebody is anxious about is
 * whichever is slowest.
 *
 * The bar is segmented by the kit's own stages rather than drawn as a percentage: "sample at
 * the lab, being analysed next" is the fact, and a bar at 60% invites the question "60% of
 * what". The line under it is the honest version of an ETA — the usual wait, from the server,
 * never a date nothing here can back.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { KIT_ICON, type JourneyKit } from '@/lib/onboarding';

export function KitTracker({ kits }: { kits: JourneyKit[] }) {
    const Palette = usePalette();
    const styles = useStyles();
    if (!kits.length) return null;

    return (
        <View style={styles.list}>
            {kits.map((kit) => (
                <View
                    key={`${kit.itemId}:${kit.kind}`}
                    style={styles.kit}
                    accessible
                    accessibilityLabel={`${kit.label}: ${kit.statusLabel}${kit.wait ? `. ${kit.wait}` : ''}`}
                >
                    <View style={styles.head}>
                        <View style={styles.icon}>
                            <Ionicons name={KIT_ICON[kit.kind] as any} size={16} color={Palette.textSecondary} />
                        </View>
                        <Text style={styles.label}>{kit.label}</Text>
                        <View style={styles.spacer} />
                        {kit.done ? <Ionicons name="checkmark-circle" size={16} color={Palette.success} /> : null}
                        <Text style={[styles.status, kit.done && styles.statusDone]}>{kit.statusLabel}</Text>
                    </View>
                    <View style={styles.bar}>
                        {kit.stages.map((s, i) => (
                            <View
                                key={s.key}
                                style={[
                                    styles.segment,
                                    i === 0 && styles.segmentFirst,
                                    i === kit.stages.length - 1 && styles.segmentLast,
                                    s.reached && (kit.done ? styles.segmentDone : styles.segmentOn),
                                ]}
                            />
                        ))}
                    </View>
                    {kit.wait ? <Text style={styles.wait}>{kit.wait}</Text> : null}
                </View>
            ))}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    list: { gap: Spacing.md },
    kit: {},
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    icon: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    spacer: { flex: 1 },
    status: { fontSize: 13, ...BodyFont.medium, color: Palette.textSecondary },
    statusDone: { color: Palette.success },
    bar: { flexDirection: 'row', gap: 3 },
    segment: { flex: 1, height: 6, backgroundColor: Palette.borderLight },
    segmentFirst: { borderTopLeftRadius: Radius.pill, borderBottomLeftRadius: Radius.pill },
    segmentLast: { borderTopRightRadius: Radius.pill, borderBottomRightRadius: Radius.pill },
    segmentOn: { backgroundColor: Palette.primary },
    segmentDone: { backgroundColor: Palette.success },
    wait: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted, marginTop: 6, lineHeight: 17 },
}));

export default KitTracker;
