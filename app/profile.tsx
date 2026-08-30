/**
 * The person's account, reached from the avatar in the home header.
 *
 * Was a tab. It lost that slot to the AI assistant, which is something people open many
 * times a session, where this is opened to change a setting and then left. Being a pushed
 * stack route also gives it the back affordance a destination screen should have — as a tab
 * it was a dead end you could only leave by picking another tab.
 *
 * Visual language follows the turing kit's "Profile Setup & Account Completion" flow
 * (`Design/profile.fig`): a slate canvas, white cards on a 16pt gutter, a large
 * left-aligned title, and a single indigo primary action. Three deliberate calls:
 *
 * - **Nine identical rows became four labelled groups.** The flat list gave "Logout" and
 *   "My Health Plans" the same weight. Grouping by what the row is *about* means someone
 *   looking for their results never reads the billing rows.
 * - **Logout is outlined, not filled.** It was the only filled button on the screen, which
 *   made the loudest control the one that signs you out.
 * - **The avatar falls back to initials.** `profileImage` is not a field on
 *   `models/userModel.js`, so the old `<Image>` rendered an empty grey circle for
 *   every user. It stays wired for when the field lands.
 *
 * The score hero is the kit's own screen (the three `LabTrack Score` frames, 88/62/31)
 * rendered as a card: white circle, oversized numeral, band sentence, two counts. It reuses
 * `computeHealthScore` rather than deriving a second number — the home screen draws the
 * same score as a radar, and two screens disagreeing about one number is worse than either
 * presentation being imperfect. Home carries the pillar explainer sheet; here the
 * disclaimer travels with the number, because this is where it is read as an attribute of
 * the account rather than as today's reading.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet,
} from 'react-native';
import { api, ApiError } from '@/lib/api';
import { getUserId, signOut } from '@/lib/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, Fonts, Radius, Spacing } from '@/constants/theme';
import { getLatestBiomarkers } from '@/lib/biomarkers';
import { getScore, type HealthScore } from '@/lib/score';
import type { User, BiomarkerSummary } from '@/types/api';
/** Shown until the score loads. A placeholder, never a zero — see `lib/score.ts`. */
const EMPTY_SCORE: HealthScore = {
  value: null,
  band: null,
  bandLabel: null,
  headline: 'Log a day or upload a result to unlock your score',
  pillars: [],
  coverage: { scored: 0, observed: 0, reported: 0, total: 0, observedWeight: 0 },
  windowDays: 30,
  computedAt: new Date().toISOString(),
  change: null,
  disclaimer: '',
  bands: [],
};


type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** `profileImage` is not on the user model yet; the avatar falls back to initials. */
type ProfileUser = Partial<User & { profileImage: string }>;

/** First letters of the name, or of the email when the assessment has not run yet. */
const initialsOf = (user: ProfileUser) => {
  const letters = `${user.firstName ?? ''} ${user.lastName ?? ''}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]);
  if (letters.length) return letters.slice(0, 2).join('').toUpperCase();
  return (user.email?.[0] ?? '?').toUpperCase();
};

const ProfileScreen = () => {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser>({});
  const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * The score comes from the server now, so this screen and the home screen cannot disagree
   * about one number — the concern the header of this file already raises. See `lib/score.ts`.
   */
  const [score, setScore] = useState<HealthScore>(EMPTY_SCORE);

  const load = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) {
      router.replace('/(auth)/loginscreen');
      return;
    }

    // Settled rather than all: the settings rows below do not depend on the score, so a
    // biomarker or plan hiccup should cost the hero, not the whole screen.
    // The plan is no longer fetched here: the score's plan pillar is computed server-side
    // now, and this screen has nothing else to say about it.
    const [userRes, bioRes, scoreRes] = await Promise.allSettled([
      api.get<ProfileUser>(`/users/${userId}`),
      getLatestBiomarkers(),
      getScore(),
    ]);

    if (userRes.status === 'fulfilled') {
      setUser(userRes.value);
    } else if (userRes.reason instanceof ApiError && userRes.reason.isAuthError) {
      router.replace('/(auth)/loginscreen');
      return;
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Unable to fetch user data' });
    }

    if (bioRes.status === 'fulfilled') setBiomarkers(bioRes.value.biomarkers ?? []);
    if (scoreRes.status === 'fulfilled') setScore(scoreRes.value);
    setLoading(false);
  }, [router]);

  // Refetches on focus so a name changed in /users is not stale here. `loading` is only
  // ever set true on mount, so returning to the screen does not flash a spinner.
  useFocusEffect(useCallback(() => { load(); }, [load]));



  /** The two counts the kit puts under the number, each pointing at a real record. */
  const outOfRange = useMemo(
    () => biomarkers.filter((b) => b.flag !== 'normal' && b.flag !== 'unknown').length,
    [biomarkers],
  );
  const toImprove = useMemo(
    () => score.pillars.filter((p) => p.value != null && p.value < 70).length,
    [score],
  );
  /**
   * A profile with height, weight and lifestyle answers clears the three-pillar bar with
   * no labs at all. Showing "0 out of range" there states a clean bill of health over an
   * empty record, so the marker count only appears once a marker has been evaluated.
   */
  const hasMarkers = useMemo(
    () => biomarkers.some((b) => b.flag !== 'unknown'),
    [biomarkers],
  );

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/loginscreen');
  };

  // These three have no screen behind them yet. A tap that does nothing at all reads as a
  // broken row, so say so until the routes exist.
  const notYet = (what: string) =>
    Toast.show({ type: 'info', text1: `${what} isn't available yet`, text2: 'It is coming in a later release' });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </SafeAreaView>
    );
  }

  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav row — the title sits below it, large and left-aligned, as the kit draws it */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton} accessibilityLabel="Go back">
            <MaterialIcons name="chevron-left" size={28} color={Palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/notification-settings')}
            style={styles.navButton}
            accessibilityLabel="Notification settings"
          >
            <MaterialIcons name="notifications-none" size={24} color={Palette.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Profile</Text>

        {/* Identity */}
        <TouchableOpacity style={styles.identity} onPress={() => router.push('/users')} activeOpacity={0.7}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initialsOf(user)}</Text>
            </View>
          )}
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {fullName || 'Your profile'}
            </Text>
            <Text style={styles.identitySub} numberOfLines={1}>
              {user.email || 'Show profile'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={Palette.textMuted} />
        </TouchableOpacity>

        <ScoreHero score={score} outOfRange={outOfRange} toImprove={toImprove} hasMarkers={hasMarkers} />

        {/* Prompt. Shown to everyone today — it has no way to know whether a test exists
            without a second request, so it reads as an invitation rather than a status. */}
        <TouchableOpacity style={styles.promo} onPress={() => router.push('/(tabs)/orders')} activeOpacity={0.8}>
          <View style={styles.promoIcon}>
            <MaterialIcons name="biotech" size={22} color={Palette.primary} />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.promoTitle}>Take your first test</Text>
            <Text style={styles.promoSub}>Monitoring your health starts with one sample.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={Palette.primary} />
        </TouchableOpacity>

        <Section title="Your health">
          <Row icon="event-note" label="My Health Plans" onPress={() => router.push('/myplans')} />
          <Row icon="favorite-border" label="Health profile" onPress={() => router.push('/health-assessment/review')} />
          <Row icon="receipt-long" label="Your orders" onPress={() => router.push('/orders-history')} last />
        </Section>

        <Section title="Assistant and alerts">
          <Row icon="auto-awesome" label="AI assistant" onPress={() => router.push('/assistant/settings')} />
          <Row icon="notifications-none" label="Notifications" onPress={() => router.push('/notification-settings')} last />
        </Section>

        <Section title="Account">
          <Row icon="person-outline" label="Personal information" onPress={() => notYet('Personal information')} />
          <Row icon="lock-outline" label="Login and security" onPress={() => notYet('Login and security')} />
          <Row icon="credit-card" label="Payments and payouts" onPress={() => notYet('Payments and payouts')} last />
        </Section>

        {/* Separate group: the screen behind it requires professional credentials, so it is
            not one of "your" settings the way the rows above are. */}
        <Section title="For clinicians">
          <Row icon="verified-user" label="Clinician review queue" onPress={() => router.push('/clinician')} last />
        </Section>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={18} color={Palette.danger} />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>
          Version {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * The kit's score screen, as a card.
 *
 * The plate is a circle because the kit's is (`rectangle*CornerRadius: 9999` on a 212pt
 * frame), and the numeral is the largest thing on the screen for the same reason it is
 * there: it is the one number people come back to check.
 *
 * With fewer than three scored pillars `computeHealthScore` returns a null value rather
 * than a flattering guess, so the plate shows `--` and the counts are withheld. The marker
 * count is withheld separately, whenever nothing has been range-evaluated — a "0 out of
 * range" next to an empty record would read as a clean bill of health.
 */
const ScoreHero = ({
  score, outOfRange, toImprove, hasMarkers,
}: { score: HealthScore; outOfRange: number; toImprove: number; hasMarkers: boolean }) => {
  const hasScore = score.value != null;
  return (
    <LinearGradient
      colors={Palette.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroEyebrow}>LabTrack Score</Text>

      <View style={styles.plateWrap}>
        <View style={styles.plate}>
          <Text style={styles.plateScore}>{score.value ?? '--'}</Text>
        </View>
        <View style={styles.plateBadge}>
          <MaterialIcons name="monitor-heart" size={20} color={Palette.white} />
        </View>
      </View>

      <Text style={styles.heroHeadline}>{score.headline}</Text>

      {hasScore && (
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <MaterialIcons name="lightbulb" size={18} color={Palette.white} />
            <Text style={styles.heroStatText}>
              {toImprove} to improve
            </Text>
          </View>
          {hasMarkers && (
            <View style={styles.heroStat}>
              <MaterialIcons name="warning" size={18} color={Palette.white} />
              <Text style={styles.heroStatText}>
                {outOfRange} out of range
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.heroDisclaimer}>{score.disclaimer}</Text>
    </LinearGradient>
  );
};

/** A labelled group of rows. The label carries the grouping; the card carries the edge. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View>
    <Text style={styles.sectionLabel}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const Row = ({
  icon, label, onPress, last,
}: { icon: IconName; label: string; onPress: () => void; last?: boolean }) => (
  <TouchableOpacity
    style={[styles.row, last && styles.rowLast]}
    onPress={onPress}
    activeOpacity={0.6}
    accessibilityRole="button"
  >
    <View style={styles.rowIcon}>
      <MaterialIcons name={icon} size={18} color={Palette.primary} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <MaterialIcons name="chevron-right" size={20} color={Palette.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.canvas },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 48 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.canvas,
  },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  // Negative inset so the chevron's own padding does not push the row off the 16pt gutter
  // the rest of the screen aligns to.
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginHorizontal: -8 },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Palette.text,
    marginBottom: Spacing.xl,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.borderSlate,
    padding: Spacing.lg,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    backgroundColor: Palette.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 18, fontFamily: Fonts.bold, color: Palette.primary },
  identityText: { flex: 1 },
  identityName: { fontSize: 17, fontFamily: Fonts.bold, color: Palette.text },
  identitySub: { fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: 2 },

  hero: {
    borderRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    color: Palette.white,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  // Room for the badge, which hangs 14pt below the plate.
  plateWrap: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xxl },
  plate: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateScore: {
    fontSize: 54,
    fontFamily: Fonts.bold,
    color: Palette.primary,
    includeFontPadding: false,
  },
  plateBadge: {
    position: 'absolute',
    bottom: -14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryDark,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeadline: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Palette.white,
    textAlign: 'center',
    lineHeight: 24,
  },
  heroStats: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.lg },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatText: { fontSize: 14, fontFamily: Fonts.medium, color: Palette.white },
  heroDisclaimer: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.lg,
  },

  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.primaryDeep },
  promoSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Palette.primaryDark,
    marginTop: 2,
    lineHeight: 17,
  },

  sectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    color: Palette.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Palette.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.borderSlate,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: Palette.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Palette.text },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxxl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  logoutButtonText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.danger },

  versionText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    marginTop: Spacing.lg,
  },
});

export default ProfileScreen;
