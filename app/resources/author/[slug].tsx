/**
 * Speaker Details — the kit's frame 18.
 *
 * Cover portrait, a floating identity card with the speciality chip, follower and course
 * counts, Chat and Follow; then About / Courses / Videos tabs, the credentials list, the
 * rating breakdown, contact details and socials.
 *
 * Two departures from the kit, both because the alternative would be a dummy control:
 *
 *   - **Chat is only drawn when the author is also a bookable clinician.** `professionalId`
 *     is what says so. There is no messaging system for a writer who is not in the
 *     professional directory, and a Chat button that opens nothing is worse than no button.
 *   - **The star breakdown shows only the buckets that can receive votes.** Articles are
 *     rated Bad / Neutral / Great, which map to 1 / 3 / 5, so 2 and 4 are drawn empty rather
 *     than back-filled to make the chart look fuller. See `utils/resourceRating.js`.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, useWindowDimensions, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/lib/api';
import {
    getAuthor, followAuthor, routeFor, formatCount,
    type ResourceAuthorDetail, type ResourceCard,
} from '@/lib/resources';
import { AutoCard } from '@/components/resources/ResourceCards';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';

const TABS = ['About', 'Courses', 'Videos'] as const;
type Tab = typeof TABS[number];

const SOCIAL_ICON: Record<string, string> = {
    facebook: 'logo-facebook',
    instagram: 'logo-instagram',
    linkedin: 'logo-linkedin',
    x: 'logo-twitter',
    discord: 'logo-discord',
    dribbble: 'logo-dribbble',
    website: 'globe-outline',
};

export default function AuthorScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const { width } = useWindowDimensions();

    const [author, setAuthor] = useState<ResourceAuthorDetail | null>(null);
    const [resources, setResources] = useState<ResourceCard[]>([]);
    const [tab, setTab] = useState<Tab>('About');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await getAuthor(String(slug));
            setAuthor(data.author);
            setResources(data.resources);
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof Error ? err.message : 'Could not load this speaker');
        } finally {
            setLoading(false);
        }
    }, [slug, router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onFollow = async () => {
        if (!author) return;
        const next = !author.following;
        setAuthor((a) => a && ({
            ...a,
            following: next,
            followerCount: Math.max(0, a.followerCount + (next ? 1 : -1)),
        }));
        try {
            const result = await followAuthor(author.slug, next);
            setAuthor((a) => a && ({ ...a, following: result.following, followerCount: result.followerCount }));
        } catch {
            setAuthor((a) => a && ({
                ...a,
                following: !next,
                followerCount: Math.max(0, a.followerCount + (next ? -1 : 1)),
            }));
        }
    };

    /**
     * The kit draws a copy button here. This dials, mails or opens instead.
     *
     * `expo-clipboard` is a native module and is not installed, so a copy button would mean
     * a new native dependency and a rebuild for an affordance that is one step short of
     * what a person actually wants — which is to call or email. Where the platform cannot
     * handle the scheme (a fax number on a phone), the row is inert rather than throwing.
     */
    const reach = (label: string, value: string) => {
        const url = label === 'Email' ? `mailto:${value}` : `tel:${value.replace(/[^+\d]/g, '')}`;
        Linking.openURL(url).catch(() =>
            Alert.alert(label, value));
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            </SafeAreaView>
        );
    }

    if (error || !author) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <View style={styles.centre}>
                    <Ionicons name="person-outline" size={36} color={Palette.textMuted} />
                    <Text style={styles.errorText}>{error ?? 'Speaker not found'}</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.errorAction}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const cover = author.coverImage ?? author.avatar;
    const heroHeight = Math.min(340, width * 0.85);
    const socials = Object.entries(author.socials);
    const contactRows: [string, string | null][] = [
        ['Tel', author.contact.tel],
        ['Email', author.contact.email],
        ['Fax', author.contact.fax],
    ];
    const maxBucket = Math.max(1, ...Object.values(author.rating.histogram));

    const open = (card: ResourceCard) => {
        const { pathname, params } = routeFor(card);
        router.push({ pathname: pathname as any, params });
    };

    const tabItems = tab === 'Courses' ? author.courses : tab === 'Videos' ? author.videos : [];

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View>
                    {cover
                        ? <Image source={{ uri: cover }} style={[styles.hero, { height: heroHeight }]} />
                        : <View style={[styles.hero, { height: heroHeight, backgroundColor: Palette.borderLight }]} />}

                    <SafeAreaView edges={['top']} style={styles.heroBar}>
                        <TouchableOpacity style={styles.heroButton} onPress={() => router.back()} hitSlop={10}>
                            <Ionicons name="chevron-back" size={22} color={Palette.text} />
                        </TouchableOpacity>
                        <Text style={styles.heroTitle}>Speaker Details</Text>
                        <View style={styles.heroButtonSpacer} />
                    </SafeAreaView>
                </View>

                <View style={styles.body}>
                    <View style={styles.identityCard}>
                        {!!author.speciality && (
                            <View style={styles.specialityChip}>
                                <Ionicons name="medkit-outline" size={13} color={Palette.white} />
                                <Text style={styles.specialityText}>{author.speciality}</Text>
                            </View>
                        )}
                        <Text style={styles.name}>{author.name}</Text>

                        <View style={styles.countRow}>
                            <View style={styles.countItem}>
                                <Ionicons name="people-outline" size={16} color={Palette.textSecondary} />
                                <Text style={styles.countText}>
                                    {formatCount(author.followerCount)} Followers
                                </Text>
                            </View>
                            <View style={styles.countItem}>
                                <Ionicons name="book-outline" size={16} color={Palette.textSecondary} />
                                <Text style={styles.countText}>
                                    {author.courseCount} Course{author.courseCount === 1 ? '' : 's'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.buttonRow}>
                            {/* Only where the author is also bookable — see the file header. */}
                            {!!author.professionalId && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => router.push({
                                        pathname: '/professionalDetails',
                                        params: { id: author.professionalId! },
                                    })}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.secondaryText}>Consult</Text>
                                    <Ionicons name="calendar-outline" size={16} color={Palette.primary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.primaryButton, author.following && styles.followingButton]}
                                onPress={onFollow}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.primaryText, author.following && styles.followingText]}>
                                    {author.following ? 'Following' : 'Follow'}
                                </Text>
                                <Ionicons
                                    name={author.following ? 'checkmark' : 'person-add-outline'}
                                    size={16}
                                    color={author.following ? Palette.primary : Palette.white}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tabBar}>
                        {TABS.map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[styles.tab, tab === item && styles.tabActive]}
                                onPress={() => setTab(item)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {tab === 'About' ? (
                        <>
                            {!!author.bio && (
                                <>
                                    <Text style={styles.sectionTitle}>Overview</Text>
                                    <Text style={styles.bio}>{author.bio}</Text>
                                </>
                            )}

                            {author.achievements.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Credentials &amp; Achievements</Text>
                                    <View style={styles.card}>
                                        {author.achievements.map((achievement, index) => (
                                            <View
                                                key={achievement.title}
                                                style={[styles.achievementRow, index > 0 && styles.divided]}
                                            >
                                                <Ionicons
                                                    name={(achievement.icon || 'ribbon-outline') as any}
                                                    size={24}
                                                    color={Palette.text}
                                                />
                                                <View style={styles.flex}>
                                                    <Text style={styles.achievementTitle}>{achievement.title}</Text>
                                                    {!!achievement.detail && (
                                                        <Text style={styles.achievementDetail}>{achievement.detail}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            <Text style={styles.sectionTitle}>Rating</Text>
                            <View style={styles.ratingCard}>
                                <View style={styles.ratingLeft}>
                                    <Text style={styles.ratingBig}>
                                        {author.rating.average != null ? author.rating.average.toFixed(1) : '—'}
                                    </Text>
                                    <Text style={styles.ratingLabel}>Avg. Rating</Text>
                                    <Text style={styles.ratingCount}>
                                        {author.rating.count
                                            ? `${formatCount(author.rating.count)} rating${author.rating.count === 1 ? '' : 's'}`
                                            : 'Not yet rated'}
                                    </Text>
                                </View>
                                <View style={styles.ratingRight}>
                                    {[5, 4, 3, 2, 1].map((star) => {
                                        const value = author.rating.histogram[String(star)] ?? 0;
                                        return (
                                            <View key={star} style={styles.histogramRow}>
                                                <Text style={styles.histogramStar}>{star}</Text>
                                                <Ionicons name="star" size={13} color={Palette.amber} />
                                                <View style={styles.histogramTrack}>
                                                    <View style={[
                                                        styles.histogramFill,
                                                        { width: `${(value / maxBucket) * 100}%` },
                                                    ]} />
                                                </View>
                                                <Text style={styles.histogramCount}>{value}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>

                            {contactRows.some(([, value]) => value) && (
                                <>
                                    <Text style={styles.sectionTitle}>Contact Information</Text>
                                    <View style={styles.card}>
                                        {contactRows.filter(([, value]) => value).map(([label, value], index) => (
                                            <View key={label} style={[styles.contactRow, index > 0 && styles.divided]}>
                                                <Text style={styles.contactLabel}>{label}</Text>
                                                <Text style={styles.contactValue} numberOfLines={1}>{value}</Text>
                                                <TouchableOpacity onPress={() => reach(label, value!)} hitSlop={10}>
                                                    <Ionicons
                                                        name={label === 'Email' ? 'mail-outline' : 'call-outline'}
                                                        size={18}
                                                        color={Palette.textSecondary}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {socials.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Socials</Text>
                                    <View style={styles.socialCard}>
                                        {socials.map(([key, url]) => (
                                            <TouchableOpacity
                                                key={key}
                                                onPress={() => Linking.openURL(url).catch(() => { })}
                                                hitSlop={8}
                                            >
                                                <Ionicons
                                                    name={(SOCIAL_ICON[key] ?? 'link-outline') as any}
                                                    size={26}
                                                    color={Palette.primary}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {resources.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Everything by {author.name.split(' ')[0]}</Text>
                                    <View style={styles.stack}>
                                        {resources.slice(0, 6).map((card) => (
                                            <AutoCard key={card.id} card={card} variant="row" onPress={() => open(card)} />
                                        ))}
                                    </View>
                                </>
                            )}
                        </>
                    ) : (
                        <View style={styles.stack}>
                            {tabItems.length ? tabItems.map((card) => (
                                <AutoCard key={card.id} card={card} variant="row" onPress={() => open(card)} />
                            )) : (
                                <Text style={styles.emptyTab}>
                                    Nothing published under {tab.toLowerCase()} yet.
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    flex: { flex: 1 },
    errorText: { fontSize: 15, fontFamily: Fonts.medium, color: Palette.textSecondary },
    errorAction: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    scroll: { paddingBottom: Spacing.xxxl * 2 },
    hero: { width: '100%' },
    heroBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
    },
    heroButton: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center', justifyContent: 'center',
    },
    heroButtonSpacer: { width: 36 },
    heroTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    body: { paddingHorizontal: Spacing.xl },
    identityCard: {
        marginTop: -Spacing.xxxl, padding: Spacing.xl, alignItems: 'center',
        borderRadius: Radius.xl, backgroundColor: Palette.background, ...Shadow.card,
    },
    specialityChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        borderRadius: Radius.pill, backgroundColor: Palette.text,
    },
    specialityText: { fontSize: 12, fontFamily: Fonts.semibold, color: Palette.white },
    name: { fontSize: 21, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center', marginTop: Spacing.md, lineHeight: 28 },

    countRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.md },
    countItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    countText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },

    buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
    secondaryButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.primary, backgroundColor: Palette.primarySurface,
    },
    secondaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },
    primaryButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md, borderRadius: Radius.lg, backgroundColor: Palette.primary,
    },
    followingButton: { backgroundColor: Palette.primarySurface, borderWidth: 1, borderColor: Palette.primary },
    primaryText: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.white },
    followingText: { color: Palette.primary },

    tabBar: {
        flexDirection: 'row', marginTop: Spacing.xl, padding: 4,
        borderRadius: Radius.lg, backgroundColor: Palette.surface,
    },
    tab: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
    tabActive: { backgroundColor: Palette.background, ...Shadow.card },
    tabText: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.textSecondary },
    tabTextActive: { color: Palette.text, fontFamily: Fonts.bold },

    sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    bio: { fontSize: 15, fontFamily: Fonts.regular, color: Palette.text, lineHeight: 24 },

    card: {
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        backgroundColor: Palette.background, ...Shadow.card,
    },
    divided: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    achievementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg, padding: Spacing.lg },
    achievementTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text },
    achievementDetail: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2, lineHeight: 19 },

    ratingCard: {
        flexDirection: 'row', gap: Spacing.xl, padding: Spacing.lg,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.borderLight,
        backgroundColor: Palette.background, ...Shadow.card,
    },
    ratingLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 92 },
    ratingBig: { fontSize: 38, fontFamily: Fonts.bold, color: Palette.text },
    ratingLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: 4 },
    ratingCount: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2, textAlign: 'center' },
    ratingRight: { flex: 1, gap: 6, justifyContent: 'center' },
    histogramRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    histogramStar: { fontSize: 12, fontFamily: Fonts.medium, color: Palette.textSecondary, width: 10 },
    histogramTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Palette.borderLight, overflow: 'hidden' },
    histogramFill: { height: '100%', borderRadius: 3, backgroundColor: Palette.primary },
    histogramCount: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textSecondary, width: 34, textAlign: 'right' },

    contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    contactLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Palette.text, width: 56 },
    contactValue: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary, textAlign: 'right' },

    socialCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl,
        padding: Spacing.lg, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.borderLight, backgroundColor: Palette.background,
    },

    stack: { gap: Spacing.md },
    emptyTab: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', paddingVertical: Spacing.xxxl,
    },
});
