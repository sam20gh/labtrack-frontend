/**
 * The next technician visit, as one tappable line: when, and that it is booked.
 *
 * Drawn above the parcels on the welcome hub and the home journey card, because for somebody
 * on home collection the visit *is* the next thing that happens — every kit on the tracker is
 * waiting for it. The label is the server's, in the market's own clock.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { Journey } from '@/lib/onboarding';

export function VisitRow({ visit, onOpen }: { visit: NonNullable<Journey['visit']>; onOpen: (route: string) => void }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <TouchableOpacity
            style={styles.row}
            onPress={() => onOpen(visit.route)}
            accessibilityRole="button"
            accessibilityLabel={`Technician visit, ${visit.label}. Open details`}
        >
            <View style={styles.icon}>
                <Ionicons name="home-outline" size={18} color={Palette.textSecondary} />
            </View>
            <View style={styles.text}>
                <Text style={styles.title}>Technician visit</Text>
                <Text style={styles.when}>{visit.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </TouchableOpacity>
    );
}

const useStyles = makeStyles((Palette) => ({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md,
    },
    icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.borderLight, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    title: { fontSize: 13, ...BodyFont.medium, color: Palette.textSecondary },
    when: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 1 },
}));

export default VisitRow;
