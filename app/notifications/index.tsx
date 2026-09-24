/**
 * The notification centre — `Design/notification.svg` frames 0 and 1.
 *
 * Until this screen existed a notification was only ever a push: `pushSender` handed bytes
 * to Expo and nothing remembered it. Swipe one away and it was gone; be asleep and it never
 * happened. The backend half of the fix is `models/Notification.js` and
 * `utils/notificationCentre.js` — the row is the notification, the push is one delivery of
 * it — and this is the screen that reads it back.
 *
 * The kit's two frames are the populated list and the empty state. Everything below is
 * either one of those or a decision the kit did not have to make, and each of those is
 * marked.
 *
 * Six things to know before changing it:
 *
 * 1. **The tabs are a server query, not a client filter.** `state=unread|read` goes to the
 *    API. Fetching everything and partitioning here would work until somebody has four
 *    hundred notifications, and would then load all four hundred to draw thirty — on the
 *    screen a person opens from a push, which is the one that has to paint fastest.
 *
 * 2. **Opening a card marks it read, and the state moves before the request.** The row
 *    leaves the Unread tab immediately and the PATCH follows. A list that waits for a round
 *    trip before responding to a tap feels broken on a train; and the failure mode of being
 *    optimistic here is a card that reappears on the next refresh, which is recoverable and
 *    obvious. `setRead` failing is swallowed for that reason.
 *
 * 3. **The category chips are built from the feed's own counts**, so a category that has
 *    never produced a notification has no chip. A filter whose only possible outcome is an
 *    empty screen is a control that wastes a tap. See `chipsFor`.
 *
 * 4. **Three empty states, not one**, because three different things have happened. Nothing
 *    at all, nothing unread, and a filter that matched nothing are distinct facts, and the
 *    last one gets the search illustration it actually depicts. Collapsing them into "no
 *    notifications" is the mistake `(tabs)/results.tsx` used to make with a failed load —
 *    see `lib/appState.ts`.
 *
 * 5. **A failed load never falls through to an empty state.** `describeError` decides what
 *    went wrong and `<ErrorState>` draws it. Telling somebody whose request timed out that
 *    they have no notifications is the exact defect that table exists to prevent.
 *
 * 6. **Swipe left to dismiss, and dismissal is a real delete.** `Notification` is not
 *    append-only, unlike `Interpretation` and `AchievementUnlock`: those record a finding
 *    and something earned, this is a message. A hidden copy of everything somebody has
 *    swiped away is special-category data with nothing asking for it.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Animated, Easing, Platform, UIManager, LayoutAnimation, PanResponder, type PanResponderGestureState, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ApiError } from '@/lib/api';
import {
    getFeed, setRead, markAllRead, dismiss, chipsFor, groupByDay,
    type FeedState, type NotificationCard as Card, type NotificationCategory,
    type NotificationCounts,
} from '@/lib/notificationCentre';
import { ErrorState } from '@/components/errors';
import NotificationCardView from '@/components/notifications/NotificationCard';
import SegmentedTabs, { type TabKey } from '@/components/notifications/SegmentedTabs';
import CaughtUpIllustration from '@/components/notifications/CaughtUpIllustration';
import NoMatchIllustration from '@/components/notifications/NoMatchIllustration';
import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

const GUTTER = 16;
const EMPTY_COUNTS: NotificationCounts = { unread: 0, read: 0, byCategory: {} };

// `LayoutAnimation` needs turning on explicitly on Android, and without it a card leaving
// the list vanishes rather than collapsing — which on a swipe reads as the wrong row going.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NotificationCentre() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();

    const [tab, setTab] = useState<TabKey>('unread');
    const [category, setCategory] = useState<NotificationCategory | null>(null);
    const [cards, setCards] = useState<Card[]>([]);
    const [counts, setCounts] = useState<NotificationCounts>(EMPTY_COUNTS);
    const [cursor, setCursor] = useState<{ before: string; beforeId: string } | null>(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paging, setPaging] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);

    /**
     * Guards the state write against a screen that has been left.
     *
     * `useFocusEffect` refires on every return, so a slow first load and a fast second one
     * can land out of order. The ref is the same `mounted` guard `app/nutrition/index.tsx`
     * documents.
     */
    const live = useRef(true);
    /** Which request is current, so a stale tab's response cannot overwrite a newer one. */
    const requestId = useRef(0);

    const load = useCallback(async (opts: { silent?: boolean } = {}) => {
        const mine = ++requestId.current;
        if (!opts.silent) setLoading(true);
        setError(null);
        try {
            const feed = await getFeed({ state: tab as FeedState, category });
            if (!live.current || mine !== requestId.current) return;
            setCards(feed.notifications);
            setCounts(feed.counts);
            setCursor(feed.nextCursor);
        } catch (err) {
            if (!live.current || mine !== requestId.current) return;
            // Note 5: held as state and branched on, never toasted and then drawn as empty.
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof ApiError ? err : new ApiError('Could not load notifications', 0));
        } finally {
            if (live.current && mine === requestId.current) setLoading(false);
        }
    }, [tab, category, router]);

    useFocusEffect(useCallback(() => {
        live.current = true;
        load();
        return () => { live.current = false; };
    }, [load]));

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load({ silent: true });
        if (live.current) setRefreshing(false);
    }, [load]);

    /**
     * The next page.
     *
     * Cursor-based, because a feed that is still being written to is exactly where an
     * offset repeats one row and hides another — see the controller's `list`.
     */
    const loadMore = useCallback(async () => {
        if (!cursor || paging) return;
        setPaging(true);
        try {
            const feed = await getFeed({ state: tab as FeedState, category, cursor });
            if (!live.current) return;
            // De-duplicated on id rather than concatenated blind: a notification published
            // between the two requests shifts the window, and the cursor narrows that to a
            // possible repeat rather than eliminating it.
            setCards((prev) => {
                const seen = new Set(prev.map((c) => c.id));
                return [...prev, ...feed.notifications.filter((c) => !seen.has(c.id))];
            });
            setCursor(feed.nextCursor);
        } catch {
            // A page that will not load is not worth an alert — the list still holds
            // everything already fetched, and pulling down retries the whole thing.
        } finally {
            if (live.current) setPaging(false);
        }
    }, [cursor, paging, tab, category]);

    /** Note 2: the list moves first, the request follows, and its failure is swallowed. */
    const open = useCallback((card: Card, route?: string) => {
        if (!card.read) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCards((prev) => (tab === 'unread'
                ? prev.filter((c) => c.id !== card.id)
                : prev.map((c) => (c.id === card.id ? { ...c, read: true } : c))));
            setCounts((prev) => ({
                ...prev,
                unread: Math.max(0, prev.unread - 1),
                read: prev.read + 1,
            }));
            setRead(card.id, true).catch(() => { });
        }
        router.push((route ?? card.route) as any);
    }, [router, tab]);

    const remove = useCallback((card: Card) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setCounts((prev) => ({
            ...prev,
            unread: card.read ? prev.unread : Math.max(0, prev.unread - 1),
            read: card.read ? Math.max(0, prev.read - 1) : prev.read,
        }));
        dismiss(card.id).catch(() => {
            Toast.show({ type: 'error', text1: 'Could not dismiss that', text2: 'It will come back on refresh.' });
        });
    }, []);

    const clearAll = useCallback(async () => {
        const previous = cards;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCards([]);
        try {
            const res = await markAllRead(category);
            if (!live.current) return;
            setCounts((prev) => ({ ...prev, unread: res.unread, read: prev.read + res.marked }));
            // The Read tab's contents changed underneath it, so its counts are refetched
            // rather than guessed at.
            load({ silent: true });
        } catch {
            if (!live.current) return;
            setCards(previous);
            Toast.show({ type: 'error', text1: 'Could not mark those read' });
        }
    }, [cards, category, load]);

    const chips = useMemo(
        () => chipsFor(counts, Object.fromEntries(cards.map((c) => [c.category, c.categoryLabel]))),
        [counts, cards]
    );
    const sections = useMemo(() => groupByDay(cards), [cards]);

    /* ---------------------------------------------------------------- *
     * Render
     * ---------------------------------------------------------------- */

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                unread={counts.unread}
                canClear={tab === 'unread' && cards.length > 0}
                onBack={() => router.back()}
                onSettings={() => router.push('/notification-settings')}
                onClear={clearAll}
            />

            <SegmentedTabs value={tab} onChange={setTab} counts={counts} />

            {chips.length > 1 && (
                <CategoryRail
                    chips={chips}
                    active={category}
                    onSelect={(key) => setCategory((prev) => (prev === key ? null : key))}
                />
            )}

            {loading && !refreshing ? (
                <View style={styles.centre}>
                    <ActivityIndicator color={Palette.primary} />
                </View>
            ) : error ? (
                /*
                    `lib/appState.ts` decides what the failure means and `<ErrorState>`
                    draws it — the right illustration, our headline rather than the
                    server's wording, and a retry only where retrying could work. `inline`
                    because this screen has already drawn its own header.
                */
                <ErrorState
                    error={error}
                    subject="your notifications"
                    onRetry={() => load()}
                    retrying={loading}
                    variant="inline"
                />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.list, cards.length === 0 && styles.listEmpty]}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <Text style={styles.sectionHeader}>{section.label}</Text>
                    )}
                    renderItem={({ item, index }) => (
                        <SwipeableRow onDismiss={() => remove(item)}>
                            <NotificationCardView
                                card={item}
                                index={index}
                                onPress={(c) => open(c)}
                                onAction={(c, route) => open(c, route)}
                            />
                        </SwipeableRow>
                    )}
                    ListEmptyComponent={
                        <FeedEmpty
                            tab={tab}
                            filtered={category !== null}
                            onClearFilter={() => setCategory(null)}
                        />
                    }
                    ListFooterComponent={
                        paging ? <ActivityIndicator style={styles.footer} color={Palette.primary} /> : null
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refresh}
                            tintColor={Palette.primary}
                            colors={[Palette.primary]}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

/* ------------------------------------------------------------------ *
 * The header
 * ------------------------------------------------------------------ */

/**
 * Back, the title, and the gear the kit draws — which goes to `notification-settings`,
 * the screen that already existed and had no way in from here.
 *
 * "Mark all read" is a fourth control the kit has no room for, so it is a text button under
 * the title rather than a third icon. It appears only on the Unread tab with something in
 * it: a button whose only effect is to do nothing is the dummy control this app keeps
 * removing.
 */
const Header = ({ unread, canClear, onBack, onSettings, onClear }: {
    unread: number;
    canClear: boolean;
    onBack: () => void;
    onSettings: () => void;
    onClear: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.header}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={26} color={Palette.text} />
                </TouchableOpacity>

                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {/*
                        The subtitle is a fact, not a count repeated from the tab: "3 waiting for
                        you" answers why the screen was opened, where "3" beside "Notifications"
                        just restates the pill eight points below it. The same call the home
                        screen's score card makes about printing its band twice.
                    */}
                    <Text style={styles.headerSub}>
                        {unread === 0 ? 'Nothing waiting' : `${unread} waiting for you`}
                    </Text>
                </View>

                <TouchableOpacity onPress={onSettings} hitSlop={12} accessibilityLabel="Notification settings">
                    <Ionicons name="settings-outline" size={22} color={Palette.text} />
                </TouchableOpacity>
            </View>

            {canClear && (
                <TouchableOpacity style={styles.clearAll} onPress={onClear} hitSlop={8}>
                    <Ionicons name="checkmark-done-outline" size={15} color={Palette.primary} />
                    <Text style={styles.clearAllText}>Mark all as read</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

/* ------------------------------------------------------------------ *
 * The category rail
 * ------------------------------------------------------------------ */

/**
 * Horizontally scrolling filter chips, built from the feed's own counts.
 *
 * Borrowed from the search flow in the same export (`Design/notification.svg` frame 6 draws
 * `Filter (3) / Medication / Health Metric`), which is where this idea belongs: a person
 * with a fortnight of reminders wants medications, not everything. Tapping the active chip
 * clears it, because a filter with no way off is a screen somebody gets stuck on.
 *
 * Drawn only when there is more than one category to choose between. One chip is not a
 * filter, it is a label.
 */
const CategoryRail = ({ chips, active, onSelect }: {
    chips: { key: NotificationCategory; label: string; total: number; unread: number }[];
    active: NotificationCategory | null;
    onSelect: (key: NotificationCategory) => void;
}) => {
    const styles = useStyles();
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            style={styles.railWrap}
        >
            {chips.map((chip) => {
                const on = active === chip.key;
                return (
                    <TouchableOpacity
                        key={chip.key}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => onSelect(chip.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${chip.label}, ${chip.total}${on ? ', selected' : ''}`}
                    >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
                        <Text style={[styles.chipCount, on && styles.chipCountOn]}>{chip.total}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

/* ------------------------------------------------------------------ *
 * Empty states
 * ------------------------------------------------------------------ */

/**
 * Three of them — note 4.
 *
 * The kit draws one ("You're all caught up", with the megaphone) and it is the right art
 * for exactly one of these: an Unread tab with nothing in it. A filter that matched nothing
 * gets frame 5's search illustration, which is a picture of that. A Read tab with nothing
 * in it gets neither: it is not an achievement and not a failed search, it just means
 * nothing has been read yet, and drawing a celebration over it would be the app
 * congratulating somebody for having done nothing.
 *
 * The kit's "Swipe to refresh" button is not reproduced. `RefreshControl` is already on the
 * list, so a button that says "swipe" is a control explaining a gesture that works — and
 * `Design/errors.svg` taught the same lesson about offering an action that is not one.
 */
const FeedEmpty = ({ tab, filtered, onClearFilter }: {
    tab: TabKey;
    filtered: boolean;
    onClearFilter: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    if (filtered) {
        return (
            <View style={styles.empty}>
                <NoMatchIllustration width={230} />
                <Text style={styles.emptyTitle}>No result found.</Text>
                <Text style={styles.emptyBody}>
                    Nothing in this category yet. Try another, or see everything.
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={onClearFilter}>
                    <Ionicons name="close-circle-outline" size={16} color={Palette.text} />
                    <Text style={styles.secondaryButtonText}>Clear filter</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (tab === 'read') {
        return (
            <View style={styles.empty}>
                <View style={styles.quietMark}>
                    <Ionicons name="mail-open-outline" size={30} color={Palette.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Nothing read yet</Text>
                <Text style={styles.emptyBody}>
                    Notifications you open move here. Nothing is ever deleted for you — swipe
                    a card left when you are done with it.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.empty}>
            <CaughtUpIllustration width={236} />
            <Text style={styles.emptyTitle}>You&apos;re all caught up.</Text>
            <Text style={styles.emptyBody}>
                There are no notifications to show. Pull down to refresh the list.
            </Text>
        </View>
    );
};

/* ------------------------------------------------------------------ *
 * Swipe to dismiss
 * ------------------------------------------------------------------ */

/**
 * Swipe a card left to dismiss it.
 *
 * Written on `Animated` and `PanResponder` rather than with a gesture library, because the
 * alternative is adding a native module — which changes `package.json`, which moves the
 * fingerprint, which silently strands every build already on somebody's phone. That is the
 * fourth trap in CLAUDE.md, and it is not worth paying for a swipe.
 *
 * Two details: the gesture only claims the touch once horizontal movement clearly exceeds
 * vertical (`dx` twice `dy`, past 12pt), so scrolling a list of these still scrolls; and
 * the card animates fully off screen before `onDismiss` fires, because removing the row
 * under a half-slid card makes the next one appear already moved.
 */
const SwipeableRow = ({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) => {
    const Palette = usePalette();
    const styles = useStyles();
    const dx = useRef(new Animated.Value(0)).current;

    const responder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) =>
            Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
            // Left only. A rightward drag is almost always the start of a back gesture.
            if (g.dx < 0) dx.setValue(g.dx);
        },
        onPanResponderRelease: (_: GestureResponderEvent, g: PanResponderGestureState) => {
            if (g.dx < -110 || g.vx < -0.6) {
                Animated.timing(dx, {
                    toValue: -520, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true,
                }).start(() => onDismiss());
            } else {
                Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
            }
        },
    }), [dx, onDismiss]);

    return (
        <View>
            {/* The mark under the card, revealed as it slides. */}
            <Animated.View
                pointerEvents="none"
                style={[styles.swipeBehind, {
                    opacity: dx.interpolate({ inputRange: [-110, -30, 0], outputRange: [1, 0.4, 0], extrapolate: 'clamp' }),
                }]}
            >
                <Ionicons name="trash-outline" size={18} color={Palette.alert} />
                <Text style={styles.swipeBehindText}>Dismiss</Text>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX: dx }] }} {...responder.panHandlers}>
                {children}
            </Animated.View>
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },

    header: { paddingHorizontal: GUTTER, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.md },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitleWrap: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, color: Palette.text, fontFamily: Fonts.bold },
    headerSub: { fontSize: 12, color: Palette.textMuted, ...BodyFont.medium, marginTop: 1 },
    clearAll: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6 },
    clearAllText: { fontSize: 13, color: Palette.primary, fontFamily: Fonts.semibold },

    railWrap: { flexGrow: 0, marginTop: Spacing.md },
    rail: { paddingHorizontal: GUTTER, gap: Spacing.sm, paddingBottom: 2 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: 7,
        borderRadius: Radius.pill, borderWidth: 1,
        borderColor: Palette.borderSlate, backgroundColor: Palette.background,
    },
    chipOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    chipText: { fontSize: 13, color: Palette.textSecondary, ...BodyFont.medium },
    chipTextOn: { color: Palette.primaryDark, fontFamily: Fonts.semibold },
    chipCount: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.bold },
    chipCountOn: { color: Palette.primary },

    list: { paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },
    listEmpty: { flexGrow: 1 },
    sectionHeader: {
        fontSize: 14, color: Palette.text, fontFamily: Fonts.bold,
        marginHorizontal: GUTTER, marginBottom: Spacing.md, marginTop: Spacing.sm,
    },
    footer: { paddingVertical: Spacing.xl },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md },
    quietMark: {
        width: 72, height: 72, borderRadius: 36, marginBottom: Spacing.xs,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.borderLight,
    },
    emptyTitle: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center', marginTop: Spacing.md },
    emptyBody: { fontSize: 15, lineHeight: 22, color: Palette.textSecondary, ...BodyFont.regular, textAlign: 'center' },

    primaryButton: {
        marginTop: Spacing.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md,
        borderRadius: Radius.sm, backgroundColor: Palette.primaryFill,
    },
    primaryButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    secondaryButton: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.borderSlate,
    },
    secondaryButtonText: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },

    swipeBehind: {
        position: 'absolute', right: GUTTER + Spacing.lg, top: 0, bottom: Spacing.md,
        flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    swipeBehindText: { fontSize: 13, color: Palette.alert, fontFamily: Fonts.semibold },
}));
