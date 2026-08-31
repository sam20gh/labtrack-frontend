/**
 * The profile hub — `Design/profile.svg`, frame 1, the flow's own home screen.
 *
 * Reached from the avatar in the home header. It was a tab; it lost that slot to the AI
 * assistant, which is opened many times a session where this is opened to change a setting
 * and then left.
 *
 * The kit rebuilds this as a **cover, an identity block, two status cards, and five
 * labelled groups**, replacing the previous four-group list. What changed and why:
 *
 * - **The score moved off the hero and onto the cover as a control.** The old screen drew
 *   a 132pt score plate here, duplicating the home screen's radar and `app/score`'s gauge —
 *   three renderings of one number, on three screens, one tap apart. The cover keeps the
 *   number where it is glanceable and makes it a route to the breakdown, which is the
 *   screen that can actually explain it.
 * - **Rows carry a value, not just a chevron.** The kit puts "Fitbit, Garmin, 3+" beside
 *   Linked Devices and "1m reply" beside Live Chat. A settings row that answers its own
 *   question is a screen someone does not have to open — so Linked Devices names the health
 *   store that is actually connected, and Notifications says whether the OS permission is
 *   granted, both read from the same endpoints the destination screens read.
 * - **The streak card is real, and is an activity streak.** `GET /activity/summary` already
 *   computes consecutive days carrying a session, and counts today as still in play rather
 *   than broken. A streak of zero is drawn as an invitation, not a failure — the same call
 *   `alignment: 'unassessed'` and a null pillar make elsewhere.
 *
 * Four things the kit draws that are deliberately not here, each because nothing backs them:
 * the "asklepios plus" membership pill and Billing & Subscription (no subscription model),
 * Achievements (no achievement model), the referral card (no referral model), and Live Chat
 * (no support thread model). The invite card's slot is used by the promo that does have a
 * destination. `app/help/index.tsx` carries the same reasoning for its own omissions.
 *
 * **Delete Account is real and is the one destructive control on the screen.**
 * `DELETE /users/:id` exists behind `requireSelf`, so the Danger Zone is not decorative —
 * it double-confirms, and it is the only row on the screen drawn in the danger colour.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';

import { api, ApiError } from '@/lib/api';
import { getUserId, signOut } from '@/lib/auth';
import { getScore, type HealthScore } from '@/lib/score';
import { getSummary as getActivitySummary, getWearableStatus } from '@/lib/activity';
import { getPermissionStatus } from '@/lib/notifications';
import { Palette, Fonts, Radius, Spacing } from '@/constants/theme';
import type { User } from '@/types/api';

/** `createdAt` comes from the model's `timestamps: true` and is not in the `User` type. */
type ProfileUser = Partial<User & { createdAt: string }>;

const initialsOf = (user: ProfileUser) => {
    const letters = `${user.firstName ?? ''} ${user.lastName ?? ''}`
        .trim().split(/\s+/).filter(Boolean).map((part) => part[0]);
    if (letters.length) return letters.slice(0, 2).join('').toUpperCase();
    return (user.email?.[0] ?? '?').toUpperCase();
};

/** "Member since Mar 2026". Omitted rather than guessed when the record has no timestamp. */
const memberSince = (iso?: string): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return `Member since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
};

/**
 * Which health store is feeding the app, for the Linked Devices row.
 *
 * Named devices first — that is what the kit's "Fitbit, Garmin, 3+" is showing and it is
 * the more useful answer. Falls back to the store's own name when the samples carry no
 * device, which is common on a phone-only setup.
 */
const describeSources = (
    sources: { platform: string; providerLabel?: string; devices: { name?: string }[]; status: string }[],
): string => {
    const connected = sources.filter((s) => s.status === 'connected');
    if (!connected.length) return 'Not connected';

    const names = Array.from(new Set(
        connected.flatMap((s) => s.devices.map((d) => d.name).filter(Boolean) as string[]),
    ));
    if (names.length > 2) return `${names.slice(0, 2).join(', ')}, ${names.length - 2}+`;
    if (names.length) return names.join(', ');

    const stores = connected.map((s) => s.providerLabel
        ?? (s.platform === 'apple_health' ? 'Apple Health' : 'Health Connect'));
    return Array.from(new Set(stores)).join(', ');
};

const NOTIFICATION_LABEL: Record<string, string> = {
    granted: 'On',
    denied: 'Blocked',
    undetermined: 'Not set up',
};

export default function ProfileScreen() {
    const router = useRouter();

    const [user, setUser] = useState<ProfileUser>({});
    const [score, setScore] = useState<HealthScore | null>(null);
    const [streak, setStreak] = useState<number | null>(null);
    const [devices, setDevices] = useState<string | null>(null);
    const [pushStatus, setPushStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const userId = await getUserId();
        if (!userId) { router.replace('/(auth)/loginscreen'); return; }

        // Settled rather than all: the settings rows below do not depend on any of the
        // status figures, so a score or wearable hiccup should cost one row's subtitle,
        // never the screen someone came here to use.
        const [userRes, scoreRes, activityRes, wearableRes, pushRes] = await Promise.allSettled([
            api.get<ProfileUser>(`/users/${userId}`),
            getScore(),
            getActivitySummary('1w'),
            getWearableStatus(),
            getPermissionStatus(),
        ]);

        if (userRes.status === 'fulfilled') {
            setUser(userRes.value);
        } else if (userRes.reason instanceof ApiError && userRes.reason.isAuthError) {
            router.replace('/(auth)/loginscreen');
            return;
        } else {
            Toast.show({ type: 'error', text1: 'Could not load your profile' });
        }

        if (scoreRes.status === 'fulfilled') setScore(scoreRes.value);
        if (activityRes.status === 'fulfilled') setStreak(activityRes.value.streak);
        if (wearableRes.status === 'fulfilled') setDevices(describeSources(wearableRes.value.sources));
        if (pushRes.status === 'fulfilled') setPushStatus(pushRes.value);
        setLoading(false);
    }, [router]);

    // Refetches on focus so a name changed in Profile Settings is not stale here. `loading`
    // is only ever set true on mount, so returning does not flash a spinner.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const fullName = useMemo(
        () => `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        [user],
    );

    const handleSignOut = () => {
        Alert.alert('Sign out?', 'You will need to sign in again on this device.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out',
                style: 'destructive',
                onPress: async () => {
                    await signOut();
                    router.replace('/(auth)/loginscreen');
                },
            },
        ]);
    };

    /**
     * Two prompts, not one. The first is the decision; the second is the moment someone
     * who tapped by accident gets out. The endpoint is `DELETE /users/:id` behind
     * `requireSelf`, and there is no undo behind it.
     */
    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete your account?',
            'This removes your account and the health records attached to it. It cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => Alert.alert(
                        'Last chance',
                        'Your results, plan, logs and score will be deleted. Are you sure?',
                        [
                            { text: 'Keep my account', style: 'cancel' },
                            {
                                text: 'Delete permanently',
                                style: 'destructive',
                                onPress: async () => {
                                    const userId = await getUserId();
                                    if (!userId) return;
                                    try {
                                        await api.delete(`/users/${userId}`);
                                        await signOut();
                                        router.replace('/(auth)/loginscreen');
                                    } catch {
                                        Toast.show({
                                            type: 'error',
                                            text1: 'Could not delete your account',
                                            text2: 'Please contact support so we can do it for you.',
                                        });
                                    }
                                },
                            },
                        ],
                    ),
                },
            ],
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.screen, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    const since = memberSince(user.createdAt);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
            >
                {/* Cover. It starts below the status bar rather than bleeding under it —
                    every other screen in the app insets its top edge, and a purple field
                    behind `<StatusBar style="auto" />` renders dark glyphs on dark. */}
                <LinearGradient
                    colors={Palette.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cover}
                >
                    <View style={styles.coverRow}>
                        <Pressable
                            onPress={() => router.back()}
                            style={styles.coverButton}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                        >
                            <Ionicons name="chevron-back" size={22} color={Palette.white} />
                        </Pressable>

                        <Pressable
                            onPress={() => router.push('/score')}
                            style={styles.coverButton}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel={
                                score?.value != null
                                    ? `LabTrack score ${score.value}. Open the breakdown.`
                                    : 'Open your score breakdown'
                            }
                        >
                            {score?.value != null ? (
                                <Text style={styles.coverScore}>{score.value}</Text>
                            ) : (
                                <Ionicons name="pie-chart-outline" size={19} color={Palette.white} />
                            )}
                        </Pressable>
                    </View>
                </LinearGradient>

                {/* Identity. The avatar straddles the cover's bottom edge, as the kit draws it. */}
                <View style={styles.identity}>
                    <Pressable
                        style={styles.avatarWrap}
                        onPress={() => router.push('/settings/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Edit your profile"
                    >
                        {/* Initials are the fallback, not the error state: `profileImage`
                            is null for everyone who has not picked one. */}
                        {user.profileImage ? (
                            <Image source={{ uri: user.profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarInitials}>{initialsOf(user)}</Text>
                            </View>
                        )}
                        <View style={styles.avatarBadge}>
                            <Ionicons name="pencil" size={12} color={Palette.white} />
                        </View>
                    </Pressable>

                    {/* Where the kit puts a membership pill. This says something true instead:
                        the score's own band, which is the status this product actually has. */}
                    {!!score?.bandLabel && (
                        <View style={styles.bandPill}>
                            <Ionicons name="sparkles" size={12} color={Palette.primary} />
                            <Text style={styles.bandPillText}>{score.bandLabel}</Text>
                        </View>
                    )}

                    {!!since && <Text style={styles.since}>{since}</Text>}
                    <Text style={styles.name} numberOfLines={1}>{fullName || 'Your profile'}</Text>
                    {!!user.email && (
                        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
                    )}
                </View>

                <View style={styles.body}>
                    <StreakCard streak={streak} onPress={() => router.push('/activity/history')} />

                    <PromoCard onPress={() => router.push('/(tabs)/orders')} />

                    <Group title="General">
                        <Row
                            icon="person-outline"
                            label="Profile"
                            onPress={() => router.push('/settings/profile')}
                        />
                        <Row
                            icon="watch-outline"
                            label="Linked devices"
                            value={devices ?? undefined}
                            onPress={() => router.push('/activity/sources')}
                        />
                        <Row
                            icon="options-outline"
                            label="Units & metrics"
                            onPress={() => router.push('/settings/units')}
                        />
                        <Row
                            icon="sparkles-outline"
                            label="AI assistant"
                            onPress={() => router.push('/assistant/settings')}
                        />
                        <Row
                            icon="receipt-outline"
                            label="Your orders"
                            onPress={() => router.push('/orders-history')}
                            last
                        />
                    </Group>

                    <Group title="Your health">
                        <Row
                            icon="calendar-outline"
                            label="Health plan"
                            onPress={() => router.push('/myplans')}
                        />
                        <Row
                            icon="clipboard-outline"
                            label="Health assessment"
                            onPress={() => router.push('/health-assessment/review')}
                        />
                        <Row
                            icon="stats-chart-outline"
                            label="Score breakdown"
                            value={score?.value != null ? String(score.value) : undefined}
                            onPress={() => router.push('/score')}
                            last
                        />
                    </Group>

                    <Group title="Notifications">
                        <Row
                            icon="notifications-outline"
                            label="Reminders and alerts"
                            value={pushStatus ? NOTIFICATION_LABEL[pushStatus] ?? pushStatus : undefined}
                            onPress={() => router.push('/notification-settings')}
                            last
                        />
                    </Group>

                    <Group title="Privacy & security">
                        <Row
                            icon="lock-closed-outline"
                            label="Security settings"
                            onPress={() => router.push('/settings/security')}
                        />
                        <Row
                            icon="pulse-outline"
                            label="Data sharing"
                            value={devices === 'Not connected' ? 'Nothing shared' : undefined}
                            onPress={() => router.push('/activity/sources')}
                            last
                        />
                    </Group>

                    <Group title="Help & support">
                        <Row
                            icon="help-buoy-outline"
                            label="Help center"
                            onPress={() => router.push('/help')}
                        />
                        <Row
                            icon="help-circle-outline"
                            label="FAQ"
                            onPress={() => router.push('/help/faq')}
                        />
                        <Row
                            icon="star-outline"
                            label="Leave a feedback"
                            onPress={() => router.push('/help/feedback')}
                            last
                        />
                    </Group>

                    <Group title="For clinicians">
                        <Row
                            icon="shield-checkmark-outline"
                            label="Review queue"
                            onPress={() => router.push('/clinician')}
                            last
                        />
                    </Group>

                    <Group title="Danger zone" danger>
                        <Row
                            icon="trash-outline"
                            label="Delete account"
                            onPress={handleDeleteAccount}
                            danger
                            last
                        />
                    </Group>

                    <Pressable
                        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
                        onPress={handleSignOut}
                        accessibilityRole="button"
                    >
                        <Text style={styles.signOutText}>Sign out</Text>
                        <Ionicons name="log-out-outline" size={18} color={Palette.primary} />
                    </Pressable>

                    <View style={styles.footer}>
                        <View style={styles.footerMark}>
                            <Ionicons name="add" size={18} color={Palette.primary} />
                        </View>
                        <Text style={styles.footerVersion}>
                            LabTrack v{Constants.expoConfig?.version ?? '1.0.0'}
                        </Text>
                        <Text style={styles.footerRights}>
                            All rights reserved, {new Date().getFullYear()} ©
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

/**
 * The kit's amber streak card.
 *
 * Zero is a real fact here — unlike a score pillar, which is null when nothing measured it —
 * so it is drawn rather than hidden. What changes is the copy: nobody who has not logged a
 * session yet has *broken* anything, so a zero reads as an invitation and loses the flame.
 * `null` means the request failed, and the card sits out entirely rather than claiming zero.
 */
const StreakCard = ({ streak, onPress }: { streak: number | null; onPress: () => void }) => {
    if (streak === null) return null;
    const active = streak > 0;

    return (
        <View style={styles.streakBlock}>
            <View style={styles.streakHead}>
                <Text style={styles.groupTitle}>Streak</Text>
                <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
                    <Text style={styles.seeMore}>See more</Text>
                </Pressable>
            </View>

            <Pressable
                style={({ pressed }) => [
                    styles.streakCard,
                    !active && styles.streakCardIdle,
                    pressed && styles.streakCardPressed,
                ]}
                onPress={onPress}
                accessibilityRole="button"
            >
                <View style={styles.streakTop}>
                    <View style={[styles.streakIcon, !active && styles.streakIconIdle]}>
                        <Ionicons
                            name={active ? 'flame' : 'flame-outline'}
                            size={20}
                            color={active ? Palette.amber : Palette.textSecondary}
                        />
                    </View>
                    <View style={styles.streakText}>
                        <Text style={[styles.streakTitle, !active && styles.streakTitleIdle]}>
                            {active ? 'You’re on fire!' : 'Start a streak'}
                        </Text>
                        <Text style={styles.streakBlurb}>
                            {active
                                ? 'Keep logging activity to hold it.'
                                : 'Log an activity today to begin one.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.streakDivider} />

                <View style={styles.streakFoot}>
                    <Text style={styles.streakFootLabel}>Current streak</Text>
                    <Text style={[styles.streakFootValue, !active && styles.streakFootValueIdle]}>
                        {streak} {streak === 1 ? 'day' : 'days'}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
};

/**
 * The slot the kit gives the referral card.
 *
 * There is no referral model, so it carries the prompt that does have a destination.
 * Shown to everyone: it cannot tell whether a test exists without a second request, so it
 * is written as an invitation rather than as a status.
 */
const PromoCard = ({ onPress }: { onPress: () => void }) => (
    <Pressable
        style={({ pressed }) => [styles.promo, pressed && styles.promoPressed]}
        onPress={onPress}
        accessibilityRole="button"
    >
        <View style={styles.promoText}>
            <Text style={styles.promoTitle}>Order a test to see more</Text>
            <Text style={styles.promoBlurb}>
                Every result you add sharpens your plan and your score.
            </Text>
            <View style={styles.promoLink}>
                <Text style={styles.promoLinkText}>Browse tests</Text>
                <Ionicons name="arrow-forward" size={14} color={Palette.primary} />
            </View>
        </View>
        <View style={styles.promoGlyph}>
            <Ionicons name="flask-outline" size={30} color={Palette.primaryLight} />
        </View>
    </Pressable>
);

const Group = ({
    title, children, danger,
}: { title: string; children: React.ReactNode; danger?: boolean }) => (
    <View style={styles.group}>
        <Text style={[styles.groupTitle, danger && styles.groupTitleDanger]}>{title}</Text>
        <View style={[styles.groupCard, danger && styles.groupCardDanger]}>{children}</View>
    </View>
);

const Row = ({
    icon, label, value, onPress, last, danger,
}: {
    icon: string;
    label: string;
    value?: string;
    onPress: () => void;
    last?: boolean;
    danger?: boolean;
}) => (
    <Pressable
        style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${value}` : label}
    >
        <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
            <Ionicons
                name={icon as never}
                size={18}
                color={danger ? Palette.danger : Palette.primary}
            />
        </View>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
            {label}
        </Text>
        {!!value && (
            <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </Pressable>
);

const AVATAR = 92;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 56 },

    cover: {
        height: 172,
        paddingTop: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    coverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    coverButton: {
        minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center', justifyContent: 'center',
    },
    coverScore: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white, includeFontPadding: false },

    identity: {
        alignItems: 'center',
        // Pulls the block up so the avatar straddles the cover's bottom edge.
        marginTop: -AVATAR / 2,
        paddingHorizontal: Spacing.xl,
        gap: 6,
    },
    avatarWrap: { marginBottom: Spacing.md },
    avatar: {
        width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 4, borderColor: Palette.canvas,
        // The canvas ring reads as part of the avatar, so an image that has not loaded
        // yet shows this rather than a hole in the middle of the identity block.
        backgroundColor: Palette.primarySurface,
    },
    avatarFallback: { backgroundColor: Palette.primarySurface },
    avatarInitials: { fontSize: 32, fontFamily: Fonts.bold, color: Palette.primary, includeFontPadding: false },
    avatarBadge: {
        position: 'absolute', right: 0, bottom: 0,
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: Palette.canvas,
    },

    bandPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        borderRadius: Radius.pill,
        backgroundColor: Palette.primarySurface,
        borderWidth: 1, borderColor: Palette.primaryLight,
    },
    bandPillText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.primaryDark },
    since: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },
    name: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, includeFontPadding: false },
    email: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },

    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.xl },

    streakBlock: { gap: Spacing.sm },
    streakHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    seeMore: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    streakCard: {
        backgroundColor: Palette.warningSurface,
        borderRadius: Radius.xl,
        borderWidth: 1, borderColor: '#FDE68A',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    streakCardIdle: { backgroundColor: Palette.background, borderColor: Palette.border },
    streakCardPressed: { opacity: 0.85 },
    streakTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    streakIcon: {
        width: 38, height: 38, borderRadius: Radius.md,
        backgroundColor: 'rgba(234,140,0,0.14)',
        alignItems: 'center', justifyContent: 'center',
    },
    streakIconIdle: { backgroundColor: Palette.borderLight },
    streakText: { flex: 1, gap: 2 },
    streakTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#92400E' },
    streakTitleIdle: { color: Palette.text },
    streakBlurb: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },
    streakDivider: { height: 1, backgroundColor: 'rgba(146,64,14,0.14)' },
    streakFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    streakFootLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    streakFootValue: { fontSize: 22, fontFamily: Fonts.bold, color: '#92400E', includeFontPadding: false },
    streakFootValueIdle: { color: Palette.textSecondary },

    promo: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.borderSlate,
        padding: Spacing.lg,
    },
    promoPressed: { backgroundColor: Palette.primarySurface },
    promoText: { flex: 1, gap: 4 },
    promoTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    promoBlurb: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.regular, color: Palette.textSecondary },
    promoLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    promoLinkText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    promoGlyph: {
        width: 56, height: 56, borderRadius: Radius.lg,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },

    group: { gap: Spacing.sm },
    groupTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    groupTitleDanger: { color: Palette.danger },
    groupCard: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.borderSlate,
        overflow: 'hidden',
    },
    groupCardDanger: { borderColor: '#FECACA' },

    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    rowLast: { borderBottomWidth: 0 },
    rowPressed: { backgroundColor: Palette.surface },
    rowIcon: {
        width: 34, height: 34, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    rowIconDanger: { backgroundColor: Palette.dangerSurface },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Palette.text },
    rowLabelDanger: { color: Palette.danger },
    // Shrinks before the label does, so a long device list truncates instead of squeezing
    // the thing the row is called.
    rowValue: { flexShrink: 1, fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted },

    signOut: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md,
    },
    signOutPressed: { opacity: 0.6 },
    signOutText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.primary },

    footer: { alignItems: 'center', gap: 4, paddingTop: Spacing.sm },
    footerMark: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    footerVersion: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.textSecondary },
    footerRights: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },
});
