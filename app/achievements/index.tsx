/**
 * The achievements hub — the design's frames 2, 6 and 7 behind one tab strip.
 *
 * ```
 * Achievement   count, three featured badges, "My Achievements" with progress
 * Leaderboard   your points and rank, then the board — opt-in, see below
 * Stats         everything you have done in LabTrack, by tracker
 * ```
 *
 * Five things about it are deliberate:
 *
 * 1. **Three tabs, one screen, one fetch each.** The kit draws them as three frames and it
 *    would have been easy to make them three routes. They are one screen because the tab
 *    strip is a filter over the same subject and a router push per tap would put a back
 *    stack between "Achievement" and "Stats". Each tab loads on first open and is then held,
 *    so switching back is instant.
 * 2. **Nothing model-backed is awaited before the first paint.** Every call here is a
 *    database read — the rule `app/nutrition/index.tsx` documents. `useFocusEffect` refires
 *    the Achievement tab on return, which is wanted: a badge earned while you were logging a
 *    meal should be waiting when you come back.
 * 3. **The celebration is mounted after the first paint, never before.** A modal over a
 *    spinner is a modal about nothing.
 * 4. **The leaderboard has to be joined.** It is off until somebody opts in, and the screen
 *    says what joining publishes before offering the switch — see `AchievementProfile` for
 *    why that is not a preference toggle.
 * 5. **"See All" goes to the grid, not to a longer list here.** Twenty-four rows with
 *    progress bars is a scroll; twenty-four tiles is a page. Frame 3 is that page.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity,
    ActivityIndicator, RefreshControl, Switch, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getAchievements, getLeaderboard, getAchievementStats,
    markCelebrationsSeen, updateLeaderboardProfile,
    type AchievementHub, type Leaderboard, type Stats, type Unlock,
} from '@/lib/achievements';
import { AchievementRow, FeaturedBadge } from '@/components/achievements/AchievementCards';
import { UnlockModal } from '@/components/achievements/UnlockModal';
import { BadgeMedal } from '@/components/achievements/BadgeMedal';
import { Avatar } from '@/components/Avatar';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';

type Tab = 'achievement' | 'leaderboard' | 'stats';

const TABS: { key: Tab; label: string }[] = [
    { key: 'achievement', label: 'Achievement' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'stats', label: 'Stats' },
];

export default function AchievementsHubScreen() {
    const router = useRouter();

    const [tab, setTab] = useState<Tab>('achievement');
    const [hub, setHub] = useState<AchievementHub | null>(null);
    const [board, setBoard] = useState<Leaderboard | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    /** The celebration queue, drained one modal at a time. */
    const [queue, setQueue] = useState<Unlock[]>([]);

    const load = useCallback(async () => {
        try {
            const data = await getAchievements();
            setHub(data);
            if (data.celebrate.length) setQueue(data.celebrate);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) router.replace('/(auth)/loginscreen');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // The other two tabs load on first open rather than up front: most visits are to the
    // first tab, and fetching a leaderboard nobody asked for is a round trip per app open.
    const openTab = async (next: Tab) => {
        setTab(next);
        try {
            if (next === 'leaderboard' && !board) setBoard(await getLeaderboard());
            if (next === 'stats' && !stats) setStats(await getAchievementStats());
        } catch {
            // A tab that could not load shows its empty state; the hub stays usable.
        }
    };

    const dismissCelebration = async () => {
        const [shown, ...rest] = queue;
        setQueue(rest);
        // Marked one at a time so quitting mid-run does not swallow the ones not yet seen.
        await markCelebrationsSeen([shown.key]).catch(() => { });
    };

    const featured = useMemo(() => pickFeatured(hub?.achievements ?? []), [hub]);
    const inProgress = useMemo(
        () => (hub?.achievements ?? [])
            .filter((a) => a.next !== null)
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5),
        [hub],
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.screen}>
            <SafeAreaView edges={['top']} style={styles.headerWrap}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={22} color={Palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Achievements</Text>
                    <TouchableOpacity
                        onPress={() => router.push('/achievements/all')}
                        hitSlop={12}
                        accessibilityLabel="All achievements"
                    >
                        <Ionicons name="grid-outline" size={20} color={Palette.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.tabs}>
                    {TABS.map((t) => (
                        <Pressable
                            key={t.key}
                            style={[styles.tab, tab === t.key && styles.tabOn]}
                            onPress={() => openTab(t.key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: tab === t.key }}
                        >
                            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        tintColor={Palette.primary}
                        onRefresh={async () => {
                            setRefreshing(true);
                            setBoard(null);
                            setStats(null);
                            await load();
                            if (tab === 'leaderboard') setBoard(await getLeaderboard().catch(() => null));
                            if (tab === 'stats') setStats(await getAchievementStats().catch(() => null));
                            setRefreshing(false);
                        }}
                    />
                }
            >
                {tab === 'achievement' && hub ? (
                    <>
                        <View style={styles.crown}>
                            <Text style={styles.crownCount}>{hub.summary.unlocked}</Text>
                            <Text style={styles.crownLabel}>
                                {hub.summary.unlocked === 1 ? 'Achievement unlocked' : 'Achievements unlocked'}
                            </Text>

                            <View style={styles.featuredRow}>
                                {featured.map((a) => (
                                    <FeaturedBadge
                                        key={a.key}
                                        achievement={a}
                                        onPress={() => router.push(`/achievements/${a.key}`)}
                                    />
                                ))}
                            </View>
                        </View>

                        <View style={styles.sectionHead}>
                            <Text style={styles.section}>My Achievements</Text>
                            <TouchableOpacity onPress={() => router.push('/achievements/all')}>
                                <Text style={styles.link}>See All</Text>
                            </TouchableOpacity>
                        </View>

                        {inProgress.length ? (
                            inProgress.map((a) => (
                                <AchievementRow
                                    key={a.key}
                                    achievement={a}
                                    onPress={() => router.push(`/achievements/${a.key}`)}
                                />
                            ))
                        ) : (
                            // Every ladder topped out. Rare, and worth saying rather than
                            // rendering an empty list that reads as a failure to load.
                            <Text style={styles.empty}>
                                Every badge is at its top level. There is nothing left to climb.
                            </Text>
                        )}

                        {hub.recent.length ? (
                            <>
                                <Text style={[styles.section, styles.sectionSpaced]}>Recently earned</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                                    {hub.recent.map((u) => (
                                        <Pressable
                                            key={`${u.key}-${u.level}`}
                                            style={styles.recent}
                                            onPress={() => router.push(`/achievements/${u.key}`)}
                                            accessibilityRole="button"
                                        >
                                            <BadgeMedal
                                                shape={u.shape} glyph={u.glyph} tone={u.tone}
                                                size={52} label={u.name}
                                            />
                                            <Text style={styles.recentName} numberOfLines={1}>{u.plainName}</Text>
                                            <Text style={styles.recentLevel}>Level {u.level}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </>
                        ) : null}
                    </>
                ) : null}

                {tab === 'leaderboard' ? (
                    <LeaderboardTab
                        data={board}
                        onChange={async (body) => {
                            await updateLeaderboardProfile(body).catch(() => { });
                            setBoard(await getLeaderboard().catch(() => board));
                        }}
                    />
                ) : null}

                {tab === 'stats' ? <StatsTab data={stats} /> : null}
            </ScrollView>

            {/* Mounted after the first paint, never over the spinner. */}
            <UnlockModal
                unlock={queue[0] ?? null}
                remaining={Math.max(0, queue.length - 1)}
                onDismiss={dismissCelebration}
                onOpen={async (key) => { await dismissCelebration(); router.push(`/achievements/${key}`); }}
            />
        </View>
    );
}

/**
 * The three across the top.
 *
 * The most recently unlocked first, then the closest to unlocking. A row of three locked
 * badges is what someone sees on day one and it is the right thing to show them — those are
 * the ones within reach — but as soon as anything is earned it belongs in that row.
 */
const pickFeatured = (all: AchievementHub['achievements']) => {
    const earned = all
        .filter((a) => a.unlocked && a.unlockedAt)
        .sort((a, b) => Date.parse(b.unlockedAt!) - Date.parse(a.unlockedAt!));
    const closest = all
        .filter((a) => !a.unlocked)
        .sort((a, b) => b.progress - a.progress);
    return [...earned, ...closest, ...all].slice(0, 3);
};

/* ------------------------------------------------------------------ *
 * Leaderboard
 * ------------------------------------------------------------------ */

function LeaderboardTab({
    data, onChange,
}: {
    data: Leaderboard | null;
    onChange: (body: { optedIn?: boolean; displayName?: string }) => Promise<void>;
}) {
    const [name, setName] = useState<string | null>(null);

    if (!data) {
        return <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>;
    }

    return (
        <>
            <View style={styles.youCard}>
                <Text style={styles.youPoints}>{data.you.points.toLocaleString()}pts</Text>
                <Text style={styles.youMeta}>
                    {data.you.unlocked} unlocked
                    {data.you.rank ? ` · #${data.you.rank} of ${data.participants}` : ' · not on the board'}
                </Text>
            </View>

            {/*
              * The switch, and above it what turning it on actually publishes. A health app
              * is the last place a scoreboard should be joinable by accident — see the note
              * at the top of `models/AchievementProfile.js`.
              */}
            <View style={styles.optIn}>
                <View style={styles.optInHead}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.optInTitle}>Show me on the leaderboard</Text>
                        <Text style={styles.optInBody}>
                            Other members would see the name below, your picture and your points.
                            Nothing about your health is ever shown, and you can leave at any time.
                        </Text>
                    </View>
                    <Switch
                        value={data.you.optedIn}
                        onValueChange={(v) => onChange({ optedIn: v })}
                        trackColor={{ true: Palette.primaryLight, false: Palette.border }}
                        thumbColor={data.you.optedIn ? Palette.primary : Palette.surface}
                    />
                </View>

                {data.you.optedIn ? (
                    <View style={styles.nameRow}>
                        <TextInput
                            style={styles.nameInput}
                            value={name ?? data.you.displayName}
                            onChangeText={setName}
                            placeholder="Display name"
                            placeholderTextColor={Palette.textMuted}
                            maxLength={40}
                            accessibilityLabel="Your leaderboard display name"
                        />
                        <TouchableOpacity
                            onPress={async () => {
                                if (name !== null) await onChange({ displayName: name });
                                setName(null);
                            }}
                            disabled={name === null || name === data.you.displayName}
                            accessibilityRole="button"
                        >
                            <Text style={[
                                styles.link,
                                (name === null || name === data.you.displayName) && styles.linkOff,
                            ]}>
                                Save
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            <Text style={styles.disclaimer}>{data.disclaimer}</Text>

            <Text style={[styles.section, styles.sectionSpaced]}>Leaderboard</Text>
            {data.board.length ? (
                data.board.map((row) => (
                    <View key={`${row.rank}-${row.name}`} style={[styles.boardRow, row.isYou && styles.boardRowYou]}>
                        <Text style={styles.boardRank}>{row.rank}</Text>
                        <Avatar uri={row.avatar} initials={initialsOf(row.name)} size={40} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.boardName} numberOfLines={1}>
                                {row.name}{row.isYou ? ' (you)' : ''}
                            </Text>
                            <Text style={styles.boardMeta}>{row.points.toLocaleString()} pts · {row.unlocked} badges</Text>
                        </View>
                    </View>
                ))
            ) : (
                <Text style={styles.empty}>
                    Nobody has joined the board yet. Turn the switch above on to be the first.
                </Text>
            )}
        </>
    );
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

function StatsTab({ data }: { data: Stats | null }) {
    if (!data) {
        return <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>;
    }

    return (
        <>
            <View style={styles.statHead}>
                <Stat
                    icon="calendar-outline"
                    value={data.header.memberSince ? String(new Date(data.header.memberSince).getFullYear()) : '—'}
                    label="Member since"
                />
                <Stat icon="time-outline" value={`${data.header.daysWithLabTrack}d`} label="With LabTrack" />
                <Stat icon="ribbon-outline" value={String(data.header.achievementsUnlocked)} label="Unlocked" />
            </View>

            {data.sections.map((section) => (
                <View key={section.title}>
                    <Text style={[styles.section, styles.sectionSpaced]}>{section.title}</Text>
                    <View style={styles.statCard}>
                        {section.rows.map((row, i) => (
                            <View key={row.label} style={[styles.statRow, i > 0 && styles.statRowDivided]}>
                                <Text style={styles.statLabel}>{row.label}</Text>
                                <Text style={styles.statValue}>{formatStat(row)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ))}

            {/*
              * The design puts a "Share my Stats" row of social icons here. There is none,
              * and the note says why instead: this screen is a list of everything somebody
              * has recorded, and a one-tap button that publishes all of it is a much bigger
              * decision than a badge. Sharing is per-badge, on the badge's own screen, with
              * a preview of exactly what goes out.
              */}
            <Text style={styles.disclaimer}>{data.note}</Text>
        </>
    );
}

const formatStat = (row: Stats['sections'][number]['rows'][number]) => {
    if (row.format === 'text') return String(row.value);
    const n = Number(row.value);
    if (row.format === 'km') return `${n.toLocaleString()} km`;
    if (row.format === 'days') return `${n.toLocaleString()} ${n === 1 ? 'day' : 'days'}`;
    return n.toLocaleString();
};

const Stat = ({
    icon, value, label,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) => (
    <View style={styles.stat}>
        <Ionicons name={icon} size={20} color={Palette.textSecondary} />
        <Text style={styles.statBig}>{value}</Text>
        <Text style={styles.statSmall}>{label}</Text>
    </View>
);

const initialsOf = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl },

    headerWrap: { backgroundColor: Palette.background, borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },

    tabs: {
        flexDirection: 'row',
        backgroundColor: Palette.primarySurface,
        margin: Spacing.lg,
        marginTop: 0,
        borderRadius: Radius.md,
        padding: 4,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
    tabOn: { backgroundColor: Palette.background, ...Shadow.card },
    tabText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tabTextOn: { fontFamily: Fonts.semibold, color: Palette.text },

    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },

    crown: {
        alignItems: 'center',
        backgroundColor: Palette.primarySurface,
        borderRadius: Radius.xl,
        paddingVertical: Spacing.xxl,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    crownCount: { fontSize: 52, fontFamily: Fonts.bold, color: Palette.text },
    crownLabel: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary, marginTop: -4 },
    featuredRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        gap: Spacing.md, marginTop: Spacing.xxl, alignSelf: 'stretch',
    },

    sectionHead: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    section: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.text },
    sectionSpaced: { marginTop: Spacing.xl, marginBottom: Spacing.md },
    link: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
    linkOff: { color: Palette.textMuted },
    empty: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingVertical: Spacing.xl, lineHeight: 20,
    },

    rail: { gap: Spacing.lg, paddingVertical: Spacing.sm, paddingRight: Spacing.lg },
    recent: { alignItems: 'center', gap: 4, width: 76 },
    recentName: { fontSize: 11, fontFamily: Fonts.semibold, color: Palette.text, textAlign: 'center' },
    recentLevel: { fontSize: 10, fontFamily: Fonts.regular, color: Palette.textMuted },

    youCard: {
        alignItems: 'center', backgroundColor: Palette.background,
        borderRadius: Radius.xl, paddingVertical: Spacing.xxl, ...Shadow.card,
    },
    youPoints: { fontSize: 34, fontFamily: Fonts.bold, color: Palette.text },
    youMeta: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

    optIn: {
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        padding: Spacing.lg, marginTop: Spacing.lg, gap: Spacing.md, ...Shadow.card,
    },
    optInHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    optInTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    optInBody: {
        fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary,
        lineHeight: 18, marginTop: 2,
    },
    nameRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.md,
    },
    nameInput: {
        flex: 1, borderWidth: 1, borderColor: Palette.borderStrong, borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md, paddingVertical: 10,
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.text,
    },

    disclaimer: {
        fontSize: 11, lineHeight: 17, fontFamily: Fonts.regular,
        color: Palette.textMuted, marginTop: Spacing.lg,
    },

    boardRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.card,
    },
    boardRowYou: { borderWidth: 1, borderColor: Palette.primaryPale },
    boardRank: { width: 22, fontSize: 13, fontFamily: Fonts.bold, color: Palette.primary },
    boardName: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    boardMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    statHead: { flexDirection: 'row', gap: Spacing.md },
    stat: {
        flex: 1, alignItems: 'center', gap: 2,
        backgroundColor: Palette.background, borderRadius: Radius.lg,
        paddingVertical: Spacing.lg, ...Shadow.card,
    },
    statBig: { fontSize: 20, fontFamily: Fonts.bold, color: Palette.text },
    statSmall: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary },
    statCard: { backgroundColor: Palette.background, borderRadius: Radius.lg, ...Shadow.card },
    statRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
    },
    statRowDivided: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    statLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary },
    statValue: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
});
