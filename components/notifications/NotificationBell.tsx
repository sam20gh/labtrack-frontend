/**
 * The way into the notification centre, drawn in the home screen's purple header.
 *
 * Four decisions:
 *
 * 1. **It counts, and it counts its own way in.** A dot would say "something happened";
 *    the number says whether it is worth stopping for, which on a header that also carries
 *    a search and an avatar is the difference between a control people learn and one they
 *    stop seeing. Capped at `99+` — past that the exact figure is not information, it is
 *    evidence the person has stopped reading them.
 *
 * 2. **It fetches on its own timeline, after the screen has painted.** `/unread-count` is
 *    a `countDocuments` and cheap, but it is still a request, and the rule this app holds
 *    everywhere is that nothing the header needs blocks the first paint —
 *    `app/nutrition/index.tsx` is the worked example. Until it lands the bell draws with no
 *    badge, which is the honest state: we do not yet know.
 *
 * 3. **It refreshes on focus, so returning from the centre updates it.** Marking everything
 *    read and coming back to a header still claiming twelve is the most visible way this
 *    component can be wrong.
 *
 * 4. **The badge never renders a zero.** "0" in a red circle is a notification about the
 *    absence of notifications. Null — not yet known — and zero both draw nothing, and they
 *    are indistinguishable on purpose: neither is worth a mark.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUnreadCount } from '@/lib/notificationCentre';
import { Palette, Radius, Fonts } from '@/constants/theme';

export default function NotificationBell({ onDark = true }: { onDark?: boolean }) {
    const router = useRouter();
    const [unread, setUnread] = useState<number | null>(null);
    const live = useRef(true);

    useFocusEffect(useCallback(() => {
        live.current = true;
        getUnreadCount()
            .then((res) => { if (live.current) setUnread(res.unread); })
            // A count that will not load is not worth telling anybody about: the bell still
            // opens the centre, which is the only thing it has to do.
            .catch(() => { });
        return () => { live.current = false; };
    }, []));

    const showBadge = (unread ?? 0) > 0;

    return (
        <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.button, onDark ? styles.onDark : styles.onLight]}
            accessibilityRole="button"
            accessibilityLabel={
                showBadge ? `Notifications, ${unread} unread` : 'Notifications'
            }
        >
            <Ionicons
                name={showBadge ? 'notifications' : 'notifications-outline'}
                size={20}
                color={onDark ? Palette.primaryDark : Palette.text}
            />
            {showBadge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread! > 99 ? '99+' : unread}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    onDark: { backgroundColor: Palette.white },
    onLight: { backgroundColor: Palette.borderLight },
    badge: {
        position: 'absolute', top: 1, right: 0,
        minWidth: 18, height: 18, paddingHorizontal: 4,
        borderRadius: Radius.pill,
        // The ring is what keeps the badge legible wherever the bell sits: against the
        // white button it is a border, against the purple header it is a gap.
        borderWidth: 2, borderColor: Palette.white,
        backgroundColor: Palette.alert,
        alignItems: 'center', justifyContent: 'center',
    },
    // 10pt, because the ring eats two of the eighteen and a 11pt digit clips its own
    // descender-less baseline on Android at the default font scale.
    badgeText: { fontSize: 10, lineHeight: 13, color: Palette.white, fontFamily: Fonts.bold },
});
