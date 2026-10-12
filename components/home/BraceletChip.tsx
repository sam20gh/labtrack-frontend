/**
 * The bracelet, in the home header's date row: a watch, and the one fact worth a glance.
 *
 * Four decisions:
 *
 * 1. **In the date row, not a fourth 44pt circle.** The header row already holds search, the
 *    bell and the avatar; a fourth button leaves the greeting about 120pt on a 375pt phone.
 *    The date row already carries the streak chip, and a status beside the date is a status
 *    bar — the day, the streak, the device. The row wraps on narrow phones rather than
 *    clipping.
 * 2. **Earned, like every home card.** Nothing is drawn without a paired bracelet. A "pair a
 *    device" chip would be the empty-state row this screen deliberately does not carry.
 * 3. **One fact, chosen by consequence.** Syncing, then "Charge" (silent after a low reading),
 *    then "Can't reach", then the battery. A battery percentage over a bracelet that has not
 *    answered since yesterday is the lie this chip was built to stop telling. The words come
 *    from `lib/health/jstyle/status.ts`, which the bracelet screen reads too, so the two cannot
 *    disagree.
 * 4. **Pinned colours, and never colour alone.** It sits on the deep hero, which does not
 *    change with the scheme (`Palettes.light`, as `NotificationBell` does). Anything that
 *    needs somebody is a solid rose chip with white text — the bell badge's pairing — and
 *    every state has its own glyph and word, so nothing rests on rose versus amber.
 *
 * It reads only the device-local pairing: no request and no radio, so it is drawn on the
 * first frame and costs the header nothing. The bracelet screen is where somebody goes to
 * find out more, and the chip is its way in.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Fonts, Palettes, Radius } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { useBracelet } from '@/hooks/useBracelet';
import { braceletStatus } from '@/lib/health/jstyle/status';

export default function BraceletChip() {
    const styles = useStyles();
    const router = useRouter();
    const { paired, syncing } = useBracelet();
    if (!paired) return null;

    const { chip, a11y } = braceletStatus(paired, { syncing });
    const solid = chip.tone === 'alert' || chip.tone === 'critical';
    const glyph = solid || chip.tone === 'ok' || chip.tone === 'busy' || chip.tone === 'muted'
        ? Palettes.light.white
        // Amber on the violet: the dark scheme's lighter step, which holds contrast there.
        : Palettes.dark.amber;

    return (
        <TouchableOpacity
            onPress={() => router.push('/bracelet')}
            style={[styles.chip, solid && styles.solid]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            accessibilityHint="Opens your bracelet"
        >
            <Ionicons name="watch-outline" size={12} color={Palettes.light.white} />
            {chip.icon ? <Ionicons name={chip.icon} size={12} color={glyph} /> : null}
            {chip.label ? <Text style={styles.label}>{chip.label}</Text> : null}
        </TouchableOpacity>
    );
}

const useStyles = makeStyles(() => ({
    // The streak chip's shape, so the two read as one row of facts.
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: Radius.sm,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    solid: { backgroundColor: Palettes.light.alert },
    label: { fontSize: 12, color: Palettes.light.white, fontFamily: Fonts.bold },
}));
