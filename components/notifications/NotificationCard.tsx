/**
 * One notification, as `Design/notification.svg` frame 0 draws it.
 *
 * The kit shows five cards and they are five *variants of one card*, not five designs: a
 * ringed circular icon, a title with its age and an unread dot, a body, and then at most
 * one of — a progress bar, an outlined metric pill, a photograph — plus an optional row of
 * up to two links. Every one of those is a field on the row (`meter`, `chip`, `imageUrl`,
 * `actions`), so this component is a switch over data rather than five components.
 *
 * Four decisions worth knowing:
 *
 * 1. **Read is drawn by subtraction, not by a second style.** A read card loses its dot,
 *    its surface goes to the page's own white and its ring goes pale. It does not go grey:
 *    dimming the text of something a person deliberately kept would make the Read tab a
 *    list of things that look broken. The kit only draws the unread state, so this is the
 *    one place the design is extended rather than followed — and it is extended by taking
 *    emphasis away, which is the reading the kit's own contrast implies.
 *
 * 2. **The unread dot is a dot, never a count.** Notifications are individually
 *    consequential here — an irregular heartbeat is not "1 item" — and a badge would invite
 *    grouping, which is how a health notification ends up collapsed behind "2 more".
 *
 * 3. **The meter is a bar with a caption, and a caption is not optional in practice.** The
 *    kit's hydration card draws a purple bar and never says what full means; on its own a
 *    bar is a shape. `meter.label` carries the words, and a meter without one prints the
 *    two numbers rather than nothing.
 *
 * 4. **The whole card is one touch target, and the actions are inside it.** Nested
 *    touchables are a real hazard on Android, so the actions are `TouchableOpacity`s inside
 *    a `Pressable` and each stops the press from reaching the card. Without that, tapping
 *    "Consult Doctor" fires the row's own route as well and the person lands somewhere they
 *    did not choose, sometimes.
 */
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { relativeTime, tintOf, type NotificationCard as Card } from '@/lib/notificationCentre';

const GUTTER = 16;

interface Props {
    card: Card;
    onPress: (card: Card) => void;
    onAction: (card: Card, route: string) => void;
    /** Position in its section, for the entrance stagger. */
    index: number;
}

function NotificationCardView({ card, onPress, onAction, index }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const tint = tintOf(card.tint);
    const unread = !card.read;

    /**
     * The entrance.
     *
     * A notification list is the one screen where a card *arriving* is the subject, so the
     * cards arrive: a short rise and fade, staggered by position. Capped at six steps —
     * beyond that the last card on a long list waits half a second for its turn, which is
     * the point where a stagger stops reading as life and starts reading as lag.
     */
    const enter = useRef(new Animated.Value(0)).current;
    /**
     * The delay is captured once, on mount, and never recomputed.
     *
     * `index` moves the moment anything above the card is dismissed or marked read, and a
     * delay that tracked it would replay the entrance on every row below the one that left
     * — so dismissing the top card makes the whole rest of the list flicker back in. It is
     * held in a ref rather than left out of the dependency array so that this is a fact
     * about the component rather than a lint suppression somebody later 'fixes'.
     */
    const delay = useRef(Math.min(index, 6) * 45).current;
    useEffect(() => {
        Animated.timing(enter, {
            toValue: 1,
            duration: 260,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [enter, delay]);

    /**
     * The unread dot breathes, and only the unread one.
     *
     * A loop on a card somebody has already dealt with is motion that asks for attention it
     * does not need, which is how an interface teaches people to ignore motion.
     */
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!unread) return;
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse, unread]);

    const meterPct = card.meter && card.meter.max > 0
        ? Math.min(1, card.meter.value / card.meter.max)
        : null;

    return (
        <Animated.View
            style={{
                opacity: enter,
                transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }}
        >
            <Pressable
                onPress={() => onPress(card)}
                style={({ pressed }) => [
                    styles.card,
                    unread ? styles.cardUnread : styles.cardRead,
                    pressed && styles.cardPressed,
                ]}
                accessibilityRole="button"
                // The category and the state lead, because a screen reader running down this
                // list needs to know what kind of thing each row is before hearing its title.
                accessibilityLabel={
                    `${card.categoryLabel}, ${unread ? 'unread' : 'read'}. ${card.title}. ${card.body}. ` +
                    relativeTime(card.createdAt)
                }
            >
                {/*
                    The left rail: a ringed disc, exactly as the kit draws it. The ring is
                    what keeps a pale tint visible on a pale card — a filled disc in
                    `successSurface` on `surface` is two greys.
                */}
                <View style={[styles.disc, { backgroundColor: tint.bg, borderColor: unread ? tint.fg : Palette.border }]}>
                    <Ionicons name={card.icon as any} size={19} color={tint.fg} />
                </View>

                <View style={styles.body}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
                        <View style={styles.ageRow}>
                            <Text style={styles.age}>{relativeTime(card.createdAt)}</Text>
                            {unread && (
                                <Animated.View
                                    style={[
                                        styles.dot,
                                        {
                                            backgroundColor: tint.fg,
                                            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
                                        },
                                    ]}
                                />
                            )}
                        </View>
                    </View>

                    {/* The bar sits between the title and the body, as the kit's hydration card does. */}
                    {meterPct !== null && card.meter && (
                        <View style={styles.meterWrap}>
                            <View style={styles.meterTrack}>
                                <View style={[styles.meterFill, { width: `${Math.max(4, meterPct * 100)}%`, backgroundColor: tint.fg }]} />
                            </View>
                            <Text style={styles.meterLabel}>
                                {card.meter.label ?? `${Math.round(card.meter.value)} of ${Math.round(card.meter.max)}`}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.text} numberOfLines={4}>{card.body}</Text>

                    {card.chip && (
                        <View style={styles.chip}>
                            {card.chip.icon && (
                                <Ionicons name={card.chip.icon as any} size={14} color={Palette.text} />
                            )}
                            <Text style={styles.chipText}>{card.chip.label}</Text>
                        </View>
                    )}

                    {/*
                        `resizeMode="cover"` on a fixed height, because a notification is a
                        row in a list and a photograph whose aspect ratio decides the row's
                        height makes the list jump as images load.
                    */}
                    {card.imageUrl && (
                        <Image source={{ uri: card.imageUrl }} style={styles.image} resizeMode="cover" />
                    )}

                    {card.actions.length > 0 && (
                        <View style={styles.actions}>
                            {card.actions.map((action) => (
                                <TouchableOpacity
                                    key={`${action.label}-${action.route}`}
                                    // Stops the press reaching the card underneath. See note 4.
                                    onPress={() => onAction(card, action.route)}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel={action.label}
                                >
                                    <Text style={action.tone === 'primary' ? styles.actionPrimary : styles.actionSecondary}>
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </Pressable>
        </Animated.View>
    );
}

/**
 * Memoised on the fields that are actually drawn.
 *
 * The feed re-renders on every mark-read, and a list of thirty cards each running two
 * animations is exactly where an unmemoised row costs frames. `readAt` is in the comparison
 * and `data` is not — nothing renders `data`.
 */
export default memo(NotificationCardView, (a, b) =>
    a.card.id === b.card.id
    && a.card.read === b.card.read
    && a.card.title === b.card.title
    && a.card.body === b.card.body
    // `index` is deliberately absent: it only ever seeded the entrance delay, which is
    // captured on mount, so a card whose position shifted has nothing new to draw.
);

const useStyles = makeStyles((Palette) => ({
    card: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginHorizontal: GUTTER,
        marginBottom: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
    },
    // Unread: the kit's own card — a tinted surface inside a hairline.
    cardUnread: { backgroundColor: Palette.canvas, borderColor: Palette.borderSlate },
    // Read: the same shape with the emphasis removed. Not greyed — see note 1.
    cardRead: { backgroundColor: Palette.background, borderColor: Palette.borderLight },
    cardPressed: { opacity: 0.7 },

    disc: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },

    body: { flex: 1, gap: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    title: { flex: 1, fontSize: 15, lineHeight: 20, color: Palette.text, fontFamily: Fonts.semibold },
    ageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
    age: { fontSize: 12, color: Palette.textMuted, ...BodyFont.medium },
    dot: { width: 7, height: 7, borderRadius: 4 },

    text: { fontSize: 14, lineHeight: 20, color: Palette.textSecondary, ...BodyFont.regular },

    meterWrap: { gap: 5, marginTop: 2 },
    meterTrack: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.border, overflow: 'hidden' },
    meterFill: { height: 6, borderRadius: Radius.pill },
    meterLabel: { fontSize: 12, color: Palette.textMuted, ...BodyFont.medium },

    chip: {
        alignSelf: 'flex-start',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 2,
        paddingHorizontal: Spacing.md, paddingVertical: 7,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.borderSlate,
        backgroundColor: Palette.background,
    },
    chipText: { fontSize: 13, color: Palette.text, fontFamily: Fonts.semibold },

    image: { width: '100%', height: 118, borderRadius: Radius.md, marginTop: 4, backgroundColor: Palette.borderLight },

    actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, marginTop: 4 },
    actionSecondary: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },
    actionPrimary: { fontSize: 14, color: Palette.primary, fontFamily: Fonts.semibold },
}));
